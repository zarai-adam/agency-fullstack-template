import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "../../lib/api";
import { deferred, makeProject, mockApiRoutes } from "../../test/mockApi";
import { DashboardPage } from "../dashboard/DashboardPage";
import type { Project } from "./types";

// Keep the real ApiError class; only replace the network call.
vi.mock("../../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api")>()),
  apiRequest: vi.fn(),
}));

type Routes = Parameters<typeof mockApiRoutes>[0];

// A tiny in-memory backend with the same response shapes as the real one:
// PATCH returns the updated project, DELETE returns { message, id }.
// `overrides` replaces any route, e.g. to make one request fail.
function fakeBackend(initial: Project[], overrides: Routes = {}) {
  const stored = [...initial];
  const routes: Routes = { "GET projects": () => [...stored] };

  for (const { id } of initial) {
    routes[`PATCH projects/${id}`] = (init) => {
      const index = stored.findIndex((project) => project.id === id);
      stored[index] = {
        ...stored[index],
        ...JSON.parse(String(init?.body)),
        updatedAt: "2026-10-21T12:00:00.000Z",
      };
      return stored[index];
    };
    routes[`DELETE projects/${id}`] = () => {
      stored.splice(
        stored.findIndex((project) => project.id === id),
        1,
      );
      return { message: "Project deleted", id };
    };
  }

  mockApiRoutes({ ...routes, ...overrides });
  return stored;
}

function callsTo(method: string) {
  return vi
    .mocked(apiRequest)
    .mock.calls.filter(([, init]) => init?.method === method);
}

function statValue(label: string) {
  const card = screen.getByRole("heading", { name: label }).closest("article");
  return card?.querySelector(".stat-card__value")?.textContent;
}

function projectNames() {
  const section = screen.getByRole("region", { name: "Recent projects" });
  return Array.from(section.querySelectorAll(".project-list__name")).map(
    (element) => element.textContent,
  );
}

async function renderDashboard() {
  render(<DashboardPage />);
  // Wait for the first project list to load before interacting.
  await waitFor(() =>
    expect(screen.queryByText("Loading projects...")).not.toBeInTheDocument(),
  );
}

async function openEditForm(projectName: string) {
  fireEvent.click(
    await screen.findByRole("button", { name: `Edit ${projectName}` }),
  );
  return screen.getByRole("form", { name: `Edit "${projectName}"` });
}

async function openDeleteConfirmation(projectName: string) {
  fireEvent.click(
    await screen.findByRole("button", { name: `Delete ${projectName}` }),
  );
  return screen.getByRole("group", { name: `Confirm deleting ${projectName}` });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Editing a project", () => {
  it("opens a form filled with the project's current values", async () => {
    fakeBackend([
      makeProject({ name: "Alpha", description: "First", status: "on_hold" }),
    ]);
    await renderDashboard();

    const form = await openEditForm("Alpha");

    expect(within(form).getByLabelText(/^Name/)).toHaveValue("Alpha");
    expect(within(form).getByLabelText("Description (optional)")).toHaveValue(
      "First",
    );
    expect(within(form).getByLabelText("Status")).toHaveValue("on_hold");
    // Keyboard users land straight in the first field.
    expect(within(form).getByLabelText(/^Name/)).toHaveFocus();
  });

  it.each([
    ["the Cancel button", (form: HTMLElement) =>
      fireEvent.click(within(form).getByRole("button", { name: "Cancel" }))],
    ["the Escape key", (form: HTMLElement) =>
      fireEvent.keyDown(within(form).getByLabelText(/^Name/), {
        key: "Escape",
      })],
  ])("closes without saving using %s", async (_label, close) => {
    fakeBackend([makeProject({ name: "Alpha" })]);
    await renderDashboard();

    const form = await openEditForm("Alpha");
    fireEvent.change(within(form).getByLabelText(/^Name/), {
      target: { value: "Changed but not saved" },
    });
    close(form);

    expect(screen.queryByRole("form", { name: /^Edit/ })).not.toBeInTheDocument();
    expect(projectNames()).toEqual(["Alpha"]);
    expect(callsTo("PATCH")).toHaveLength(0);
    // Focus goes back to where the user started.
    expect(screen.getByRole("button", { name: "Edit Alpha" })).toHaveFocus();
  });

  it("saves only the changed fields, then updates the list and counts", async () => {
    const alpha = makeProject({
      name: "Alpha",
      description: "Keep me",
      status: "planning",
    });
    fakeBackend([alpha]);
    await renderDashboard();
    expect(statValue("Active Projects")).toBe("0");

    const form = await openEditForm("Alpha");
    fireEvent.change(within(form).getByLabelText(/^Name/), {
      target: { value: "  Alpha v2  " },
    });
    fireEvent.change(within(form).getByLabelText("Status"), {
      target: { value: "active" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText('Changes to "Alpha v2" saved.'),
    ).toBeInTheDocument();

    // The description was not touched, so it was not sent.
    expect(callsTo("PATCH")).toHaveLength(1);
    expect(callsTo("PATCH")[0][0]).toBe(`projects/${alpha.id}`);
    expect(JSON.parse(String(callsTo("PATCH")[0][1]?.body))).toEqual({
      name: "Alpha v2",
      status: "active",
    });

    // The dashboard shows the reloaded data.
    expect(projectNames()).toEqual(["Alpha v2"]);
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    expect(statValue("Active Projects")).toBe("1");
    // The form closes and focus returns to Edit right after the message
    // appears (one render later), so wait for it rather than checking at once.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Alpha v2" })).toHaveFocus(),
    );
    expect(screen.queryByRole("form", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("shows Saving... and blocks the form until the save finishes", async () => {
    const response = deferred<Project>();
    const project = makeProject({ name: "Alpha" });
    fakeBackend([project], {
      [`PATCH projects/${project.id}`]: () => response.promise,
    });
    await renderDashboard();

    const form = await openEditForm("Alpha");
    fireEvent.change(within(form).getByLabelText("Status"), {
      target: { value: "completed" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(
      await within(form).findByRole("button", { name: "Saving..." }),
    ).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeDisabled();

    response.resolve({ ...project, status: "completed" });
    expect(
      await screen.findByText('Changes to "Alpha" saved.'),
    ).toBeInTheDocument();
  });

  it("does not send a request when nothing changed", async () => {
    fakeBackend([makeProject({ name: "Alpha" })]);
    await renderDashboard();

    const form = await openEditForm("Alpha");
    // Extra spaces are trimmed, so this is not a real change.
    fireEvent.change(within(form).getByLabelText(/^Name/), {
      target: { value: "  Alpha  " },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(within(form).getByText("No changes to save.")).toBeInTheDocument();
    expect(callsTo("PATCH")).toHaveLength(0);
  });

  it.each([
    ["a blank name", "   ", "Name is required"],
    ["a name over 100 characters", "a".repeat(101), "Name must be 100 characters or fewer"],
  ])("rejects %s before calling the API", async (_label, name, message) => {
    fakeBackend([makeProject({ name: "Alpha" })]);
    await renderDashboard();

    const form = await openEditForm("Alpha");
    const nameInput = within(form).getByLabelText(/^Name/);
    fireEvent.change(nameInput, { target: { value: name } });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(within(form).getByText(message)).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveFocus();
    expect(callsTo("PATCH")).toHaveLength(0);
  });

  it("shows the backend's validation errors next to the fields", async () => {
    const project = makeProject({ name: "Alpha" });
    // Simulated 400 in the backend's real shape: { error, details }.
    fakeBackend([project], {
      [`PATCH projects/${project.id}`]: () => {
        throw new ApiError(400, "Bad Request", {
          error: "Invalid project data",
          details: { name: ["Rejected by the server"] },
        });
      },
    });
    await renderDashboard();

    const form = await openEditForm("Alpha");
    fireEvent.change(within(form).getByLabelText(/^Name/), {
      target: { value: "Beta" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(
      await within(form).findByText("Rejected by the server"),
    ).toBeInTheDocument();
    expect(within(form).getByRole("alert")).toHaveTextContent(
      "Invalid project data",
    );
    expect(within(form).getByLabelText(/^Name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it.each([
    [
      "a server error",
      () => {
        throw new ApiError(500, "Internal Server Error", {
          error: "Internal server error",
        });
      },
      "Could not save the changes. Check your connection and try again.",
    ],
    [
      "a network failure",
      () => {
        throw new TypeError("Failed to fetch");
      },
      "Could not save the changes. Check your connection and try again.",
    ],
    [
      "a project that no longer exists",
      () => {
        throw new ApiError(404, "Not Found", { error: "Project not found" });
      },
      "This project no longer exists. It may have been deleted elsewhere.",
    ],
  ])("keeps the form open with a clear message for %s", async (_label, failingPatch, message) => {
    const project = makeProject({ name: "Alpha" });
    const stored = fakeBackend([project], {
      [`PATCH projects/${project.id}`]: failingPatch,
    });
    await renderDashboard();

    const form = await openEditForm("Alpha");
    fireEvent.change(within(form).getByLabelText(/^Name/), {
      target: { value: "Beta" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(message);
    // What the user typed is kept so they can try again.
    expect(within(form).getByLabelText(/^Name/)).toHaveValue("Beta");
    expect(within(form).getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.queryByText(/Internal server error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    expect(stored[0].name).toBe("Alpha");
  });
});

describe("Deleting a project", () => {
  it("asks for confirmation, explains it is permanent, and Cancel keeps the project", async () => {
    fakeBackend([makeProject({ name: "Alpha" })]);
    await renderDashboard();

    const confirm = await openDeleteConfirmation("Alpha");

    expect(confirm).toHaveAccessibleDescription(/permanently removes/);
    expect(confirm).toHaveTextContent("It cannot be undone.");
    // Focus starts on the safe choice.
    const cancel = within(confirm).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();

    fireEvent.click(cancel);

    expect(screen.queryByRole("group", { name: /Confirm deleting/ })).not.toBeInTheDocument();
    expect(callsTo("DELETE")).toHaveLength(0);
    expect(projectNames()).toEqual(["Alpha"]);
    expect(screen.getByRole("button", { name: "Delete Alpha" })).toHaveFocus();
  });

  it("cancels with the Escape key", async () => {
    fakeBackend([makeProject({ name: "Alpha" })]);
    await renderDashboard();

    const confirm = await openDeleteConfirmation("Alpha");
    fireEvent.keyDown(within(confirm).getByRole("button", { name: "Cancel" }), {
      key: "Escape",
    });

    expect(screen.queryByRole("group", { name: /Confirm deleting/ })).not.toBeInTheDocument();
    expect(callsTo("DELETE")).toHaveLength(0);
  });

  it("deletes once after confirmation, then updates the list and counts", async () => {
    const alpha = makeProject({ name: "Alpha", status: "active" });
    const beta = makeProject({ name: "Beta", status: "planning" });
    const response = deferred<void>();
    const stored = fakeBackend([alpha, beta], {
      // Hold the DELETE open so the in-progress state can be checked.
      [`DELETE projects/${alpha.id}`]: async () => {
        await response.promise;
        stored.splice(0, 1);
        return { message: "Project deleted", id: alpha.id };
      },
    });
    await renderDashboard();
    expect(statValue("Total Projects")).toBe("2");
    expect(statValue("Active Projects")).toBe("1");

    const confirm = await openDeleteConfirmation("Alpha");
    const deleteButton = within(confirm).getByRole("button", {
      name: "Delete permanently",
    });
    fireEvent.click(deleteButton);

    // While waiting: disabled, still listed, and a second click does nothing.
    const deleting = within(confirm).getByRole("button", { name: "Deleting..." });
    expect(deleting).toBeDisabled();
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(deleting);
    expect(callsTo("DELETE")).toHaveLength(1);
    expect(projectNames()).toEqual(["Alpha", "Beta"]);

    response.resolve();

    expect(
      await screen.findByText('Project "Alpha" deleted.'),
    ).toBeInTheDocument();
    expect(projectNames()).toEqual(["Beta"]);
    expect(statValue("Total Projects")).toBe("1");
    expect(statValue("Active Projects")).toBe("0");
    expect(callsTo("DELETE")[0][0]).toBe(`projects/${alpha.id}`);
    // The deleted item's buttons are gone, so focus moves to the list heading.
    expect(screen.getByRole("heading", { name: "Recent projects" })).toHaveFocus();
  });

  it("shows the empty state after deleting the last project", async () => {
    fakeBackend([makeProject({ name: "Alpha" })]);
    await renderDashboard();

    const confirm = await openDeleteConfirmation("Alpha");
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Delete permanently" }),
    );

    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(statValue("Total Projects")).toBe("0");
  });

  it.each([
    [
      "a server error",
      () => {
        throw new ApiError(500, "Internal Server Error", {
          error: "Internal server error",
        });
      },
    ],
    [
      "a network failure",
      () => {
        throw new TypeError("Failed to fetch");
      },
    ],
  ])("keeps the project on screen after %s", async (_label, failingDelete) => {
    const alpha = makeProject({ name: "Alpha" });
    fakeBackend([alpha, makeProject({ name: "Beta" })], {
      [`DELETE projects/${alpha.id}`]: failingDelete,
    });
    await renderDashboard();

    const confirm = await openDeleteConfirmation("Alpha");
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Delete permanently" }),
    );

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "Could not delete the project. Check your connection and try again.",
    );
    expect(projectNames()).toEqual(["Alpha", "Beta"]);
    expect(statValue("Total Projects")).toBe("2");
    expect(screen.queryByText(/deleted\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal server error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    // The user can try again.
    expect(
      within(confirm).getByRole("button", { name: "Delete permanently" }),
    ).toBeEnabled();
  });

  it("reloads and says so when the project was already deleted", async () => {
    const alpha = makeProject({ name: "Alpha" });
    const stored = fakeBackend([alpha, makeProject({ name: "Beta" })], {
      [`DELETE projects/${alpha.id}`]: () => {
        throw new ApiError(404, "Not Found", { error: "Project not found" });
      },
    });
    // Someone else deleted it after the page loaded.
    await renderDashboard();
    stored.splice(0, 1);

    const confirm = await openDeleteConfirmation("Alpha");
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Delete permanently" }),
    );

    expect(
      await screen.findByText('"Alpha" had already been deleted.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(projectNames()).toEqual(["Beta"]));
    expect(statValue("Total Projects")).toBe("1");
  });
});
