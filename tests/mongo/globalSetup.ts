import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Share the URI with test workers via env and
  // store the instance reference for teardown.
  process.env.MONGO_URI = uri;
  (globalThis as Record<string, unknown>).__MONGOD__ = mongod;
}
