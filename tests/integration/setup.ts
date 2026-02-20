import mongoose from 'mongoose';

beforeAll(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set — did globalSetup run?');
  await mongoose.connect(uri);
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
