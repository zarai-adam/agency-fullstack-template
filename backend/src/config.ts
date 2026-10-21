import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z
    .string({ error: "MONGODB_URI is required" })
    .regex(/^mongodb(\+srv)?:\/\//, {
      error: "MONGODB_URI must start with mongodb:// or mongodb+srv://",
    }),
});

export type Env = z.infer<typeof envSchema>;

// Takes the source as an argument so tests can check the rules
// without changing process.env. server.ts calls this at startup; importing
// this file on its own never reads or validates process.env.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
