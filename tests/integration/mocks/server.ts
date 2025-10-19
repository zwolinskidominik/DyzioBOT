import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server for integration tests
export const server = setupServer(...handlers);

// Setup and teardown hooks for tests
export const setupMSW = () => {
  // Start server before all tests
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'error',
    });
  });

  // Reset handlers between tests
  afterEach(() => {
    server.resetHandlers();
  });

  // Clean up after all tests
  afterAll(() => {
    server.close();
  });
};