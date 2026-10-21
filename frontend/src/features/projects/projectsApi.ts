import { ApiError, apiRequest } from "../../lib/api";
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "./types";

export function listProjects() {
  return apiRequest<Project[]>("projects");
}

export function createProject(input: CreateProjectInput) {
  return apiRequest<Project>("projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, changes: UpdateProjectInput) {
  return apiRequest<Project>(`projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

// The backend answers 200 { message: "Project deleted", id }.
export function deleteProject(id: string) {
  return apiRequest<{ message: string; id: string }>(
    `projects/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export type FieldErrors = Partial<Record<keyof CreateProjectInput, string>>;

// Reads the backend's 400 response: { error, details: { field: [messages] } }.
// Returns null for anything else (server errors, network failures), so those
// get a generic message instead of internal details.
export function readValidationError(
  error: unknown,
): { message: string; fieldErrors: FieldErrors } | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  if (typeof error.data !== "object" || error.data === null) return null;

  const data = error.data as {
    error?: unknown;
    details?: Record<string, unknown>;
  };
  const fieldErrors: FieldErrors = {};

  for (const field of ["name", "description", "status"] as const) {
    const messages = data.details?.[field];
    if (Array.isArray(messages) && typeof messages[0] === "string") {
      fieldErrors[field] = messages[0];
    }
  }

  return {
    message:
      typeof data.error === "string" ? data.error : "Invalid project data",
    fieldErrors,
  };
}
