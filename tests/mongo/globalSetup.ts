import { startInMemoryMongo } from './setupMongo';

module.exports = async function globalSetup() {
  await startInMemoryMongo();
};
