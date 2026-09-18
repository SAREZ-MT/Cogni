// Stable error codes the UI maps to Spanish copy. Messages on the
// DomainError itself stay technical and short.
export const AUTH_ERROR = {
  INVALID_INPUT: "AUTH_INVALID_INPUT",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  PROVIDER_UNAVAILABLE: "AUTH_PROVIDER_UNAVAILABLE",
  FORBIDDEN: "AUTH_FORBIDDEN",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];
