import {
  normalizeCustomerDetails,
  normalizeCustomerEmail,
  normalizeCustomerPhoneMatch,
} from './customers.js';

export const DEFAULT_CUSTOMER_FORM_VALUES = Object.freeze({
  displayPhone: '',
  email: '',
  name: '',
  notes: '',
});

function normalizeSearchPhoneToken(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function formatCustomerPhone(value) {
  const canonical = normalizeCustomerPhoneMatch(value);
  const national = canonical.slice(3);

  if (national.length <= 7) return `+62 ${national}`;

  const first = national.slice(0, 3);
  const middle = national.slice(3, 7);
  const tail = national.slice(7);
  return `+62 ${first}-${middle}-${tail}`;
}

export function toCustomerFormValues(customer) {
  return {
    displayPhone: formatCustomerPhone(customer.displayPhone),
    email: customer.email ?? '',
    name: customer.name,
    notes: customer.notes,
  };
}

export function validateCustomerForm(values) {
  const errors = {};

  const name = String(values?.name ?? '').trim();
  if (!name || name.length > 120) {
    errors.name = 'Nama customer wajib diisi dan maksimal 120 karakter.';
  }

  const displayPhone = String(values?.displayPhone ?? '').trim();
  try {
    normalizeCustomerPhoneMatch(displayPhone);
  } catch {
    errors.displayPhone = 'Gunakan nomor Indonesia yang valid, misalnya 0812 3456 7890.';
  }

  const email = String(values?.email ?? '').trim();
  try {
    normalizeCustomerEmail(email);
  } catch {
    errors.email = 'Masukkan alamat email yang valid atau kosongkan field ini.';
  }

  const notes = String(values?.notes ?? '').trim();
  if (notes.length > 2000) {
    errors.notes = 'Catatan maksimal 2.000 karakter.';
  }

  if (Object.keys(errors).length > 0) {
    return Object.freeze({ errors: Object.freeze(errors), normalized: null });
  }

  return Object.freeze({
    errors: Object.freeze({}),
    normalized: normalizeCustomerDetails({ displayPhone, email, name, notes }),
  });
}

export function filterCustomerDirectory(customers, searchText) {
  const queryText = String(searchText ?? '').trim().toLocaleLowerCase('id-ID');
  if (!queryText) return Object.freeze([...customers]);

  const phoneToken = normalizeSearchPhoneToken(queryText);

  return Object.freeze(
    customers.filter((customer) => {
      const name = customer.name.toLocaleLowerCase('id-ID');
      const email = customer.email?.toLocaleLowerCase('id-ID') ?? '';
      const phone = customer.normalizedPhone.replace(/\D/g, '');

      return (
        name.includes(queryText) ||
        email.includes(queryText) ||
        (phoneToken.length >= 3 && phone.includes(phoneToken))
      );
    }),
  );
}

export function tryNormalizeExactCustomerPhone(searchText) {
  try {
    return normalizeCustomerPhoneMatch(searchText);
  } catch {
    return null;
  }
}

export function mergeCustomerResults(primary, secondary) {
  const byId = new Map();

  for (const customer of [...primary, ...secondary]) {
    byId.set(customer.id, customer);
  }

  return Object.freeze(
    [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'id-ID', { sensitivity: 'base' }),
    ),
  );
}

export function excludeCurrentCustomer(matches, customerId) {
  return Object.freeze(matches.filter((customer) => customer.id !== customerId));
}
