export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { startBackgroundJobs } = require('./lib/server/api-handler.cjs');
    startBackgroundJobs();
  }
}
