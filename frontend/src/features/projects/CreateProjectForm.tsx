import { useId, useState, type FormEvent } from "react";
import {
  emptyProjectValues,
  firstInvalidField,
  focusField,
  trimValues,
  type ProjectFormValues,
} from "./projectForm";
import { ProjectFormFields } from "./ProjectFormFields";
import {
  createProject,
  readValidationError,
  type FieldErrors,
} from "./projectsApi";
import type { Project } from "./types";
import { validateProject } from "./validateProject";

type CreateProjectFormProps = {
  onCreated: (project: Project) => void;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; projectName: string }
  | { kind: "error"; message: string };

const GENERIC_ERROR =
  "Could not create the project. Check your connection and try again.";

export function CreateProjectForm({ onCreated }: CreateProjectFormProps) {
  const id = useId();
  const [values, setValues] = useState<ProjectFormValues>(emptyProjectValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const isSubmitting = submit.kind === "submitting";

  function handleChange(field: keyof ProjectFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = trimValues(values);

    // 1. Quick check in the browser.
    const errors = validateProject(input);
    setFieldErrors(errors);

    const firstInvalid = firstInvalidField(errors);
    if (firstInvalid) {
      setSubmit({ kind: "idle" });
      focusField(event.currentTarget, firstInvalid);
      return;
    }

    // 2. Send to the backend, which validates again and has the final say.
    setSubmit({ kind: "submitting" });

    try {
      const project = await createProject(input);
      setValues(emptyProjectValues);
      setSubmit({ kind: "success", projectName: project.name });
      onCreated(project);
    } catch (error) {
      const validation = readValidationError(error);

      if (validation) {
        setFieldErrors(validation.fieldErrors);
        setSubmit({ kind: "error", message: validation.message });
      } else {
        // Server or network error: never show internal details.
        setSubmit({ kind: "error", message: GENERIC_ERROR });
      }
    }
  }

  return (
    <section className="card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Create project</h2>
      <p className="section-note">Saved to the database through the API.</p>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <ProjectFormFields
          idPrefix={id}
          values={values}
          errors={fieldErrors}
          onChange={handleChange}
        />

        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create project"}
        </button>

        {/* Always rendered so screen readers announce the success message. */}
        <div role="status" className="form__success">
          {submit.kind === "success" &&
            `Project "${submit.projectName}" created.`}
        </div>

        {submit.kind === "error" && (
          <p role="alert" className="form__error">
            {submit.message}
          </p>
        )}
      </form>
    </section>
  );
}
