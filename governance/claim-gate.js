'use strict';

const { CLAIM_REGISTRY } = require('./claim-registry');
const { buildSafeFallback } = require('./safe-fallback');

function isNonEmptyEvidenceValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeClaimId(candidate) {
  if (!isPlainObject(candidate)) {
    return undefined;
  }

  return candidate.claimId || candidate.claim_id;
}

function evaluateClaim(claimId, evidence) {
  const claim = CLAIM_REGISTRY[claimId];

  if (!claim) {
    return {
      claimId,
      decision: 'BLOCK',
      reason: 'UNKNOWN_CLAIM_ID'
    };
  }

  const providedEvidence = isPlainObject(evidence) ? evidence : {};
  const missingRequiredEvidence = claim.requiredEvidence.filter(
    (key) => !isNonEmptyEvidenceValue(providedEvidence[key])
  );

  if (missingRequiredEvidence.length > 0) {
    return {
      claimId,
      decision: 'BLOCK',
      reason: 'MISSING_REQUIRED_EVIDENCE',
      missingRequiredEvidence
    };
  }

  return {
    claimId,
    decision: 'ALLOW',
    reason: 'REQUIRED_EVIDENCE_PRESENT'
  };
}

function evaluateCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const claimResults = [];

  for (const candidate of list) {
    const normalizedCandidate = isPlainObject(candidate) ? candidate : {};
    const result = evaluateClaim(normalizeClaimId(normalizedCandidate), normalizedCandidate.evidence);
    claimResults.push(result);

    if (result.decision === 'ALLOW') {
      return {
        decision: 'ALLOW',
        selectedClaim: result.claimId,
        claimResults
      };
    }
  }

  return {
    decision: 'SAFE_FALLBACK',
    fallback: buildSafeFallback(claimResults),
    claimResults
  };
}

module.exports = {
  isNonEmptyEvidenceValue,
  evaluateClaim,
  evaluateCandidates
};
