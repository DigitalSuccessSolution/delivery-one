import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;

// Remove the top-level error throw so it doesn't crash Next.js build on Vercel
// if the environment variable is not set during the build step.

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  // Throw error only when trying to connect (at runtime)
  if (!MONGODB_URI) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside Vercel Dashboard or .env.local'
    );
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
