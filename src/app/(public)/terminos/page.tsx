import Link from "next/link";
import {
  ensureProfileForUser,
  getCurrentUser,
  hasAcceptedCurrentTerms,
  type Profile,
  type SessionUser,
  safeNext,
  TERMS_VERSION,
} from "@/modules/identity";
import { AcceptTermsForm, TERMS_COPY, TermsOfUse } from "@/modules/identity/ui";

// Public by design (proxy OPEN_PATHS): anyone can read the terms; what the
// page adds depends on the session. It also lives in the (public) group so
// an account that still has to accept is not caught by the (app) gate here.

async function readSession(): Promise<SessionUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    // A broken session read must not hide the terms: show them as anonymous.
    return null;
  }
}

function formatDate(date: Date, timezone: string): string {
  const options = { dateStyle: "long" } as const;
  try {
    return new Intl.DateTimeFormat("es", {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("es", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

function AcceptedState({ profile }: { profile: Profile }) {
  const version = profile.termsAcceptedVersion ?? TERMS_VERSION;
  const message = profile.termsAcceptedAt
    ? TERMS_COPY.accepted.state(
        version,
        formatDate(profile.termsAcceptedAt, profile.timezone),
      )
    : TERMS_COPY.accepted.stateWithoutDate(version);
  return (
    <div className="flex flex-col gap-3">
      <p
        data-testid="terms-accepted-state"
        className="rounded-input bg-success-50 px-3 py-2 text-sm text-success-600"
      >
        {message}
      </p>
      <Link href="/inicio" className="text-sm">
        {TERMS_COPY.accepted.back}
      </Link>
    </div>
  );
}

function AnonymousLinks() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-secondary text-sm">{TERMS_COPY.anonymous.prompt}</p>
      <p className="flex gap-4 text-sm">
        <Link href="/login">{TERMS_COPY.anonymous.login}</Link>
        <Link href="/register">{TERMS_COPY.anonymous.register}</Link>
      </p>
    </div>
  );
}

export default async function TerminosPage({
  searchParams,
}: PageProps<"/terminos">) {
  const { next } = await searchParams;
  const user = await readSession();
  // null profile = transient failure (reported upstream): offer the form
  // anyway, the action ensures the profile again before recording.
  const profile = user ? await ensureProfileForUser(user.id) : null;

  let footer: React.ReactNode;
  if (!user) footer = <AnonymousLinks />;
  else if (profile && hasAcceptedCurrentTerms(profile))
    footer = <AcceptedState profile={profile} />;
  else
    footer = (
      <AcceptTermsForm
        next={safeNext(typeof next === "string" ? next : null)}
      />
    );

  return (
    <div className="flex flex-col gap-8">
      <TermsOfUse />
      {footer}
    </div>
  );
}
