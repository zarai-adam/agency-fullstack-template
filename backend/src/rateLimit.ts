import type { Request } from "express";
import { MINUTE, rateLimit, type RateLimitRequestHandler } from "express-rate-limit";

// Rate limiting slows down abuse from one IP address. It is NOT a replacement
// for authentication: anyone can still use the API, just not as fast.

export type ProjectRateLimits = {
  windowMs: number;
  // Every /projects request, reads and writes together.
  general: number;
  // POST, PATCH, and DELETE only, inside the general budget.
  writes: number;
};

export const defaultProjectRateLimits: ProjectRateLimits = {
  windowMs: 15 * MINUTE,
  general: 100,
  writes: 20,
};

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"]);

const isWrite = (req: Request) => WRITE_METHODS.has(req.method);

// Clients are identified by req.ip. "trust proxy" is off, so this is the
// address that actually connected; X-Forwarded-For is ignored and cannot be
// faked to get a fresh limit. Each limiter has its own in-memory store.
//
// Returned in the order they must run:
// 1. Writes: counts only POST/PATCH/DELETE. A write it rejects stops here
//    and does not use up the general budget, so a client that hit the write
//    limit can still read.
// 2. General: counts every request that got this far, once.
// A write that is let through therefore uses one slot in each budget: writes
// are part of the overall 100, and at most 20 of them.
export function createProjectRateLimiters(
  limits: ProjectRateLimits = defaultProjectRateLimits,
): RateLimitRequestHandler[] {
  const shared = {
    windowMs: limits.windowMs,
    // "draft-8" names each policy, so both limiters' headers can be sent
    // side by side (older drafts overwrite each other). No X-RateLimit-*.
    standardHeaders: "draft-8",
    legacyHeaders: false,
    statusCode: 429,
    message: { error: "Too many requests. Please try again later." },
  } as const;

  return [
    rateLimit({
      ...shared,
      identifier: "project-writes",
      limit: limits.writes,
      skip: (req) => !isWrite(req),
    }),
    rateLimit({
      ...shared,
      identifier: "projects",
      limit: limits.general,
    }),
  ];
}
