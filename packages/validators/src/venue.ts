import { z } from "zod/v4";

export const VenueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Venue name must be at least 2 characters")
    .max(256),
  address: z.string().trim().min(4, "Please enter a valid address"),
  description: z
    .string()
    .trim()
    .max(300, "Description must be 300 characters or less")
    .optional(),
  photoUrl: z.url().optional(),
});
export type VenueInput = z.infer<typeof VenueSchema>;
