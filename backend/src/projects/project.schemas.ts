import { z } from "zod";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_STATUSES,
} from "./project.constants.js";

// Validates the request body for POST /projects before it reaches the
// database. Unknown fields (e.g. "_id" or "createdAt") are stripped.
export const createProjectSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, { error: "Name is required" })
    .max(PROJECT_NAME_MAX_LENGTH),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX_LENGTH).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Validates the request body for PATCH /projects/:id. Reuses the create rules
// with every field optional, but at least one field must be sent. Because
// unknown fields are stripped first, a body with only unknown fields counts
// as empty too.
export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: "Provide at least one field to update: name, description, or status",
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
