import type { FieldErrors } from "./projectsApi";
import type { ProjectFormValues } from "./projectForm";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
} from "./types";

type ProjectFormFieldsProps = {
  // Must be unique on the page, e.g. from useId(), so labels match inputs.
  idPrefix: string;
  values: ProjectFormValues;
  errors: FieldErrors;
  onChange: (field: keyof ProjectFormValues, value: string) => void;
  autoFocusName?: boolean;
};

// The name, description, and status inputs shared by the create and edit
// forms, so both use the same labels, limits, and error messages.
export function ProjectFormFields({
  idPrefix,
  values,
  errors,
  onChange,
  autoFocusName = false,
}: ProjectFormFieldsProps) {
  const fieldId = (field: string) => `${idPrefix}-${field}`;

  // aria-describedby links each field to its hint and error text.
  const describedBy = (field: keyof FieldErrors, hintId?: string) =>
    [hintId, errors[field] ? fieldId(`${field}-error`) : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <>
      <div className="form__field">
        <label htmlFor={fieldId("name")}>
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id={fieldId("name")}
          name="name"
          type="text"
          value={values.name}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          required
          autoFocus={autoFocusName}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name", fieldId("name-hint"))}
          onChange={(event) => onChange("name", event.target.value)}
        />
        <p id={fieldId("name-hint")} className="form__hint">
          Required. Up to {PROJECT_NAME_MAX_LENGTH} characters.
        </p>
        {errors.name && (
          <p id={fieldId("name-error")} className="form__error">
            {errors.name}
          </p>
        )}
      </div>

      <div className="form__field">
        <label htmlFor={fieldId("description")}>Description (optional)</label>
        <textarea
          id={fieldId("description")}
          name="description"
          rows={3}
          value={values.description}
          maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy("description")}
          onChange={(event) => onChange("description", event.target.value)}
        />
        {errors.description && (
          <p id={fieldId("description-error")} className="form__error">
            {errors.description}
          </p>
        )}
      </div>

      <div className="form__field">
        <label htmlFor={fieldId("status")}>Status</label>
        <select
          id={fieldId("status")}
          name="status"
          value={values.status}
          aria-invalid={Boolean(errors.status)}
          aria-describedby={describedBy("status")}
          onChange={(event) => onChange("status", event.target.value)}
        >
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        {errors.status && (
          <p id={fieldId("status-error")} className="form__error">
            {errors.status}
          </p>
        )}
      </div>
    </>
  );
}
