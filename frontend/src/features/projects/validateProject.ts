import type { FieldErrors } from "./projectsApi";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_STATUSES,
  type CreateProjectInput,
} from "./types";

// Quick checks so users get instant feedback. The backend runs the real
// validation again, so this does not need to catch every case.
export function validateProject(input: CreateProjectInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();

  if (name.length === 0) {
    errors.name = "Name is required";
  } else if (name.length > PROJECT_NAME_MAX_LENGTH) {
    errors.name = `Name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer`;
  }

  if ((input.description ?? "").trim().length > PROJECT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${PROJECT_DESCRIPTION_MAX_LENGTH} characters or fewer`;
  }

  if (input.status && !PROJECT_STATUSES.includes(input.status)) {
    errors.status = "Choose a valid status";
  }

  return errors;
}
