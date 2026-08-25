import { Timestamp } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';

import {
  PRICING_RULE_LIST_LIMIT,
  PRICING_RULE_MODELS,
  PRICING_RULE_ROUNDING_MODES,
} from '../features/pricing/pricingRules.js';
import { createPricingRuleRepository } from './pricingRuleRepository.js';

const EFFECTIVE_FROM = new Date('2026-09-01T00:00:00.000Z');

function createConfiguration(overrides = {}) {
  return {
    amountPerIncrementIdr: 120_000,
    incrementMinutes: 60,
    minimumDurationMinutes: 120,
    roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    ...overrides,
  };
}

function createDetails(overrides = {}) {
  return {
    configuration: createConfiguration(),
    effectiveFrom: EFFECTIVE_FROM,
    effectiveUntil: null,
    name: 'Rehearsal hourly — general',
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    studioId: null,
    ...overrides,
  };
}

function createStoredPricingRule(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-25T01:00:00.000Z'),
    createdByUid: 'owner-1',
    status: 'active',
    updatedAt: new Date('2026-08-25T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createHarness({ documents } = {}) {
  const collectionReference = { path: 'pricingRules' };
  const generatedReference = { id: 'generated-pricing-rule', path: 'pricingRules/generated-rule' };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, pricingRuleId) =>
      pricingRuleId
        ? { id: pricingRuleId, path: `pricingRules/${pricingRuleId}` }
        : generatedReference,
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        {
          data: () => createStoredPricingRule({ name: 'Studio-specific', priority: 200 }),
          id: 'studio-rule',
        },
        { data: () => createStoredPricingRule(), id: 'general-rule' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createPricingRuleRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('pricingRuleRepository', () => {
  it('lists pricing rules with one priority-desc query capped at 200 documents', async () => {
    const { adapter, repository } = createHarness();

    const pricingRules = await repository.listPricingRules();

    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'pricingRules');
    expect(adapter.orderBy).toHaveBeenCalledWith('priority', 'desc');
    expect(adapter.limit).toHaveBeenCalledWith(PRICING_RULE_LIST_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(pricingRules.map(({ id }) => id)).toEqual(['studio-rule', 'general-rule']);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deletePricingRule');
    expect(repository).not.toHaveProperty('resolvePricingRule');
  });

  it('creates an active rule with encoded effective timestamps and server-owned metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createPricingRule(createDetails({ name: '  Rehearsal hourly — general  ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('generated-pricing-rule');

    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(adapter.setDoc).toHaveBeenCalledWith(generatedReference, {
      ...createDetails(),
      effectiveFrom: Timestamp.fromDate(EFFECTIVE_FROM),
      createdAt: writeTimestamp,
      createdByUid: 'owner-1',
      status: 'active',
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
  });

  it('updates only editable fields plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updatePricingRule('general-rule', createDetails({ priority: 150 }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('general-rule');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'general-rule', path: 'pricingRules/general-rule' },
      {
        ...createDetails({ priority: 150 }),
        effectiveFrom: Timestamp.fromDate(EFFECTIVE_FROM),
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('soft-disables rules without exposing hard delete', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.setPricingRuleStatus('general-rule', 'disabled', { actorUid: 'owner-1' }),
    ).resolves.toBe('general-rule');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'general-rule', path: 'pricingRules/general-rule' },
      {
        status: 'disabled',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(repository.deletePricingRule).toBeUndefined();
  });

  it('rejects malformed values and stored documents before returning or writing', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createPricingRule(
        createDetails({ configuration: createConfiguration({ incrementMinutes: 10 }) }),
        { actorUid: 'owner-1' },
      ),
    ).rejects.toThrow(/incrementMinutes/);
    await expect(
      repository.updatePricingRule('pricingRules/general', createDetails(), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/document id/);
    await expect(
      repository.setPricingRuleStatus('general-rule', 'archived', { actorUid: 'owner-1' }),
    ).rejects.toThrow(/status/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();

    const malformed = createHarness({
      documents: [
        { data: () => createStoredPricingRule({ manualOverride: null }), id: 'general-rule' },
      ],
    });
    await expect(malformed.repository.listPricingRules()).rejects.toThrow(
      /unsupported document shape/,
    );
  });
});
