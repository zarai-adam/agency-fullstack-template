import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "../../lib/api";
import {
  deferred,
  fakeBackend,
  makeProject,
  mockApiRoutes,
} from "../../test/mockApi";
import { ProjectsPage } from "./ProjectsPage";
import type { Project } from "./types";

// Keep the real ApiError class; only replace the network call.
vi.mock("../../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api")>()),
  apiRequest: vi.fn(),
}));

// Seven projects: more than the dashboard's five, to prove all are shown.
// Listed newest first, which is how the backend returns them.
function sampleProjects(): Project[] {
  return [
    ["Website redesign", "New landing page", "active", "2026-10-07"],
    ["Support chatbot", "Assistant for the help desk", "planning", "2026-10-06"],
    ["Brand guide", "Logo and colours", "completed", "2026-10-05"],
    ["Email automation", "Weekly newsletter", "on_hold", "2026-10-04"],
    ["Mobile app", "", "active", "2026-10-03"],
    ["SEO audit", "Search ranking review", "planning", "2026-10-02"],
    ["Analytics setup", "Traffic reports", "completed", "2026-10-01"],
  ].map(([name, description, status, date]) =>
    makeProject({
      name,
      description,
      status: status as Project["status"],
      createdAt: `${date}T09:00:00.000Z`,
    }),
  );
}

const allNames = sampleProjects().map((project) => project.name);

function listSection() {
  return screen.getByRole("region", { name: "All projects" });
}

function shownNames() {
  return Array.from(
    listSection().querySelectorAll(".project-list__name"),
  ).map((element) => element.textContent);
}

function summary() {
  return listSection().querySelector('[aria-live="polite"]')?.textContent;
}

async function renderPage() {
  render(<ProjectsPage />);
  await waitFor(() =>
    expect(screen.queryByText("Loading projects...")).not.toBeInTheDocument(),
  );
}

function search(text: string) {
  fireEvent.change(screen.getByLabelText("Search projects"), {
    target: { value: text },
  });
}

function chooseStatus(value: string) {
  fireEvent.change(screen.getByLabelText("Filter by status"), {
    target: { value },
  });
}

function chooseSort(value: string) {
  fireEvent.change(screen.getByLabelText("Sort by"), { target: { value } });
}

function callsTo(method: string) {
  return vi
    .mocked(apiRequest)
    .mock.calls.filter(([, init]) => init?.method === method);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Projects page: list, search, filter, sort", () => {
  it("shows every project the API returns, with status labels", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
    expect(shownNames()).toEqual(allNames);
    expect(summary()).toBe("Showing 7 of 7 projects.");

    const firstItem = within(listSection()).getAllByRole("listitem")[0];
    expect(within(firstItem).getByText("Active")).toBeInTheDocument();
    const thirdItem = within(listSection()).getAllByRole("listitem")[2];
    expect(within(thirdItem).getByText("Completed")).toBeInTheDocument();
  });

  it("searches by name, ignoring case", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    search("WEBSITE");

    expect(shownNames()).toEqual(["Website redesign"]);
    expect(summary()).toBe("Showing 1 of 7 projects.");
  });

  it("searches by description", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    search("help desk");
    expect(shownNames()).toEqual(["Support chatbot"]);

    search("  logo  ");
    expect(shownNames()).toEqual(["Brand guide"]);
  });

  it("filters by each status, and combines with search", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    chooseStatus("on_hold");
    expect(shownNames()).toEqual(["Email automation"]);

    chooseStatus("active");
    expect(shownNames()).toEqual(["Website redesign", "Mobile app"]);

    chooseStatus("planning");
    expect(shownNames()).toEqual(["Support chatbot", "SEO audit"]);

    chooseStatus("completed");
    expect(shownNames()).toEqual(["Brand guide", "Analytics setup"]);

    chooseStatus("active");
    search("app");
    expect(shownNames()).toEqual(["Mobile app"]);

    chooseStatus("all");
    search("");
    expect(shownNames()).toEqual(allNames);
  });

  it("sorts by oldest and newest", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    expect(screen.getByLabelText("Sort by")).toHaveValue("newest");

    chooseSort("oldest");
    expect(shownNames()).toEqual([...allNames].reverse());

    chooseSort("newest");
    expect(shownNames()).toEqual(allNames);
  });

  it("shows a no-results state, and Clear filters keeps the sort order", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    chooseSort("oldest");
    chooseStatus("active");
    search("nothing matches this");

    expect(
      screen.getByText("No projects match your search or filters."),
    ).toBeInTheDocument();
    expect(summary()).toBe("Showing 0 of 7 projects.");

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByLabelText("Search projects")).toHaveValue("");
    expect(screen.getByLabelText("Filter by status")).toHaveValue("all");
    expect(shownNames()).toEqual([...allNames].reverse());
  });
});

describe("Projects page: loading, empty, and error states", () => {
  it("shows a loading state until projects arrive", async () => {
    const response = deferred<Project[]>();
    mockApiRoutes({ "GET projects": () => response.promise });

    render(<ProjectsPage />);
    expect(screen.getByText("Loading projects...")).toBeInTheDocument();

    response.resolve(sampleProjects());
    expect(await screen.findByText("Website redesign")).toBeInTheDocument();
  });

  it("shows an empty state that opens the create form", async () => {
    fakeBackend([]);
    await renderPage();

    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    expect(summary()).toBe("");

    fireEvent.click(
      screen.getByRole("button", { name: "Create your first project" }),
    );

    const form = screen.getByRole("region", { name: "Create project" });
    expect(within(form).getByLabelText(/^Name/)).toHaveFocus();
  });

  it("shows a friendly error without internal details, and can retry", async () => {
    let calls = 0;
    mockApiRoutes({
      "GET projects": () => {
        calls += 1;
        if (calls === 1) {
          throw new ApiError(500, "Internal Server Error", {
            error: "Internal server error",
          });
        }
        return sampleProjects();
      },
    });

    render(<ProjectsPage />);

    expect(await within(listSection()).findByRole("alert")).toHaveTextContent(
      "Could not load projects",
    );
    expect(screen.queryByText(/Internal server error/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Website redesign")).toBeInTheDocument();
    expect(shownNames()).toHaveLength(7);
  });
});

describe("Projects page: create, edit, delete", () => {
  it("opens the create form, creates a project, and refreshes the list", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    const newButton = screen.getByRole("button", { name: "New project" });
    expect(newButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(newButton);
    expect(newButton).toHaveAttribute("aria-expanded", "true");

    const form = screen.getByRole("region", { name: "Create project" });
    const nameInput = within(form).getByLabelText(/^Name/);
    expect(nameInput).toHaveFocus();

    fireEvent.change(nameInput, { target: { value: "Podcast launch" } });
    fireEvent.click(within(form).getByRole("button", { name: "Create project" }));

    expect(
      await within(form).findByText('Project "Podcast launch" created.'),
    ).toBeInTheDocument();
    expect(callsTo("POST")).toHaveLength(1);
    await waitFor(() => expect(shownNames()[0]).toBe("Podcast launch"));
    expect(summary()).toBe("Showing 8 of 8 projects.");

    // Closing the form returns focus to the button that opened it.
    fireEvent.click(screen.getByRole("button", { name: "Close form" }));
    expect(
      screen.queryByRole("region", { name: "Create project" }),
    ).not.toBeInTheDocument();
    expect(newButton).toHaveFocus();
    expect(newButton).toHaveAttribute("aria-expanded", "false");
  });

  it("edits a project and shows the saved change", async () => {
    const stored = fakeBackend(sampleProjects());
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit Brand guide" }));
    const form = screen.getByRole("form", { name: 'Edit "Brand guide"' });
    fireEvent.change(within(form).getByLabelText("Status"), {
      target: { value: "on_hold" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText('Changes to "Brand guide" saved.'),
    ).toBeInTheDocument();
    expect(JSON.parse(String(callsTo("PATCH")[0][1]?.body))).toEqual({
      status: "on_hold",
    });
    expect(stored.find((p) => p.name === "Brand guide")?.status).toBe("on_hold");

    const item = within(listSection()).getAllByRole("listitem")[2];
    expect(within(item).getByText("On hold")).toBeInTheDocument();
  });

  it("says so when an edited project no longer matches the filter", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    chooseStatus("completed");
    expect(shownNames()).toEqual(["Brand guide", "Analytics setup"]);

    fireEvent.click(screen.getByRole("button", { name: "Edit Brand guide" }));
    const form = screen.getByRole("form", { name: 'Edit "Brand guide"' });
    fireEvent.change(within(form).getByLabelText("Status"), {
      target: { value: "active" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(
        'Changes to "Brand guide" saved. It no longer matches the current filters.',
      ),
    ).toBeInTheDocument();
    expect(shownNames()).toEqual(["Analytics setup"]);
    // Its Edit button is gone, so focus moves to the list heading.
    expect(screen.getByRole("heading", { name: "All projects" })).toHaveFocus();
  });

  it("deletes a project after confirmation and refreshes the list", async () => {
    fakeBackend(sampleProjects());
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Delete SEO audit" }));
    const confirm = screen.getByRole("group", {
      name: "Confirm deleting SEO audit",
    });
    expect(confirm).toHaveTextContent("It cannot be undone.");
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Delete permanently" }),
    );

    expect(
      await screen.findByText('Project "SEO audit" deleted.'),
    ).toBeInTheDocument();
    expect(shownNames()).not.toContain("SEO audit");
    expect(summary()).toBe("Showing 6 of 6 projects.");
    expect(screen.getByRole("heading", { name: "All projects" })).toHaveFocus();
  });

  it("keeps the project when deletion fails", async () => {
    const projects = sampleProjects();
    const seo = projects[5];
    fakeBackend(projects, {
      [`DELETE projects/${seo.id}`]: () => {
        throw new ApiError(500, "Internal Server Error", {
          error: "Internal server error",
        });
      },
    });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Delete SEO audit" }));
    const confirm = screen.getByRole("group", {
      name: "Confirm deleting SEO audit",
    });
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Delete permanently" }),
    );

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "Could not delete the project.",
    );
    expect(shownNames()).toContain("SEO audit");
    expect(summary()).toBe("Showing 7 of 7 projects.");
  });
});
