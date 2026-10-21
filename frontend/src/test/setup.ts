import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library can't clean up on its own.
// Unmount rendered components after each test so tests stay independent.
afterEach(() => {
  cleanup();
  // The page is chosen from the URL hash, so reset it to the Overview page.
  window.location.hash = "";
});
