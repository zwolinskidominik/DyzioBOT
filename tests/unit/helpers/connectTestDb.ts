import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Use project-root based path to be resilient to ts-jest/coverage path remapping
const STATE_FILE = path.resolve(process.cwd(), 'tests', 'mongo', 'state.json');

export async function connectTestDb() {
  if (!fs.existsSync(STATE_FILE)) throw new Error('Mongo state file missing');
  const { uri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as { uri: string };
  if (mongoose.connection.readyState === 0) {
    // Create unique database name for each test file to avoid collisions in parallel execution
    const uniqueDbName = `testdb_${process.pid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await mongoose.connect(uri, { dbName: uniqueDbName });
  }
}

export async function clearDatabase() {
  const cs = mongoose.connection.collections;
  await Promise.all(Object.values(cs).map(c => c.deleteMany({})));
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}