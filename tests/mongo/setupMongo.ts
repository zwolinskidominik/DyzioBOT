import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';

// Resolve the state file relative to the project root to avoid issues with transformed __dirname under coverage
const STATE_FILE = path.resolve(process.cwd(), 'tests', 'mongo', 'state.json');

export interface MongoState { uri: string }

export async function startInMemoryMongo(version = '7.0.14') {
  // Increase launchTimeout to be more lenient on Windows/CI where startup can be slower
  const mongod = await MongoMemoryServer.create({
    binary: { version },
    instance: { dbName: 'testdb', launchTimeout: 60000 }
  });
  const uri = mongod.getUri();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ uri }), 'utf8');
  (global as any).__MONGO_URI__ = uri;
  (global as any).__MONGOD__ = mongod;
  return { uri } as MongoState;
}

export async function stopInMemoryMongo() {
  const mongod = (global as any).__MONGOD__ as MongoMemoryServer | undefined;
  if (mongod) await mongod.stop();
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

export function getStateFilePath() { return STATE_FILE; }