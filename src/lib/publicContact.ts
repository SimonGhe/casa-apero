export function approvedPublicEmail(email: string | undefined, approved: string | undefined): string | null {
  const value = email?.trim() ?? '';
  if (approved !== 'true' || value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return null;
  return value;
}
// Owner confirmed publication approval and tested incoming mail/replies.
export const VERIFIED_PUBLIC_EMAIL='info@casa-apero.com';
