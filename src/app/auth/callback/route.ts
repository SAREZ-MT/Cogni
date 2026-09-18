import { NextResponse } from "next/server";
import { exchangeCodeForSession, safeNext } from "@/modules/identity";

// Google OAuth, email verification and password-reset links all land here
// with a PKCE code. A missing or rejected code sends the visitor back to
// login with a neutral message; `next` is sanitised against open redirects.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code && (await exchangeCodeForSession(code))) {
    return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=google`);
}
