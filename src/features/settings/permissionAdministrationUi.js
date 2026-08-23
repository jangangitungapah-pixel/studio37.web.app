import {
  ALL_CAPABILITIES,
  CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
} from '../auth/capabilities.js';
import { normalizePermissionSetDetails } from '../auth/permissionSet.js';
import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from '../auth/userProfile.js';
import { OPERATOR_STATUSES, OPERATOR_TYPES } from './operators.js';

function capability(value, label, description, { sensitive = false } = {}) {
  return Object.freeze({ description, label, sensitive, value });
}

function group(id, label, description, capabilities) {
  return Object.freeze({
    capabilities: Object.freeze(capabilities),
    description,
    id,
    label,
  });
}

export const PERMISSION_CAPABILITY_GROUPS = Object.freeze([
  group('dashboard', 'Dashboard', 'Ringkasan operasional yang terlihat setelah login.', [
    capability(
      CAPABILITIES.DASHBOARD_VIEW,
      'Lihat dashboard',
      'Membuka ringkasan aktivitas dan status operasional.',
    ),
  ]),
  group('booking', 'Booking', 'Akses jadwal dan tindakan pada reservasi studio.', [
    capability(
      CAPABILITIES.BOOKING_VIEW,
      'Lihat booking',
      'Melihat kalender, jadwal, dan detail booking yang diizinkan.',
    ),
    capability(
      CAPABILITIES.BOOKING_CREATE,
      'Buat booking',
      'Membuat booking baru melalui workflow yang tervalidasi.',
    ),
    capability(
      CAPABILITIES.BOOKING_EDIT,
      'Edit booking',
      'Mengubah detail dan jadwal booking yang masih dapat diedit.',
    ),
    capability(
      CAPABILITIES.BOOKING_CANCEL,
      'Batalkan booking',
      'Menjalankan pembatalan tanpa menghapus riwayat booking.',
      { sensitive: true },
    ),
    capability(
      CAPABILITIES.BOOKING_OVERRIDE_PRICE,
      'Override harga',
      'Mengganti hasil pricing engine dengan alasan dan jejak perubahan.',
      { sensitive: true },
    ),
  ]),
  group('customer', 'Customer', 'Data pelanggan yang dipakai dalam workflow booking.', [
    capability(
      CAPABILITIES.CUSTOMER_VIEW,
      'Lihat customer',
      'Melihat daftar, detail, dan riwayat pelanggan.',
    ),
    capability(
      CAPABILITIES.CUSTOMER_EDIT,
      'Kelola customer',
      'Membuat dan memperbarui data pelanggan.',
    ),
  ]),
  group('payment', 'Payment', 'Pencatatan dan koreksi pembayaran booking.', [
    capability(
      CAPABILITIES.PAYMENT_VIEW,
      'Lihat pembayaran',
      'Melihat status, saldo, dan riwayat pembayaran.',
    ),
    capability(
      CAPABILITIES.PAYMENT_CREATE,
      'Catat pembayaran',
      'Menambahkan pembayaran melalui flow yang tervalidasi.',
    ),
    capability(
      CAPABILITIES.PAYMENT_ADJUST,
      'Koreksi pembayaran',
      'Membuat adjustment atau koreksi finansial yang sensitif.',
      { sensitive: true },
    ),
  ]),
  group('commission', 'Commission', 'Visibilitas dan tindakan pada fee/komisi operator.', [
    capability(
      CAPABILITIES.COMMISSION_VIEW_OWN,
      'Lihat komisi sendiri',
      'Melihat komisi yang terhubung dengan operator sendiri.',
    ),
    capability(
      CAPABILITIES.COMMISSION_VIEW_ALL,
      'Lihat semua komisi',
      'Melihat nilai komisi seluruh operator.',
      { sensitive: true },
    ),
    capability(
      CAPABILITIES.COMMISSION_ADJUST,
      'Koreksi komisi',
      'Menyesuaikan komisi dengan alasan dan jejak perubahan.',
      { sensitive: true },
    ),
    capability(
      CAPABILITIES.COMMISSION_PAYOUT,
      'Proses payout',
      'Menandai dan memproses pembayaran komisi operator.',
      { sensitive: true },
    ),
  ]),
  group('bookkeeping', 'Bookkeeping', 'Akses ke ledger dan pencatatan kas studio.', [
    capability(
      CAPABILITIES.BOOKKEEPING_VIEW,
      'Lihat pembukuan',
      'Melihat ledger, pemasukan, pengeluaran, dan saldo.',
      { sensitive: true },
    ),
    capability(
      CAPABILITIES.BOOKKEEPING_CREATE,
      'Catat transaksi',
      'Membuat pemasukan atau pengeluaran manual.',
      { sensitive: true },
    ),
  ]),
  group('settings', 'Settings', 'Konfigurasi operasional yang boleh didelegasikan.', [
    capability(
      CAPABILITIES.SETTINGS_STUDIO_VIEW,
      'Lihat studio',
      'Melihat profil studio, jam operasional, dan room.',
    ),
    capability(
      CAPABILITIES.SETTINGS_STUDIO_EDIT,
      'Kelola studio',
      'Mengubah profil, jam operasional, dan room aktif.',
      { sensitive: true },
    ),
    capability(
      CAPABILITIES.SETTINGS_OPERATORS_VIEW,
      'Lihat operator',
      'Melihat profil dan status operator.',
    ),
    capability(
      CAPABILITIES.SETTINGS_OPERATORS_MANAGE,
      'Kelola operator',
      'Membuat, mengedit, serta mengubah status profil operator.',
      { sensitive: true },
    ),
    capability(
      CAPABILITIES.SETTINGS_PRICING_VIEW,
      'Lihat konfigurasi harga',
      'Melihat session type dan aturan harga.',
    ),
    capability(
      CAPABILITIES.SETTINGS_PRICING_EDIT,
      'Kelola konfigurasi harga',
      'Mengubah aturan yang memengaruhi harga booking baru.',
      { sensitive: true },
    ),
  ]),
]);

export const DELEGABLE_CAPABILITY_OPTIONS = Object.freeze(
  PERMISSION_CAPABILITY_GROUPS.flatMap((capabilityGroup) => capabilityGroup.capabilities),
);

const capabilityOptionByValue = new Map(
  DELEGABLE_CAPABILITY_OPTIONS.map((option) => [option.value, option]),
);
const delegableCapabilityValues = new Set(DELEGABLE_CAPABILITY_OPTIONS.map(({ value }) => value));
const nonDelegableCapabilityValues = new Set(NON_DELEGABLE_CAPABILITIES);

if (
  delegableCapabilityValues.size !== DELEGABLE_CAPABILITY_OPTIONS.length ||
  DELEGABLE_CAPABILITY_OPTIONS.some(({ value }) => nonDelegableCapabilityValues.has(value)) ||
  ALL_CAPABILITIES.some(
    (capabilityValue) =>
      !delegableCapabilityValues.has(capabilityValue) &&
      !nonDelegableCapabilityValues.has(capabilityValue),
  )
) {
  throw new Error('Permission UI capability groups are out of sync with the runtime registry.');
}

export function createPermissionSetFormValues(permissionSet = null) {
  return {
    capabilities: permissionSet ? [...permissionSet.capabilities] : [],
    name: permissionSet?.name ?? '',
  };
}

export function validatePermissionSetForm(value) {
  const errors = {};
  const name = typeof value?.name === 'string' ? value.name.trim() : '';

  if (!name || name.length > 120) {
    errors.name = 'Nama template wajib diisi dan maksimal 120 karakter.';
  }

  if (!Array.isArray(value?.capabilities)) {
    errors.capabilities = 'Daftar capability tidak valid.';
  }

  if (Object.keys(errors).length > 0) {
    return Object.freeze({ errors: Object.freeze(errors), value: null });
  }

  try {
    return Object.freeze({
      errors: Object.freeze({}),
      value: normalizePermissionSetDetails({ capabilities: value.capabilities, name }),
    });
  } catch {
    return Object.freeze({
      errors: Object.freeze({ capabilities: 'Pilih hanya capability yang dapat didelegasikan.' }),
      value: null,
    });
  }
}

export function getCapabilityOption(capabilityValue) {
  return capabilityOptionByValue.get(capabilityValue) ?? null;
}

export function getPermissionSetDomainLabels(permissionSet) {
  const assignedCapabilities = new Set(permissionSet.capabilities);

  return PERMISSION_CAPABILITY_GROUPS.filter((capabilityGroup) =>
    capabilityGroup.capabilities.some(({ value }) => assignedCapabilities.has(value)),
  ).map(({ label }) => label);
}

export function isLoginLinkedStudioOperator(operator) {
  return (
    typeof operator?.linkedUserUid === 'string' &&
    operator.linkedUserUid.length > 0 &&
    operator.operatorTypes?.includes(OPERATOR_TYPES.STUDIO_OPERATOR)
  );
}

export function canAssignActivePermissionSet(operator, userProfile) {
  return (
    isLoginLinkedStudioOperator(operator) &&
    operator.status === OPERATOR_STATUSES.ACTIVE &&
    userProfile?.role === USER_PROFILE_ROLES.STUDIO_OPERATOR &&
    userProfile.status === USER_PROFILE_STATUSES.ACTIVE &&
    userProfile.operatorId === operator.id &&
    operator.linkedUserUid === userProfile.uid
  );
}

export function canClearPermissionAssignment(userProfile) {
  return (
    userProfile?.role === USER_PROFILE_ROLES.STUDIO_OPERATOR &&
    typeof userProfile.permissionSetId === 'string'
  );
}
