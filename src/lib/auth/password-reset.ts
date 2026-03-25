import { Auth, sendPasswordResetEmail } from 'firebase/auth';

function getCustomResetUrl(): string | null {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/reset-password`;
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) {
    return `${configuredOrigin.replace(/\/$/, '')}/reset-password`;
  }

  return null;
}

export async function sendUserPasswordResetEmail(auth: Auth, email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error('A valid sign-in email is required to reset your password.');
  }

  const useCustomResetFlow = process.env.NEXT_PUBLIC_USE_CUSTOM_RESET_FLOW === 'true';
  const customResetUrl = getCustomResetUrl();

  if (useCustomResetFlow && customResetUrl) {
    await sendPasswordResetEmail(auth, normalizedEmail, {
      url: customResetUrl,
      handleCodeInApp: false,
    });
    return;
  }

  await sendPasswordResetEmail(auth, normalizedEmail);
}

export function formatPasswordResetErrorMessage(error: any): string {
  const code = error?.code || '';

  if (code === 'auth/operation-not-allowed') {
    return 'Password reset is disabled in Firebase. Re-enable Email/Password in Authentication -> Sign-in method.';
  }

  if (code === 'auth/invalid-email') {
    return 'That email address is invalid.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting Firebase. Check your connection and retry.';
  }

  return error?.message || 'Could not send password reset email.';
}
