import { createDatabaseClient } from '../apps/api/dist/db/client.js';
import { seedDatabase } from '../apps/api/dist/db/seed/run-seed.js';

const password = process.env.SEED_HR_PASSWORD;
if (!password) throw new Error('Set SEED_HR_PASSWORD before running the seed.');
const db = createDatabaseClient();
try {
  const result = await seedDatabase(db, password);
  console.info(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    error instanceof Error && !error.name.startsWith('Prisma')
      ? error.message
      : 'Seeding failed; all changes were rolled back. Check database connectivity and migrations.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
