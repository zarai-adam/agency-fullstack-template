import type { FieldErrors } from "./projectsApi";
import type { Project, ProjectStatus, UpdateProjectInput } from "./types";

// What the create and edit forms hold while the user types.
export type ProjectFormValues = {
  name: string;
  description: string;
  status: ProjectStatus;
};

export const emptyProjectValues: ProjectFormValues = {
  name: "",
  description: "",
  status: "planning",
};

export function valuesFromProject(project: Project): ProjectFormValues {
  return {
    name: project.name,
    description: project.description,
    status: project.status,
  };
}

// Trims text the same way the backend does, before checking or sending.
export function trimValues(values: ProjectFormValues): ProjectFormValues {
  return {
    ...values,
    name: values.name.trim(),
    description: values.description.trim(),
  };
}

// Only the fields the user actually changed. PATCH then leaves every other
// field exactly as it is in the database.
export function changedFields(
  project: Project,
  values: ProjectFormValues,
): UpdateProjectInput {
  const changes: UpdateProjectInput = {};

  if (values.name !== project.name) changes.name = values.name;
  if (values.description !== project.description) {
    changes.description = values.description;
  }
  if (values.status !== project.status) changes.status = values.status;

  return changes;
}

// The first field with an error, in the order the fields appear on screen.
export function firstInvalidField(errors: FieldErrors) {
  return (["name", "description", "status"] as const).find(
    (field) => errors[field],
  );
}

// Moves keyboard and screen-reader users to the field they need to fix.
export function focusField(form: HTMLFormElement, field: string) {
  const element = form.elements.namedItem(field);
  if (element instanceof HTMLElement) element.focus();
}
