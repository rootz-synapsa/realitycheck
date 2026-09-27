'use strict';

const EvidenceClass = {
  FILE_METADATA: 'FILE_METADATA',
  VIDEO_METADATA: 'VIDEO_METADATA'
};

const VerificationStatus = {
  OBSERVED: 'OBSERVED'
};

const CoverageStatus = {
  CHECKED: 'CHECKED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
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

function valueOrNull(value) {
  return value === undefined ? null : value;
}

function validateNumericField(value, fieldName) {
  if (value === null || value === undefined) {
    return { valid: 'MISSING' };
  }

  if (typeof value !== 'number') {
    return { valid: false, error: `${fieldName} is not a number: ${typeof value}` };
  }

  if (!Number.isFinite(value)) {
    return { valid: false, error: `${fieldName} is not finite: ${value}` };
  }

  if (value < 0) {
    return { valid: false, error: `${fieldName} is negative: ${value}` };
  }

  return { valid: true };
}

function validateMimeType(mimeType) {
  if (mimeType === null || mimeType === undefined) {
    return { valid: 'MISSING' };
  }
  if (typeof mimeType !== 'string') {
    return { valid: false, error: 'mime_type is not a string' };
  }
  if (mimeType.length === 0) {
    return { valid: false, error: 'mime_type is empty string' };
  }
  if (!mimeType.includes('/')) {
    return { valid: false, error: `mime_type format invalid: ${mimeType}` };
  }
  return { valid: true };
}

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

function createExtractionError(code, stage, message) {
  const error = { code, stage };
  if (message !== undefined && message !== null && message !== '') {
    error.message = message;
  }
  return error;
}

function hasExplicitVideoReadFailure(extractionErrors) {
  return extractionErrors.some((error) => {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = typeof error.code === 'string' ? error.code : '';
    const stage = typeof error.stage === 'string' ? error.stage : '';

    return stage === 'video_metadata_read' || code.startsWith('VIDEO_METADATA_') || code === 'BROWSER_API_NOT_AVAILABLE';
  });
}

function validateVideoMetadata(video, options = {}) {
  const metadata = video || {};
  const validations = {
    duration_seconds: validateNumericField(metadata.duration_seconds, 'duration_seconds'),
    width: validateNumericField(metadata.width, 'width'),
    height: validateNumericField(metadata.height, 'height')
  };

  const errors = [];
  let validFieldCount = 0;
  let missingFieldCount = 0;
  let invalidFieldCount = 0;

  for (const result of Object.values(validations)) {
    if (result.valid === true) {
      validFieldCount += 1;
    } else if (result.valid === 'MISSING') {
      missingFieldCount += 1;
    } else {
      invalidFieldCount += 1;
      errors.push(result.error);
    }
  }

  let coverage = CoverageStatus.FAILED;
  if (validFieldCount === 3) {
    coverage = CoverageStatus.CHECKED;
  } else if (validFieldCount > 0) {
    coverage = CoverageStatus.PARTIAL;
  } else if (invalidFieldCount > 0) {
    coverage = CoverageStatus.FAILED;
  } else if (missingFieldCount === 3) {
    coverage = options.explicitReadFailure ? CoverageStatus.FAILED : CoverageStatus.NOT_SUPPORTED;
  }

  return {
    validations,
    errors,
    coverage,
    validFieldCount,
    missingFieldCount,
    invalidFieldCount
  };
}

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

function normalizeExtractionStatus(coverage) {
  const fileCoverage = coverage.file_metadata;
  const videoCoverage = coverage.video_metadata;

  if (
    fileCoverage === CoverageStatus.CHECKED &&
    videoCoverage === CoverageStatus.CHECKED
  ) {
    return ExtractionStatus.COMPLETE;
  }

  if (videoCoverage === CoverageStatus.FAILED) {
    return ExtractionStatus.FAILED;
  }

  if (
    fileCoverage === CoverageStatus.PARTIAL ||
    videoCoverage === CoverageStatus.PARTIAL
  ) {
    return ExtractionStatus.PARTIAL;
  }

  if (
    fileCoverage === CoverageStatus.CHECKED ||
    videoCoverage === CoverageStatus.CHECKED
  ) {
    return ExtractionStatus.PARTIAL;
  }

  if (fileCoverage === CoverageStatus.FAILED) {
    return ExtractionStatus.FAILED;
  }

  return ExtractionStatus.FAILED;
}

function buildEvidenceBundle(inputs = {}) {
  const schemaVersion = inputs.schema_version || 'rc-evidence-0.1';
  const file = inputs.file || {};
  const video = inputs.video || {};
  const extractionErrors = Array.isArray(inputs.extraction_errors) ? [...inputs.extraction_errors] : [];
  const explicitStatus = inputs.extraction_status || ExtractionStatus.COMPLETE;

  const bundle = {
    schema_version: schemaVersion,
    media_type: 'video',
    source: {
      acquisition: AcquisitionMethod.USER_SELECTED_LOCAL_FILE,
      processing_location: ProcessingLocation.LOCAL_DEVICE
    },
    file: {
      name: valueOrNull(file.name),
      size_bytes: valueOrNull(file.size_bytes),
      mime_type: valueOrNull(file.mime_type),
      last_modified: valueOrNull(file.last_modified)
    },
    video: {
      duration_seconds: valueOrNull(video.duration_seconds),
      width: valueOrNull(video.width),
      height: valueOrNull(video.height)
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
      status: explicitStatus,
      errors: extractionErrors
    }
  };

  if (explicitStatus === ExtractionStatus.REJECTED) {
    return bundle;
  }

  const fileSizeValidation = validateFileSize(bundle.file.size_bytes);
  const mimeTypeValidation = validateMimeType(bundle.file.mime_type);
  const fileNameValid = typeof bundle.file.name === 'string' && bundle.file.name.length > 0;

  if (fileNameValid && fileSizeValidation.valid === true && mimeTypeValidation.valid === true) {
    bundle.coverage.file_metadata = CoverageStatus.CHECKED;
    bundle.observations.push(createFileMetadataObservation(bundle.file));
  } else if (fileNameValid && (fileSizeValidation.valid === false || mimeTypeValidation.valid === false)) {
    bundle.coverage.file_metadata = CoverageStatus.FAILED;
    const fileErrors = [];
    if (fileSizeValidation.valid === false) {
      fileErrors.push(fileSizeValidation.error);
    }
    if (mimeTypeValidation.valid === false) {
      fileErrors.push(mimeTypeValidation.error);
    }
    if (fileErrors.length > 0) {
      bundle.extraction.errors.push(
        createExtractionError('FILE_METADATA_VALIDATION_FAILED', 'file_metadata', fileErrors.join('; '))
      );
    }
  }

  const videoValidation = validateVideoMetadata(bundle.video, {
    explicitReadFailure: hasExplicitVideoReadFailure(bundle.extraction.errors)
  });

  bundle.coverage.video_metadata = videoValidation.coverage;

  if (
    videoValidation.coverage === CoverageStatus.CHECKED ||
    videoValidation.coverage === CoverageStatus.PARTIAL
  ) {
    bundle.observations.push(createVideoMetadataObservation(bundle.video, videoValidation.validations));
  }

  if (videoValidation.errors.length > 0) {
    bundle.extraction.errors.push(
      createExtractionError('VIDEO_METADATA_VALIDATION_FAILED', 'video_metadata', videoValidation.errors.join('; '))
    );
  }

  bundle.extraction.status = normalizeExtractionStatus(bundle.coverage);

  return bundle;
}

function getEvidenceState(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    return 'ANALYSIS_FAILED';
  }

  const status = bundle.extraction && bundle.extraction.status;

  if (status === ExtractionStatus.FAILED || status === ExtractionStatus.REJECTED) {
    return 'ANALYSIS_FAILED';
  }

  if (status === ExtractionStatus.COMPLETE || status === ExtractionStatus.PARTIAL) {
    return 'INCONCLUSIVE';
  }

  return 'ANALYSIS_FAILED';
}

function createGovernanceContext(bundle) {
  if (!bundle || bundle.extraction?.status === ExtractionStatus.REJECTED) {
    return null;
  }

  return {
    evidence_state: getEvidenceState(bundle),
    evidence: Array.isArray(bundle.observations) ? bundle.observations : []
  };
}

const api = {
  EvidenceClass,
  VerificationStatus,
  CoverageStatus,
  ExtractionStatus,
  AcquisitionMethod,
  ProcessingLocation,
  buildEvidenceBundle,
  createGovernanceContext,
  createFileMetadataObservation,
  createVideoMetadataObservation,
  createExtractionError,
  validateNumericField,
  validateVideoMetadata,
  validateMimeType,
  validateFileSize,
  getEvidenceState
};

if (typeof globalThis !== 'undefined') {
  globalThis.RealityCheckEvidenceBundle = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
