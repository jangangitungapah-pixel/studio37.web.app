import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  operatorAccountLinkRepository,
  OPERATOR_ACCOUNT_LINK_ERROR_CODES,
} from '../../services/operatorAccountLinkRepository.js';
import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from '../auth/userProfile.js';

const userRoleLabels = Object.freeze({
  [USER_PROFILE_ROLES.OWNER]: 'Owner',
  [USER_PROFILE_ROLES.STUDIO_OPERATOR]: 'Studio Operator',
});

const userStatusLabels = Object.freeze({
  [USER_PROFILE_STATUSES.ACTIVE]: 'Akun aktif',
  [USER_PROFILE_STATUSES.DISABLED]: 'Akun nonaktif',
});

function getAccountLinkErrorMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return 'Hanya Owner aktif yang dapat menghubungkan atau memutuskan akun operator.';
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} akun lagi setelah koneksi pulih.`;
  }

  const messages = {
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.INVARIANT_BROKEN]:
      'Hubungan operator dan profil user tidak konsisten. Periksa kedua dokumen sebelum mencoba lagi.',
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_ALREADY_LINKED]:
      'Operator ini sudah terhubung ke profil user lain. Muat ulang daftar sebelum melanjutkan.',
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_NOT_FOUND]:
      'Profil operator tidak ditemukan. Muat ulang daftar sebelum melanjutkan.',
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_NOT_LINKED]:
      'Operator ini sudah tidak memiliki akun terhubung. Muat ulang daftar untuk melihat kondisi terbaru.',
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.REPOSITORY_UNAVAILABLE]:
      'Repository account linking belum tersedia pada sesi ini.',
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.USER_ALREADY_LINKED]:
      'Profil user tersebut sudah terhubung ke operator lain.',
    [OPERATOR_ACCOUNT_LINK_ERROR_CODES.USER_NOT_FOUND]:
      'Profil user tidak ditemukan. Pastikan akun Auth dan dokumen users/{uid} sudah dibuat.',
  };

  if (messages[error?.code]) return messages[error.code];
  if (error instanceof TypeError) {
    return 'UID harus berupa satu Firebase document ID tanpa karakter garis miring.';
  }

  return `Account linking belum bisa ${action}. Data yang sudah dimasukkan tetap dipertahankan.`;
}

function AccountProfileSummary({ operator, profile }) {
  const isReciprocal = profile.operatorId === operator.id;
  const isAvailable = profile.operatorId === null;
  const statusTone = profile.status === USER_PROFILE_STATUSES.ACTIVE ? 'success' : 'warning';

  return (
    <div className="settings-account-profile" aria-label="Profil akun yang dipilih">
      <div className="settings-account-profile__header">
        <div>
          <span>Profil user ditemukan</span>
          <strong>{profile.displayName}</strong>
          <small>{profile.email}</small>
        </div>
        <div className="settings-account-profile__badges">
          <Badge tone={statusTone}>{userStatusLabels[profile.status]}</Badge>
          <Badge tone="info">{userRoleLabels[profile.role]}</Badge>
        </div>
      </div>
      <dl className="settings-account-profile__details">
        <div>
          <dt>Firebase UID</dt>
          <dd>{profile.uid}</dd>
        </div>
        <div>
          <dt>Permission set</dt>
          <dd>{profile.permissionSetId ?? 'Belum ditetapkan'}</dd>
        </div>
        <div>
          <dt>Operator link</dt>
          <dd>{profile.operatorId ?? 'Belum terhubung'}</dd>
        </div>
      </dl>
      {operator.linkedUserUid === null && !isAvailable ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Profil tidak dapat dipilih.</strong>
          <span>
            Profil ini sudah terhubung ke operator {profile.operatorId}. Putuskan hubungan lama
            terlebih dahulu; direct reassignment tidak diizinkan.
          </span>
        </div>
      ) : null}
      {operator.linkedUserUid !== null && !isReciprocal ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Backlink tidak konsisten.</strong>
          <span>
            Profil user menunjuk ke {profile.operatorId ?? 'tidak ada operator'}, bukan ke operator
            ini. Workflow dihentikan agar data tidak berubah sepihak.
          </span>
        </div>
      ) : null}
      {profile.status === USER_PROFILE_STATUSES.DISABLED ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Akun aplikasi sedang nonaktif.</strong>
          <span>Linking tidak mengaktifkan akun dan tidak mengubah permission set.</span>
        </div>
      ) : null}
    </div>
  );
}

export function OperatorAccountLinkDialog({
  actorUid,
  onClose,
  onSaved,
  operator,
  repository = operatorAccountLinkRepository,
}) {
  const { pushToast } = useToast();
  const accountIsLinked = Boolean(operator.linkedUserUid);
  const mountedRef = useRef(true);
  const [error, setError] = useState('');
  const [lookupKey, setLookupKey] = useState(0);
  const [lookupState, setLookupState] = useState(accountIsLinked ? 'loading' : 'idle');
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userUid, setUserUid] = useState(operator.linkedUserUid ?? '');
  const [userUidError, setUserUidError] = useState('');
  const profileIsAvailable = profile?.operatorId === null;
  const profileIsReciprocal = profile?.operatorId === operator.id;
  const mutationAllowed = accountIsLinked
    ? lookupState === 'ready' && profileIsReciprocal
    : lookupState === 'ready' && profileIsAvailable;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!operator.linkedUserUid) return undefined;

    let active = true;
    setLookupState('loading');
    setProfile(null);
    setError('');

    repository
      .getUserByUid(operator.linkedUserUid)
      .then((nextProfile) => {
        if (!active) return;

        if (!nextProfile) {
          setLookupState('error');
          setError(
            'Profil user terhubung tidak ditemukan. Periksa dokumen users/{uid} sebelum mengubah hubungan.',
          );
          return;
        }

        setProfile(nextProfile);
        setLookupState('ready');
      })
      .catch((nextError) => {
        if (!active) return;
        setLookupState('error');
        setError(getAccountLinkErrorMessage(nextError, 'memuat'));
      });

    return () => {
      active = false;
    };
  }, [lookupKey, operator, repository]);

  const closeDialog = useCallback(() => {
    if (!saving) onClose?.();
  }, [onClose, saving]);

  const changeUserUid = (event) => {
    setUserUid(event.target.value);
    setUserUidError('');
    setProfile(null);
    setError('');
    setLookupState('idle');
  };

  const lookupProfile = async (event) => {
    event.preventDefault();
    const resolvedUserUid = userUid.trim();

    if (!resolvedUserUid || resolvedUserUid.length > 128 || resolvedUserUid.includes('/')) {
      setUserUidError('Masukkan satu Firebase UID yang valid tanpa karakter garis miring.');
      return;
    }

    if (accountIsLinked) return;

    setUserUid(resolvedUserUid);
    setUserUidError('');
    setProfile(null);
    setError('');
    setLookupState('loading');

    try {
      const nextProfile = await repository.getUserByUid(resolvedUserUid);
      if (!mountedRef.current) return;

      if (!nextProfile) {
        setLookupState('error');
        setError(
          'Profil user tidak ditemukan. Buat akun Firebase Authentication dan dokumen users/{uid} terlebih dahulu.',
        );
        return;
      }

      setProfile(nextProfile);
      setLookupState('ready');
    } catch (nextError) {
      if (!mountedRef.current) return;
      setLookupState('error');
      setError(getAccountLinkErrorMessage(nextError, 'mencari'));
    }
  };

  const saveAccountLink = async () => {
    if (!profile || !mutationAllowed || !actorUid) {
      setError('Sesi atau profil yang dipilih belum memenuhi syarat account linking.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (accountIsLinked) {
        await repository.unlinkOperatorFromUser(operator.id, { actorUid });
      } else {
        await repository.linkOperatorToUser(operator.id, profile.uid, { actorUid });
      }
      if (!mountedRef.current) return;

      pushToast({
        message: accountIsLinked
          ? `${operator.displayName} kembali menjadi profil operasional tanpa login; akun dan permission tetap dipertahankan.`
          : `${operator.displayName} sekarang terhubung ke ${profile.displayName}; permission tetap dikelola terpisah.`,
        tone: 'success',
        title: accountIsLinked ? 'Hubungan akun diputuskan' : 'Akun terhubung',
      });
      setSaving(false);
      onSaved?.();
    } catch (nextError) {
      if (!mountedRef.current) return;
      setError(
        getAccountLinkErrorMessage(nextError, accountIsLinked ? 'memutuskan' : 'menghubungkan'),
      );
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={`${accountIsLinked ? 'Kelola akun' : 'Hubungkan akun'} ${operator.displayName}`}
      description={
        accountIsLinked
          ? 'Review profil user reciprocal sebelum memutuskan hubungan akun.'
          : 'Cari satu profil user yang sudah ada menggunakan Firebase UID immutable.'
      }
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={closeDialog}>
            Batal
          </Button>
          <Button
            variant={accountIsLinked ? 'danger' : 'primary'}
            loading={saving}
            disabled={!mutationAllowed || lookupState === 'loading'}
            onClick={saveAccountLink}
          >
            {accountIsLinked ? 'Putuskan akun' : 'Hubungkan akun'}
          </Button>
        </>
      }
    >
      <div className="settings-account-link-dialog">
        <div className="settings-notice" role="status">
          <strong>Tidak membuat akun Firebase.</strong>
          <span>
            Workflow ini tidak mengubah role, status, atau permission set. Akun Auth dan dokumen
            user dengan UID yang sama harus sudah dibuat melalui prosedur administrasi yang
            direview.
          </span>
        </div>

        {accountIsLinked ? (
          <Input
            label="Firebase user UID terhubung"
            value={userUid}
            description="UID berasal dari operators.linkedUserUid dan tidak dapat diedit di sini."
            disabled
          />
        ) : (
          <form className="settings-account-link-form" onSubmit={lookupProfile} noValidate>
            <Input
              label="Firebase user UID"
              value={userUid}
              error={userUidError}
              description="Exact document ID users/{uid}; email tidak digunakan sebagai identitas pencarian."
              maxLength={128}
              required
              disabled={saving || lookupState === 'loading'}
              data-autofocus="true"
              onChange={changeUserUid}
            />
            <Button
              type="submit"
              variant="secondary"
              loading={lookupState === 'loading'}
              disabled={saving}
            >
              Cari profil
            </Button>
          </form>
        )}

        {lookupState === 'loading' && accountIsLinked ? (
          <div
            className="settings-state settings-state--embedded"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="settings-state__spinner" aria-hidden="true" />
            <div>
              <p className="settings-state__title">Memuat profil user terhubung</p>
              <p className="settings-state__description">
                Membaca satu exact document users/{userUid}.
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
            <div>
              <p className="settings-state__title">Account linking belum dapat dilanjutkan</p>
              <p className="settings-state__description">{error}</p>
            </div>
            {accountIsLinked && lookupState === 'error' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setLookupKey((value) => value + 1)}
              >
                Coba lagi
              </Button>
            ) : null}
          </div>
        ) : null}

        {profile ? <AccountProfileSummary operator={operator} profile={profile} /> : null}
      </div>
    </Dialog>
  );
}
