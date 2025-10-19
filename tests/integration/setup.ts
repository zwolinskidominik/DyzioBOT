import { fetch } from 'undici';
// Register ts-node to allow requiring TS source files dynamically in tests
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const tsnode = require('ts-node');
	if (tsnode && typeof tsnode.register === 'function') {
		tsnode.register({
			transpileOnly: true,
			compilerOptions: {
				module: 'CommonJS',
				target: 'ES2022',
				moduleResolution: 'Node',
				experimentalDecorators: true,
				emitDecoratorMetadata: true,
				esModuleInterop: true,
				resolveJsonModule: true,
			},
		});
	}
} catch {
	// ignore if ts-node is not available
}

	// Mock ESM-only modules that Jest (CJS) can't load by default
	jest.mock('pretty-ms', () => ({
		__esModule: true,
		default: (ms: number) => `${ms}ms`,
	}));

// Setup global fetch for Jest environment
global.fetch = fetch as any;

// Set NODE_ENV to test for model validation bypass
process.env.NODE_ENV = 'test';