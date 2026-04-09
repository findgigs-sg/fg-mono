import { z } from "zod/v4";

export const EmployerProfileSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, "Organisation name must be at least 2 characters")
    .max(256),
  contactName: z
    .string()
    .trim()
    .min(2, "Contact name must be at least 2 characters")
    .max(256),
  phone: z.string().trim().min(6, "Please enter a valid phone number").max(32),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  logoUrl: z.url().optional(),
});
export type EmployerProfileInput = z.infer<typeof EmployerProfileSchema>;
