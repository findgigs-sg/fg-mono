import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { eq, inArray } from "@findgigs/db";
import {
  EmployerProfile,
  JobCategory,
  Profile,
  Venue,
  WorkerJobCategory,
  WorkerProfile,
} from "@findgigs/db/schema";
import {
  EmployerProfileSchema,
  SetRoleSchema,
  WorkerProfileSchema,
} from "@findgigs/validators";

import { protectedProcedure } from "../trpc";

export const profileRouter = {
  /**
   * Returns the full profile snapshot for the current user.
   * Drives the auth-gate routing logic: which onboarding step to show,
   * or the role-appropriate home screen when onboarding is complete.
   */
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [profile, workerProfile, employerProfile, venues] = await Promise.all(
      [
        ctx.db.query.Profile.findFirst({
          where: eq(Profile.userId, userId),
        }),
        ctx.db.query.WorkerProfile.findFirst({
          where: eq(WorkerProfile.userId, userId),
        }),
        ctx.db.query.EmployerProfile.findFirst({
          where: eq(EmployerProfile.userId, userId),
        }),
        ctx.db.query.Venue.findMany({
          where: eq(Venue.employerUserId, userId),
        }),
      ],
    );

    let workerJobCategorySlugs: string[] = [];
    if (workerProfile) {
      const rows = await ctx.db
        .select({ slug: JobCategory.slug })
        .from(WorkerJobCategory)
        .innerJoin(
          JobCategory,
          eq(WorkerJobCategory.jobCategoryId, JobCategory.id),
        )
        .where(eq(WorkerJobCategory.workerUserId, userId));
      workerJobCategorySlugs = rows.map((r) => r.slug);
    }

    return {
      profile: profile ?? null,
      workerProfile: workerProfile ?? null,
      employerProfile: employerProfile ?? null,
      workerJobCategorySlugs,
      venues,
    };
  }),

  /**
   * Sets the user's role (worker or employer). Idempotent if the same
   * role is passed. Throws CONFLICT if a different role is already set —
   * role is immutable for MVP (FIN-8).
   */
  setRole: protectedProcedure
    .input(SetRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await ctx.db.query.Profile.findFirst({
        where: eq(Profile.userId, userId),
      });
      if (existing) {
        if (existing.role !== input.role) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Role is locked and cannot be changed.",
          });
        }
        return existing;
      }

      const [created] = await ctx.db
        .insert(Profile)
        .values({ userId, role: input.role })
        .returning();
      return created;
    }),

  /**
   * Completes worker onboarding (FIN-9). Upserts WorkerProfile, replaces
   * job category join rows, and sets onboarding_complete = true. All in a tx.
   */
  completeWorkerProfile: protectedProcedure
    .input(WorkerProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const profile = await ctx.db.query.Profile.findFirst({
        where: eq(Profile.userId, userId),
      });
      if (profile?.role !== "worker") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must select the worker role first.",
        });
      }

      const { jobCategories, ...workerFields } = input;

      await ctx.db.transaction(async (tx) => {
        const existingWorker = await tx.query.WorkerProfile.findFirst({
          where: eq(WorkerProfile.userId, userId),
        });
        if (existingWorker) {
          await tx
            .update(WorkerProfile)
            .set(workerFields)
            .where(eq(WorkerProfile.userId, userId));
        } else {
          await tx.insert(WorkerProfile).values({ userId, ...workerFields });
        }

        const categoryRows = await tx.query.JobCategory.findMany({
          where: inArray(JobCategory.slug, jobCategories),
        });
        const categoryIds = categoryRows.map((c) => c.id);

        await tx
          .delete(WorkerJobCategory)
          .where(eq(WorkerJobCategory.workerUserId, userId));
        if (categoryIds.length > 0) {
          await tx.insert(WorkerJobCategory).values(
            categoryIds.map((jobCategoryId) => ({
              workerUserId: userId,
              jobCategoryId,
            })),
          );
        }

        await tx
          .update(Profile)
          .set({ onboardingComplete: true })
          .where(eq(Profile.userId, userId));
      });

      return { success: true as const };
    }),

  /**
   * Completes employer profile step (FIN-10). Does NOT set
   * onboarding_complete — the employer still needs to create a venue
   * (FIN-11) before onboarding is done.
   */
  completeEmployerProfile: protectedProcedure
    .input(EmployerProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const profile = await ctx.db.query.Profile.findFirst({
        where: eq(Profile.userId, userId),
      });
      if (profile?.role !== "employer") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must select the employer role first.",
        });
      }

      const existing = await ctx.db.query.EmployerProfile.findFirst({
        where: eq(EmployerProfile.userId, userId),
      });
      if (existing) {
        await ctx.db
          .update(EmployerProfile)
          .set(input)
          .where(eq(EmployerProfile.userId, userId));
      } else {
        await ctx.db.insert(EmployerProfile).values({ userId, ...input });
      }

      return { success: true as const };
    }),
} satisfies TRPCRouterRecord;
