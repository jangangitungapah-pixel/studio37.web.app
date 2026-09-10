import { useCallback, useEffect, useMemo, useState } from 'react';

import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Input, Textarea } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { customerRepository } from '../../services/customerRepository.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { useAuth } from '../auth/useAuth.js';
import {
  DEFAULT_CUSTOMER_FORM_VALUES,
  excludeCurrentCustomer,
  filterCustomerDirectory,
  formatCustomerPhone,
  mergeCustomerResults,
  toCustomerFormValues,
  tryNormalizeExactCustomerPhone,
  validateCustomerForm,
} from './customerManagement.js';
import './customer-management.css';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} data customer.`;
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} data customer lagi setelah koneksi pulih.`;
  }

  return `Data customer belum bisa ${action}. Coba lagi tanpa menghapus data yang sudah diisi.`;
}

function getCustomerInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function CustomerCard({ canEdit, customer, onEdit }) {
  return (
    <article className="customer-card">
      <div className="customer-card__identity">
        <div className="customer-card__avatar" aria-hidden="true">
          {getCustomerInitials(customer.name)}
        </div>
        <div className="customer-card__heading">
          <h2>{customer.name}</h2>
          <p>{formatCustomerPhone(customer.displayPhone)}</p>
        </div>
      </div>

      <dl className="customer-card__details">
        <div>
          <dt>Email</dt>
          <dd>{customer.email ?? 'Belum ada email'}</dd>
        </div>
        <div>
          <dt>Catatan</dt>
          <dd>{customer.notes || 'Belum ada catatan customer.'}</dd>
        </div>
      </dl>

      {canEdit ? (
        <div className="customer-card__actions">
          <Button
            aria-label={`Edit ${customer.name}`}
            size="sm"
            variant="secondary"
            onClick={() => onEdit(customer)}
          >
            Edit customer
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function CustomerManagementPage({ repository = customerRepository }) {
  const access = useAuth();
  const { pushToast } = useToast();
  const canEdit = hasCapability(access, CAPABILITIES.CUSTOMER_EDIT);
  const actorUid = access.user?.uid;
  const [customers, setCustomers] = useState([]);
  const [dialogError, setDialogError] = useState('');
  const [dialogMode, setDialogMode] = useState(null);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [exactMatches, setExactMatches] = useState([]);
  const [exactSearchState, setExactSearchState] = useState('idle');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({ ...DEFAULT_CUSTOMER_FORM_VALUES }));
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');

  const directoryLimit = repository.directoryLimit ?? 50;
  const directoryLimitReached = customers.length >= directoryLimit;
  const localResults = useMemo(
    () => filterCustomerDirectory(customers, searchText),
    [customers, searchText],
  );
  const visibleCustomers = useMemo(
    () => mergeCustomerResults(localResults, exactMatches),
    [exactMatches, localResults],
  );

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');

    repository
      .listCustomerDirectory()
      .then((nextCustomers) => {
        if (!active) return;
        setCustomers([...nextCustomers]);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(getSafeFirebaseMessage(error, 'memuat'));
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [reloadKey, repository]);

  useEffect(() => {
    let active = true;
    const canonicalPhone = tryNormalizeExactCustomerPhone(searchText);

    if (!canonicalPhone) {
      setExactMatches([]);
      setExactSearchState('idle');
      return () => {
        active = false;
      };
    }

    setExactSearchState('loading');
    repository
      .findCustomersByPhone(canonicalPhone)
      .then((matches) => {
        if (!active) return;
        setExactMatches([...matches]);
        setExactSearchState('ready');
      })
      .catch(() => {
        if (!active) return;
        setExactMatches([]);
        setExactSearchState('error');
      });

    return () => {
      active = false;
    };
  }, [repository, searchText]);

  const closeDialog = useCallback(() => {
    if (saving) return;
    setDialogMode(null);
    setEditingCustomer(null);
    setDialogError('');
    setDuplicateMatches([]);
    setFieldErrors({});
  }, [saving]);

  const openCreateDialog = () => {
    if (!canEdit) return;
    setEditingCustomer(null);
    setFormValues({ ...DEFAULT_CUSTOMER_FORM_VALUES });
    setFieldErrors({});
    setDialogError('');
    setDuplicateMatches([]);
    setDialogMode('create');
  };

  const openEditDialog = (customer) => {
    if (!canEdit) return;
    setEditingCustomer(customer);
    setFormValues(toCustomerFormValues(customer));
    setFieldErrors({});
    setDialogError('');
    setDuplicateMatches([]);
    setDialogMode('edit');
  };

  const updateFormField = (fieldName, value) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
    setFieldErrors((current) => {
      if (!current[fieldName]) return current;
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
    setDialogError('');
    setDuplicateMatches([]);
  };

  const persistCustomer = async ({ skipDuplicateCheck = false } = {}) => {
    const validation = validateCustomerForm(formValues);
    setFieldErrors({ ...validation.errors });
    setDialogError('');

    if (!validation.normalized || !actorUid) return;

    setSaving(true);

    try {
      if (!skipDuplicateCheck) {
        const matches = await repository.findCustomersByPhone(validation.normalized.displayPhone);
        const conflicts = editingCustomer
          ? excludeCurrentCustomer(matches, editingCustomer.id)
          : matches;

        if (conflicts.length > 0) {
          setDuplicateMatches([...conflicts]);
          setSaving(false);
          return;
        }
      }

      const details = {
        displayPhone: validation.normalized.displayPhone,
        email: validation.normalized.email,
        name: validation.normalized.name,
        notes: validation.normalized.notes,
      };

      if (dialogMode === 'edit' && editingCustomer) {
        await repository.updateCustomer(editingCustomer.id, details, { actorUid });
        pushToast({ message: 'Data customer diperbarui', tone: 'success' });
      } else {
        await repository.createCustomer(details, { actorUid });
        pushToast({ message: 'Customer ditambahkan', tone: 'success' });
      }

      setDialogMode(null);
      setEditingCustomer(null);
      setDuplicateMatches([]);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(
        getSafeFirebaseMessage(error, dialogMode === 'edit' ? 'menyimpan' : 'membuat'),
      );
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle = dialogMode === 'edit' ? 'Edit customer' : 'Tambah customer';
  const dialogDescription =
    dialogMode === 'edit'
      ? 'Perbarui profil reusable. Booking historis nantinya tetap memakai snapshot saat transaksi dibuat.'
      : 'Simpan profil reusable agar booking berikutnya tidak perlu mengetik ulang data customer.';

  return (
    <section className="customer-workspace">
      <header className="customer-workspace__hero">
        <div>
          <p className="customer-workspace__eyebrow">Customer directory</p>
          <h1>Customers</h1>
          <p className="customer-workspace__lede">
            Profil customer reusable dengan pencocokan nomor Indonesia yang konsisten untuk booking
            berikutnya.
          </p>
        </div>

        {canEdit ? (
          <Button onClick={openCreateDialog}>Tambah customer</Button>
        ) : (
          <span className="customer-workspace__readonly">Mode lihat saja</span>
        )}
      </header>

      <div className="customer-workspace__toolbar">
        <div className="customer-workspace__search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="customer-search">
            Cari customer
          </label>
          <input
            id="customer-search"
            type="search"
            value={searchText}
            placeholder="Cari nama, email, atau nomor lengkap…"
            onChange={(event) => setSearchText(event.target.value)}
          />
          {exactSearchState === 'loading' ? <span>Memeriksa nomor…</span> : null}
        </div>

        <div className="customer-workspace__stats" aria-live="polite">
          <strong>{visibleCustomers.length}</strong>
          <span>{searchText ? 'hasil terlihat' : 'customer dimuat'}</span>
        </div>
      </div>

      {directoryLimitReached ? (
        <div className="customer-workspace__notice">
          <Icon name="info" size={18} />
          <p>
            Directory menampilkan maksimal {directoryLimit} customer. Pencarian nomor lengkap tetap
            memeriksa seluruh collection lewat exact match.
          </p>
        </div>
      ) : null}

      {exactSearchState === 'error' ? (
        <div className="customer-workspace__notice" data-tone="warning">
          <Icon name="warning" size={18} />
          <p>
            Pencarian nomor lengkap gagal. Data directory yang sudah dimuat tetap bisa digunakan.
          </p>
        </div>
      ) : null}

      {loadState === 'loading' ? (
        <div className="customer-workspace__state" role="status">
          <span className="customer-workspace__loader" aria-hidden="true" />
          <h2>Memuat customer</h2>
          <p>Menyiapkan directory customer Studio37…</p>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="customer-workspace__state" data-tone="danger">
          <Icon name="warning" size={24} />
          <h2>Customer belum bisa dimuat</h2>
          <p>{loadError}</p>
          <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {loadState === 'ready' && visibleCustomers.length === 0 ? (
        <div className="customer-workspace__state">
          <Icon name="user" size={26} />
          <h2>{searchText ? 'Customer tidak ditemukan' : 'Belum ada customer'}</h2>
          <p>
            {searchText
              ? 'Coba nama, email, atau masukkan nomor Indonesia lengkap untuk exact match.'
              : 'Tambahkan customer pertama untuk mulai membangun directory reusable.'}
          </p>
        </div>
      ) : null}

      {loadState === 'ready' && visibleCustomers.length > 0 ? (
        <div className="customer-workspace__grid">
          {visibleCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              canEdit={canEdit}
              customer={customer}
              onEdit={openEditDialog}
            />
          ))}
        </div>
      ) : null}

      <Dialog
        open={Boolean(dialogMode)}
        title={dialogTitle}
        description={dialogDescription}
        onClose={closeDialog}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={closeDialog}>
              Batal
            </Button>
            {duplicateMatches.length > 0 ? (
              <Button
                loading={saving}
                onClick={() => persistCustomer({ skipDuplicateCheck: true })}
              >
                Tetap simpan customer
              </Button>
            ) : (
              <Button loading={saving} onClick={() => persistCustomer()}>
                Simpan customer
              </Button>
            )}
          </>
        }
      >
        <div className="customer-form">
          <Input
            data-autofocus="true"
            label="Nama customer"
            required
            value={formValues.name}
            error={fieldErrors.name}
            onChange={(event) => updateFormField('name', event.target.value)}
          />
          <Input
            label="Nomor WhatsApp"
            required
            inputMode="tel"
            value={formValues.displayPhone}
            error={fieldErrors.displayPhone}
            description="Boleh ketik 08…, 628…, atau +62…. Sistem menyimpan bentuk canonical +62."
            onChange={(event) => updateFormField('displayPhone', event.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={formValues.email}
            error={fieldErrors.email}
            onChange={(event) => updateFormField('email', event.target.value)}
          />
          <Textarea
            label="Catatan"
            rows={4}
            value={formValues.notes}
            error={fieldErrors.notes}
            description="Catatan profil tidak ikut masuk ke snapshot booking historis."
            onChange={(event) => updateFormField('notes', event.target.value)}
          />

          {duplicateMatches.length > 0 ? (
            <div className="customer-form__duplicate" role="alert">
              <div>
                <Icon name="warning" size={18} />
                <strong>Nomor ini sudah dipakai customer lain.</strong>
              </div>
              <p>
                Periksa data existing sebelum membuat duplikat. Studio37 tidak menggabungkan record
                secara otomatis.
              </p>
              <ul>
                {duplicateMatches.map((customer) => (
                  <li key={customer.id}>
                    <span>{customer.name}</span>
                    <small>{formatCustomerPhone(customer.displayPhone)}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {dialogError ? (
            <p className="customer-form__error" role="alert">
              {dialogError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}
