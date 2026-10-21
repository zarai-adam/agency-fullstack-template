import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  changedFields,
  firstInvalidField,
  focusField,
  trimValues,
  valuesFromProject,
  type ProjectFormValues,
} from "./projectForm";
import { ProjectFormFields } from "./ProjectFormFields";
import {
  isNotFound,
  readValidationError,
  updateProject,
  type FieldErrors,
} from "./projectsApi";
import type { Project } from "./types";
import { validateProject } from "./validateProject";

type EditProjectFormProps = {
  project: Project;
  // Called after the backend saved the change. The form stays in its
  // "Saving..." state until this Promise finishes (the list is reloaded).
  onSaved: (project: Project) => Promise<void>;
  onCancel: () => void;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "unchanged" }
  | { kind: "error"; message: string };

const GENERIC_ERROR =
  "Could not save the changes. Check your connection and try again.";
const NOT_FOUND_ERROR =
  "This project no longer exists. It may have been deleted elsewhere.";

export function EditProjectForm({
  project,
  onSaved,
  onCancel,
}: EditProjectFormProps) {
  const id = useId();
  const [values, setValues] = useState<ProjectFormValues>(() =>
    valuesFromProject(project),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const isSaving = submit.kind === "saving";

  function handleChange(field: keyof ProjectFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = trimValues(values);

    // 1. Same quick check as the create form.
    const errors = validateProject(input);
    setFieldErrors(errors);

    const firstInvalid = firstInvalidField(errors);
    if (firstInvalid) {
      setSubmit({ kind: "idle" });
      focusField(event.currentTarget, firstInvalid);
      return;
    }

    // 2. Send only what changed, so other fields stay exactly as saved.
    const changes = changedFields(project, input);
    if (Object.keys(changes).length === 0) {
      setSubmit({ kind: "unchanged" });
      return;
    }

    setSubmit({ kind: "saving" });

    try {
      const updated = await updateProject(project.id, changes);
      await onSaved(updated);
    } catch (error) {
      const validation = readValidationError(error);

      if (validation) {
        setFieldErrors(validation.fieldErrors);
        setSubmit({ kind: "error", message: validation.message });
      } else if (isNotFound(error)) {
        setSubmit({ kind: "error", message: NOT_FOUND_ERROR });
      } else {
        // Server or network error: never show internal details.
        setSubmit({ kind: "error", message: GENERIC_ERROR });
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && !isSaving) onCancel();
  }

  return (
    <form
      className="form edit-form"
      aria-labelledby={`${id}-heading`}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
    >
      <h3 id={`${id}-heading`}>Edit "{project.name}"</h3>

      <ProjectFormFields
        idPrefix={id}
        values={values}
        errors={fieldErrors}
        onChange={handleChange}
        autoFocusName
      />

      <div className="button-row">
        <button type="submit" className="button" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>

      {/* Always rendered so screen readers announce the message. */}
      <div role="status" className="form__hint">
        {submit.kind === "unchanged" && "No changes to save."}
      </div>

      {submit.kind === "error" && (
        <p role="alert" className="form__error">
          {submit.message}
        </p>
      )}
    </form>
  );
}
