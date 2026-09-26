'use strict';

const CLAIM_REGISTRY = Object.freeze({
  'RC.CLAIM.SUSPICIOUS_TRANSFER_REQUEST': Object.freeze({
    requiredEvidence: Object.freeze(['message_text', 'risk_indicators'])
  })
});

module.exports = {
  CLAIM_REGISTRY
};
