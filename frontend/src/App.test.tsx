import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { apiRequest } from "./lib/api";
import { makeProject, mockApiRoutes } from "./test/mockApi";

// The dashboard includes the real HealthCheck and project list, so mock the
// API client to keep these tests from making network requests.
vi.mock("./lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/api")>()),
  apiRequest: vi.fn(),
}));

describe("Agency dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApiRoutes({ "GET projects": () => [] });
  });

  it("shows the page title and profile area", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Demo User")).toBeInTheDocument();
    await screen.findByText("API connected successfully");
  });

  it("lists every navigation item and only links to pages that exist", async () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    for (const label of [
      "Overview",
      "Projects",
      "Clients",
      "AI Tools",
      "Automations",
      "Settings",
    ]) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }

    // Overview and Projects are the only real pages, so the only links.
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Overview",
      "Projects",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");

    // The other four are clearly marked as placeholders.
    expect(within(nav).getAllByText("Coming soon")).toHaveLength(4);
    await screen.findByText("API connected successfully");
  });

  it("shows the four overview cards labelled as demo data", async () => {
    render(<App />);

    const metrics = screen.getByRole("region", { name: "Key metrics" });

    for (const label of [
      "Total Projects",
      "Active Clients",
      "AI Automations",
      "Tasks Completed",
    ]) {
      expect(
        within(metrics).getByRole("heading", { name: label }),
      ).toBeInTheDocument();
    }
    // Total Projects is now live; the other three cards are still demo data.
    expect(within(metrics).getAllByText("Demo data")).toHaveLength(3);
    expect(
      within(metrics).getByText(/not loaded from the backend/i),
    ).toBeInTheDocument();
    await screen.findByText("API connected successfully");
  });

  it("shows recent activity labelled as demo data", async () => {
    render(<App />);

    const activity = screen.getByRole("region", { name: "Recent activity" });

    expect(within(activity).getByText("Demo data")).toBeInTheDocument();
    expect(within(activity).getAllByRole("listitem").length).toBeGreaterThan(0);
    await screen.findByText("API connected successfully");
  });

  it("keeps the API health check visible on the dashboard", async () => {
    render(<App />);

    const status = screen.getByRole("region", { name: "System status" });

    expect(
      await within(status).findByText("API connected successfully"),
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("health");
  });
});

describe("Page navigation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApiRoutes({
      "GET projects": () =>
        Array.from({ length: 7 }, (_, i) => makeProject({ name: `P${i + 1}` })),
    });
  });

  it("opens the Projects page from the sidebar and comes back to Overview", async () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    fireEvent.click(within(nav).getByRole("link", { name: "Projects" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/projects");
    expect(document.title).toBe("Projects · AI Agency Dashboard");
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Focus moves to the new page so screen readers start at its content.
    expect(screen.getByRole("main")).toHaveFocus();
    // All seven projects, not just the dashboard's five.
    expect(await screen.findByText("P7")).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("link", { name: "Overview" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Overview · AI Agency Dashboard");
  });

  it("opens the Projects page from the dashboard's View all projects link", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "View all projects" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
  });

  it("shows the Projects page when the URL already points to it", async () => {
    window.location.hash = "#/projects";

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
    await screen.findByText("P1");
  });

  it("moves focus with the skip link without changing the page", async () => {
    window.location.hash = "#/projects";
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    // A link's hash change is applied a moment later, so wait one tick
    // before checking that the page did not change.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe("#/projects");
    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
    // P7 is only shown on the Projects page (the dashboard shows five).
    expect(await screen.findByText("P7")).toBeInTheDocument();
  });
});
