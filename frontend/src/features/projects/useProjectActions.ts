import { useState, type RefObject } from "react";
import type { Project } from "./types";

type Options = {
  // Reloads the list from the API.
  reload: () => Promise<void>;
  // Gets focus after a delete, because the deleted item's buttons are gone.
  focusAfterDelete: RefObject<HTMLElement | null>;
  // Optional: whether a project is still shown after an edit (for example,
  // with a status filter on). If not, focus moves to focusAfterDelete too.
  isVisible?: (project: Project) => boolean;
};

// What happens after an edit or delete, shared by every project list:
// reload from the API, then tell screen-reader users what changed.
export function useProjectActions({
  reload,
  focusAfterDelete,
  isVisible,
}: Options) {
  const [announcement, setAnnouncement] = useState("");

  async function handleUpdated(project: Project) {
    await reload();

    if (isVisible && !isVisible(project)) {
      setAnnouncement(
        `Changes to "${project.name}" saved. It no longer matches the current filters.`,
      );
      focusAfterDelete.current?.focus();
      return;
    }

    setAnnouncement(`Changes to "${project.name}" saved.`);
  }

  async function handleDeleted(project: Project, alreadyDeleted: boolean) {
    await reload();
    setAnnouncement(
      alreadyDeleted
        ? `"${project.name}" had already been deleted.`
        : `Project "${project.name}" deleted.`,
    );
    focusAfterDelete.current?.focus();
  }

  return { announcement, handleUpdated, handleDeleted };
}
