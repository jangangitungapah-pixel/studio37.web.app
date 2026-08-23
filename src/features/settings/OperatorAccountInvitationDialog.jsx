import { useCallback, useState } from 'react';

import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { OPERATOR_ACCOUNT_INVITATION_DEFAULT_HOURS } from '../auth/operatorAccountInvitation.js';
import {
  buildOperatorAccountInvitationUrl,
  isOperatorAccountInvitationEligible,
} from '../auth/operatorAccountInvitationUi.js';
import {
  operatorAccountInvitationRepository,
  OPERATOR_ACCOUNT_INVITATION_ERROR_CODES,
} from '../../services/operatorAccountInvitationRepository.js';

const invitationDurationDays = OPERATOR_ACCOUNT_INVITATION_DEFAULT_HOURS / 24;

function getInvitationCreationErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Hanya Owner aktif yang dapat membuat undangan akun operator.';
  }

  if (error?.code === 'unavailable') {
    return 'Firestore sedang tidak tersedia. Coba buat undangan lagi setelah koneksi pulih.';
  }

  const messages = {
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.EMAIL_REQUIRED]:
      'Tambahkan email operator sebelum membuat undangan akun.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_ALREADY_LINKED]:
      'Operator ini sudah terhubung ke akun. Muat ulang daftar sebelum melanjutkan.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_INACTIVE]:
      'Aktifkan operator terlebih dahulu sebelum membuat undangan.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_NOT_FOUND]:
      'Profil operator tidak ditemukan. Muat ulang daftar sebelum melanjutkan.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_TYPE_REQUIRED]:
      'Undangan login hanya tersedia untuk operator bertipe Studio Operator.',
    [OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.REPOSITORY_UNAVAILABLE]:
      'Repository undangan akun belum tersedia pada sesi ini.',
  };

  return (
    messages[error?.code] ??
    'Link undangan belum dapat dibuat. Profil operator tidak diubah; coba lagi.'
  );
}

async function copyWithBrowserClipboard(value) {
  if (!globalThis.navigator?.clipboard?.writeText) {
    throw new Error('Clipboard API is unavailable.');
  }

  await globalThis.navigator.clipboard.writeText(value);
}

export function OperatorAccountInvitationDialog({
  actorUid,
  copyText = copyWithBrowserClipboard,
  onClose,
  operator,
  origin = globalThis.location?.origin,
  repository = operatorAccountInvitationRepository,
}) {
  const [copyState, setCopyState] = useState('idle');
  const [error, setError] = useState('');
  const [invitationUrl, setInvitationUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const eligible = isOperatorAccountInvitationEligible(operator);

  const closeDialog = useCallback(() => {
    if (!saving) onClose?.();
  }, [onClose, saving]);

  async function createInvitation() {
    if (!eligible || !actorUid) {
      setError('Operator atau sesi Owner belum memenuhi syarat untuk membuat undangan.');
      return;
    }

    setSaving(true);
    setError('');
    setCopyState('idle');

    try {
      const result = await repository.createInvitation(operator.id, { actorUid });
      setInvitationUrl(
        buildOperatorAccountInvitationUrl(origin, result.operatorId, result.invitationId),
      );
    } catch (nextError) {
      setError(getInvitationCreationErrorMessage(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function copyInvitation() {
    setCopyState('copying');

    try {
      await copyText(invitationUrl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <Dialog
      open
      title={`Undang akun ${operator.displayName}`}
      description="Buat link onboarding terikat ke satu profil Studio Operator dan email terverifikasi."
      onClose={closeDialog}
      footer={
        invitationUrl ? (
          <Button onClick={closeDialog}>Selesai</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={saving} onClick={closeDialog}>
              Batal
            </Button>
            <Button loading={saving} disabled={!eligible} onClick={createInvitation}>
              Buat link undangan
            </Button>
          </>
        )
      }
    >
      <div className="settings-invitation-dialog">
        <div className="settings-notice" role="status">
          <strong>Hak akses tetap terkunci.</strong>
          <span>
            Akun baru selalu menjadi Studio Operator aktif tanpa permission set. Undangan ini tidak
            dapat membuat atau mempromosikan Owner.
          </span>
        </div>

        <dl className="settings-invitation-summary">
          <div>
            <dt>Operator</dt>
            <dd>{operator.displayName}</dd>
          </div>
          <div>
            <dt>Email wajib cocok</dt>
            <dd>{operator.email ?? 'Belum tersedia'}</dd>
          </div>
          <div>
            <dt>Masa berlaku</dt>
            <dd>{invitationDurationDays} hari sejak dibuat</dd>
          </div>
        </dl>

        {!eligible ? (
          <div className="settings-notice" data-tone="warning" role="alert">
            <strong>Operator belum memenuhi syarat.</strong>
            <span>
              Pastikan status aktif, tipe Studio Operator, email tersedia, dan belum ada akun
              terhubung.
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="settings-notice" data-tone="danger" role="alert">
            <strong>Undangan belum dibuat.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {invitationUrl ? (
          <div className="settings-invitation-result" aria-live="polite">
            <div className="settings-notice" data-tone="success" role="status">
              <strong>Link undangan siap.</strong>
              <span>
                Salin link ini sekarang dan kirim lewat kanal pilihan Anda. Studio37 tidak menyimpan
                atau mengirim password.
              </span>
            </div>
            <Input
              label="Link undangan"
              value={invitationUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="settings-invitation-result__actions">
              <Button
                variant="secondary"
                loading={copyState === 'copying'}
                onClick={copyInvitation}
              >
                {copyState === 'copied' ? 'Link tersalin' : 'Salin link'}
              </Button>
              {copyState === 'error' ? (
                <span role="alert">Clipboard tidak tersedia. Pilih link lalu salin manual.</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
