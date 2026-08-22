import { describe, expect, it } from 'vitest';

import { getAuthErrorMessage } from './authErrors.js';

describe('authentication error messages', () => {
  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'])(
    'does not reveal account existence for %s',
    (code) => {
      expect(getAuthErrorMessage({ code })).toBe('Email atau password tidak cocok.');
    },
  );

  it('provides actionable configuration and network messages', () => {
    expect(getAuthErrorMessage({ code: 'studio37/auth-not-configured' })).toContain(
      'belum dikonfigurasi',
    );
    expect(getAuthErrorMessage({ code: 'auth/network-request-failed' })).toContain(
      'Periksa internet',
    );
  });

  it('uses a safe fallback without exposing raw provider errors', () => {
    expect(getAuthErrorMessage(new Error('raw backend detail'))).toBe(
      'Login belum berhasil. Coba lagi atau hubungi Owner.',
    );
  });
});
