import { readFile, writeFile } from 'node:fs/promises';

const rulesPath = new URL('../firestore.rules', import.meta.url);
const source = await readFile(rulesPath, 'utf8');

if (source.includes('function isValidCompensationRule(data)')) {
  console.log('Compensation rule boundary is already present.');
  process.exit(0);
}

const validationMarker = '    function isValidAccountInvitationId(invitationId) {';
const metadataMarker = '    function usesOperatorCreateMetadata() {';
const matchMarker = '    match /operators/{operatorId} {';

for (const marker of [validationMarker, metadataMarker, matchMarker]) {
  if (!source.includes(marker)) {
    throw new Error(`Unable to patch firestore.rules; marker not found: ${marker}`);
  }
}

const validationBlock = `    function isValidCompensationAmount(value) {
      return value is int
        && value >= 0
        && value <= 9007199254740991;
    }

    function isValidCompensationDuration(value) {
      return value is int
        && value >= 15
        && value <= 1440
        && value % 15 == 0;
    }

    function isValidCompensationConfiguration(compensationModel, data) {
      return data is map
        && ((compensationModel == 'per_hour'
            && data.keys().hasAll(['amountPerHourIdr'])
            && data.keys().hasOnly(['amountPerHourIdr'])
            && isValidCompensationAmount(data.amountPerHourIdr))
          || (compensationModel in ['per_session', 'fixed']
            && data.keys().hasAll(['amountIdr'])
            && data.keys().hasOnly(['amountIdr'])
            && isValidCompensationAmount(data.amountIdr))
          || (compensationModel == 'package'
            && data.keys().hasAll(['amountIdr', 'durationMinutes'])
            && data.keys().hasOnly(['amountIdr', 'durationMinutes'])
            && isValidCompensationAmount(data.amountIdr)
            && isValidCompensationDuration(data.durationMinutes))
          || (compensationModel == 'percentage'
            && data.keys().hasAll(['base', 'basisPoints'])
            && data.keys().hasOnly(['base', 'basisPoints'])
            && data.base in [
              'booking_subtotal_before_discount',
              'booking_total_after_discount',
              'service_amount'
            ]
            && data.basisPoints is int
            && data.basisPoints >= 0
            && data.basisPoints <= 10000));
    }

    function hasValidCompensationEffectiveWindow(data) {
      return (data.effectiveFrom == null || data.effectiveFrom is timestamp)
        && (data.effectiveUntil == null || data.effectiveUntil is timestamp)
        && (data.effectiveFrom == null
          || data.effectiveUntil == null
          || data.effectiveUntil > data.effectiveFrom);
    }

    function isValidCompensationRule(data) {
      return data.keys().hasAll([
          'name',
          'operatorType',
          'operatorId',
          'sessionTypeId',
          'studioId',
          'compensationModel',
          'configuration',
          'priority',
          'effectiveFrom',
          'effectiveUntil',
          'status',
          'createdAt',
          'createdByUid',
          'updatedAt',
          'updatedByUid'
        ])
        && data.keys().hasOnly([
          'name',
          'operatorType',
          'operatorId',
          'sessionTypeId',
          'studioId',
          'compensationModel',
          'configuration',
          'priority',
          'effectiveFrom',
          'effectiveUntil',
          'status',
          'createdAt',
          'createdByUid',
          'updatedAt',
          'updatedByUid'
        ])
        && data.name is string
        && data.name.size() > 0
        && data.name.size() <= 100
        && data.operatorType in ['studio_operator', 'recording_engineer']
        && hasValidOptionalReference(data.operatorId)
        && hasValidOptionalReference(data.sessionTypeId)
        && hasValidOptionalReference(data.studioId)
        && data.compensationModel in [
          'fixed',
          'package',
          'percentage',
          'per_hour',
          'per_session'
        ]
        && isValidCompensationConfiguration(data.compensationModel, data.configuration)
        && data.priority is int
        && data.priority >= 1
        && data.priority <= 999
        && hasValidCompensationEffectiveWindow(data)
        && data.status in ['active', 'disabled']
        && data.createdAt is timestamp
        && data.updatedAt is timestamp
        && data.updatedAt >= data.createdAt
        && hasValidRequiredReference(data.createdByUid)
        && hasValidRequiredReference(data.updatedByUid);
    }

    function hasValidCompensationRuleReferences(data) {
      return (data.sessionTypeId == null || exists(sessionTypePath(data.sessionTypeId)))
        && (data.studioId == null || exists(studioPath(data.studioId)))
        && (data.operatorId == null
          || (exists(operatorPath(data.operatorId))
            && isValidOperator(get(operatorPath(data.operatorId)).data)
            && data.operatorType in get(operatorPath(data.operatorId)).data.operatorTypes));
    }

`;

const metadataBlock = `    function usesCompensationRuleCreateMetadata() {
      return request.resource.data.status == 'active'
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.updatedByUid == request.auth.uid;
    }

    function preservesCompensationRuleHistory() {
      return request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.updatedAt == request.time
        && request.resource.data.updatedAt >= resource.data.updatedAt
        && request.resource.data.updatedByUid == request.auth.uid;
    }

`;

const matchBlock = `    match /compensationRules/{compensationRuleId} {
      allow get: if isActiveOwner();
      allow list: if isActiveOwner()
        && request.query.limit != null
        && request.query.limit <= 200;

      allow create: if isActiveOwner()
        && isValidCompensationRule(request.resource.data)
        && hasValidCompensationRuleReferences(request.resource.data)
        && usesCompensationRuleCreateMetadata();

      allow update: if isActiveOwner()
        && isValidCompensationRule(request.resource.data)
        && hasValidCompensationRuleReferences(request.resource.data)
        && preservesCompensationRuleHistory();

      allow delete: if false;
    }

`;

const patched = source
  .replace(validationMarker, validationBlock + validationMarker)
  .replace(metadataMarker, metadataBlock + metadataMarker)
  .replace(matchMarker, matchBlock + matchMarker);

await writeFile(rulesPath, patched, 'utf8');
console.log('Patched firestore.rules with the Phase 6A2 compensation boundary.');
