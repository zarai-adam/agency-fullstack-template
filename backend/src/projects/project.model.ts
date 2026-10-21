import { model, Schema, type InferSchemaType } from "mongoose";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_STATUSES,
} from "./project.constants.js";

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: PROJECT_NAME_MAX_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      maxlength: PROJECT_DESCRIPTION_MAX_LENGTH,
      default: "",
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "planning",
    },
  },
  {
    // Adds createdAt and updatedAt, managed by Mongoose.
    timestamps: true,
    toJSON: {
      // Send "id" to clients instead of MongoDB's "_id" and "__v".
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type Project = InferSchemaType<typeof projectSchema>;

export const ProjectModel = model("Project", projectSchema);
