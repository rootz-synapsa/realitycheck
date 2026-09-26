'use strict';

const SAFE_FALLBACK = Object.freeze({
  decision: 'SAFE_FALLBACK',
  reason: 'INSUFFICIENT_SUPPORTED_EVIDENCE',
  message: 'There is not enough supported evidence to produce an analytical conclusion.'
});

function buildSafeFallback(blockedResults) {
  return {
    ...SAFE_FALLBACK,
    blockedCount: Array.isArray(blockedResults) ? blockedResults.length : 0
  };
}

module.exports = {
  SAFE_FALLBACK,
  buildSafeFallback
};
