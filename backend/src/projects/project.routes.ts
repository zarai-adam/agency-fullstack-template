import { Router, type NextFunction, type Request, type Response } from "express";
import { isObjectIdOrHexString } from "mongoose";
import { z } from "zod";
import { ProjectModel } from "./project.model.js";
import {
  createProjectSchema,
  updateProjectSchema,
} from "./project.schemas.js";

export const projectsRouter = Router();

// Same shape for every validation failure: { error, details }.
// Errors about the whole body (like an empty update) become the message;
// errors about single fields go in details.
function invalidDataResponse(error: z.ZodError) {
  const { formErrors, fieldErrors } = z.flattenError(error);

  return {
    error: formErrors[0] ?? "Invalid project data",
    details: fieldErrors,
  };
}

// Runs before every /:id route, so a malformed ID gets a clear 400 instead of
// reaching the database. isObjectIdOrHexString accepts only a 24-character
// hex string, which is what MongoDB IDs look like in our API.
function requireValidId(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  if (!isObjectIdOrHexString(req.params.id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  next();
}

projectsRouter.post("/", async (req, res) => {
  const result = createProjectSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json(invalidDataResponse(result.error));
    return;
  }

  const project = await ProjectModel.create(result.data);
  res.status(201).json(project);
});

projectsRouter.get("/", async (_req, res) => {
  // Newest first. _id breaks ties between projects created in the same ms.
  const projects = await ProjectModel.find().sort({ createdAt: -1, _id: -1 });
  res.status(200).json(projects);
});

projectsRouter.get("/:id", requireValidId, async (req, res) => {
  const project = await ProjectModel.findById(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(200).json(project);
});

projectsRouter.patch("/:id", requireValidId, async (req, res) => {
  const result = updateProjectSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json(invalidDataResponse(result.error));
    return;
  }

  // Only the validated fields are written. Mongoose sets updatedAt itself
  // because the schema has timestamps enabled.
  const project = await ProjectModel.findByIdAndUpdate(
    req.params.id,
    result.data,
    { returnDocument: "after", runValidators: true },
  );

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(200).json(project);
});

projectsRouter.delete("/:id", requireValidId, async (req, res) => {
  const project = await ProjectModel.findByIdAndDelete(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(200).json({ message: "Project deleted", id: req.params.id });
});
