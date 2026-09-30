/** Single Postgres database URL for the whole app. */

export function getPostgresUrl() {
  return process.env.POSTGRES_URL?.trim() ?? "";
}
