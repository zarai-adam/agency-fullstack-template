import { useEffect, useRef, useState } from "react";
import { listProjects } from "./projectsApi";
import type { Project } from "./types";

export type ProjectsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; projects: Project[] };

// Fetches the list and turns the result into the next state. It never throws.
async function fetchProjectsState(): Promise<ProjectsState> {
  try {
    return { status: "success", projects: await listProjects() };
  } catch {
    return { status: "error" };
  }
}

// Loads projects from the API. reload() fetches them again and returns a
// Promise, so a form can wait until the fresh list is on screen (for example
// after deleting a project). While reloading, the current list stays visible
// instead of flashing back to "Loading".
export function useProjects() {
  const [state, setState] = useState<ProjectsState>({ status: "loading" });
  // Each request gets a number. Only the newest one may update the screen,
  // so a slow old response can never overwrite a newer one.
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    let cancelled = false;

    fetchProjectsState().then((next) => {
      if (!cancelled && requestId === latestRequest.current) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const requestId = ++latestRequest.current;
    const next = await fetchProjectsState();
    if (requestId === latestRequest.current) setState(next);
  }

  return { state, reload };
}
