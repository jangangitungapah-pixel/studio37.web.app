import { describe, expect, it } from 'vitest';

import { PRICING_RULE_MODELS, PRICING_RULE_STATUSES } from '../pricing/pricingRules.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import {
  PRICING_CONFIGURATION_ISSUE_CODES,
  validatePricingConfiguration,
  validatePricingRuleCandidate,
} from './pricingConfigurationValidation.js';
import { STUDIO_ROOM_STATUSES } from './studioRooms.js';

function createSessionType(overrides = {}) {
  return {
    id: 'session-recording',
    name: 'Recording',
    status: SESSION_TYPE_STATUSES.ACTIVE,
    ...overrides,
  };
}

function createStudio(overrides = {}) {
  return {
    id: 'studio-a',
    name: 'Studio A',
    status: STUDIO_ROOM_STATUSES.ACTIVE,
    ...overrides,
  };
}

function createRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500000 },
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-a',
    name: 'Recording fixed',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-recording',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    ...overrides,
  };
}

function createPackageRule(durationMinutes, overrides = {}) {
  return createRule({
    configuration: {
      additionalAmountPerIncrementIdr: null,
      additionalIncrementMinutes: null,
      amountIdr: 450000,
      durationMinutes,
      extraTimePolicy: 'blocked',
      roundingMode: null,
    },
    pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    ...overrides,
  });
}

function getCodes(result) {
  return result.issues.map((issue) => issue.code);
}

describe('validatePricingConfiguration', () => {
  it('accepts a valid active rule with complete references', () => {
    const result = validatePricingConfiguration({
      pricingRules: [createRule({ studioId: 'studio-a' })],
      sessionTypes: [createSessionType()],
      studioRooms: [createStudio()],
    });

    expect(result.blocking).toBe(false);
    expect(result.complete).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports malformed canonical pricing data as blocking', () => {
    const result = validatePricingConfiguration({
      pricingRules: [createRule({ configuration: { amountIdr: -1 } })],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.INVALID_RULE);
    expect(result.blocking).toBe(true);
  });

  it('reports a missing active session reference as blocking', () => {
    const result = validatePricingConfiguration({
      pricingRules: [createRule()],
      sessionTypes: [],
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.MISSING_SESSION_REFERENCE);
    expect(result.blocking).toBe(true);
  });

  it('reports inactive session and studio references as warnings', () => {
    const result = validatePricingConfiguration({
      pricingRules: [createRule({ studioId: 'studio-a' })],
      sessionTypes: [createSessionType({ status: SESSION_TYPE_STATUSES.DISABLED })],
      studioRooms: [createStudio({ status: STUDIO_ROOM_STATUSES.DISABLED })],
    });

    expect(getCodes(result)).toEqual(
      expect.arrayContaining([
        PRICING_CONFIGURATION_ISSUE_CODES.INACTIVE_SESSION_REFERENCE,
        PRICING_CONFIGURATION_ISSUE_CODES.INACTIVE_STUDIO_REFERENCE,
      ]),
    );
    expect(result.blocking).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });

  it('reports a missing exact-studio reference as blocking when rooms are known', () => {
    const result = validatePricingConfiguration({
      pricingRules: [createRule({ studioId: 'studio-missing' })],
      sessionTypes: [createSessionType()],
      studioRooms: [createStudio()],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.MISSING_STUDIO_REFERENCE);
    expect(result.blocking).toBe(true);
  });

  it('marks exact-studio validation incomplete rather than inventing a missing reference', () => {
    const result = validatePricingConfiguration({
      pricingRules: [createRule({ studioId: 'studio-a' })],
      sessionTypes: [createSessionType()],
      studioReferencesAvailable: false,
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(
      PRICING_CONFIGURATION_ISSUE_CODES.UNVERIFIED_STUDIO_REFERENCE,
    );
    expect(getCodes(result)).not.toContain(
      PRICING_CONFIGURATION_ISSUE_CODES.MISSING_STUDIO_REFERENCE,
    );
    expect(result.complete).toBe(false);
    expect(result.blocking).toBe(false);
  });

  it('detects overlapping equal-priority active rules as blocking ambiguity', () => {
    const result = validatePricingConfiguration({
      pricingRules: [
        createRule({
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-10-15T00:00:00.000Z'),
        }),
        createRule({
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-11-01T00:00:00.000Z'),
          id: 'rule-b',
          name: 'Recording fixed future',
        }),
      ],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.AMBIGUOUS_RULES);
    expect(result.blocking).toBe(true);
  });

  it('allows adjacent effective windows in the same resolution envelope', () => {
    const result = validatePricingConfiguration({
      pricingRules: [
        createRule({
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-10-01T00:00:00.000Z'),
        }),
        createRule({
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveUntil: null,
          id: 'rule-b',
          name: 'Recording fixed future',
        }),
      ],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).not.toContain(PRICING_CONFIGURATION_ISSUE_CODES.AMBIGUOUS_RULES);
    expect(result.blocking).toBe(false);
  });

  it('allows distinct duration packages in the same overlapping envelope', () => {
    const result = validatePricingConfiguration({
      pricingRules: [
        createPackageRule(180),
        createPackageRule(360, { id: 'rule-b', name: 'Recording 6 jam' }),
      ],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).not.toContain(PRICING_CONFIGURATION_ISSUE_CODES.AMBIGUOUS_RULES);
    expect(result.blocking).toBe(false);
  });

  it('treats a saturated rule list as incomplete and blocking', () => {
    const result = validatePricingConfiguration({
      limitReached: true,
      pricingRules: [createRule()],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.SATURATED_RULE_SET);
    expect(result.complete).toBe(false);
    expect(result.blocking).toBe(true);
  });

  it('rejects malformed collection containers', () => {
    expect(() =>
      validatePricingConfiguration({ pricingRules: null, sessionTypes: [], studioRooms: [] }),
    ).toThrow(TypeError);
  });
});

describe('validatePricingRuleCandidate', () => {
  it('blocks an active candidate that would create an ambiguity', () => {
    const result = validatePricingRuleCandidate({
      candidateDetails: createRule({ id: undefined, name: 'Duplicate rule' }),
      pricingRules: [createRule()],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.AMBIGUOUS_RULES);
    expect(result.blocking).toBe(true);
  });

  it('allows a candidate whose effective window starts at the existing end boundary', () => {
    const result = validatePricingRuleCandidate({
      candidateDetails: createRule({
        effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
        effectiveUntil: null,
        id: undefined,
        name: 'Future rule',
      }),
      pricingRules: [
        createRule({
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-10-01T00:00:00.000Z'),
        }),
      ],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(result.blocking).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('does not let an unrelated existing ambiguity block a different candidate', () => {
    const result = validatePricingRuleCandidate({
      candidateDetails: createRule({
        id: undefined,
        name: 'Podcast fixed',
        sessionTypeId: 'session-podcast',
      }),
      pricingRules: [createRule(), createRule({ id: 'rule-b', name: 'Existing duplicate' })],
      sessionTypes: [
        createSessionType(),
        createSessionType({ id: 'session-podcast', name: 'Podcast' }),
      ],
      studioRooms: [],
    });

    expect(result.blocking).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('blocks a candidate with a missing session reference', () => {
    const result = validatePricingRuleCandidate({
      candidateDetails: createRule({ id: undefined, sessionTypeId: 'session-missing' }),
      pricingRules: [],
      sessionTypes: [createSessionType()],
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(PRICING_CONFIGURATION_ISSUE_CODES.MISSING_SESSION_REFERENCE);
    expect(result.blocking).toBe(true);
  });

  it('marks an exact-studio candidate incomplete when room references cannot be verified', () => {
    const result = validatePricingRuleCandidate({
      candidateDetails: createRule({ id: undefined, studioId: 'studio-a' }),
      pricingRules: [],
      sessionTypes: [createSessionType()],
      studioReferencesAvailable: false,
      studioRooms: [],
    });

    expect(getCodes(result)).toContain(
      PRICING_CONFIGURATION_ISSUE_CODES.UNVERIFIED_STUDIO_REFERENCE,
    );
    expect(result.blocking).toBe(false);
    expect(result.complete).toBe(false);
  });
});
