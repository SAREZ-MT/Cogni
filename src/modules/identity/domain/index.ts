export { AUTH_ERROR, type AuthErrorCode } from "./auth-errors";
export type {
  AuthGateway,
  SignUpOutcome,
  SignUpResult,
} from "./auth-gateway";
export {
  createProfile,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  type NewProfile,
  type Profile,
} from "./profile";
export type { ProfileRepository } from "./profile-repository";
export { acceptTerms, hasAcceptedCurrentTerms, TERMS_VERSION } from "./terms";
