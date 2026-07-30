/**
 * Clerk gates the whole dashboard, but the project must also be runnable by a
 * reviewer who has no Clerk tenant. When no publishable key is present we fall
 * back to a clearly-labelled dev session instead of crashing at boot.
 */
export const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const CLERK_ENABLED = CLERK_PUBLISHABLE_KEY.length > 0;
