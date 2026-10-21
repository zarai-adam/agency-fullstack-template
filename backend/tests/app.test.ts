import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { app } from "../src/app.js";

// This file never connects to MongoDB. Vitest runs each test file in its own
// process, so the connection here is always "disconnected".

// Silence and record console.error for every test, then put it back.
const originalConsoleError = console.error;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  // Guard against the spy leaking into other tests.
  expect(console.error).toBe(originalConsoleError);
});

// Larger than express.json()'s default 100 KB (102,400 bytes) limit.
const oversizedJson = JSON.stringify({
  name: "Too big",
  description: "a".repeat(110_000),
});

describe("Security headers", () => {
  it.each([
    ["GET", "/health"],
    ["GET", "/does-not-exist"],
    ["GET", "/projects/not-a-valid-id"],
  ] as const)("are set on %s %s", async (_method, path) => {
    const response = await request(app).get(path);

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("are set on error responses too", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("Unknown routes", () => {
  it.each([
    ["GET", "/does-not-exist"],
    ["POST", "/projects-typo"],
    ["DELETE", "/health/extra"],
  ] as const)("%s %s returns a JSON 404", async (method, path) => {
    const response = await request(app)[
      method.toLowerCase() as "get" | "post" | "delete"
    ](path);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it("does not hide the existing routes", async () => {
    expect((await request(app).get("/health")).status).toBe(200);
    // 503 (not 404): the readiness route is still reached.
    expect((await request(app).get("/health/ready")).status).toBe(503);
    // 400 (not 404): the projects router still handles its paths.
    expect((await request(app).get("/projects/not-a-valid-id")).status).toBe(400);
  });
});

describe("Request body errors", () => {
  it("returns 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Request body must be valid JSON" });
  });

  it("returns 413 for a JSON body over the size limit", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .send(oversizedJson);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "Request body is too large" });
  });

  it("returns 415 for an unsupported content encoding, without echoing it", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "made-up-encoding")
      .send('{"name":"x"}');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: "Unsupported content encoding" });
    expect(response.text).not.toContain("made-up-encoding");
  });

  it("returns 415 for an unsupported charset, without echoing it", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Content-Type", "application/json; charset=made-up-charset")
      .send('{"name":"x"}');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: "Unsupported charset" });
    expect(response.text.toLowerCase()).not.toContain("made-up-charset");
  });

  it("does not log these expected client errors", async () => {
    await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .send("{ not json");
    await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .send(oversizedJson);
    await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "made-up-encoding")
      .send('{"name":"x"}');

    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("Unexpected errors", () => {
  // A real server-side failure, no mocks: with no database connection, the
  // Project model throws at once (bufferCommands is off).
  it("returns a generic 500 without internal details, and logs the error", async () => {
    expect(mongoose.connection.readyState).toBe(0);

    const response = await request(app).get("/projects");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
    expect(response.text).not.toMatch(/bufferCommands|projects\.find|mongoose/i);

    // The details go to the server log instead.
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toMatch(/bufferCommands/);
  });
});
