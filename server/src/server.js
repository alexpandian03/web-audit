import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './db.js';
import { recoverPendingAudits } from './services/auditQueue.js';
import { getActiveSearchProvider } from './services/searchProvider.js';

const isProduction = process.env.NODE_ENV === 'production';
const port = parseInt(process.env.PORT, 10) || 5000;
const host = '0.0.0.0';
const activeProvider = getActiveSearchProvider();

// 1. Startup validation: require MONGODB_URI and search provider API key (never log secrets)
if (!process.env.MONGODB_URI) {
  console.error('\n❌ Startup configuration error: MONGODB_URI is required.');
  console.error('   Please provide a valid MongoDB connection string (e.g. MongoDB Atlas) in your environment variables.\n');
  process.exit(1);
}

if (activeProvider === 'serpapi' && !process.env.SERPAPI_KEY) {
  console.error('\n❌ Startup configuration error: SEARCH_PROVIDER=serpapi requires SERPAPI_KEY.');
  console.error('   Please set SERPAPI_KEY in your environment variables.\n');
  process.exit(1);
} else if (activeProvider === 'places' && !process.env.GOOGLE_PLACES_API_KEY) {
  console.error('\n❌ Startup configuration error: SEARCH_PROVIDER=places requires GOOGLE_PLACES_API_KEY.');
  console.error('   Please set GOOGLE_PLACES_API_KEY in your environment variables.\n');
  process.exit(1);
}

// 2. In production force ALLOW_PRIVATE=false so the SSRF guard stays strictly on
let allowPrivate = process.env.ALLOW_PRIVATE === 'true';
if (isProduction) {
  allowPrivate = false;
}

console.log(`[Config] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`[Config] Active search provider: ${activeProvider}`);
console.log(`[Config] SSRF guard allowPrivate: ${allowPrivate}`);

// 3. Connect to MongoDB and recover pending audits
try {
  await connectDB(process.env.MONGODB_URI);
  await recoverPendingAudits({ allowPrivate });
} catch (err) {
  console.error('[Database] Startup connection warning:', err.message);
}

// 4. Create and start HTTP server on 0.0.0.0
const app = createApp({ allowPrivate });

const server = app.listen(port, host, () => {
  console.log(`Audit API listening on http://${host}:${port}`);
  console.log(`Health check: http://${host}:${port}/api/health`);
});

// 5. Graceful shutdown on SIGTERM and SIGINT
const handleShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP connections closed.');
    try {
      await disconnectDB();
    } catch (err) {
      console.error('[Server] Error disconnecting database:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Server] Graceful shutdown timeout exceeded. Forcefully exiting.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
