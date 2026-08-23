import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { Input } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { getAuthErrorMessage } from './authErrors.js';
import { getPostLoginPath } from './authNavigation.js';
import { useAuth } from './useAuth.js';
import './auth.css';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blockedAccessContent = Object.freeze({
  disabled: {
    description:
      'Akun ini masih terhubung ke Firebase, tetapi akses operasionalnya dinonaktifkan. Hubungi Owner Studio37 untuk aktivasi ulang.',
    title: 'Akun dinonaktifkan',
  },
  'profile-error': {
    description:
      'Studio37 tidak dapat memverifikasi profil akses akun ini. Coba lagi setelah koneksi atau konfigurasi Firestore diperiksa.',
    title: 'Profil akses gagal diverifikasi',
  },
  'profile-missing': {
    description:
      'Akun Firebase berhasil dikenali, tetapi profil Studio37 belum dibuat. Owner perlu menyelesaikan bootstrap atau menambahkan profil pengguna.',
    title: 'Profil akses belum tersedia',
  },
  'permission-error': {
    description:
      'Studio37 tidak dapat memverifikasi permission akun operator ini. Owner perlu memeriksa permission set yang ditetapkan.',
    title: 'Permission akses gagal diverifikasi',
  },
});

function validateCredentials(email, password) {
  const errors = {};

  if (!email) {
    errors.email = 'Email wajib diisi.';
  } else if (!emailPattern.test(email)) {
    errors.email = 'Masukkan alamat email yang valid.';
  }

  if (!password) {
    errors.password = 'Password wajib diisi.';
  }

  return errors;
}

function BlockedAccessPanel({ onSignOut, status }) {
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const content = blockedAccessContent[status];

  async function handleSignOut() {
    setError('');
    setSigningOut(true);

    try {
      await onSignOut();
    } catch {
      setError('Sesi belum dapat ditutup. Periksa koneksi lalu coba lagi.');
      setSigningOut(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="access-state-title">
        <div className="login-page__brand" aria-hidden="true">
          37
        </div>

        <div>
          <p className="login-page__eyebrow">Studio37 Access</p>
          <h1 id="access-state-title">{content.title}</h1>
          <p className="login-page__intro">{content.description}</p>
        </div>

        {error ? (
          <div className="login-page__alert" role="alert">
            {error}
          </div>
        ) : null}

        <Button loading={signingOut} onClick={handleSignOut} size="lg" variant="secondary">
          Keluar dan gunakan akun lain
        </Button>

        <p className="login-page__support">
          Status ini memblokir seluruh protected route sampai profil kembali aktif.
        </p>
      </section>
    </main>
  );
}

export function LoginPage() {
  const location = useLocation();
  const { error: sessionError, signIn, signOut, status, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submissionError, setSubmissionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const postLoginPath = useMemo(() => getPostLoginPath(location.state?.from), [location.state]);

  if (status === 'authenticated' && user) {
    return <Navigate to={postLoginPath} replace />;
  }

  if (status === 'loading') {
    return (
      <main className="auth-status" aria-live="polite">
        <span className="auth-status__spinner" aria-hidden="true" />
        <p>Memulihkan sesi Studio37…</p>
      </main>
    );
  }

  if (user && blockedAccessContent[status]) {
    return <BlockedAccessPanel onSignOut={signOut} status={status} />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedEmail = email.trim();
    const errors = validateCredentials(normalizedEmail, password);
    setFieldErrors(errors);
    setSubmissionError('');

    if (Object.keys(errors).length) return;

    setSubmitting(true);

    try {
      await signIn({ email: normalizedEmail, password });
    } catch (error) {
      setSubmissionError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const visibleError = submissionError || (sessionError ? getAuthErrorMessage(sessionError) : '');

  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="login-title">
        <div className="login-page__brand" aria-hidden="true">
          37
        </div>

        <div>
          <p className="login-page__eyebrow">Studio Management</p>
          <h1 id="login-title">Masuk ke Studio37</h1>
          <p className="login-page__intro">
            Gunakan akun yang diberikan Owner untuk membuka workspace operasional.
          </p>
        </div>

        {visibleError ? (
          <div className="login-page__alert" role="alert">
            {visibleError}
          </div>
        ) : null}

        <form
          className="login-page__form"
          aria-label="Login Studio37"
          noValidate
          onSubmit={handleSubmit}
        >
          <Input
            autoComplete="email"
            autoFocus
            error={fieldErrors.email}
            inputMode="email"
            label="Email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@studio37.id"
            required
            type="email"
            value={email}
          />

          <Input
            autoComplete="current-password"
            error={fieldErrors.password}
            label="Password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <Button className="login-page__submit" loading={submitting} size="lg" type="submit">
            Masuk
          </Button>
        </form>

        <p className="login-page__support">
          Belum punya akses atau akun dinonaktifkan? Hubungi Owner Studio37.
        </p>
      </section>
    </main>
  );
}
