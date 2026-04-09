import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq } from "@findgigs/db";
import { EmployerProfile, Profile, Venue } from "@findgigs/db/schema";
import { VenueSchema } from "@findgigs/validators";

import { protectedProcedure } from "../trpc";

export const venueRouter = {
  /**
   * List all venues owned by the current employer.
   */
  listMine: protectedProcedure.query(({ ctx }) => {
    return ctx.db.query.Venue.findMany({
      where: eq(Venue.employerUserId, ctx.session.user.id),
      orderBy: desc(Venue.createdAt),
    });
  }),

  /**
   * Create a venue (FIN-11). Requires an employer role and an existing
   * employer profile. On first venue create, also sets
   * profile.onboarding_complete = true so the employer lands on home.
   */
  create: protectedProcedure
    .input(VenueSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const profile = await ctx.db.query.Profile.findFirst({
        where: eq(Profile.userId, userId),
      });
      if (profile?.role !== "employer") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only employers can create venues.",
        });
      }

      const employerProfile = await ctx.db.query.EmployerProfile.findFirst({
        where: eq(EmployerProfile.userId, userId),
      });
      if (!employerProfile) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Complete your employer profile before adding a venue.",
        });
      }

      const createdVenue = await ctx.db.transaction(async (tx) => {
        const [venue] = await tx
          .insert(Venue)
          .values({ employerUserId: userId, ...input })
          .returning();
        if (!venue) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create venue.",
          });
        }

        if (!profile.onboardingComplete) {
          await tx
            .update(Profile)
            .set({ onboardingComplete: true })
            .where(eq(Profile.userId, userId));
        }

        return venue;
      });

      return createdVenue;
    }),

  /**
   * Delete a venue owned by the current employer.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const result = await ctx.db
        .delete(Venue)
        .where(and(eq(Venue.id, input.id), eq(Venue.employerUserId, userId)))
        .returning({ id: Venue.id });
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venue not found or not owned by you.",
        });
      }
      return { success: true as const };
    }),
} satisfies TRPCRouterRecord;
