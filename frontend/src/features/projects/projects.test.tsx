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

// Reads the big number on a metric card, e.g. statValue("Total Projects").
function statValue(label: string) {
  const card = screen.getByRole("heading", { name: label }).closest("article");
  return card?.querySelector(".stat-card__value")?.textContent;
}

function projectNames() {
  const section = screen.getByRole("region", { name: "Recent projects" });
  return within(section)
    .queryAllByRole("listitem")
    .map((item) => item.querySelector(".project-list__name")?.textContent);
}

function postCalls() {
  return vi
    .mocked(apiRequest)
    .mock.calls.filter(([, init]) => init?.method === "POST");
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Projects on the dashboard", () => {
  it("shows a loading state, then real projects and counts", async () => {
    const response = deferred<Project[]>();
    mockApiRoutes({ "GET projects": () => response.promise });

    render(<DashboardPage />);

    expect(screen.getByText("Loading projects...")).toBeInTheDocument();
    expect(statValue("Total Projects")).toBe("…");

    // The API returns newest first; the dashboard keeps that order.
    response.resolve([
      makeProject({ name: "Newest", status: "active" }),
      makeProject({ name: "Middle", status: "active" }),
      makeProject({ name: "Oldest", status: "planning" }),
    ]);

    expect(await screen.findByText("Newest")).toBeInTheDocument();
    expect(projectNames()).toEqual(["Newest", "Middle", "Oldest"]);
    expect(statValue("Total Projects")).toBe("3");
    expect(statValue("Active Projects")).toBe("2");
    expect(screen.queryByText("Loading projects...")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no projects", async () => {
    mockApiRoutes({ "GET projects": () => [] });

    render(<DashboardPage />);

    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(statValue("Total Projects")).toBe("0");
    expect(statValue("Active Projects")).toBe("0");
  });

  it("shows only the five newest projects", async () => {
    const projects = Array.from({ length: 7 }, (_, i) =>
      makeProject({ name: `P${i + 1}` }),
    );
    mockApiRoutes({ "GET projects": () => projects });

    render(<DashboardPage />);

    expect(await screen.findByText("P1")).toBeInTheDocument();
    expect(projectNames()).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    expect(screen.getByText("Showing 5 of 7 projects.")).toBeInTheDocument();
    expect(statValue("Total Projects")).toBe("7");
  });

  it("shows a friendly error without internal details when loading fails", async () => {
    mockApiRoutes({
      "GET projects": () => {
        throw new ApiError(500, "Internal Server Error", {
          error: "Internal server error",
        });
      },
    });

    render(<DashboardPage />);

    const section = screen.getByRole("region", { name: "Recent projects" });
    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "Could not load projects",
    );
    expect(statValue("Total Projects")).toBe("—");
    expect(screen.queryByText(/Internal server error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/API request failed/i)).not.toBeInTheDocument();
  });

  it("loads the projects again when Try again is clicked", async () => {
    let calls = 0;
    mockApiRoutes({
      "GET projects": () => {
        calls += 1;
        if (calls === 1) throw new TypeError("Failed to fetch");
        return [makeProject({ name: "Recovered" })];
      },
    });

    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    expect(statValue("Total Projects")).toBe("1");
  });
});

describe("Create project form", () => {
  it("creates a project, then refreshes the count and list", async () => {
    // A tiny fake backend: POST stores the project, GET returns them all.
    const stored: Project[] = [];
    mockApiRoutes({
      "GET projects": () => [...stored],
      "POST projects": (init) => {
        const project = makeProject(JSON.parse(String(init?.body)));
        stored.unshift(project);
        return project;
      },
    });

    render(<DashboardPage />);
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "  New website  " },
    });
    fireEvent.change(screen.getByLabelText("Description (optional)"), {
      target: { value: "Landing page" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      await screen.findByText('Project "New website" created.'),
    ).toBeInTheDocument();

    // Sent trimmed values to POST /projects.
    expect(postCalls()).toHaveLength(1);
    expect(JSON.parse(String(postCalls()[0][1]?.body))).toEqual({
      name: "New website",
      description: "Landing page",
      status: "active",
    });

    // The list and the counts were loaded again from the API.
    await waitFor(() => expect(projectNames()).toEqual(["New website"]));
    expect(statValue("Total Projects")).toBe("1");
    expect(statValue("Active Projects")).toBe("1");

    // The form is ready for the next project.
    expect(screen.getByLabelText(/^Name/)).toHaveValue("");
    expect(screen.getByLabelText("Status")).toHaveValue("planning");
  });

  it("disables the button while the project is being created", async () => {
    const response = deferred<Project>();
    mockApiRoutes({
      "GET projects": () => [],
      "POST projects": () => response.promise,
    });

    render(<DashboardPage />);
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Slow project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      await screen.findByRole("button", { name: "Creating..." }),
    ).toBeDisabled();

    response.resolve(makeProject({ name: "Slow project" }));
    expect(
      await screen.findByRole("button", { name: "Create project" }),
    ).toBeEnabled();
  });

  it("requires a name and does not call the API", async () => {
    mockApiRoutes({ "GET projects": () => [] });

    render(<DashboardPage />);
    await screen.findByText(/No projects yet/);

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    const nameInput = screen.getByLabelText(/^Name/);
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAccessibleDescription(/Name is required/);
    expect(nameInput).toHaveFocus();
    expect(postCalls()).toHaveLength(0);
  });

  it("rejects a name longer than 100 characters", async () => {
    mockApiRoutes({ "GET projects": () => [] });

    render(<DashboardPage />);
    await screen.findByText(/No projects yet/);

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "a".repeat(101) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      screen.getByText("Name must be 100 characters or fewer"),
    ).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it("shows the backend's validation errors next to the fields", async () => {
    // Simulated 400 in the backend's real shape: { error, details }.
    mockApiRoutes({
      "GET projects": () => [],
      "POST projects": () => {
        throw new ApiError(400, "Bad Request", {
          error: "Invalid project data",
          details: { name: ["Rejected by the server"] },
        });
      },
    });

    render(<DashboardPage />);
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Valid locally" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Rejected by the server")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText("Invalid project data", { selector: '[role="alert"]' }),
    ).toBeInTheDocument();
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
  ])("shows a generic message for %s", async (_label, failingPost) => {
    mockApiRoutes({ "GET projects": () => [], "POST projects": failingPost });

    render(<DashboardPage />);
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "My project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      await screen.findByText(
        "Could not create the project. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Internal server error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    // What the user typed is kept so they can try again.
    expect(screen.getByLabelText(/^Name/)).toHaveValue("My project");
  });
});
