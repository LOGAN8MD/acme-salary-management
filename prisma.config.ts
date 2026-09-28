import { defineConfig } from 'prisma/config';

// Node's --env-file flag loads the root .env for database commands.
// Generation/validation do not need a database; migrations require DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
