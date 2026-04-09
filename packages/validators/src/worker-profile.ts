import { z } from "zod/v4";

import { JobCategorySlugSchema } from "./profile";

export const WorkerProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(256),
  phone: z.string().trim().min(6, "Please enter a valid phone number").max(32),
  bio: z
    .string()
    .trim()
    .max(300, "Bio must be 300 characters or less")
    .optional(),
  photoUrl: z.url().optional(),
  jobCategories: z
    .array(JobCategorySlugSchema)
    .min(1, "Select at least one job category"),
});
export type WorkerProfileInput = z.infer<typeof WorkerProfileSchema>;
