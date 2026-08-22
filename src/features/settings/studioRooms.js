import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';

export const STUDIO_ROOMS_COLLECTION_NAME = 'studios';
export const STUDIO_ROOM_LIST_LIMIT = 50;

export const STUDIO_ROOM_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

export const DEFAULT_STUDIO_ROOM_FORM_VALUES = Object.freeze({
  code: '',
  description: '',
  displayOrder: '1',
  name: '',
});

const mutableFieldNames = Object.freeze(['code', 'description', 'displayOrder', 'name']);
const persistedFieldNames = Object.freeze([
  'code',
  'createdAt',
  'createdByUid',
  'description',
  'displayOrder',
  'id',
  'name',
  'status',
  'updatedAt',
  'updatedByUid',
]);
const studioRoomCodePattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/;
const supportedStatuses = new Set(Object.values(STUDIO_ROOM_STATUSES));

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value;
}

function requireExactFields(value, expectedFields, label) {
  const actualFields = Object.keys(value).sort();
  const expected = [...expectedFields].sort();

  if (
    actualFields.length !== expected.length ||
    actualFields.some((field, index) => field !== expected[index])
  ) {
    throw new TypeError(`${label} has an unsupported document shape.`);
  }
}

function requireTrimmedString(value, label, { allowEmpty = false, maxLength }) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();

  if (!allowEmpty && !normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function requireSingleSegmentId(value, label) {
  const id = requireTrimmedString(value, label, { maxLength: 128 });

  if (id.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return id;
}

function requireStudioRoomCode(value) {
  const code = requireTrimmedString(value, 'studioRoom.code', { maxLength: 24 }).toUpperCase();

  if (!studioRoomCodePattern.test(code)) {
    throw new TypeError('studioRoom.code must use uppercase letters, numbers, or hyphens.');
  }

  return code;
}

function requireDisplayOrder(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError('studioRoom.displayOrder must be an integer between 1 and 999.');
  }

  return value;
}

export function normalizeStudioRoomDetails(value) {
  const room = requireRecord(value, 'studioRoom');
  requireExactFields(room, mutableFieldNames, 'studioRoom');

  return Object.freeze({
    code: requireStudioRoomCode(room.code),
    description: requireTrimmedString(room.description, 'studioRoom.description', {
      allowEmpty: true,
      maxLength: 240,
    }),
    displayOrder: requireDisplayOrder(room.displayOrder),
    name: requireTrimmedString(room.name, 'studioRoom.name', { maxLength: 80 }),
  });
}

export function normalizeStudioRoomStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('studioRoom.status is not supported.');
  }

  return value;
}

export function normalizeStudioRoomActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizeStudioRoomId(value) {
  return requireSingleSegmentId(value, 'studioRoomId');
}

export function decodeStudioRoomDocument(value) {
  const room = requireRecord(value, 'studioRoom document');
  requireExactFields(room, persistedFieldNames, 'studioRoom document');

  const details = normalizeStudioRoomDetails({
    code: room.code,
    description: room.description,
    displayOrder: room.displayOrder,
    name: room.name,
  });
  const createdAt = toJavaScriptDate(room.createdAt, { label: 'studioRoom.createdAt' });
  const updatedAt = toJavaScriptDate(room.updatedAt, { label: 'studioRoom.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('studioRoom.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(room.createdByUid, 'studioRoom.createdByUid'),
    id: normalizeStudioRoomId(room.id),
    status: normalizeStudioRoomStatus(room.status),
    updatedAt,
    updatedByUid: requireSingleSegmentId(room.updatedByUid, 'studioRoom.updatedByUid'),
  });
}

export function compareStudioRooms(left, right) {
  const orderDifference = left.displayOrder - right.displayOrder;
  if (orderDifference !== 0) return orderDifference;

  const nameDifference = left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
  if (nameDifference !== 0) return nameDifference;

  return left.id.localeCompare(right.id);
}

export function toStudioRoomFormValues(room = null) {
  if (!room) return { ...DEFAULT_STUDIO_ROOM_FORM_VALUES };

  const details = normalizeStudioRoomDetails({
    code: room.code,
    description: room.description,
    displayOrder: room.displayOrder,
    name: room.name,
  });

  return {
    code: details.code,
    description: details.description,
    displayOrder: String(details.displayOrder),
    name: details.name,
  };
}

export function validateStudioRoomForm(value) {
  const form = requireRecord(value, 'studioRoom form');
  const errors = {};
  let code;
  let description;
  let displayOrder;
  let name;

  try {
    code = requireStudioRoomCode(form.code);
  } catch (error) {
    errors.code = error.message;
  }

  try {
    name = requireTrimmedString(form.name, 'studioRoom.name', { maxLength: 80 });
  } catch (error) {
    errors.name = error.message;
  }

  try {
    description = requireTrimmedString(form.description, 'studioRoom.description', {
      allowEmpty: true,
      maxLength: 240,
    });
  } catch (error) {
    errors.description = error.message;
  }

  try {
    displayOrder = requireDisplayOrder(Number(form.displayOrder));
  } catch (error) {
    errors.displayOrder = error.message;
  }

  const hasErrors = Object.keys(errors).length > 0;

  return Object.freeze({
    errors: Object.freeze(errors),
    value: hasErrors ? null : normalizeStudioRoomDetails({ code, description, displayOrder, name }),
  });
}
