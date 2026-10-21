// Single source of truth: the Mongoose model and the Zod schema both use
// these, so the rules for a project can never drift apart.
export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on_hold",
  "completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 1000;
