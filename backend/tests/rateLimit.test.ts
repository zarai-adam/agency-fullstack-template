import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app as productionApp, createApp } from "../src/app.js";
import { defaultProjectRateLimits } from "../src/rateLimit.js";

// Every test builds a fresh app with small limits, so each one starts with
// empty counters and the order of tests does not matter. The requests used
// here are answered without a database (validation fails first), so no
// MongoDB is needed.

const TOO_MANY = { error: "Too many requests. Please try again later." };

function appWithLimits(general: number, writes: number) {
  return createApp({
    projectRateLimits: { windowMs: 60_000, general, writes },
  });
}

// Requests that reach the projects routes and get a normal 400.
const read = (app: ReturnType<typeof createApp>) =>
  request(app).get("/projects/not-a-valid-id");
const writes = {
  post: (app: ReturnType<typeof createApp>) =>
    request(app).post("/projects").send({}),
  patch: (app: ReturnType<typeof createApp>) =>
    request(app).patch("/projects/not-a-valid-id").send({ status: "active" }),
  delete: (app: ReturnType<typeof createApp>) =>
    request(app).delete("/projects/not-a-valid-id"),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("production limits", () => {
  it("are 100 requests and 20 writes per 15 minutes", () => {
    expect(defaultProjectRateLimits).toEqual({
      windowMs: 15 * 60 * 1000,
      general: 100,
      writes: 20,
    });
  });

  it("are what the exported app uses, shown in the standard headers", async () => {
    const response = await request(productionApp)
      .post("/projects")
      .send({});

    // Both budgets are reported; each counted this write once.
    expect(response.headers["ratelimit-policy"]).toContain(
      '"project-writes"; q=20; w=900',
    );
    expect(response.headers["ratelimit-policy"]).toContain(
      '"projects"; q=100; w=900',
    );
    expect(response.headers["ratelimit"]).toContain('"project-writes"; r=19');
    expect(response.headers["ratelimit"]).toContain('"projects"; r=99');
  });
});

describe("general limit", () => {
  it("allows requests up to the limit, then returns 429", async () => {
    const app = appWithLimits(3, 10);

    for (let i = 0; i < 3; i++) {
      const response = await read(app);
      // Existing behavior is unchanged while under the limit.
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid project ID" });
    }

    const limited = await read(app);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual(TOO_MANY);
  });

  it("counts each write once, together with reads", async () => {
    const app = appWithLimits(4, 10);

    // 2 writes + 2 reads = 4 requests. If writes were counted twice in the
    // general budget, the third request would already be refused.
    expect((await writes.post(app)).status).toBe(400);
    expect((await writes.patch(app)).status).toBe(400);
    expect((await read(app)).status).toBe(400);
    expect((await read(app)).status).toBe(400);

    expect((await read(app)).status).toBe(429);
  });
});

describe("write limit", () => {
  it("counts POST, PATCH, and DELETE, then returns 429 for writes", async () => {
    const app = appWithLimits(100, 3);

    expect((await writes.post(app)).status).toBe(400);
    expect((await writes.patch(app)).status).toBe(400);
    expect((await writes.delete(app)).status).toBe(400);

    for (const write of [writes.post, writes.patch, writes.delete]) {
      const limited = await write(app);
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual(TOO_MANY);
    }
  });

  it("does not stop reads once the write limit is reached", async () => {
    const app = appWithLimits(100, 1);

    expect((await writes.post(app)).status).toBe(400);
    expect((await writes.post(app)).status).toBe(429);

    expect((await read(app)).status).toBe(400);
  });

  it("does not let refused writes use up the general budget", async () => {
    const app = appWithLimits(3, 1);

    expect((await writes.post(app)).status).toBe(400); // general: 1
    expect((await writes.post(app)).status).toBe(429); // stopped by writes
    expect((await writes.post(app)).status).toBe(429); // stopped by writes

    expect((await read(app)).status).toBe(400); // general: 2
    expect((await read(app)).status).toBe(400); // general: 3
    expect((await read(app)).status).toBe(429);
  });
});

describe("429 response", () => {
  it("is JSON with standard headers, CORS, and nosniff, without legacy headers", async () => {
    const app = appWithLimits(1, 10);
    await read(app);

    const response = await read(app).set("Origin", "http://localhost:5173");

    expect(response.status).toBe(429);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual(TOO_MANY);

    // Standard (draft-8) headers, and when to retry.
    expect(response.headers["ratelimit"]).toContain('"projects"; r=0');
    expect(response.headers["ratelimit-policy"]).toContain('"projects"; q=1');
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);

    // No legacy or draft-6 style headers.
    expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(response.headers["x-ratelimit-remaining"]).toBeUndefined();
    expect(response.headers["x-ratelimit-reset"]).toBeUndefined();
    expect(response.headers["ratelimit-limit"]).toBeUndefined();

    // Existing middleware still applies to the 429.
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("cannot be avoided by sending a different X-Forwarded-For", async () => {
    // express-rate-limit warns once (via console.error) when the first
    // request it sees has this header but "trust proxy" is off. Its checks
    // run only on a limiter's first request, so both requests send the
    // header. Silence that expected warning here.
    const warning = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = appWithLimits(1, 10);

    const first = await read(app).set("X-Forwarded-For", "198.51.100.1");
    expect(first.status).toBe(400);

    // Pretending to be another client does not give a fresh limit: the
    // limit follows the real connection address.
    const second = await read(app).set("X-Forwarded-For", "203.0.113.7");
    expect(second.status).toBe(429);

    expect(app.get("trust proxy")).toBe(false);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(String(warning.mock.calls[0][0])).toContain(
      "ERR_ERL_UNEXPECTED_X_FORWARDED_FOR",
    );
  });
});

describe("health endpoints", () => {
  it("are never rate limited, even when /projects is", async () => {
    const app = appWithLimits(1, 1);
    await writes.post(app);
    expect((await read(app)).status).toBe(429);

    for (let i = 0; i < 5; i++) {
      const health = await request(app).get("/health");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: "ok" });
      expect(health.headers["ratelimit"]).toBeUndefined();

      // 503 because this file has no database: still not 429.
      const ready = await request(app).get("/health/ready");
      expect(ready.status).toBe(503);
      expect(ready.body).toEqual({ status: "not_ready" });
    }
  });
});

describe("other paths", () => {
  it("are not counted under /projects", async () => {
    const app = appWithLimits(1, 1);
    await read(app);

    // "/projects-typo" is not under "/projects": a normal JSON 404.
    const response = await request(app).get("/projects-typo");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it("CORS preflight requests are not counted", async () => {
    const app = appWithLimits(1, 1);

    for (let i = 0; i < 3; i++) {
      const preflight = await request(app)
        .options("/projects")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST");
      expect(preflight.status).toBe(204);
    }

    // The single allowed write is still available.
    expect((await writes.post(app)).status).toBe(400);
  });
});
