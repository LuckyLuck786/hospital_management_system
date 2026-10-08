import { execSync } from 'child_process';
import * as path from 'path';

const TEST_DB = process.env.TEST_DATABASE_NAME || 'medcore_hms_test';
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || `postgresql://postgres:postgres@localhost:5432/${TEST_DB}?schema=public`;

export default async () => {
  // Create the test database if it does not exist yet (ignore "already exists").
  try {
    execSync(`docker exec medcore_postgres psql -U postgres -c "CREATE DATABASE ${TEST_DB}"`, {
      stdio: 'ignore',
    });
    // eslint-disable-next-line no-empty
  } catch {}

  // The test dir sits inside the backend app — prisma needs the app root as cwd.
  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit',
  });
};
