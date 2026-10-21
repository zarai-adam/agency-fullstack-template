import { describe, expect, it } from "vitest";
import { makeProject } from "../../test/mockApi";
import {
  defaultFilters,
  filterProjects,
  hasActiveFilters,
  type ProjectFilters,
} from "./projectFilters";

const older = makeProject({
  name: "Brand guide",
  description: "Logo and colours",
  status: "completed",
  createdAt: "2026-10-01T09:00:00.000Z",
});
const newer = makeProject({
  name: "Support chatbot",
  description: "Assistant for the HELP desk",
  status: "active",
  createdAt: "2026-10-05T09:00:00.000Z",
});
// Given oldest first on purpose, to prove the function sorts by itself.
const projects = [older, newer];

const names = (filters: Partial<ProjectFilters>) =>
  filterProjects(projects, { ...defaultFilters, ...filters }).map(
    (project) => project.name,
  );

describe("filterProjects", () => {
  it("returns everything, newest first, with the default filters", () => {
    expect(names({})).toEqual(["Support chatbot", "Brand guide"]);
  });

  it("sorts oldest first", () => {
    expect(names({ sort: "oldest" })).toEqual(["Brand guide", "Support chatbot"]);
  });

  it("breaks ties on the same date by id, like the backend", () => {
    const sameTime = "2026-10-02T09:00:00.000Z";
    const first = makeProject({ name: "First", createdAt: sameTime });
    const second = makeProject({ name: "Second", createdAt: sameTime });

    const result = filterProjects([first, second], defaultFilters);

    expect(result.map((project) => project.name)).toEqual(["Second", "First"]);
  });

  it("searches name and description, ignoring case and extra spaces", () => {
    expect(names({ query: "BRAND" })).toEqual(["Brand guide"]);
    expect(names({ query: "  help desk  " })).toEqual(["Support chatbot"]);
    expect(names({ query: "nothing like this" })).toEqual([]);
  });

  it("filters by status, and combines with search", () => {
    expect(names({ status: "completed" })).toEqual(["Brand guide"]);
    expect(names({ status: "on_hold" })).toEqual([]);
    expect(names({ status: "active", query: "logo" })).toEqual([]);
  });

  it("does not change the list it was given", () => {
    filterProjects(projects, { ...defaultFilters, sort: "newest" });

    expect(projects).toEqual([older, newer]);
  });
});

describe("hasActiveFilters", () => {
  it("ignores sort order and blank searches", () => {
    expect(hasActiveFilters(defaultFilters)).toBe(false);
    expect(hasActiveFilters({ ...defaultFilters, sort: "oldest" })).toBe(false);
    expect(hasActiveFilters({ ...defaultFilters, query: "   " })).toBe(false);
    expect(hasActiveFilters({ ...defaultFilters, status: "active" })).toBe(true);
  });
});
