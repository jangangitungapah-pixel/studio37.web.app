import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PERMISSION_SET_STATUSES } from '../auth/permissionSet.js';
import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from '../auth/userProfile.js';
import {
  canAssignActivePermissionSet,
  canClearPermissionAssignment,
} from './permissionAdministrationUi.js';

function getLoadErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Hanya Owner aktif yang dapat membaca profil akun ini.';
  }

  if (error?.code === 'unavailable') {
    return 'Firestore sedang tidak tersedia. Coba muat profil lagi setelah koneksi pulih.';
  }

  return 'Profil akun belum dapat dimuat melalui exact UID.';
}

function getAssignmentErrorMessage(error) {
  const messages = {
    'studio37/permission-assignment-operator-ineligible':
      'Operator tidak aktif, bukan Studio Operator, atau hubungan akunnya tidak lagi timbal balik.',
    'studio37/permission-assignment-operator-not-found':
      'Profil operator tidak ditemukan. Muat ulang halaman sebelum mencoba lagi.',
    'studio37/permission-assignment-set-disabled':
      'Template sudah dinonaktifkan dan tidak dapat ditetapkan.',
    'studio37/permission-assignment-set-not-found':
      'Template tidak lagi tersedia. Muat ulang daftar permission.',
    'studio37/permission-assignment-user-ineligible':
      'Profil user tidak aktif, bukan Studio Operator, atau belum memiliki hubungan akun yang valid.',
    'studio37/permission-assignment-user-not-found':
      'Profil user tidak ditemukan. Periksa kembali hubungan akun operator.',
  };

  if (messages[error?.code]) return messages[error.code];
  if (error?.code === 'permission-denied') {
    return 'Security Rules menolak perubahan permission dari sesi ini.';
  }
  if (error?.code === 'unavailable') {
    return 'Firestore sedang tidak tersedia. Pilihan tetap dipertahankan untuk dicoba lagi.';
  }

  return 'Permission belum berubah. Muat ulang data lalu coba lagi.';
}

function getCurrentPermissionLabel(permissionSetId, permissionSets) {
  if (!permissionSetId) return 'Tanpa permission';
  const permissionSet = permissionSets.find(({ id }) => id === permissionSetId);

  if (!permissionSet) return `${permissionSetId} · template tidak ditemukan`;
  if (permissionSet.status === PERMISSION_SET_STATUSES.DISABLED) {
    return `${permissionSet.name} · nonaktif`;
  }

  return permissionSet.name;
}

export function OperatorPermissionAssignmentDialog({
  onClose,
  onSaved,
  operator,
  permissionSets,
  repository,
}) {
  const { pushToast } = useToast();
  const [dialogError, setDialogError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedPermissionSetId, setSelectedPermissionSetId] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');
    setUserProfile(null);

    repository
      .getUserByUid(operator.linkedUserUid)
      .then((profile) => {
        if (!active) return;

        if (!profile || profile.uid !== operator.linkedUserUid) {
          setLoadError('Profil akun yang terhubung tidak ditemukan pada exact UID tersebut.');
          setLoadState('error');
          return;
        }

        setUserProfile(profile);
        setSelectedPermissionSetId(profile.permissionSetId ?? '');
        setLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(getLoadErrorMessage(error));
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [operator.linkedUserUid, reloadKey, repository]);

  const closeDialog = useCallback(() => {
    if (!saving) onClose?.();
  }, [onClose, saving]);

  const activeAssignmentAllowed = canAssignActivePermissionSet(operator, userProfile);
  const clearingAllowed = canClearPermissionAssignment(userProfile);
  const selectedAssignment = selectedPermissionSetId || null;
  const assignmentChanged = Boolean(
    userProfile && selectedAssignment !== userProfile.permissionSetId,
  );
  const saveAllowed =
    loadState === 'ready' &&
    assignmentChanged &&
    (selectedAssignment === null ? clearingAllowed : activeAssignmentAllowed);

  const permissionOptions = useMemo(() => {
    const options = [
      {
        label: 'Tanpa permission — cabut akses operasional',
        value: '',
      },
    ];
    const activePermissionSets = permissionSets.filter(
      ({ status }) => status === PERMISSION_SET_STATUSES.ACTIVE,
    );
    const currentPermissionSet = permissionSets.find(
      ({ id }) => id === userProfile?.permissionSetId,
    );

    if (
      userProfile?.permissionSetId &&
      currentPermissionSet?.status !== PERMISSION_SET_STATUSES.ACTIVE
    ) {
      options.push({
        disabled: true,
        label: getCurrentPermissionLabel(userProfile.permissionSetId, permissionSets),
        value: userProfile.permissionSetId,
      });
    }

    options.push(
      ...activePermissionSets.map((permissionSet) => ({
        disabled: !activeAssignmentAllowed,
        label: `${permissionSet.name} · ${permissionSet.capabilities.length} capability`,
        value: permissionSet.id,
      })),
    );

    return options;
  }, [activeAssignmentAllowed, permissionSets, userProfile?.permissionSetId]);

  const saveAssignment = async () => {
    if (!userProfile || !saveAllowed) return;

    setSaving(true);
    setDialogError('');

    try {
      await repository.assignPermissionSetToUser(userProfile.uid, selectedAssignment);
      const permissionLabel = getCurrentPermissionLabel(selectedAssignment, permissionSets);

      pushToast({
        message:
          selectedAssignment === null
            ? `${operator.displayName} sekarang tidak memiliki akses operasional yang didelegasikan.`
            : `${operator.displayName} sekarang memakai template ${permissionLabel}.`,
        tone: 'success',
        title: selectedAssignment === null ? 'Permission dicabut' : 'Permission ditetapkan',
      });
      onSaved?.({ permissionSetId: selectedAssignment, userUid: userProfile.uid });
    } catch (error) {
      setDialogError(getAssignmentErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={`Kelola akses ${operator.displayName}`}
      description="Profil user dibaca melalui satu exact UID hanya setelah dialog ini dibuka. Tidak ada pencarian atau daftar akun Authentication."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={closeDialog}>
            Batal
          </Button>
          <Button loading={saving} disabled={!saveAllowed} onClick={saveAssignment}>
            Simpan permission
          </Button>
        </>
      }
    >
      {loadState === 'loading' ? (
        <div
          className="settings-state settings-state--embedded"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="settings-state__spinner" aria-hidden="true" />
          <div>
            <p className="settings-state__title">Memuat satu profil user</p>
            <p className="settings-state__description">
              Exact path: users/{operator.linkedUserUid}
            </p>
          </div>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Profil akun tidak dapat diverifikasi</p>
            <p className="settings-state__description">{loadError}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {loadState === 'ready' && userProfile ? (
        <div className="permission-assignment">
          <div className="permission-assignment__profile">
            <div className="permission-assignment__heading">
              <div>
                <strong>{userProfile.displayName}</strong>
                <span>{userProfile.email}</span>
              </div>
              <div className="permission-assignment__badges">
                <Badge
                  tone={userProfile.status === USER_PROFILE_STATUSES.ACTIVE ? 'success' : 'neutral'}
                >
                  {userProfile.status === USER_PROFILE_STATUSES.ACTIVE
                    ? 'User aktif'
                    : 'User nonaktif'}
                </Badge>
                <Badge
                  tone={
                    userProfile.role === USER_PROFILE_ROLES.STUDIO_OPERATOR ? 'brand' : 'danger'
                  }
                >
                  {userProfile.role === USER_PROFILE_ROLES.STUDIO_OPERATOR
                    ? 'Studio Operator'
                    : 'Role tidak valid'}
                </Badge>
              </div>
            </div>
            <dl>
              <div>
                <dt>Firebase UID</dt>
                <dd>{userProfile.uid}</dd>
              </div>
              <div>
                <dt>Permission saat ini</dt>
                <dd>{getCurrentPermissionLabel(userProfile.permissionSetId, permissionSets)}</dd>
              </div>
            </dl>
          </div>

          {!activeAssignmentAllowed ? (
            <div className="settings-notice" data-tone="warning" role="status">
              <strong>Template aktif tidak dapat ditetapkan.</strong>
              <span>
                User/operator harus aktif, berjenis Studio Operator, dan memiliki hubungan akun
                timbal balik. Permission lama tetap dapat dicabut dengan memilih Tanpa permission.
              </span>
            </div>
          ) : null}

          {dialogError ? (
            <div className="settings-notice" data-tone="danger" role="alert">
              <strong>Permission belum berubah.</strong>
              <span>{dialogError}</span>
            </div>
          ) : null}

          <Select
            label="Template permission"
            description="Perubahan hanya menulis users.permissionSetId dan server updatedAt."
            value={selectedPermissionSetId}
            options={permissionOptions}
            placeholder=""
            disabled={saving}
            onChange={(event) => {
              setSelectedPermissionSetId(event.target.value);
              setDialogError('');
            }}
          />
        </div>
      ) : null}
    </Dialog>
  );
}
