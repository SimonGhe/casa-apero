export function approvedPublicEmail(email: string | undefined, approved: string | undefined): string | null {
  const value = email?.trim() ?? '';
  if (approved !== 'true' || value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return null;
  return value;
}
