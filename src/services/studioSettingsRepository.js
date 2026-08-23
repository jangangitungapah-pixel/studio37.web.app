import { serverTimestamp } from 'firebase/firestore';

import {
  decodeStudioSettingsDocument,
  normalizeStudioSettings,
  normalizeStudioSettingsActorUid,
  STUDIO_SETTINGS_COLLECTION_NAME,
  STUDIO_SETTINGS_DOCUMENT_ID,
} from '../features/settings/studioSettings.js';
import { firestoreDb } from '../lib/firebase/client.js';
import { createDocumentRepository } from './firestore/createDocumentRepository.js';

function requireTimestampFactory(value) {
  if (typeof value !== 'function') {
    throw new TypeError('timestampFactory must be a function.');
  }

  return value;
}

export function createStudioSettingsRepository({
  adapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const documentRepository = createDocumentRepository({
    adapter,
    collectionName: STUDIO_SETTINGS_COLLECTION_NAME,
    db,
    decode: decodeStudioSettingsDocument,
  });

  return Object.freeze({
    collectionName: STUDIO_SETTINGS_COLLECTION_NAME,
    documentId: STUDIO_SETTINGS_DOCUMENT_ID,

    getStudioSettings() {
      return documentRepository.getById(STUDIO_SETTINGS_DOCUMENT_ID);
    },

    createStudioSettings(value, { actorUid } = {}) {
      const settings = normalizeStudioSettings(value);
      const resolvedActorUid = normalizeStudioSettingsActorUid(actorUid);
      const writeTimestamp = createWriteTimestamp();

      return documentRepository.setById(STUDIO_SETTINGS_DOCUMENT_ID, {
        ...settings,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });
    },

    updateStudioSettings(value, { actorUid } = {}) {
      const settings = normalizeStudioSettings(value);
      const resolvedActorUid = normalizeStudioSettingsActorUid(actorUid);

      return documentRepository.updateById(STUDIO_SETTINGS_DOCUMENT_ID, {
        ...settings,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });
    },
  });
}

export const studioSettingsRepository = createStudioSettingsRepository();
