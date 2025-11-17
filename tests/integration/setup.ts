import { fetch } from 'undici';
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
} catch {}

	jest.mock('pretty-ms', () => ({
		__esModule: true,
		default: (ms: number) => `${ms}ms`,
	}));

global.fetch = fetch as any;

process.env.NODE_ENV = 'test';