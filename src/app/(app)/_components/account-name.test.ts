import { describe, expect, it } from "vitest";
import { displayNameFromEmail, initialsFrom } from "./account-name";

// These helpers are consumed by a Server Component (app/(app)/inicio/page.tsx) as
// well as by "use client" components. They must therefore live in a plain
// module: importing a function from a "use client" file into a Server
// Component turns it into a client reference and calling it on the server
// throws at runtime ("Attempted to call ... from the server"), which is
// exactly what took the Home page down to its error boundary.
describe("account-name helpers", () => {
  it("derives a capitalised display name from the email local part", () => {
    expect(displayNameFromEmail("ana.perez@cogni.dev")).toBe("Ana.perez");
    expect(displayNameFromEmail(null)).toBe("Cuenta");
  });

  it("builds two-letter initials from a display name", () => {
    expect(initialsFrom("Ana Perez")).toBe("AP");
    expect(initialsFrom("ana.perez")).toBe("AP");
    expect(initialsFrom("Cuenta")).toBe("CU");
  });
});
