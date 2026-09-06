import { readFile, writeFile } from 'node:fs/promises';

const rulesUrl = new URL('../firestore.rules', import.meta.url);
let source = await readFile(rulesUrl, 'utf8');

const customerHelpers = `    function isValidCustomer(data) {
      return data.keys().hasAll([
          'name',
          'normalizedPhone',
          'displayPhone',
          'email',
          'notes',
          'createdAt',
          'createdByUid',
          'updatedAt',
          'updatedByUid'
        ])
        && data.keys().hasOnly([
          'name',
          'normalizedPhone',
          'displayPhone',
          'email',
          'notes',
          'createdAt',
          'createdByUid',
          'updatedAt',
          'updatedByUid'
        ])
        && data.name is string
        && data.name.size() > 0
        && data.name.size() <= 120
        && data.normalizedPhone is string
        && data.normalizedPhone.matches('^\\\\+62[0-9]{8,13}$')
        && data.displayPhone == data.normalizedPhone
        && hasValidOptionalEmail(data.email)
        && data.notes is string
        && data.notes.size() <= 2000
        && data.createdAt is timestamp
        && data.updatedAt is timestamp
        && data.updatedAt >= data.createdAt
        && hasValidRequiredReference(data.createdByUid)
        && hasValidRequiredReference(data.updatedByUid);
    }

    function usesCustomerCreateMetadata() {
      return request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.updatedByUid == request.auth.uid;
    }

    function preservesCustomerHistory() {
      return request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.updatedAt == request.time
        && request.resource.data.updatedByUid == request.auth.uid;
    }

`;

const helperAnchor = '    function isValidStudioOperatingHours(data, bookingIntervalMinutes) {';
if (!source.includes('    function isValidCustomer(data) {')) {
  if (!source.includes(helperAnchor)) throw new Error('Customer helper insertion anchor was not found.');
  source = source.replace(helperAnchor, `${customerHelpers}${helperAnchor}`);
}

const customerMatch = `    match /customers/{customerId} {
      allow get: if hasCapability('customer.view');
      allow list: if hasCapability('customer.view')
        && request.query.limit != null
        && request.query.limit <= 50;

      allow create: if hasCapability('customer.edit')
        && isValidCustomer(request.resource.data)
        && usesCustomerCreateMetadata();

      allow update: if hasCapability('customer.edit')
        && isValidCustomer(request.resource.data)
        && preservesCustomerHistory();

      allow delete: if false;
    }

`;

const matchAnchor = '    // Phase 6D2 booking compensation persistence boundary.';
if (!source.includes('    match /customers/{customerId} {')) {
  if (!source.includes(matchAnchor)) throw new Error('Customer match insertion anchor was not found.');
  source = source.replace(matchAnchor, `${customerMatch}${matchAnchor}`);
}

await writeFile(rulesUrl, source);
