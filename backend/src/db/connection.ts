import mongoose from "mongoose";

// The URI is passed in (not imported from config) so tests can connect to
// an in-memory database instead of the real one.
export async function connectToDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, {
    // Fail fast if MongoDB is not reachable, instead of hanging for 30s.
    serverSelectionTimeoutMS: 5000,
  });

  // Log only host and database name. The full URI can contain a password.
  const { host, port, name } = mongoose.connection;
  console.log(`Connected to MongoDB at ${host}:${port}/${name}`);
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
