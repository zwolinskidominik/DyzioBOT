import { stopInMemoryMongo } from './setupMongo';

module.exports = async function globalTeardown() {
  await stopInMemoryMongo();
};
