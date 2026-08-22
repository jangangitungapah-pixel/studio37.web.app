import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALL_CAPABILITIES, NON_DELEGABLE_CAPABILITIES } from './capabilities.js';

const firestoreRules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

function readDelegableCapabilitiesFromRules() {
  const functionMatch = firestoreRules.match(
    /function hasOnlyDelegableCapabilities[\s\S]*?capabilities\.hasOnly\(\[([\s\S]*?)\]\);/,
  );

  if (!functionMatch) {
    throw new Error('Firestore delegable-capability allowlist is missing.');
  }

  return [...functionMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
}

describe('Firestore capability allowlist', () => {
  it('stays synchronized with the client capability registry', () => {
    const nonDelegable = new Set(NON_DELEGABLE_CAPABILITIES);
    const expectedCapabilities = ALL_CAPABILITIES.filter(
      (capability) => !nonDelegable.has(capability),
    );

    expect(readDelegableCapabilitiesFromRules()).toEqual(expectedCapabilities);
  });
});
