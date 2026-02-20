import mongoose from 'mongoose';

beforeAll(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set — did globalSetup run?');
  // Each Jest worker gets its own database to prevent race conditions
  // when parallel test files clear collections via afterEach.
  const workerId = process.env.JEST_WORKER_ID || '1';
  await mongoose.connect(uri, { dbName: `test_worker_${workerId}` });
});

afterEach(async () => {
  // Clear all collections between tests for isolation.
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});
