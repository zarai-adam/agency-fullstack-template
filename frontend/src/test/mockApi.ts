import { vi } from "vitest";
import { apiRequest } from "../lib/api";
import type { Project } from "../features/projects/types";

// Each key is "METHOD path", e.g. "GET projects" or "POST projects".
type RouteHandler = (init?: RequestInit) => unknown;

// Fakes the backend for component tests. The test file must also call
// vi.mock("<path>/lib/api", ...) so apiRequest is a mock function.
// Any request a test did not set up fails loudly instead of passing silently.
export function mockApiRoutes(routes: Record<string, RouteHandler>) {
  const allRoutes: Record<string, RouteHandler> = {
    "GET health": () => ({ status: "ok" }),
    ...routes,
  };

  vi.mocked(apiRequest).mockImplementation((async (
    path: string,
    init?: RequestInit,
  ) => {
    const key = `${init?.method ?? "GET"} ${path}`;
    const handler = allRoutes[key];

    if (!handler) throw new Error(`Unexpected API call in test: ${key}`);
    return handler(init);
  }) as typeof apiRequest);
}

// A tiny in-memory backend with the same response shapes as the real one:
// POST and PATCH return the project, DELETE returns { message, id }, and GET
// returns the stored list newest first. `overrides` replaces any route, e.g.
// to make one request fail. Returns the stored list so tests can inspect it.
export function fakeBackend(
  initial: Project[],
  overrides: Record<string, RouteHandler> = {},
) {
  const stored = [...initial];
  const indexOf = (id: string) =>
    stored.findIndex((project) => project.id === id);

  const routes: Record<string, RouteHandler> = {
    "GET projects": () => [...stored],
    "POST projects": (init) => {
      // Like the real backend, a new project is stamped with the current time.
      const now = new Date().toISOString();
      const project = makeProject({
        ...JSON.parse(String(init?.body)),
        createdAt: now,
        updatedAt: now,
      });
      stored.unshift(project);
      return project;
    },
  };

  for (const { id } of initial) {
    routes[`PATCH projects/${id}`] = (init) => {
      stored[indexOf(id)] = {
        ...stored[indexOf(id)],
        ...JSON.parse(String(init?.body)),
        updatedAt: "2026-10-21T12:00:00.000Z",
      };
      return stored[indexOf(id)];
    };
    routes[`DELETE projects/${id}`] = () => {
      stored.splice(indexOf(id), 1);
      return { message: "Project deleted", id };
    };
  }

  mockApiRoutes({ ...routes, ...overrides });
  return stored;
}

let nextId = 1;

export function makeProject(overrides: Partial<Project> = {}): Project {
  const id = String(nextId++).padStart(24, "0");

  return {
    id,
    name: `Project ${id.slice(-2)}`,
    description: "",
    status: "planning",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

// A promise you resolve or reject by hand, to test loading states.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
