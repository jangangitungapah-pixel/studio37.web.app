import { AUTH_NOT_CONFIGURED_CODE } from './firebaseAuthGateway.js';

const invalidCredentialCodes = new Set([
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
]);

export function getAuthErrorMessage(error) {
  const code = error?.code;

  if (invalidCredentialCodes.has(code)) {
    return 'Email atau password tidak cocok.';
  }

  if (code === 'auth/invalid-email') {
    return 'Format email belum valid.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Koneksi ke layanan autentikasi gagal. Periksa internet lalu coba lagi.';
  }

  if (code === AUTH_NOT_CONFIGURED_CODE || code === 'auth/configuration-not-found') {
    return 'Firebase Authentication belum dikonfigurasi untuk environment ini.';
  }

  return 'Login belum berhasil. Coba lagi atau hubungi Owner.';
}
