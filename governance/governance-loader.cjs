'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./yaml-loader.cjs');

const ALLOWED_NORMATIVE_LEVELS = new Set([
  'ALLOW',
  'ALLOW_WITH_WARNING',
  'MANDATORY',
  'CONDITIONAL',
  'PERMANENTLY_BLOCKED',
]);

function readFile(rootDirectory, relativePath) {
  return fs.readFileSync(path.join(rootDirectory, relativePath), 'utf8');
}

function parsePolicyVersionFromMarkdown(markdown, relativePath) {
  const match = markdown.match(/^Policy version:\s*(.+)$/m);
  if (!match) {
    throw new Error(`Missing policy version in ${relativePath}`);
  }

  return match[1].trim();
}

function parseRequiredMetadata(markdown, fieldName, relativePath) {
  const expression = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
  const match = markdown.match(expression);
  if (!match) {
    throw new Error(`Missing ${fieldName} in ${relativePath}`);
  }

  return match[1].trim();
}

function validateClaimsDocument(claimsDocument) {
  if (!claimsDocument || typeof claimsDocument !== 'object' || Array.isArray(claimsDocument)) {
    throw new Error('governance/claims.yaml must parse to an object');
  }

  if (typeof claimsDocument.policy_version !== 'string' || claimsDocument.policy_version.length === 0) {
    throw new Error('governance/claims.yaml must include a non-empty policy_version');
  }

  if (!claimsDocument.claims || typeof claimsDocument.claims !== 'object' || Array.isArray(claimsDocument.claims)) {
    throw new Error('governance/claims.yaml must include a claims mapping');
  }

  const entries = Object.entries(claimsDocument.claims);
  if (entries.length === 0) {
    throw new Error('governance/claims.yaml must define at least one claim');
  }

  for (const [claimId, claim] of entries) {
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
      throw new Error(`Claim ${claimId} must be an object`);
    }

    if (typeof claim.family !== 'string' || claim.family.length === 0) {
      throw new Error(`Claim ${claimId} must define a family`);
    }

    if (!ALLOWED_NORMATIVE_LEVELS.has(claim.normative_level)) {
      throw new Error(`Claim ${claimId} has unsupported normative_level ${claim.normative_level}`);
    }
  }
}

function validateCompositionDocument(compositionDocument, claimsDocument) {
  if (!compositionDocument || typeof compositionDocument !== 'object' || Array.isArray(compositionDocument)) {
    throw new Error('governance/composition.yaml must parse to an object');
  }

  if (compositionDocument.policy_version !== claimsDocument.policy_version) {
    throw new Error('governance/composition.yaml policy_version must match governance/claims.yaml');
  }

  if (!compositionDocument.safe_fallback || typeof compositionDocument.safe_fallback !== 'object') {
    throw new Error('governance/composition.yaml must define safe_fallback');
  }

  const fallback = compositionDocument.safe_fallback;
  if (typeof fallback.evidence_state !== 'string' || fallback.evidence_state.length === 0) {
    throw new Error('governance/composition.yaml safe_fallback must define evidence_state');
  }

  if (!Array.isArray(fallback.claim_ids) || fallback.claim_ids.length === 0) {
    throw new Error('governance/composition.yaml safe_fallback must define claim_ids');
  }

  for (const claimId of fallback.claim_ids) {
    if (!claimsDocument.claims[claimId]) {
      throw new Error(`Safe fallback claim ${claimId} is missing from governance/claims.yaml`);
    }
  }
}

function validateLexiconDocument(document, claimsDocument, relativePath) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error(`${relativePath} must parse to an object`);
  }

  if (document.policy_version !== claimsDocument.policy_version) {
    throw new Error(`${relativePath} policy_version must match governance/claims.yaml`);
  }
}

function loadGovernance(rootDirectory = path.resolve(__dirname, '..')) {
  const workContract = readFile(rootDirectory, 'RC-WC-001-REVISED.md');
  const principles = readFile(rootDirectory, 'governance/principles.md');
  const changelog = readFile(rootDirectory, 'governance/CHANGELOG.md');
  const claims = parseYaml(readFile(rootDirectory, 'governance/claims.yaml'));
  const composition = parseYaml(readFile(rootDirectory, 'governance/composition.yaml'));
  const lexiconTh = parseYaml(readFile(rootDirectory, 'governance/lexicon.th.yaml'));
  const lexiconEn = parseYaml(readFile(rootDirectory, 'governance/lexicon.en.yaml'));
  const camSchema = JSON.parse(readFile(rootDirectory, 'governance/cam.schema.json'));

  validateClaimsDocument(claims);
  validateCompositionDocument(composition, claims);
  validateLexiconDocument(lexiconTh, claims, 'governance/lexicon.th.yaml');
  validateLexiconDocument(lexiconEn, claims, 'governance/lexicon.en.yaml');

  const workContractStatus = parseRequiredMetadata(workContract, 'Status', 'RC-WC-001-REVISED.md');
  if (workContractStatus !== 'AUTHORIZED FOR IMPLEMENTATION') {
    throw new Error('RC-WC-001-REVISED.md must remain authorized for implementation');
  }

  parseRequiredMetadata(workContract, 'Policy source', 'RC-WC-001-REVISED.md');

  const principlesPolicyVersion = parsePolicyVersionFromMarkdown(principles, 'governance/principles.md');
  if (principlesPolicyVersion !== claims.policy_version) {
    throw new Error('governance/principles.md policy_version must match governance/claims.yaml');
  }

  return {
    policyVersion: claims.policy_version,
    workContract,
    principles,
    changelog,
    camSchema,
    claims,
    composition,
    lexicon: {
      th: lexiconTh,
      en: lexiconEn,
    },
  };
}

module.exports = {
  loadGovernance,
};
