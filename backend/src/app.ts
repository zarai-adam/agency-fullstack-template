import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { projectsRouter } from "./projects/project.routes.js";

export const app = express();

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

app.use("/projects", projectsRouter);

// Error handler: must be registered last and must take 4 arguments, or
// Express will not treat it as an error handler. Express 5 sends errors
// thrown in async route handlers here automatically.
app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // express.json() throws this when the request body is not valid JSON.
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      res.status(400).json({ error: "Request body must be valid JSON" });
      return;
    }

    // Log the details on the server, but never send them to the client.
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  },
);
