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
 * - Explicit coverage state with NOT_SUPPORTED/FAILED/CHECKED/PARTIAL
 * - Deterministic validation (no || shortcuts)
 * - Distinguishes MISSING (field absent/null) from INVALID (field failed validation)
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
  CHECKED: 'CHECKED',       // Successfully extracted and validated
  FAILED: 'FAILED',         // Attempted extraction but validation failed
  NOT_SUPPORTED: 'NOT_SUPPORTED',  // Capability not implemented in RC-WC-002
  PARTIAL: 'PARTIAL'        // Some fields extracted, others missing/failed
};

const ExtractionStatus = {
  COMPLETE: 'COMPLETE',     // All applicable observations extracted and valid
  PARTIAL: 'PARTIAL',       // Some observations extracted, some failed/missing
  FAILED: 'FAILED',         // Extraction failed; no valid observations
  REJECTED: 'REJECTED'      // Input rejected before extraction (wrong type, etc.)
};

const AcquisitionMethod = {
  USER_SELECTED_LOCAL_FILE: 'user_selected_local_file'
};

const ProcessingLocation = {
  LOCAL_DEVICE: 'local_device'
};

/**
 * Check if a value is a legitimate observed numeric field
 * Returns { valid: true/false, error?: string }
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
 * Returns { valid: true/false, errors?: string[], allMissing?: boolean }
 */
function validateVideoMetadata(metadata) {
  const errors = [];
  const validations = {
    duration_seconds: validateNumericField(metadata.duration_seconds, 'duration_seconds'),
    width: validateNumericField(metadata.width, 'width'),
    height: validateNumericField(metadata.height, 'height')
  };

  let hasValidField = false;
  let hasMissingField = false;

  Object.entries(validations).forEach(([field, result]) => {
    if (result.valid === 'MISSING') {
      hasMissingField = true;
    } else if (result.valid === true) {
      hasValidField = true;
    } else if (result.valid === false) {
      errors.push(result.error);
    }
  });

  // All fields missing = no attempt to extract
  const allMissing = !hasValidField && hasMissingField && errors.length === 0;

  return {
    valid: errors.length === 0 && hasValidField, // Must have at least one valid field
    errors,
    allMissing,
    validations
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
  // Only add if at least one field is present and valid
  const videoValidation = validateVideoMetadata(video);

  if (videoValidation.allMissing) {
    // All video fields are missing: no attempt made
    bundle.coverage.video_metadata = CoverageStatus.NOT_SUPPORTED;
  } else if (videoValidation.valid === true) {
    // At least one field is valid
    bundle.observations.push(createVideoMetadataObservation(video, videoValidation.validations));
    bundle.coverage.video_metadata = CoverageStatus.CHECKED;
  } else if (videoValidation.errors.length > 0) {
    // At least one field was present but validation failed
    bundle.coverage.video_metadata = CoverageStatus.FAILED;
    bundle.extraction.errors.push(
      createExtractionError(
        'VIDEO_METADATA_VALIDATION_FAILED',
        'video_metadata',
        videoValidation.errors.join('; ')
      )
    );
  }

  // Automatically update extraction status based on coverage (only if not pre-set to REJECTED)
  if (extractionStatus !== ExtractionStatus.REJECTED) {
    const checkedFields = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.CHECKED
    ).length;
    const failedFields = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.FAILED
    ).length;

    if (checkedFields > 0 && failedFields > 0) {
      bundle.extraction.status = ExtractionStatus.PARTIAL;
    } else if (checkedFields === 0 && failedFields > 0) {
      bundle.extraction.status = ExtractionStatus.FAILED;
    } else if (checkedFields > 0 && failedFields === 0) {
      bundle.extraction.status = ExtractionStatus.COMPLETE;
    } else {
      // No fields checked or failed
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
