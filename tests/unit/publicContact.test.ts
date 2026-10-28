import { describe, expect, it } from 'vitest';
import { approvedPublicEmail, VERIFIED_PUBLIC_EMAIL } from '../../src/lib/publicContact';

describe('public email publication gate', () => {
  it('publishes the owner-verified mailbox without weakening unapproved overrides',()=>{
    expect(approvedPublicEmail(VERIFIED_PUBLIC_EMAIL,'true')).toBe('info@casa-apero.com');
    expect(approvedPublicEmail('unapproved@example.test',undefined)).toBeNull();
  });
  it('excludes an unapproved address from public configuration', () => {
    expect(approvedPublicEmail('student@example.test', undefined)).toBeNull();
    expect(approvedPublicEmail('student@example.test', 'false')).toBeNull();
    expect(approvedPublicEmail('student@example.test', 'yes')).toBeNull();
  });

  it('only returns an approved valid address', () => {
    expect(approvedPublicEmail(' contact@example.test ', 'true')).toBe('contact@example.test');
    for (const value of ['', 'not-an-email', 'test@example', 'x@example.test\r\nHeader: injected', '<x>@example.test']) {
      expect(approvedPublicEmail(value, 'true')).toBeNull();
    }
  });
});
