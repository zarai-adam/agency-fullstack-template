import { useRef, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { ProjectListItem } from "./ProjectListItem";
import type { Project } from "./types";
import type { ProjectsState } from "./useProjects";

type RecentProjectsProps = {
  state: ProjectsState;
  onRetry: () => void;
  // Reloads the list from the API after an edit or delete.
  onChanged: () => Promise<void>;
  limit?: number;
};

export function RecentProjects({
  state,
  onRetry,
  onChanged,
  limit = 5,
}: RecentProjectsProps) {
  const [announcement, setAnnouncement] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  async function handleUpdated(project: Project) {
    await onChanged();
    setAnnouncement(`Changes to "${project.name}" saved.`);
  }

  async function handleDeleted(project: Project, alreadyDeleted: boolean) {
    await onChanged();
    setAnnouncement(
      alreadyDeleted
        ? `"${project.name}" had already been deleted.`
        : `Project "${project.name}" deleted.`,
    );
    // The deleted item's buttons are gone, so move focus somewhere sensible.
    heading.current?.focus();
  }

  return (
    <section className="card" aria-labelledby="projects-heading">
      <div className="section-heading">
        <h2 id="projects-heading" ref={heading} tabIndex={-1}>
          Recent projects
        </h2>
        <Badge tone="live">Live data</Badge>
      </div>
      <p className="section-note">Newest first, loaded from the projects API.</p>

      {/* Always rendered so screen readers announce edit/delete results. */}
      <div role="status" className="form__success">
        {announcement}
      </div>

      {state.status === "loading" && (
        <p role="status">Loading projects...</p>
      )}

      {state.status === "error" && (
        <div role="alert" className="inline-error">
          <p>Could not load projects. Check that the API is running.</p>
          <button type="button" className="button button--secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {state.status === "success" && state.projects.length === 0 && (
        <p className="empty-state">
          No projects yet. Use the form to create your first one.
        </p>
      )}

      {state.status === "success" && state.projects.length > 0 && (
        <>
          {/* The backend already returns projects newest first. */}
          <ul className="project-list">
            {state.projects.slice(0, limit).map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
          {state.projects.length > limit && (
            <p className="section-note">
              Showing {limit} of {state.projects.length} projects.
            </p>
          )}
        </>
      )}
    </section>
  );
}
