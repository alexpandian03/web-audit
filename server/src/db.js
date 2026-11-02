import mongoose from 'mongoose';

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!uri) {
    console.warn('[Database] MONGODB_URI not provided. Falling back to resilient in-memory store.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (err) {
    console.error(`[Database] MongoDB connection failed: ${err.message}. Running fallback mode.`);
    return null;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] MongoDB connection closed.');
  }
}
