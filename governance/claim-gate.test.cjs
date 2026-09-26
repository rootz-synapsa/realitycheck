'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateClaim, evaluateCandidates } = require('./claim-gate');

test('Unknown Claim ID -> BLOCK', () => {
  const result = evaluateClaim('RC.CLAIM.UNKNOWN', {
    message_text: 'send money now',
    risk_indicators: ['urgency']
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reason, 'UNKNOWN_CLAIM_ID');
});

test('Known Claim with missing required evidence -> BLOCK', () => {
  const result = evaluateClaim('RC.CLAIM.SUSPICIOUS_TRANSFER_REQUEST', {
    message_text: 'send money now',
    risk_indicators: []
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reason, 'MISSING_REQUIRED_EVIDENCE');
  assert.deepEqual(result.missingRequiredEvidence, ['risk_indicators']);
});

test('If all candidate analytical claims are blocked -> SAFE_FALLBACK', () => {
  const result = evaluateCandidates([
    {
      claimId: 'RC.CLAIM.UNKNOWN',
      evidence: { message_text: 'x', risk_indicators: ['urgency'] }
    },
    {
      claimId: 'RC.CLAIM.SUSPICIOUS_TRANSFER_REQUEST',
      evidence: { message_text: 'x', risk_indicators: [] }
    }
  ]);

  assert.equal(result.decision, 'SAFE_FALLBACK');
  assert.equal(result.fallback.decision, 'SAFE_FALLBACK');
  assert.equal(result.fallback.reason, 'INSUFFICIENT_SUPPORTED_EVIDENCE');
  assert.equal(result.fallback.message, 'There is not enough supported evidence to produce an analytical conclusion.');
  assert.equal(result.claimResults.every((item) => item.decision === 'BLOCK'), true);
});

test('Known Claim with valid required evidence -> ALLOW', () => {
  const result = evaluateClaim('RC.CLAIM.SUSPICIOUS_TRANSFER_REQUEST', {
    message_text: 'please transfer immediately',
    risk_indicators: ['urgency', 'payment-request']
  });

  assert.equal(result.decision, 'ALLOW');
  assert.equal(result.reason, 'REQUIRED_EVIDENCE_PRESENT');
});
