
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../lib/api";
import { HealthCheck } from "./HealthCheck";

vi.mock("../../lib/api", () => ({
  apiRequest: vi.fn(),
}));

describe("HealthCheck", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows success when the API is healthy", async () => {
    vi.mocked(apiRequest).mockImplementation(
      async () => ({ status: "ok" }) as never,
    );

    render(<HealthCheck />);

    expect(
      await screen.findByText("API connected successfully"),
    ).toBeInTheDocument();
  });

  it("shows an error when the API request fails", async () => {
    vi.mocked(apiRequest).mockRejectedValue(
      new Error("Network error"),
    );

    render(<HealthCheck />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "API connection failed",
    );
  });
});
