// These mirror the backend rules in backend/src/projects/project.constants.ts.
// The frontend uses them for a quick check before sending; the backend still
// validates every request and has the final say.
export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on_hold",
  "completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 1000;

// Shape returned by the backend (see the toJSON transform in project.model.ts).
export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  status?: ProjectStatus;
};

// PATCH /projects/:id accepts any subset of the create fields (at least one).
export type UpdateProjectInput = Partial<CreateProjectInput>;
