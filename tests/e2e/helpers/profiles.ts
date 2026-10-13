import postgres from "postgres";

// Reads a profile's stored time zone straight from the database, so a spec
// can tell the browser detection or a save actually persisted (the
// settings select alone may show a client-side preselection).
export async function profileTimeZoneOf(userId: string): Promise<string> {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    const [row] = await sql<{ timezone: string }[]>`
      select timezone from profiles where id = ${userId}
    `;
    return row?.timezone ?? "";
  } finally {
    await sql.end();
  }
}
