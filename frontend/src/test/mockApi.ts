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
