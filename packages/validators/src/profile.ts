import { z } from "zod/v4";

export const RoleEnum = z.enum(["worker", "employer"]);
export type Role = z.infer<typeof RoleEnum>;

export const SetRoleSchema = z.object({
  role: RoleEnum,
});
export type SetRoleInput = z.infer<typeof SetRoleSchema>;

/**
 * Single source of truth for job categories shown in the worker
 * profile creation chips (FIN-9) and seeded into the `job_category` DB table.
 */
export const JOB_CATEGORIES = [
  { slug: "food-and-beverage", label: "Food & Beverage" },
  { slug: "events", label: "Events" },
  { slug: "retail", label: "Retail" },
  { slug: "cleaning", label: "Cleaning" },
  { slug: "warehouse-and-logistics", label: "Warehouse & Logistics" },
  { slug: "admin-and-reception", label: "Admin & Reception" },
  { slug: "promotions-and-marketing", label: "Promotions & Marketing" },
  { slug: "general-labor", label: "General Labor" },
] as const;

export const JOB_CATEGORY_SLUGS = JOB_CATEGORIES.map(
  (c) => c.slug,
) as unknown as readonly [string, ...string[]];

export const JobCategorySlugSchema = z.enum(
  JOB_CATEGORY_SLUGS as [string, ...string[]],
);
export type JobCategorySlug = z.infer<typeof JobCategorySlugSchema>;
