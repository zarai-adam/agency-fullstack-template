import { useId, useRef, useState } from "react";
import { DashboardHeader } from "../../components/layout/DashboardHeader";
import { Badge } from "../../components/ui/Badge";
import { CreateProjectForm } from "./CreateProjectForm";
import {
  defaultFilters,
  filterProjects,
  hasActiveFilters,
  type ProjectFilters,
  type SortOrder,
  type StatusFilter,
} from "./projectFilters";
import { ProjectListItem } from "./ProjectListItem";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES, type Project } from "./types";
import { useProjectActions } from "./useProjectActions";
import { useProjects } from "./useProjects";

function countLabel(count: number) {
  return `${count} ${count === 1 ? "project" : "projects"}`;
}

export function ProjectsPage() {
  const id = useId();
  const { state, reload } = useProjects();
  const [filters, setFilters] = useState<ProjectFilters>(defaultFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const listHeading = useRef<HTMLHeadingElement>(null);
  const newProjectButton = useRef<HTMLButtonElement>(null);

  const isVisible = (project: Project) =>
    filterProjects([project], filters).length > 0;
  const { announcement, handleUpdated, handleDeleted } = useProjectActions({
    reload,
    focusAfterDelete: listHeading,
    isVisible,
  });

  const allProjects = state.status === "success" ? state.projects : [];
  const visibleProjects = filterProjects(allProjects, filters);

  function updateFilters(changes: Partial<ProjectFilters>) {
    setFilters((current) => ({ ...current, ...changes }));
  }

  function clearFilters() {
    // Keep the chosen sort order; only clear what hides projects.
    updateFilters({ query: "", status: "all" });
  }

  function closeCreateForm() {
    setIsCreateOpen(false);
    newProjectButton.current?.focus();
  }

  return (
    // tabIndex={-1} lets the skip link and page navigation move focus here.
    <main id="main-content" className="dashboard-main" tabIndex={-1}>
      <DashboardHeader
        title="Projects"
        subtitle="Every project in your workspace, loaded from the projects API."
        profileName="Demo User"
        profileRole="Demo profile (no sign-in yet)"
      />

      <div className="page-actions">
        <button
          ref={newProjectButton}
          type="button"
          className="button"
          aria-expanded={isCreateOpen}
          aria-controls={isCreateOpen ? `${id}-create` : undefined}
          onClick={() => setIsCreateOpen((open) => !open)}
        >
          New project
        </button>
      </div>

      {isCreateOpen && (
        <div id={`${id}-create`} className="create-panel">
          <CreateProjectForm onCreated={() => void reload()} autoFocus />
          <button
            type="button"
            className="button button--secondary"
            onClick={closeCreateForm}
          >
            Close form
          </button>
        </div>
      )}

      <section className="card" aria-labelledby={`${id}-heading`}>
        <div className="section-heading">
          <h2 id={`${id}-heading`} ref={listHeading} tabIndex={-1}>
            All projects
          </h2>
          <Badge tone="live">Live data</Badge>
        </div>

        {/* Always rendered so screen readers announce edit/delete results. */}
        <div role="status" className="form__success">
          {announcement}
        </div>

        <form
          role="search"
          aria-label="Filter projects"
          className="filters"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="form__field filters__search">
            <label htmlFor={`${id}-search`}>Search projects</label>
            <input
              id={`${id}-search`}
              type="search"
              placeholder="Name or description"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
            />
          </div>

          <div className="form__field">
            <label htmlFor={`${id}-status`}>Filter by status</label>
            <select
              id={`${id}-status`}
              value={filters.status}
              onChange={(event) =>
                updateFilters({ status: event.target.value as StatusFilter })
              }
            >
              <option value="all">All statuses</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="form__field">
            <label htmlFor={`${id}-sort`}>Sort by</label>
            <select
              id={`${id}-sort`}
              value={filters.sort}
              onChange={(event) =>
                updateFilters({ sort: event.target.value as SortOrder })
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </form>

        {state.status === "loading" && (
          <p role="status">Loading projects...</p>
        )}

        {state.status === "error" && (
          <div role="alert" className="inline-error">
            <p>Could not load projects. Check that the API is running.</p>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void reload()}
            >
              Try again
            </button>
          </div>
        )}

        {state.status === "success" && (
          <>
            {/* Polite live region: announces the new count as filters change. */}
            <p className="section-note" aria-live="polite">
              {allProjects.length > 0 &&
                `Showing ${visibleProjects.length} of ${countLabel(allProjects.length)}.`}
            </p>

            {allProjects.length === 0 && (
              <div className="empty-state">
                <p>No projects yet.</p>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setIsCreateOpen(true)}
                >
                  Create your first project
                </button>
              </div>
            )}

            {allProjects.length > 0 && visibleProjects.length === 0 && (
              <div className="empty-state">
                <p>No projects match your search or filters.</p>
                {hasActiveFilters(filters) && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {visibleProjects.length > 0 && (
              <ul className="project-list">
                {visibleProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
