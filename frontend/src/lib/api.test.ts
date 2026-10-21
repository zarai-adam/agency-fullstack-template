import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ id: "1" }], { status: 200 })),
    );

    await expect(apiRequest("projects")).resolves.toEqual([{ id: "1" }]);
  });

  it("throws an ApiError with the status and body on failure", async () => {
    const body = { error: "Invalid project data", details: { name: ["Bad"] } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body, { status: 400 })),
    );

    const error = await apiRequest("projects").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, data: body });
  });

  it("uses null as the body when the error response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })),
    );

    const error = await apiRequest("projects").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, data: null });
  });
});
