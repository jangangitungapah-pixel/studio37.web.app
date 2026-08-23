import { useCallback, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  createPermissionSetFormValues,
  PERMISSION_CAPABILITY_GROUPS,
  validatePermissionSetForm,
} from './permissionAdministrationUi.js';

function getSaveErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Hanya Owner aktif yang dapat mengelola template permission.';
  }

  if (error?.code === 'unavailable') {
    return 'Firestore sedang tidak tersedia. Data form tetap dipertahankan untuk dicoba lagi.';
  }

  return 'Template belum tersimpan. Periksa pilihan lalu coba lagi.';
}

export function PermissionSetEditorDialog({ onClose, onSaved, permissionSet = null, repository }) {
  const { pushToast } = useToast();
  const editing = Boolean(permissionSet);
  const [dialogError, setDialogError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => createPermissionSetFormValues(permissionSet));
  const [saving, setSaving] = useState(false);

  const closeDialog = useCallback(() => {
    if (!saving) onClose?.();
  }, [onClose, saving]);

  const changeName = (event) => {
    setFormValues((current) => ({ ...current, name: event.target.value }));
    setFieldErrors((current) => {
      if (!current.name) return current;
      const next = { ...current };
      delete next.name;
      return next;
    });
    setDialogError('');
  };

  const toggleCapability = (capabilityValue) => (event) => {
    setFormValues((current) => ({
      ...current,
      capabilities: event.target.checked
        ? [...current.capabilities, capabilityValue]
        : current.capabilities.filter((capability) => capability !== capabilityValue),
    }));
    setFieldErrors((current) => {
      if (!current.capabilities) return current;
      const next = { ...current };
      delete next.capabilities;
      return next;
    });
    setDialogError('');
  };

  const savePermissionSet = async (event) => {
    event.preventDefault();
    const validation = validatePermissionSetForm(formValues);
    setFieldErrors({ ...validation.errors });
    setDialogError('');

    if (!validation.value) return;

    setSaving(true);

    try {
      const permissionSetId = editing
        ? await repository.updatePermissionSet(permissionSet.id, validation.value)
        : await repository.createPermissionSet(validation.value);

      pushToast({
        message: `${validation.value.name} siap dipakai untuk akun Studio Operator yang memenuhi syarat.`,
        tone: 'success',
        title: editing ? 'Template diperbarui' : 'Template dibuat',
      });
      onSaved?.({ id: permissionSetId, mode: editing ? 'edit' : 'create' });
    } catch (error) {
      setDialogError(getSaveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={editing ? `Edit ${permissionSet.name}` : 'Buat template permission'}
      description="Capability dikelompokkan per domain. Owner tetap memiliki kewenangan implisit dan tidak memakai template ini."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={closeDialog}>
            Batal
          </Button>
          <Button type="submit" form="permission-set-editor-form" loading={saving}>
            Simpan template
          </Button>
        </>
      }
    >
      {dialogError ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Template belum tersimpan.</strong>
          <span>{dialogError}</span>
        </div>
      ) : null}

      <form
        id="permission-set-editor-form"
        className="permission-editor"
        onSubmit={savePermissionSet}
        noValidate
      >
        <Input
          label="Nama template"
          value={formValues.name}
          error={fieldErrors.name}
          maxLength={120}
          placeholder="Contoh: Front Desk"
          required
          disabled={saving}
          data-autofocus="true"
          onChange={changeName}
        />

        <div className="permission-editor__summary" aria-live="polite">
          <strong>{formValues.capabilities.length} capability dipilih</strong>
          <span>
            Template tanpa capability tetap valid dan menghasilkan akun login tanpa akses
            operasional.
          </span>
        </div>

        {fieldErrors.capabilities ? (
          <div className="settings-notice" data-tone="danger" role="alert">
            <span>{fieldErrors.capabilities}</span>
          </div>
        ) : null}

        <div className="permission-editor__groups">
          {PERMISSION_CAPABILITY_GROUPS.map((capabilityGroup) => (
            <fieldset className="permission-capability-group" key={capabilityGroup.id}>
              <legend>
                <span>{capabilityGroup.label}</span>
                <small>{capabilityGroup.description}</small>
              </legend>
              <div className="permission-capability-group__options">
                {capabilityGroup.capabilities.map((option) => {
                  const selected = formValues.capabilities.includes(option.value);

                  return (
                    <label
                      key={option.value}
                      data-selected={selected || undefined}
                      data-sensitive={option.sensitive || undefined}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={saving}
                        onChange={toggleCapability(option.value)}
                      />
                      <span>
                        <span className="permission-capability-group__option-heading">
                          <strong>{option.label}</strong>
                          {option.sensitive ? <Badge tone="warning">Sensitif</Badge> : null}
                        </span>
                        <small>{option.description}</small>
                        <code>{option.value}</code>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Tetap Owner-only.</strong>
          <span>
            Pengelolaan permission dan Danger Zone tidak muncul sebagai pilihan dan tidak dapat
            didelegasikan ke Studio Operator.
          </span>
        </div>
      </form>
    </Dialog>
  );
}
