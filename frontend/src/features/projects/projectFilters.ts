import type { Project, ProjectStatus } from "./types";

export type StatusFilter = "all" | ProjectStatus;
export type SortOrder = "newest" | "oldest";

export type ProjectFilters = {
  query: string;
  status: StatusFilter;
  sort: SortOrder;
};

export const defaultFilters: ProjectFilters = {
  query: "",
  status: "all",
  sort: "newest",
};

export function hasActiveFilters(filters: ProjectFilters) {
  return filters.query.trim() !== "" || filters.status !== "all";
}

// Search, filter, and sort in the browser. Fine while GET /projects returns
// every project; with many projects this should move to the backend.
export function filterProjects(
  projects: Project[],
  { query, status, sort }: ProjectFilters,
): Project[] {
  const search = query.trim().toLowerCase();

  const matching = projects.filter((project) => {
    if (status !== "all" && project.status !== status) return false;
    if (search === "") return true;

    return (
      project.name.toLowerCase().includes(search) ||
      project.description.toLowerCase().includes(search)
    );
  });

  // Same order as the backend: by createdAt, then by id when two projects
  // were created in the same millisecond. toSorted() leaves the input alone.
  return matching.toSorted((a, b) => {
    const byDate =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const oldestFirst = byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    return sort === "oldest" ? oldestFirst : -oldestFirst;
  });
}
