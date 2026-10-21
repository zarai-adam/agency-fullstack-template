import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import mongoose from "mongoose";
import { projectsRouter } from "./projects/project.routes.js";

export const app = express();

// Don't advertise the framework in every response.
app.disable("x-powered-by");

// Registered first so every response gets it, including errors and 404s:
// tells browsers not to guess a different content type than the one sent.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

// Readiness: can this instance serve requests right now? Unlike /health
// (the process is alive), this fails while MongoDB is not connected, so a
// load balancer can stop sending traffic here. readyState 1 = connected.
app.get("/health/ready", (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: "ready" });
    return;
  }

  res.status(503).json({ status: "not_ready" });
});

app.use("/projects", projectsRouter);

// Any request no route above handled. Must come after every route and
// before the error handler.
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// express.json() reports problems with the request body as errors that have
// a 4xx `status`, `expose: true`, and a `type`. Those are the client's
// mistake, not a server failure.
type ClientError = { status: number; expose: true; type?: unknown };

function isClientError(error: unknown): error is ClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    "expose" in error &&
    error.expose === true
  );
}

// Our own fixed messages. Never send error.message: some body-parser
// messages repeat request headers back, e.g. the unsupported encoding name.
const clientErrorMessages: Partial<Record<string, string>> = {
  "entity.parse.failed": "Request body must be valid JSON",
  "entity.too.large": "Request body is too large",
  "encoding.unsupported": "Unsupported content encoding",
  "charset.unsupported": "Unsupported charset",
};

// Error handler: must be registered last and must take 4 arguments, or
// Express will not treat it as an error handler. Express 5 sends errors
// thrown in async route handlers here automatically.
app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Expected client mistakes: answer with their status, don't log them.
    if (isClientError(error)) {
      const message =
        (typeof error.type === "string" && clientErrorMessages[error.type]) ||
        "Invalid request";
      res.status(error.status).json({ error: message });
      return;
    }

    // Anything else is a server problem. Log the details on the server,
    // but never send them to the client.
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  },
);
