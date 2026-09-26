'use strict';

const { loadGovernance } = require('./governance-loader.cjs');

function buildAudit(claimId, decision, reason, policyVersion) {
  return {
    claim_id: claimId,
    decision,
    reason,
    policy_version: policyVersion,
  };
}

function requirementSatisfied(requirement, evidence) {
  return evidence.some((entry) => Object.entries(requirement).every(([key, value]) => entry[key] === value));
}

function stateRequirementsSatisfied(requiredState, context) {
  return Object.entries(requiredState).every(([field, allowedValues]) => {
    const actualValue = context[field];
    return Array.isArray(allowedValues) && allowedValues.includes(actualValue);
  });
}

function buildSafeFallback(governance, reason) {
  return {
    decision: 'SAFE_FALLBACK',
    reason,
    evidence_state: governance.composition.safe_fallback.evidence_state,
    claim_ids: [...governance.composition.safe_fallback.claim_ids],
    policy_version: governance.policyVersion,
  };
}

function evaluateClaim(governance, claimId, context = {}) {
  const claim = governance.claims.claims[claimId];
  if (!claim) {
    return buildAudit(claimId, 'BLOCK', 'UNKNOWN_CLAIM_ID', governance.policyVersion);
  }

  if (claim.normative_level === 'PERMANENTLY_BLOCKED') {
    return buildAudit(claimId, 'BLOCK', 'PERMANENTLY_BLOCKED', governance.policyVersion);
  }

  const evidence = Array.isArray(context.evidence) ? context.evidence : [];
  if (Array.isArray(claim.requires_evidence) && !claim.requires_evidence.every((requirement) => requirementSatisfied(requirement, evidence))) {
    return buildAudit(claimId, 'BLOCK', 'UNRESOLVED_REQUIRED_EVIDENCE', governance.policyVersion);
  }

  if (claim.requires_state && !stateRequirementsSatisfied(claim.requires_state, context)) {
    return buildAudit(claimId, 'BLOCK', 'UNRESOLVED_REQUIRED_STATE', governance.policyVersion);
  }

  return buildAudit(claimId, 'ALLOW', 'PRECONDITIONS_SATISFIED', governance.policyVersion);
}

function evaluateResultSet(governance, claimIds, context = {}) {
  const decisions = claimIds.map((claimId) => evaluateClaim(governance, claimId, context));
  const allowedClaimIds = decisions.filter((decision) => decision.decision === 'ALLOW').map((decision) => decision.claim_id);

  if (allowedClaimIds.length === 0) {
    return {
      decision: 'SAFE_FALLBACK',
      reason: 'ALL_CANDIDATES_BLOCKED_OR_UNRESOLVABLE',
      gate_decisions: decisions,
      fallback: buildSafeFallback(governance, 'ALL_CANDIDATES_BLOCKED_OR_UNRESOLVABLE'),
      policy_version: governance.policyVersion,
    };
  }

  for (const claimId of allowedClaimIds) {
    const claim = governance.claims.claims[claimId];
    const mandatoryCompanions = Array.isArray(claim.mandatory_companions) ? claim.mandatory_companions : [];
    const missingCompanion = mandatoryCompanions.find((companionId) => !allowedClaimIds.includes(companionId));

    if (missingCompanion) {
      return {
        decision: 'HOLD',
        reason: 'MISSING_MANDATORY_COMPANION',
        missing_companion: missingCompanion,
        gate_decisions: decisions,
        fallback: buildSafeFallback(governance, 'MISSING_MANDATORY_COMPANION'),
        policy_version: governance.policyVersion,
      };
    }
  }

  return {
    decision: 'ALLOW',
    reason: 'RENDERABLE_RESULT_SET',
    gate_decisions: decisions,
    claim_ids: allowedClaimIds,
    policy_version: governance.policyVersion,
  };
}

function createClaimGate(rootDirectory) {
  const governance = loadGovernance(rootDirectory);

  return {
    governance,
    evaluateClaim: (claimId, context) => evaluateClaim(governance, claimId, context),
    evaluateResultSet: (claimIds, context) => evaluateResultSet(governance, claimIds, context),
    buildSafeFallback: (reason) => buildSafeFallback(governance, reason),
  };
}

module.exports = {
  buildSafeFallback,
  createClaimGate,
  evaluateClaim,
  evaluateResultSet,
};
