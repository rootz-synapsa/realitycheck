'use strict';

/**
 * Video Adapter
 * 
 * Reads observable video metadata from browser File objects.
 * Coordinates with Evidence Bundle builder to create normalized,
 * governance-ready observations.
 * 
 * Adheres to RC-WC-002 contract:
 * - Local-device processing only
 * - No external network calls
 * - Observation-only (no analytical conclusions)
 * - Deterministic output
 * - Explicit failure handling
 */

const {
  buildEvidenceBundle,
  ExtractionStatus,
  CoverageStatus,
  createExtractionError
} = require('./evidence-bundle.cjs');

/**
 * Check if a file is a supported video type
 */
function isSupportedVideoType(file) {
  if (!file || typeof file !== 'object') {
    return false;
  }
  
  const type = file.type || '';
  
  // Accept video/* MIME types
  if (type.startsWith('video/')) {
    return true;
  }
  
  // If type is not present, cannot verify
  return false;
}

/**
 * Extract file-level metadata from a File object
 */
function extractFileMetadata(file) {
  return {
    name: file.name || null,
    size_bytes: file.size || null,
    mime_type: file.type || null,
    last_modified: file.lastModified || null
  };
}

/**
 * Read video metadata using browser HTML5 Video API.
 * Returns a Promise that resolves to { duration_seconds, width, height }
 * or null values if metadata cannot be read.
 */
function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const metadata = {
        duration_seconds: video.duration || null,
        width: video.videoWidth || null,
        height: video.videoHeight || null
      };

      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        duration_seconds: null,
        width: null,
        height: null
      });
    };

    video.src = objectUrl;
  });
}

/**
 * Adapt a File object into an Evidence Bundle
 * 
 * Workflow:
 * 1. Check if file is a supported video type
 * 2. Extract file metadata
 * 3. Read video metadata from browser
 * 4. Build Evidence Bundle with observations
 * 5. Return governance-ready context
 * 
 * @param {File} file - Browser File object
 * @returns {Promise<Object>} { bundle, governanceContext }
 */
async function adaptVideoFile(file) {
  // Input validation
  if (!file || typeof file !== 'object') {
    return {
      bundle: buildEvidenceBundle({
        extraction_status: ExtractionStatus.REJECTED,
        extraction_errors: [
          createExtractionError('INVALID_INPUT', 'input', 'File object is invalid')
        ]
      }),
      governanceContext: null
    };
  }

  // Check if file is a supported video
  if (!isSupportedVideoType(file)) {
    return {
      bundle: buildEvidenceBundle({
        extraction_status: ExtractionStatus.REJECTED,
        extraction_errors: [
          createExtractionError(
            'UNSUPPORTED_INPUT',
            'file_type_check',
            `File type "${file.type}" is not a supported video`
          )
        ]
      }),
      governanceContext: null
    };
  }

  // Extract file metadata
  const fileMetadata = extractFileMetadata(file);

  // Read video metadata
  const videoMetadata = await readVideoMetadata(file);

  // Build Evidence Bundle
  const bundle = buildEvidenceBundle({
    file: fileMetadata,
    video: videoMetadata
  });

  // Create governance-ready context
  const { createGovernanceContext } = require('./evidence-bundle.cjs');
  const governanceContext = createGovernanceContext(bundle);

  return {
    bundle,
    governanceContext
  };
}

module.exports = {
  adaptVideoFile,
  isSupportedVideoType,
  extractFileMetadata,
  readVideoMetadata
};
