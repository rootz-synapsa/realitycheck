'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./yaml-loader.cjs');

function readFile(rootDirectory, relativePath) {
  return fs.readFileSync(path.join(rootDirectory, relativePath), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRequiredMetadata(markdown, fieldName, relativePath) {
  const expression = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
  const match = markdown.match(expression);
  if (!match) {
    throw new Error(`Missing ${fieldName} in ${relativePath}`);
  }

  return match[1].trim();
}

function validateCamSchemaShape(camSchema) {
  if (!camSchema || typeof camSchema !== 'object' || Array.isArray(camSchema)) {
    throw new Error('governance/cam.schema.json must parse to an object');
  }

  const claimSchema = camSchema.properties && camSchema.properties.claims && camSchema.properties.claims.additionalProperties;
  const normativeLevelSchema = claimSchema && claimSchema.properties && claimSchema.properties.normative_level;

  if (!Array.isArray(camSchema.required) || !claimSchema || !Array.isArray(claimSchema.required) || !normativeLevelSchema || !Array.isArray(normativeLevelSchema.enum)) {
    throw new Error('governance/cam.schema.json is missing required claim schema definitions');
  }
}

function assertArrayOfStrings(value, errorMessage) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(errorMessage);
  }
}

function validateCompanionReferences(claimsDocument) {
  const visiting = new Set();
  const visited = new Set();

  function visit(claimId) {
    if (visited.has(claimId)) {
      return;
    }
    if (visiting.has(claimId)) {
      throw new Error(`Companion claim cycle detected at ${claimId}`);
    }

    visiting.add(claimId);
    const claim = claimsDocument.claims[claimId];
    const companions = Array.isArray(claim.mandatory_companions) ? claim.mandatory_companions : [];

    for (const companionId of companions) {
      if (!claimsDocument.claims[companionId]) {
        throw new Error(`Claim ${claimId} references unknown mandatory companion ${companionId}`);
      }
      visit(companionId);
    }

    visiting.delete(claimId);
    visited.add(claimId);
  }

  for (const claimId of Object.keys(claimsDocument.claims)) {
    visit(claimId);
  }
}

function validateClaimsDocument(claimsDocument, camSchema) {
  if (!claimsDocument || typeof claimsDocument !== 'object' || Array.isArray(claimsDocument)) {
    throw new Error('governance/claims.yaml must parse to an object');
  }

  for (const requiredField of camSchema.required || []) {
    if (!(requiredField in claimsDocument)) {
      throw new Error(`governance/claims.yaml is missing required field ${requiredField}`);
    }
  }

  if (camSchema.additionalProperties === false) {
    for (const fieldName of Object.keys(claimsDocument)) {
      if (!(fieldName in camSchema.properties)) {
        throw new Error(`governance/claims.yaml contains unsupported top-level field ${fieldName}`);
      }
    }
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

  const claimSchema = camSchema.properties.claims.additionalProperties;
  const allowedNormativeLevels = new Set(claimSchema.properties.normative_level.enum);
  const allowedClaimFields = new Set(Object.keys(claimSchema.properties));

  for (const [claimId, claim] of entries) {
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
      throw new Error(`Claim ${claimId} must be an object`);
    }

    for (const requiredField of claimSchema.required || []) {
      if (!(requiredField in claim)) {
        throw new Error(`Claim ${claimId} is missing required field ${requiredField}`);
      }
    }

    for (const fieldName of Object.keys(claim)) {
      if (!allowedClaimFields.has(fieldName) && claimSchema.additionalProperties === false) {
        throw new Error(`Claim ${claimId} contains unsupported field ${fieldName}`);
      }
    }

    if (typeof claim.family !== 'string' || claim.family.length === 0) {
      throw new Error(`Claim ${claimId} must define a family`);
    }

    if (!allowedNormativeLevels.has(claim.normative_level)) {
      throw new Error(`Claim ${claimId} has unsupported normative_level ${claim.normative_level}`);
    }

    if ('requires_evidence' in claim && !Array.isArray(claim.requires_evidence)) {
      throw new Error(`Claim ${claimId} requires_evidence must be an array`);
    }

    if ('requires_state' in claim && (!claim.requires_state || typeof claim.requires_state !== 'object' || Array.isArray(claim.requires_state))) {
      throw new Error(`Claim ${claimId} requires_state must be an object`);
    }

    if ('template' in claim && (!claim.template || typeof claim.template !== 'object' || Array.isArray(claim.template))) {
      throw new Error(`Claim ${claimId} template must be an object`);
    }

    if ('mandatory_companions' in claim) {
      assertArrayOfStrings(claim.mandatory_companions, `Claim ${claimId} mandatory_companions must be an array of strings`);
    }

    if ('gp_refs' in claim) {
      assertArrayOfStrings(claim.gp_refs, `Claim ${claimId} gp_refs must be an array of strings`);
    }

    if ('reason' in claim && typeof claim.reason !== 'string') {
      throw new Error(`Claim ${claimId} reason must be a string`);
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

  if (typeof document.scope !== 'string' || document.scope.length === 0) {
    throw new Error(`${relativePath} must define a scope`);
  }

  assertArrayOfStrings(document.hard_block_terms, `${relativePath} hard_block_terms must be an array of strings`);
  assertArrayOfStrings(document.hedge_block_terms, `${relativePath} hedge_block_terms must be an array of strings`);

  if ('notes' in document) {
    assertArrayOfStrings(document.notes, `${relativePath} notes must be an array of strings when present`);
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

  validateCamSchemaShape(camSchema);
  validateClaimsDocument(claims, camSchema);
  validateCompanionReferences(claims);
  validateCompositionDocument(composition, claims);
  validateLexiconDocument(lexiconTh, claims, 'governance/lexicon.th.yaml');
  validateLexiconDocument(lexiconEn, claims, 'governance/lexicon.en.yaml');

  const workContractStatus = parseRequiredMetadata(workContract, 'Status', 'RC-WC-001-REVISED.md');
  if (workContractStatus !== 'AUTHORIZED FOR IMPLEMENTATION') {
    throw new Error('RC-WC-001-REVISED.md must remain authorized for implementation');
  }

  parseRequiredMetadata(workContract, 'Policy source', 'RC-WC-001-REVISED.md');

  const principlesPolicyVersion = parseRequiredMetadata(principles, 'Policy version', 'governance/principles.md');
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
