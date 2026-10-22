import { describe, expect, it } from 'vitest';
import { approvedPublicEmail } from '../../src/lib/publicContact';

describe('public email publication gate', () => {
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
