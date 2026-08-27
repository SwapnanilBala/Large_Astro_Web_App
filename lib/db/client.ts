import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function createDatabaseClients() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (
    !connectionString.startsWith("postgresql://") &&
    !connectionString.startsWith("postgres://")
  ) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  }

  const sql = neon(connectionString);

  return {
    sql,
    db: drizzle({ client: sql }),
  };
}

type DatabaseClients = ReturnType<typeof createDatabaseClients>;

let databaseClients: DatabaseClients | undefined;

function getDatabaseClients(): DatabaseClients {
  databaseClients ??= createDatabaseClients();
  return databaseClients;
}

export function getDb() {
  return getDatabaseClients().db;
}

export function getSql() {
  return getDatabaseClients().sql;
}
