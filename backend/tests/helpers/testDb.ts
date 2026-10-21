import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "../../src/db/connection.js";

// Call once at the top of a test file that needs MongoDB. Each file gets
// its own throwaway in-memory database: no real database is ever touched.
export function useTestDatabase() {
  let mongo: MongoMemoryServer | undefined;

  // Long timeout: the very first run downloads a MongoDB binary.
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await connectToDatabase(mongo.getUri());
  }, 120_000);

  // Empty every collection so one test's data never leaks into the next.
  afterEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    await mongo?.stop();
  });
}
