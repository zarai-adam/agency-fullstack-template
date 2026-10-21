import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { apiRequest } from "./lib/api";
import { mockApiRoutes } from "./test/mockApi";

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

    // Overview is the only real page, so it is the only link.
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Overview");
    expect(links[0]).toHaveAttribute("aria-current", "page");

    // The other five are clearly marked as placeholders.
    expect(within(nav).getAllByText("Coming soon")).toHaveLength(5);
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
