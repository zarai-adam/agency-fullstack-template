
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { useTestDatabase } from "./helpers/testDb.js";

describe("GET /health", () => {
  it("returns a healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("GET /health/ready", () => {
  // Vitest runs each test file in its own process, so nothing in this file
  // has connected to MongoDB yet: this is a real "disconnected" state.
  describe("when the database is not connected", () => {
    it("returns 503 not_ready", async () => {
      expect(mongoose.connection.readyState).toBe(0);

      const response = await request(app).get("/health/ready");

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: "not_ready" });
    });

    it("returns 503 while still connecting", async () => {
      // 2 = connecting. Hard to reach for real on demand, so fake only the
      // state by hiding Mongoose's readyState getter (on the prototype) with
      // our own property. Not vi.spyOn: its restore leaves the fake value
      // stuck for this inherited getter, which broke the connected tests.
      Object.defineProperty(mongoose.connection, "readyState", {
        configurable: true,
        get: () => 2,
      });

      try {
        const response = await request(app).get("/health/ready");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: "not_ready" });
      } finally {
        // Remove our property so the real getter is used again.
        Reflect.deleteProperty(mongoose.connection, "readyState");
      }

      expect(mongoose.connection.readyState).toBe(0);
    });

    it("keeps /health at 200 ok", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  // useTestDatabase() inside this block connects to a throwaway in-memory
  // MongoDB for these tests only. No real database server is needed.
  describe("when the database is connected", () => {
    useTestDatabase();

    it("returns 200 ready", async () => {
      expect(mongoose.connection.readyState).toBe(1);

      const response = await request(app).get("/health/ready");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ready" });
    });
  });
});
