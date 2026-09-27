'use strict';

/**
 * Evidence Bundle v0.1
 * 
 * Canonical representation of observations from a local-device analysis.
 * Encodes detected properties and explicit coverage markers without
 * making analytical conclusions.
 * 
 * Adheres to RC-WC-002 contract requirements:
 * - Only evidence from observations
 * - No raw media bytes
 * - Explicit coverage state
 * - Deterministic validation
 * - Governance-ready context
 */

const EvidenceClass = {
  FILE_METADATA: 'FILE_METADATA',
  VIDEO_METADATA: 'VIDEO_METADATA'
};

const VerificationStatus = {
  OBSERVED: 'OBSERVED'
};

const CoverageStatus = {
  CHECKED: 'CHECKED',
  FAILED: 'FAILED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  PARTIAL: 'PARTIAL'
};

const ExtractionStatus = {
  COMPLETE: 'COMPLETE',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED'
};

const AcquisitionMethod = {
  USER_SELECTED_LOCAL_FILE: 'user_selected_local_file'
};

const ProcessingLocation = {
  LOCAL_DEVICE: 'local_device'
};

/**
 * Validate a numeric field is finite and non-negative
 */
function validateNumericField(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return {
      valid: false,
      error: `${fieldName} is not finite: ${value}`
    };
  }
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
 */
function validateVideoMetadata(metadata) {
  const errors = [];

  const durationValidation = validateNumericField(metadata.duration_seconds, 'duration_seconds');
  if (durationValidation && !durationValidation.valid) {
    errors.push(durationValidation.error);
  }

  const widthValidation = validateNumericField(metadata.width, 'width');
  if (widthValidation && !widthValidation.valid) {
    errors.push(widthValidation.error);
  }

  const heightValidation = validateNumericField(metadata.height, 'height');
  if (heightValidation && !heightValidation.valid) {
    errors.push(heightValidation.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate MIME type format
 */
function validateMimeType(mimeType) {
  if (!mimeType) {
    return { valid: false, error: 'mime_type is empty' };
  }
  if (typeof mimeType !== 'string') {
    return { valid: false, error: 'mime_type is not a string' };
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
 */
function createVideoMetadataObservation(videoMetadata) {
  return {
    class: EvidenceClass.VIDEO_METADATA,
    verification: VerificationStatus.OBSERVED,
    method: 'browser_video_metadata',
    fields: {
      duration_seconds: videoMetadata.duration_seconds,
      width: videoMetadata.width,
      height: videoMetadata.height
    }
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
  const extractionStatus = inputs.extraction_status || ExtractionStatus.COMPLETE;
  const extractionErrors = Array.isArray(inputs.extraction_errors) ? inputs.extraction_errors : [];

  // Initialize bundle structure
  const bundle = {
    schema_version: schemaVersion,
    media_type: 'video',
    source: {
      acquisition: AcquisitionMethod.USER_SELECTED_LOCAL_FILE,
      processing_location: ProcessingLocation.LOCAL_DEVICE
    },
    file: {
      name: file.name || null,
      size_bytes: file.size_bytes || null,
      mime_type: file.mime_type || null,
      last_modified: file.last_modified || null
    },
    video: {
      duration_seconds: video.duration_seconds || null,
      width: video.width || null,
      height: video.height || null
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

  // Validate and add file metadata observation
  if (file.name && file.size_bytes !== undefined && file.mime_type) {
    const fileSizeValidation = validateFileSize(file.size_bytes);
    const mimeTypeValidation = validateMimeType(file.mime_type);

    if (fileSizeValidation.valid && mimeTypeValidation.valid) {
      bundle.observations.push(createFileMetadataObservation(file));
      bundle.coverage.file_metadata = CoverageStatus.CHECKED;
    } else {
      const errors = [];
      if (!fileSizeValidation.valid) {
        errors.push(fileSizeValidation.error);
      }
      if (!mimeTypeValidation.valid) {
        errors.push(mimeTypeValidation.error);
      }
      bundle.coverage.file_metadata = CoverageStatus.FAILED;
      bundle.extraction.errors.push(
        createExtractionError('FILE_METADATA_VALIDATION_FAILED', 'file_metadata', errors.join('; '))
      );
    }
  }

  // Validate and add video metadata observation
  if (
    video.duration_seconds !== undefined ||
    video.width !== undefined ||
    video.height !== undefined
  ) {
    const videoValidation = validateVideoMetadata(video);
    if (videoValidation.valid) {
      bundle.observations.push(createVideoMetadataObservation(video));
      bundle.coverage.video_metadata = CoverageStatus.CHECKED;
    } else {
      bundle.coverage.video_metadata = CoverageStatus.FAILED;
      bundle.extraction.errors.push(
        createExtractionError(
          'VIDEO_METADATA_VALIDATION_FAILED',
          'video_metadata',
          videoValidation.errors.join('; ')
        )
      );
    }
  }

  // Update extraction status based on coverage
  if (bundle.extraction.status === ExtractionStatus.COMPLETE) {
    const checkedCount = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.CHECKED
    ).length;
    const failedCount = Object.values(bundle.coverage).filter(
      (s) => s === CoverageStatus.FAILED
    ).length;

    if (failedCount > 0 && checkedCount > 0) {
      bundle.extraction.status = ExtractionStatus.PARTIAL;
    } else if (failedCount > 0 && checkedCount === 0) {
      bundle.extraction.status = ExtractionStatus.FAILED;
    }
  }

  return bundle;
}

/**
 * Map extraction status to governance evidence_state
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
 */
function createGovernanceContext(bundle) {
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
