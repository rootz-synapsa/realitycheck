'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createClaimGate } = require('./claim-gate.cjs');

const gate = createClaimGate(path.resolve(__dirname, '..'));
const POLICY_VERSION = 'rc-gov-0.2';

test('unknown claim ID blocks by default', () => {
  const decision = gate.evaluateClaim('CLAIM-NOT-REGISTERED');

  assert.deepEqual(decision, {
    claim_id: 'CLAIM-NOT-REGISTERED',
    decision: 'BLOCK',
    reason: 'UNKNOWN_CLAIM_ID',
    policy_version: POLICY_VERSION,
  });
});

test('permanently blocked claim ID blocks', () => {
  const decision = gate.evaluateClaim('CLAIM-X-SAFE');

  assert.deepEqual(decision, {
    claim_id: 'CLAIM-X-SAFE',
    decision: 'BLOCK',
    reason: 'PERMANENTLY_BLOCKED',
    policy_version: POLICY_VERSION,
  });
});

test('registered claim with unresolved required evidence blocks', () => {
  const decision = gate.evaluateClaim('CLAIM-PROV-ABSENT', {
    evidence: [{ class: 'PROVENANCE', verification: 'PRESENT' }],
  });

  assert.deepEqual(decision, {
    claim_id: 'CLAIM-PROV-ABSENT',
    decision: 'BLOCK',
    reason: 'UNRESOLVED_REQUIRED_EVIDENCE',
    policy_version: POLICY_VERSION,
  });
});

test('registered claim with satisfied preconditions allows', () => {
  const decision = gate.evaluateClaim('CLAIM-PROV-ABSENT', {
    evidence: [{ class: 'PROVENANCE', verification: 'ABSENT' }],
  });

  assert.deepEqual(decision, {
    claim_id: 'CLAIM-PROV-ABSENT',
    decision: 'ALLOW',
    reason: 'PRECONDITIONS_SATISFIED',
    policy_version: POLICY_VERSION,
  });
});

test('missing mandatory companion holds result set and invokes safe fallback', () => {
  const result = gate.evaluateResultSet(['CLAIM-PROV-ABSENT'], {
    evidence: [{ class: 'PROVENANCE', verification: 'ABSENT' }],
  });

  assert.equal(result.decision, 'HOLD');
  assert.equal(result.reason, 'MISSING_MANDATORY_COMPANION');
  assert.equal(result.missing_companion, 'CLAIM-PROV-ABSENT-SCOPE-NOTE');
  assert.deepEqual(result.fallback, {
    decision: 'SAFE_FALLBACK',
    reason: 'MISSING_MANDATORY_COMPANION',
    evidence_state: 'INCONCLUSIVE',
    claim_ids: [
      'CLAIM-INCONC-COVERAGE',
      'CLAIM-LIMIT-NOT-LEGAL',
      'CLAIM-META-RESULT-PERISHABLE',
    ],
    policy_version: POLICY_VERSION,
  });
  assert.deepEqual(result.gate_decisions, [
    {
      claim_id: 'CLAIM-PROV-ABSENT',
      decision: 'ALLOW',
      reason: 'PRECONDITIONS_SATISFIED',
      policy_version: POLICY_VERSION,
    },
  ]);
});

test('if every candidate analytical claim is blocked or unresolvable, safe fallback is used', () => {
  const result = gate.evaluateResultSet(['CLAIM-X-AUTHENTIC', 'CLAIM-NOT-REGISTERED'], {
    evidence_state: 'NO_SIGNAL_IN_SCOPE',
  });

  assert.equal(result.decision, 'SAFE_FALLBACK');
  assert.equal(result.reason, 'ALL_CANDIDATES_BLOCKED_OR_UNRESOLVABLE');
  assert.deepEqual(result.fallback.claim_ids, [
    'CLAIM-INCONC-COVERAGE',
    'CLAIM-LIMIT-NOT-LEGAL',
    'CLAIM-META-RESULT-PERISHABLE',
  ]);
  assert.equal(result.fallback.evidence_state, 'INCONCLUSIVE');
  assert.equal(result.fallback.policy_version, POLICY_VERSION);
});

test('safe fallback uses only claim IDs declared in composition.yaml', () => {
  const fallback = gate.buildSafeFallback('TEST_REASON');

  assert.deepEqual(fallback, {
    decision: 'SAFE_FALLBACK',
    reason: 'TEST_REASON',
    evidence_state: 'INCONCLUSIVE',
    claim_ids: [
      'CLAIM-INCONC-COVERAGE',
      'CLAIM-LIMIT-NOT-LEGAL',
      'CLAIM-META-RESULT-PERISHABLE',
    ],
    policy_version: POLICY_VERSION,
  });
});

test('analysis failure cannot become no-signal, authentic, or safe', () => {
  const result = gate.evaluateResultSet(['CLAIM-X-SAFE', 'CLAIM-PROV-ABSENT'], {
    evidence_state: 'ANALYSIS_FAILED',
    evidence: [],
  });

  assert.equal(result.decision, 'SAFE_FALLBACK');
  assert.equal(result.fallback.evidence_state, 'INCONCLUSIVE');
  assert.deepEqual(result.gate_decisions, [
    {
      claim_id: 'CLAIM-X-SAFE',
      decision: 'BLOCK',
      reason: 'PERMANENTLY_BLOCKED',
      policy_version: POLICY_VERSION,
    },
    {
      claim_id: 'CLAIM-PROV-ABSENT',
      decision: 'BLOCK',
      reason: 'UNRESOLVED_REQUIRED_EVIDENCE',
      policy_version: POLICY_VERSION,
    },
  ]);
});

test('every gate decision exposes structured audit fields including policy_version', () => {
  const result = gate.evaluateResultSet([
    'CLAIM-PROV-ABSENT',
    'CLAIM-PROV-ABSENT-SCOPE-NOTE',
  ], {
    evidence: [{ class: 'PROVENANCE', verification: 'ABSENT' }],
  });

  assert.equal(result.decision, 'ALLOW');
  assert.deepEqual(result.claim_ids, [
    'CLAIM-PROV-ABSENT',
    'CLAIM-PROV-ABSENT-SCOPE-NOTE',
  ]);

  for (const decision of result.gate_decisions) {
    assert.deepEqual(Object.keys(decision).sort(), [
      'claim_id',
      'decision',
      'policy_version',
      'reason',
    ]);
    assert.equal(decision.policy_version, POLICY_VERSION);
  }
});
