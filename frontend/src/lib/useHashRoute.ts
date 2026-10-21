import { useSyncExternalStore } from "react";

// A tiny router without a dependency. Pages live in the URL hash
// ("#/projects"), so the back button and bookmarks work, and any static host
// can serve the app without extra server configuration.
export type Route = "overview" | "projects";

export const routeHrefs: Record<Route, string> = {
  overview: "#/",
  projects: "#/projects",
};

export function routeFromHash(hash: string): Route {
  return hash === routeHrefs.projects ? "projects" : "overview";
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return routeFromHash(hash);
}
