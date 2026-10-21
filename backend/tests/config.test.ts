import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config.js";

describe("parseEnv", () => {
  it("accepts a local MongoDB URI and applies defaults", () => {
    const env = parseEnv({ MONGODB_URI: "mongodb://127.0.0.1:27017/test" });

    expect(env).toEqual({
      NODE_ENV: "development",
      PORT: 3000,
      MONGODB_URI: "mongodb://127.0.0.1:27017/test",
    });
  });

  it("accepts a mongodb+srv URI", () => {
    const env = parseEnv({
      MONGODB_URI: "mongodb+srv://cluster.example.net/agency",
    });

    expect(env.MONGODB_URI).toBe("mongodb+srv://cluster.example.net/agency");
  });

  it("rejects a missing MONGODB_URI", () => {
    expect(() => parseEnv({})).toThrow("MONGODB_URI is required");
  });

  it("rejects a URI that is not a MongoDB URI", () => {
    expect(() => parseEnv({ MONGODB_URI: "http://localhost:27017" })).toThrow(
      "must start with mongodb://",
    );
  });
});
