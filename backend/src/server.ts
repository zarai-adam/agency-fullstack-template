import "dotenv/config";
import { app } from "./app.js";
import { parseEnv } from "./config.js";
import { connectToDatabase, disconnectFromDatabase } from "./db/connection.js";

async function start() {
  const env = parseEnv(process.env);

  // Connect first: if the database is down, don't accept requests at all.
  await connectToDatabase(env.MONGODB_URI);

  const server = app.listen(env.PORT, () => {
    console.log(`API server listening on port ${env.PORT}`);
  });

  // Close the HTTP server and the database connection cleanly on Ctrl+C
  // or when the host stops the process.
  const shutdown = () => {
    server.close(async () => {
      await disconnectFromDatabase();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error: unknown) => {
  console.error("Failed to start the API server:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
