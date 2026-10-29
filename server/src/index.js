import app from './app.js';
import { connectDb, disconnectDb } from './db.js';
import { env } from './config.js';
import { sweepBookings } from './services/sweeper.js';

let server;
let timer;

async function start() {
  await connectDb();
  console.log('[db] connected');

  server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  timer = setInterval(() => {
    sweepBookings().catch((error) => console.error('[sweeper]', error.message));
  }, 60_000);
  timer.unref?.();
}

const shutdown = async (signal) => {
  console.log(`[api] ${signal} received, shutting down`);
  if (timer) clearInterval(timer);
  if (server) server.close();
  await disconnectDb().catch(() => {});
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[api] failed to start:', error.message);
  process.exit(1);
});
