import { Timestamp } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';

import {
  COMPENSATION_RULE_LIST_LIMIT,
  COMPENSATION_RULE_MODELS,
} from '../features/commissions/compensationRules.js';
import { createCompensationRuleRepository } from './compensationRuleRepository.js';

const EFFECTIVE_FROM = new Date('2026-09-01T00:00:00.000Z');

function createDetails(overrides = {}) {
  return {
    compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
    configuration: { amountPerHourIdr: 10_000 },
    effectiveFrom: EFFECTIVE_FROM,
    effectiveUntil: null,
    name: 'Rehearsal studio operator',
    operatorId: null,
    operatorType: 'studio_operator',
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    studioId: null,
    ...overrides,
  };
}

function createStoredRule(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-09-05T01:00:00.000Z'),
    createdByUid: 'owner-1',
    status: 'active',
    updatedAt: new Date('2026-09-05T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createHarness({ documents } = {}) {
  const collectionReference = { path: 'compensationRules' };
  const generatedReference = {
    id: 'generated-compensation-rule',
    path: 'compensationRules/generated-compensation-rule',
  };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, compensationRuleId) =>
      compensationRuleId
        ? { id: compensationRuleId, path: `compensationRules/${compensationRuleId}` }
        : generatedReference,
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        {
          data: () => createStoredRule({ name: 'Recording Pro engineer', priority: 200 }),
          id: 'recording-pro',
        },
        { data: () => createStoredRule(), id: 'rehearsal' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createCompensationRuleRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('compensationRuleRepository', () => {
  it('lists rules with one bounded priority-desc query', async () => {
    const { adapter, repository } = createHarness();

    const rules = await repository.listCompensationRules();

    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'compensationRules');
    expect(adapter.orderBy).toHaveBeenCalledWith('priority', 'desc');
    expect(adapter.limit).toHaveBeenCalledWith(COMPENSATION_RULE_LIST_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(rules.map(({ id }) => id)).toEqual(['recording-pro', 'rehearsal']);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deleteCompensationRule');
    expect(repository).not.toHaveProperty('calculateCompensation');
  });

  it('creates an active rule with encoded timestamps and server-owned metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createCompensationRule(createDetails({ name: '  Rehearsal studio operator  ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('generated-compensation-rule');

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

  it('updates only mutable fields plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateCompensationRule('rehearsal', createDetails({ priority: 150 }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('rehearsal');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'rehearsal', path: 'compensationRules/rehearsal' },
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

  it('soft-disables a rule and intentionally exposes no hard-delete path', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.setCompensationRuleStatus('rehearsal', 'disabled', { actorUid: 'owner-1' }),
    ).resolves.toBe('rehearsal');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'rehearsal', path: 'compensationRules/rehearsal' },
      {
        status: 'disabled',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(repository).not.toHaveProperty('deleteCompensationRule');
  });

  it('fails closed for malformed writes and stored documents', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createCompensationRule(createDetails({ operatorType: 'owner' }), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/operatorType/);
    await expect(
      repository.updateCompensationRule('compensationRules/rehearsal', createDetails(), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/document id/);
    await expect(
      repository.setCompensationRuleStatus('rehearsal', 'archived', { actorUid: 'owner-1' }),
    ).rejects.toThrow(/status/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();

    const malformed = createHarness({
      documents: [
        { data: () => createStoredRule({ unexpectedField: true }), id: 'rehearsal' },
      ],
    });
    await expect(malformed.repository.listCompensationRules()).rejects.toThrow(
      /unsupported document shape/,
    );
  });
});
