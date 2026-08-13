import { MongoClient } from 'mongodb';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set — copy .env.example to .env');

export const DB_NAME = process.env.MONGODB_DB || 'receipts';

// One web process, one reviewer worker holding a change stream. Concurrency is
// bounded by the operator clicking demo buttons, so a small pool is correct.
export const client = new MongoClient(uri, {
  maxPoolSize: 20,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  retryWrites: true,
});

export const db = () => client.db(DB_NAME);
