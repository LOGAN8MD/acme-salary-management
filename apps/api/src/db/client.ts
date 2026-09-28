import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** Create once per process, reuse across services, disconnect on shutdown. */
export function createDatabaseClient(
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
  }
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10 }),
  });
}
