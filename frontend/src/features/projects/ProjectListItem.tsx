import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { EditProjectForm } from "./EditProjectForm";
import { deleteProject, isNotFound } from "./projectsApi";
import { PROJECT_STATUS_LABELS, type Project } from "./types";

type ProjectListItemProps = {
  project: Project;
  // Both callbacks reload the list; this item waits for them to finish.
  onUpdated: (project: Project) => Promise<void>;
  onDeleted: (project: Project, alreadyDeleted: boolean) => Promise<void>;
};

type Mode = "view" | "edit" | "confirm-delete";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const DELETE_ERROR =
  "Could not delete the project. Check your connection and try again.";

export function ProjectListItem({
  project,
  onUpdated,
  onDeleted,
}: ProjectListItemProps) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("view");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  // Which button gets focus back when the user leaves edit or confirm mode.
  const returnFocusTo = useRef<"edit" | "delete" | null>(null);

  useEffect(() => {
    if (mode !== "view" || !returnFocusTo.current) return;
    const target = returnFocusTo.current === "edit" ? editButton : deleteButton;
    target.current?.focus();
    returnFocusTo.current = null;
  }, [mode]);

  function backToView(focus: "edit" | "delete") {
    returnFocusTo.current = focus;
    setMode("view");
  }

  async function handleSaved(updated: Project) {
    await onUpdated(updated);
    backToView("edit");
  }

  async function handleConfirmDelete() {
    // The button is disabled while deleting; this guard is a second safety net.
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteFailed(false);

    try {
      await deleteProject(project.id);
      // The item disappears only when the reloaded list no longer has it.
      await onDeleted(project, false);
    } catch (error) {
      if (isNotFound(error)) {
        // Already gone on the server: reload so the list shows the truth.
        await onDeleted(project, true);
      } else {
        // Keep the project on screen: it was not deleted.
        setDeleteFailed(true);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  function handleConfirmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !isDeleting) backToView("delete");
  }

  if (mode === "edit") {
    return (
      <li className="project-list__item project-list__item--editing">
        <EditProjectForm
          project={project}
          onSaved={handleSaved}
          onCancel={() => backToView("edit")}
        />
      </li>
    );
  }

  return (
    <li className="project-list__item">
      <div className="project-list__main">
        <p className="project-list__name">{project.name}</p>
        {project.description && (
          <p className="project-list__description">{project.description}</p>
        )}
      </div>
      <div className="project-list__meta">
        <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
        <time dateTime={project.createdAt}>
          {dateFormat.format(new Date(project.createdAt))}
        </time>
      </div>

      {mode === "view" && (
        <div className="project-list__actions">
          {/* aria-label gives each button a unique name for screen readers,
              e.g. "Edit Website redesign", while the visible text stays short.
              It starts with the visible word so voice control still works. */}
          <button
            ref={editButton}
            type="button"
            className="button button--secondary button--small"
            aria-label={`Edit ${project.name}`}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            ref={deleteButton}
            type="button"
            className="button button--danger-outline button--small"
            aria-label={`Delete ${project.name}`}
            onClick={() => {
              setDeleteFailed(false);
              setMode("confirm-delete");
            }}
          >
            Delete
          </button>
        </div>
      )}

      {mode === "confirm-delete" && (
        <div
          role="group"
          aria-label={`Confirm deleting ${project.name}`}
          aria-describedby={`${id}-warning`}
          className="confirm-box"
          onKeyDown={handleConfirmKeyDown}
        >
          <p id={`${id}-warning`}>
            <strong>Delete "{project.name}"?</strong> This permanently removes
            the project from the database. It cannot be undone.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button--danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete permanently"}
            </button>
            {/* Focus starts on Cancel: the safe choice. */}
            <button
              type="button"
              className="button button--secondary"
              onClick={() => backToView("delete")}
              disabled={isDeleting}
              autoFocus
            >
              Cancel
            </button>
          </div>
          {deleteFailed && (
            <p role="alert" className="form__error">
              {DELETE_ERROR}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
