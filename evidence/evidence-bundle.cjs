'use strict';

/**
 * Evidence Bundle v0.1
 * 
 * Canonical representation of observations from a local-device analysis.
 * Encodes detected properties and explicit coverage markers without
 * making analytical conclusions.
 * 
 * Contract RC-WC-002 compliance:
 * - Only evidence from verified observations
 * - No raw media bytes
 * - Explicit coverage state: CHECKED (all required fields valid), PARTIAL (some valid, some missing/invalid),
 *   FAILED (attempted but all invalid), NOT_SUPPORTED (not implemented)
 * - Deterministic validation (no || shortcuts)
 * - Distinguishes MISSING (field absent/null) from INVALID (field failed validation)
 * - VIDEO_METADATA coverage CHECKED only if ALL three fields (duration, width, height) are valid
 * - VIDEO_METADATA coverage PARTIAL if some fields valid and some missing/invalid
 * - Governance-ready context: INCONCLUSIVE for metadata-only, ANALYSIS_FAILED for errors/rejected
 */

const EvidenceClass = {
  FILE_METADATA: 'FILE_METADATA',
  VIDEO_METADATA: 'VIDEO_METADATA'
};

const VerificationStatus = {
  OBSERVED: 'OBSERVED'
};

const CoverageStatus = {
  CHECKED: 'CHECKED',              // All required fields present and valid
  PARTIAL: 'PARTIAL',              // Some fields valid, some missing or invalid
  FAILED: 'FAILED',                // Attempted extraction but all validation failed
  NOT_SUPPORTED: 'NOT_SUPPORTED',  // Capability not implemented in RC-WC-002
  NOT_APPLICABLE: 'NOT_APPLICABLE' // Field does not apply to this input
};

const ExtractionStatus = {
  COMPLETE: 'COMPLETE',   // All applicable observations extracted and valid
  PARTIAL: 'PARTIAL',     // Some observations extracted, some failed/missing
  FAILED: 'FAILED',       // Extraction failed; no valid observations
  REJECTED: 'REJECTED'    // Input rejected before extraction (wrong type, etc.)
};

const AcquisitionMethod = {
  USER_SELECTED_LOCAL_FILE: 'user_selected_local_file'
};

const ProcessingLocation = {
  LOCAL_DEVICE: 'local_device'
};

/**
 * Check if a value is a legitimate observed numeric field
 * Returns { valid: true/false/'MISSING', error?: string }
 * 
 * Valid: finite, non-negative numbers (including 0)
 * Invalid: NaN, Infinity, negative, non-number
 * Missing: null or undefined
 */
function validateNumericField(value, fieldName) {
  // null or undefined = MISSING (not an error, expected for unread fields)
  if (value === null || value === undefined) {
    return { valid: 'MISSING' };
  }

  // Type check
  if (typeof value !== 'number') {
    return {
      valid: false,
      error: `${fieldName} is not a number: ${typeof value}`
    };
  }

  // Finite check
  if (!Number.isFinite(value)) {
    return {
      valid: false,
      error: `${fieldName} is not finite: ${value}`
    };
  }

  // Negative check
  if (value < 0) {
    return {
      valid: false,
      error: `${fieldName} is negative: ${value}`
    };
  }

  return { valid: true };
}

/**
 * Validate all numeric video metadata fields
 * Returns { valid: true/false, errors?: string[], coverage: 'CHECKED'/'PARTIAL'/'FAILED' }
 * 
 * CHECKED: all three fields (duration, width, height) are valid
 * PARTIAL: at least one field is valid, but not all three are valid
 * FAILED: all fields are either invalid or missing
 */
function validateVideoMetadata(metadata) {
  const errors = [];
  const validations = {
    duration_seconds: validateNumericField(metadata.duration_seconds, 'duration_seconds'),
    width: validateNumericField(metadata.width, 'width'),
    height: validateNumericField(metadata.height, 'height')
  };

  const validFieldCount = Object.values(validations).filter(
    (v) => v.valid === true
  ).length;

  const missingFieldCount = Object.values(validations).filter(
    (v) => v.valid === 'MISSING'
  ).length;

  Object.values(validations).forEach((result) => {
    if (result.valid === false) {
      errors.push(result.error);
    }
  });

  // Determine coverage
  let coverage;
  if (validFieldCount === 3) {
    // All three fields are valid
    coverage = CoverageStatus.CHECKED;
  } else if (validFieldCount > 0) {
    // Some fields are valid, but not all
    coverage = CoverageStatus.PARTIAL;
  } else if (missingFieldCount === 3) {
    // All fields are missing; no attempt was made
    coverage = CoverageStatus.NOT_SUPPORTED;
  } else {
    // Some fields are present but invalid
    coverage = CoverageStatus.FAILED;
  }

  return {
    valid: coverage === CoverageStatus.CHECKED,
    errors,
    coverage,
    validations,
    validFieldCount
  };
}

/**
 * Validate MIME type format
 */
function validateMimeType(mimeType) {
  if (mimeType === null || mimeType === undefined) {
    return { valid: 'MISSING' };
  }
  if (typeof mimeType !== 'string') {
    return { valid: false, error: 'mime_type is not a string' };
  }
  if (mimeType === '') {
    return { valid: false, error: 'mime_type is empty string' };
  }
  if (!mimeType.includes('/')) {
    return { valid: false, error: `mime_type format invalid: ${mimeType}` };
  }
  return { valid: true };
}

/**
 * Validate file size
 */
function validateFileSize(sizeBytes) {
  if (sizeBytes === null || sizeBytes === undefined) {
    return { valid: 'MISSING' };
  }
  if (typeof sizeBytes !== 'number') {
    return { valid: false, error: `size_bytes is not a number: ${typeof sizeBytes}` };
  }
  if (!Number.isFinite(sizeBytes)) {
    return { valid: false, error: `size_bytes is not finite: ${sizeBytes}` };
  }
  if (sizeBytes < 0) {
    return { valid: false, error: `size_bytes is negative: ${sizeBytes}` };
  }
  if (sizeBytes === 0) {
    return { valid: false, error: 'size_bytes is zero' };
  }
  return { valid: true };
}

/**
 * Create a FILE_METADATA observation
 */
function createFileMetadataObservation(fileMetadata) {
  return {
    class: EvidenceClass.FILE_METADATA,
    verification: VerificationStatus.OBSERVED,
    method: 'browser_file_api',
    fields: {
      name: fileMetadata.name,
      size_bytes: fileMetadata.size_bytes,
      mime_type: fileMetadata.mime_type,
      last_modified: fileMetadata.last_modified
    }
  };
}

/**
 * Create a VIDEO_METADATA observation
 * Only include fields that are actually valid numbers
 */
function createVideoMetadataObservation(videoMetadata, validations) {
  const fields = {};

  if (validations.duration_seconds && validations.duration_seconds.valid === true) {
    fields.duration_seconds = videoMetadata.duration_seconds;
  }
  if (validations.width && validations.width.valid === true) {
    fields.width = videoMetadata.width;
  }
  if (validations.height && validations.height.valid === true) {
    fields.height = videoMetadata.height;
  }

  return {
    class: EvidenceClass.VIDEO_METADATA,
    verification: VerificationStatus.OBSERVED,
    method: 'browser_video_metadata',
    fields
  };
}

/**
 * Create an evidence extraction error record
 */
function createExtractionError(code, stage, message = null) {
  const error = {
    code,
    stage
  };
  if (message) {
    error.message = message;
  }
  return error;
}

/**
 * Build an Evidence Bundle from structured inputs
 * 
 * @param {Object} inputs - Configuration object
 * @param {string} inputs.schema_version - Schema version (default: "rc-evidence-0.1")
 * @param {Object} inputs.file - File metadata { name, size_bytes, mime_type, last_modified }
 * @param {Object} inputs.video - Video metadata { duration_seconds, width, height }
 * @param {string} inputs.extraction_status - Status: COMPLETE, PARTIAL, FAILED, REJECTED
 * @param {Array} inputs.extraction_errors - Array of error objects
 * @returns {Object} Evidence Bundle v0.1 object
 */
function buildEvidenceBundle(inputs = {}) {
  const schemaVersion = inputs.schema_version || 'rc-evidence-0.1';
  const file = inputs.file || {};
  const video = inputs.video || {};
  let extractionStatus = inputs.extraction_status || ExtractionStatus.COMPLETE;
  const extractionErrors = Array.isArray(inputs.extraction_errors) ? inputs.extraction_errors : [];

  // Initialize bundle structure with all fields preserved (no || null shortcuts)
  const bundle = {
    schema_version: schemaVersion,
    media_type: 'video',
    source: {
      acquisition: AcquisitionMethod.USER_SELECTED_LOCAL_FILE,
      processing_location: ProcessingLocation.LOCAL_DEVICE
    },
    file: {
      name: file.name !== undefined ? file.name : null,
      size_bytes: file.size_bytes !== undefined ? file.size_bytes : null,
      mime_type: file.mime_type !== undefined ? file.mime_type : null,
      last_modified: file.last_modified !== undefined ? file.last_modified : null
    },
    video: {
      duration_seconds: video.duration_seconds !== undefined ? video.duration_seconds : null,
      width: video.width !== undefined ? video.width : null,
      height: video.height !== undefined ? video.height : null
    },
    observations: [],
    coverage: {
      file_metadata: CoverageStatus.NOT_SUPPORTED,
      video_metadata: CoverageStatus.NOT_SUPPORTED,
      provenance: CoverageStatus.NOT_SUPPORTED,
      ai_watermark: CoverageStatus.NOT_SUPPORTED,
      visual_ai_signal: CoverageStatus.NOT_SUPPORTED,
      audio_ai_signal: CoverageStatus.NOT_SUPPORTED
    },
    extraction: {
      status: extractionStatus,
      errors: extractionErrors
    }
  };

  // If already rejected, return early without attempting observation extraction
  if (extractionStatus === ExtractionStatus.REJECTED) {
    return bundle;
  }

  // Validate and add file metadata observation
  // Only add observation if BOTH file.name and file.mime_type are present and valid
  const fileSizeValidation = validateFileSize(file.size_bytes);
  const mimeTypeValidation = validateMimeType(file.mime_type);

  if (
    file.name !== undefined && file.name !== null &&
    fileSizeValidation.valid === true &&
    mimeTypeValidation.valid === true
  ) {
    bundle.observations.push(createFileMetadataObservation(file));
    bundle.coverage.file_metadata = CoverageStatus.CHECKED;
  } else if (
    file.name !== undefined && file.name !== null &&
    (fileSizeValidation.valid === false || mimeTypeValidation.valid === false)
  ) {
    // Attempted to extract file metadata but validation failed
    bundle.coverage.file_metadata = CoverageStatus.FAILED;
    const errors = [];
    if (fileSizeValidation.valid === false) {
      errors.push(fileSizeValidation.error);
    }
    if (mimeTypeValidation.valid === false) {
      errors.push(mimeTypeValidation.error);
    }
    bundle.extraction.errors.push(
      createExtractionError('FILE_METADATA_VALIDATION_FAILED', 'file_metadata', errors.join('; '))
    );
  }

  // Validate and add video metadata observation
  // Coverage determined by videoValidation.coverage:
  // - CHECKED: all three fields valid
  // - PARTIAL: some fields valid, some missing/invalid
  // - FAILED: all fields invalid/present
  // - NOT_SUPPORTED: all fields missing (never attempted)
  const videoValidation = validateVideoMetadata(video);

  if (videoValidation.coverage === CoverageStatus.NOT_SUPPORTED) {
    // All video fields are missing: no attempt made
    bundle.coverage.video_metadata = CoverageStatus.NOT_SUPPORTED;
  } else if (videoValidation.coverage === CoverageStatus.CHECKED) {
    // All three fields are valid
    bundle.observations.push(createVideoMetadataObservation(video, videoValidation.validations));
    bundle.coverage.video_metadata = CoverageStatus.CHECKED;
  } else {
    // PARTIAL or FAILED: some fields present but not all valid
    bundle.coverage.video_metadata = videoValidation.coverage;

    // Only add observation if at least one field is valid (PARTIAL case)
    if (videoValidation.validFieldCount > 0) {
      bundle.observations.push(createVideoMetadataObservation(video, videoValidation.validations));
    }

    // Record any validation errors
    if (videoValidation.errors.length > 0) {
      bundle.extraction.errors.push(
        createExtractionError(
          'VIDEO_METADATA_VALIDATION_FAILED',
          'video_metadata',
          videoValidation.errors.join('; ')
        )
      );
    }
  }

  // Automatically update extraction status based on coverage (only if not pre-set to REJECTED)
  if (extractionStatus !== ExtractionStatus.REJECTED) {
    const checkedFields = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.CHECKED
    ).length;
    const partialFields = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.PARTIAL
    ).length;
    const failedFields = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.FAILED
    ).length;

    if (partialFields > 0 || (checkedFields > 0 && failedFields > 0)) {
      bundle.extraction.status = ExtractionStatus.PARTIAL;
    } else if (checkedFields > 0) {
      bundle.extraction.status = ExtractionStatus.COMPLETE;
    } else if (failedFields > 0) {
      bundle.extraction.status = ExtractionStatus.FAILED;
    } else {
      // No fields checked, partial, or failed
      bundle.extraction.status = ExtractionStatus.FAILED;
    }
  }

  return bundle;
}

/**
 * Map extraction status to governance evidence_state
 * 
 * Contract semantics:
 * - COMPLETE or PARTIAL with observations -> INCONCLUSIVE
 * - FAILED or REJECTED -> ANALYSIS_FAILED
 */
function getEvidenceState(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    return 'ANALYSIS_FAILED';
  }

  const status = bundle.extraction?.status;

  if (status === ExtractionStatus.FAILED || status === ExtractionStatus.REJECTED) {
    return 'ANALYSIS_FAILED';
  }

  // Metadata-only analysis (no AI/watermark/provenance detection) -> INCONCLUSIVE
  if (status === ExtractionStatus.COMPLETE || status === ExtractionStatus.PARTIAL) {
    return 'INCONCLUSIVE';
  }

  return 'ANALYSIS_FAILED';
}

/**
 * Create governance-ready context from Evidence Bundle
 * 
 * Rejected bundles should NOT have a governance context (null indicates not renderable)
 */
function createGovernanceContext(bundle) {
  if (!bundle || bundle.extraction?.status === ExtractionStatus.REJECTED) {
    return null;
  }

  return {
    evidence_state: getEvidenceState(bundle),
    evidence: bundle.observations || []
  };
}

module.exports = {
  // Constants
  EvidenceClass,
  VerificationStatus,
  CoverageStatus,
  ExtractionStatus,
  AcquisitionMethod,
  ProcessingLocation,
  
  // Builders
  buildEvidenceBundle,
  createGovernanceContext,
  createFileMetadataObservation,
  createVideoMetadataObservation,
  createExtractionError,
  
  // Validators
  validateNumericField,
  validateVideoMetadata,
  validateMimeType,
  validateFileSize,
  
  // Utilities
  getEvidenceState
};
