import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { formatDateTimeInTimeZone } from '../../lib/datetime/timestamps.js';
import {
  operatorAccountInvitationRepository,
  OPERATOR_ACCOUNT_INVITATION_ERROR_CODES,
} from '../../services/operatorAccountInvitationRepository.js';
import { getAuthErrorMessage } from './authErrors.js';
import {
  normalizeOperatorAccountInvitationId,
  OPERATOR_ACCOUNT_INVITATION_STATUSES,
} from './operatorAccountInvitation.js';
import {
  OPERATOR_ACCOUNT_INVITATION_AUTH_MODES,
  validateOperatorAccountInvitationAuthForm,
} from './operatorAccountInvitationUi.js';
import { useAuth } from './useAuth.js';
import { normalizeOperatorId } from '../settings/operators.js';
import './auth.css';

const invitationStatusLabels = Object.freeze({
  [OPERATOR_ACCOUNT_INVITATION_STATUSES.ACCEPTED]: 'Sudah digunakan',
  [OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING]: 'Siap diterima',
  [OPERATOR_ACCOUNT_INVITATION_STATUSES.REVOKED]: 'Sudah dicabut',
});

function normalizeInvitationPath(operatorId, invitationId) {
  try {
    return Object.freeze({
      invitationId: normalizeOperatorAccountInvitationId(invitationId),
      operatorId: normalizeOperatorId(operatorId),
    });
  } catch {
    return null;
  }
}

function getInvitationAcceptanceErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Undangan tidak dapat diverifikasi dengan akun ini. Pastikan email akun sudah terverifikasi dan sama dengan email tujuan undangan.';
  }

  if (error?.code === 'unavailable') {
    return 'Firestore sedang tidak tersedia. Periksa koneksi lalu coba lagi.';
  }

  const messages = {
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.AUTH_EMAIL_MISMATCH]:
      'Email akun ini tidak cocok dengan email tujuan undangan.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.EXPIRED]:
      'Undangan ini sudah kedaluwarsa. Minta Owner membuat link baru.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVITATION_NOT_FOUND]:
      'Undangan tidak ditemukan atau sudah tidak tersedia.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVALID_STATE]:
      'Undangan ini sudah tidak dapat digunakan.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_ALREADY_LINKED]:
      'Profil operator sudah terhubung ke akun lain. Hubungi Owner untuk meninjau hubungan akun.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_INACTIVE]:
      'Profil operator sedang nonaktif. Hubungi Owner untuk mengaktifkannya kembali.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.USER_ALREADY_LINKED]:
      'Akun ini sudah terhubung ke operator lain.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.USER_INELIGIBLE]:
      'Profil Studio37 akun ini tidak memenuhi syarat untuk menerima undangan.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.VERIFIED_EMAIL_REQUIRED]:
      'Verifikasi email Firebase terlebih dahulu sebelum menerima undangan.',
  };

  return (
    messages[error?.code] ??
    'Undangan belum dapat diproses. Tidak ada role atau permission yang diubah.'
  );
}

function InvitationPanel({ children, intro, title }) {
  return (
    <main className="login-page invitation-page">
      <section className="login-page__panel invitation-page__panel" aria-labelledby="invite-title">
        <div className="login-page__brand" aria-hidden="true">
          37
        </div>
        <div>
          <p className="login-page__eyebrow">Studio Operator Onboarding</p>
          <h1 id="invite-title">{title}</h1>
          <p className="login-page__intro">{intro}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export function OperatorAccountInvitationPage({
  continueUrl = globalThis.location?.href,
  repository = operatorAccountInvitationRepository,
}) {
  const { invitationId, operatorId } = useParams();
  const invitationPath = useMemo(
    () => normalizeInvitationPath(operatorId, invitationId),
    [invitationId, operatorId],
  );
  const navigate = useNavigate();
  const access = useAuth();
  const { createAccount, refreshUser, sendVerificationEmail, signIn, signOut, status, user } =
    access;
  const [actionError, setActionError] = useState('');
  const [authMode, setAuthMode] = useState(OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP);
  const [copyEmail, setCopyEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
    passwordConfirmation: '',
  });
  const [invitation, setInvitation] = useState(null);
  const [invitationState, setInvitationState] = useState('idle');
  const [loadKey, setLoadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transientUser, setTransientUser] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const effectiveUser =
    transientUser && (!user || transientUser.uid === user.uid) ? transientUser : user;
  const effectiveEmail = effectiveUser?.email?.trim().toLowerCase() ?? '';
  const effectiveEmailVerified = effectiveUser?.emailVerified === true;

  useEffect(() => {
    if (!user || user.uid === transientUser?.uid) return;
    setTransientUser(null);
  }, [transientUser?.uid, user]);

  useEffect(() => {
    if (!invitationPath || !effectiveUser || !effectiveEmailVerified) {
      setInvitation(null);
      setInvitationState('idle');
      return undefined;
    }

    let active = true;
    setInvitation(null);
    setInvitationState('loading');
    setActionError('');

    repository
      .getInvitation(invitationPath.operatorId, invitationPath.invitationId)
      .then((resolvedInvitation) => {
        if (!active) return;

        if (!resolvedInvitation) {
          setInvitationState('error');
          setActionError('Undangan tidak ditemukan atau sudah tidak tersedia.');
          return;
        }

        setInvitation(resolvedInvitation);
        setInvitationState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setInvitationState('error');
        setActionError(getInvitationAcceptanceErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [
    effectiveEmail,
    effectiveEmailVerified,
    effectiveUser?.uid,
    invitationPath,
    loadKey,
    repository,
  ]);

  if (!invitationPath) {
    return (
      <InvitationPanel
        title="Link undangan tidak valid"
        intro="Path onboarding tidak memenuhi format Studio37 dan tidak akan digunakan untuk membaca data."
      >
        <div className="login-page__alert" role="alert">
          Minta Owner mengirim ulang link undangan lengkap.
        </div>
        <Button variant="secondary" onClick={() => navigate('/login')}>
          Kembali ke Login
        </Button>
      </InvitationPanel>
    );
  }

  if (status === 'loading' && !effectiveUser) {
    return (
      <main className="auth-status" aria-live="polite">
        <span className="auth-status__spinner" aria-hidden="true" />
        <p>Memulihkan sesi undangan Studio37…</p>
      </main>
    );
  }

  function changeAuthMode(nextMode) {
    setAuthMode(nextMode);
    setActionError('');
    setFieldErrors({});
    setFormValues((current) => ({
      ...current,
      password: '',
      passwordConfirmation: '',
    }));
  }

  function changeField(fieldName) {
    return (event) => {
      setFormValues((current) => ({ ...current, [fieldName]: event.target.value }));
      setFieldErrors((current) => {
        if (!current[fieldName]) return current;
        const nextErrors = { ...current };
        delete nextErrors[fieldName];
        return nextErrors;
      });
      setActionError('');
    };
  }

  async function submitCredentials(event) {
    event.preventDefault();
    const validation = validateOperatorAccountInvitationAuthForm(formValues, authMode);
    setFieldErrors(validation.errors);
    setActionError('');

    if (!validation.value) return;
    setSubmitting(true);

    try {
      if (authMode === OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP) {
        const createdUser = await createAccount(validation.value);
        setTransientUser(createdUser);
        setCopyEmail(createdUser.email ?? validation.value.email);

        try {
          await sendVerificationEmail(createdUser, { continueUrl });
          setVerificationSent(true);
        } catch (verificationError) {
          setActionError(getAuthErrorMessage(verificationError));
        }
      } else {
        const signedInUser = await signIn(validation.value);
        setTransientUser(signedInUser);
        setCopyEmail(signedInUser.email ?? validation.value.email);
      }
    } catch (error) {
      setActionError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    if (!effectiveUser) return;
    setSendingVerification(true);
    setActionError('');

    try {
      await sendVerificationEmail(effectiveUser, { continueUrl });
      setVerificationSent(true);
    } catch (error) {
      setActionError(getAuthErrorMessage(error));
    } finally {
      setSendingVerification(false);
    }
  }

  async function checkVerification() {
    if (!effectiveUser) return;
    setRefreshing(true);
    setActionError('');

    try {
      const refreshedUser = await refreshUser(effectiveUser);
      setTransientUser(refreshedUser);

      if (refreshedUser.emailVerified !== true) {
        setActionError('Email belum terverifikasi. Buka link dari inbox lalu coba periksa lagi.');
      }
    } catch (error) {
      setActionError(getAuthErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function changeAccount() {
    setActionError('');

    try {
      await signOut();
      setTransientUser(null);
      setVerificationSent(false);
      setInvitation(null);
      setInvitationState('idle');
    } catch {
      setActionError('Sesi belum dapat ditutup. Periksa koneksi lalu coba lagi.');
    }
  }

  async function acceptInvitation() {
    if (!invitation || !effectiveUser || !effectiveEmailVerified) return;
    setSubmitting(true);
    setActionError('');

    try {
      await repository.redeemInvitation(invitationPath.operatorId, invitationPath.invitationId, {
        email: effectiveEmail,
        emailVerified: true,
        userUid: effectiveUser.uid,
      });
      setInvitationState('accepted');
    } catch (error) {
      setActionError(getInvitationAcceptanceErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (!effectiveUser) {
    const signingUp = authMode === OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP;

    return (
      <InvitationPanel
        title={signingUp ? 'Buat akun operator' : 'Masuk untuk menerima undangan'}
        intro="Gunakan persis email yang menerima undangan. Link saja tidak cukup untuk membuka akses."
      >
        <div className="invitation-page__mode" aria-label="Pilih cara autentikasi">
          <Button
            variant={signingUp ? 'primary' : 'ghost'}
            onClick={() => changeAuthMode(OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP)}
          >
            Buat akun baru
          </Button>
          <Button
            variant={signingUp ? 'ghost' : 'primary'}
            onClick={() => changeAuthMode(OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_IN)}
          >
            Sudah punya akun
          </Button>
        </div>

        {actionError ? (
          <div className="login-page__alert" role="alert">
            {actionError}
          </div>
        ) : null}

        <form
          className="login-page__form"
          aria-label={signingUp ? 'Buat akun undangan Studio37' : 'Masuk akun undangan Studio37'}
          noValidate
          onSubmit={submitCredentials}
        >
          <Input
            autoComplete="email"
            autoFocus
            error={fieldErrors.email}
            inputMode="email"
            label="Email undangan"
            onChange={changeField('email')}
            required
            type="email"
            value={formValues.email}
          />
          <Input
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            error={fieldErrors.password}
            label="Password"
            onChange={changeField('password')}
            required
            type="password"
            value={formValues.password}
          />
          {signingUp ? (
            <Input
              autoComplete="new-password"
              error={fieldErrors.passwordConfirmation}
              label="Konfirmasi password"
              onChange={changeField('passwordConfirmation')}
              required
              type="password"
              value={formValues.passwordConfirmation}
            />
          ) : null}
          <Button className="login-page__submit" loading={submitting} size="lg" type="submit">
            {signingUp ? 'Buat akun dan verifikasi email' : 'Masuk dan periksa undangan'}
          </Button>
        </form>

        <p className="login-page__support">
          Akun baru tidak memperoleh permission otomatis dan tidak pernah dapat menjadi Owner dari
          flow ini.
        </p>
      </InvitationPanel>
    );
  }

  if (!effectiveEmailVerified) {
    return (
      <InvitationPanel
        title="Verifikasi email akun"
        intro={`Firebase perlu membuktikan kepemilikan ${copyEmail || effectiveEmail} sebelum Studio37 membaca undangan.`}
      >
        {verificationSent ? (
          <div className="invitation-page__notice" data-tone="success" role="status">
            Email verifikasi sudah dikirim. Periksa inbox dan folder spam.
          </div>
        ) : null}
        {actionError ? (
          <div className="login-page__alert" role="alert">
            {actionError}
          </div>
        ) : null}
        <div className="invitation-page__actions">
          <Button loading={sendingVerification} onClick={resendVerification}>
            {verificationSent ? 'Kirim ulang verifikasi' : 'Kirim email verifikasi'}
          </Button>
          <Button variant="secondary" loading={refreshing} onClick={checkVerification}>
            Saya sudah verifikasi
          </Button>
          <Button variant="ghost" onClick={changeAccount}>
            Gunakan akun lain
          </Button>
        </div>
        <p className="login-page__support">
          Setelah membuka link verifikasi Firebase, kembali ke halaman ini dan periksa lagi.
        </p>
      </InvitationPanel>
    );
  }

  if (invitationState === 'accepted') {
    return (
      <InvitationPanel
        title="Akun operator berhasil diaktifkan"
        intro="Profil user, profil operator, dan undangan sudah terhubung atomik. Permission tetap menunggu pengaturan Owner."
      >
        <div className="invitation-page__notice" data-tone="success" role="status">
          Tidak ada permission Owner yang disalin. Akun ini mulai sebagai Studio Operator dengan
          akses minimum.
        </div>
        <Button disabled={status !== 'authenticated'} onClick={() => navigate('/settings/account')}>
          {status === 'authenticated' ? 'Buka akun Studio37' : 'Menyiapkan profil akses…'}
        </Button>
      </InvitationPanel>
    );
  }

  const invitationExpired = invitation?.expiresAt.getTime() <= Date.now();
  const invitationCanBeAccepted =
    invitation?.status === OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING && !invitationExpired;

  return (
    <InvitationPanel
      title="Tinjau undangan operator"
      intro={`Akun ${effectiveEmail} sudah terverifikasi. Studio37 hanya membaca satu exact invitation path.`}
    >
      {invitationState === 'loading' ? (
        <div className="invitation-page__loading" aria-busy="true" aria-live="polite">
          <span className="auth-status__spinner" aria-hidden="true" />
          <span>Memverifikasi undangan…</span>
        </div>
      ) : null}

      {actionError ? (
        <div className="login-page__alert" role="alert">
          {actionError}
        </div>
      ) : null}

      {invitationState === 'error' ? (
        <div className="invitation-page__actions">
          <Button variant="secondary" onClick={() => setLoadKey((value) => value + 1)}>
            Coba lagi
          </Button>
          <Button variant="ghost" onClick={changeAccount}>
            Gunakan akun lain
          </Button>
        </div>
      ) : null}

      {invitation ? (
        <div className="invitation-page__summary">
          <div className="invitation-page__summary-header">
            <div>
              <span>Profil operator</span>
              <strong>{invitation.displayName}</strong>
              <small>{invitation.email}</small>
            </div>
            <Badge
              tone={
                invitationCanBeAccepted
                  ? 'success'
                  : invitation.status === OPERATOR_ACCOUNT_INVITATION_STATUSES.REVOKED
                    ? 'warning'
                    : 'neutral'
              }
            >
              {invitationExpired ? 'Kedaluwarsa' : invitationStatusLabels[invitation.status]}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>Berlaku sampai</dt>
              <dd>{formatDateTimeInTimeZone(invitation.expiresAt)} WIB</dd>
            </div>
            <div>
              <dt>Role awal</dt>
              <dd>Studio Operator</dd>
            </div>
            <div>
              <dt>Permission awal</dt>
              <dd>Belum ditetapkan</dd>
            </div>
          </dl>
          {!invitationCanBeAccepted ? (
            <div className="invitation-page__notice" data-tone="warning" role="status">
              Link ini tidak dapat dipakai. Minta Owner membuat undangan baru bila akses masih
              diperlukan.
            </div>
          ) : null}
        </div>
      ) : null}

      {invitationState === 'ready' ? (
        <div className="invitation-page__actions">
          <Button
            size="lg"
            loading={submitting}
            disabled={!invitationCanBeAccepted}
            onClick={acceptInvitation}
          >
            Aktifkan akun Studio37
          </Button>
          <Button variant="ghost" disabled={submitting} onClick={changeAccount}>
            Gunakan akun lain
          </Button>
        </div>
      ) : null}
    </InvitationPanel>
  );
}
