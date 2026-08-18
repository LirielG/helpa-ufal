import { execSync } from "node:child_process";
import { resolve } from "node:path";

const backendRoot = resolve(import.meta.dirname, "../..");

function parseDatabaseName(databaseUrl: string): string {
  let pathname: string;

  try {
    pathname = new URL(databaseUrl).pathname;
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: ${databaseUrl}`);
  }

  const name = pathname.replace(/^\//, "");

  if (!name) {
    throw new Error(`DATABASE_URL has no database name: ${databaseUrl}`);
  }

  return name;
}

export async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Was .env.test loaded?");
  }

  const databaseName = parseDatabaseName(databaseUrl);

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to run the tests against database "${databaseName}": the suite ` +
        'truncates every table, so its name must end with "_test".',
    );
  }

  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit",
  });
}
