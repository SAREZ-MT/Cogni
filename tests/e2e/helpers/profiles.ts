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

// Stores a chosen time zone for the profile, so a spec reads calendar days
// in a known zone. The browser detection only saves while the stored value
// is still the unset "UTC", so it never overwrites this one.
export async function setProfileTimeZone(
  userId: string,
  timeZone: string,
): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    await sql`update profiles set timezone = ${timeZone} where id = ${userId}`;
  } finally {
    await sql.end();
  }
}
