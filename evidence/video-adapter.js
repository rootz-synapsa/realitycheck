'use strict';

/**
 * Video Adapter
 * 
 * Canonical implementation used by both browser and Node.js environments.
 * Reads observable video metadata from browser File objects.
 * Coordinates with Evidence Bundle to create normalized, governance-ready observations.
 * 
 * Adheres to RC-WC-002 contract:
 * - Local-device processing only
 * - No external network calls
 * - Observation-only (no analytical conclusions)
 * - Deterministic output
 * - Explicit failure handling
 * - Browser dependency injection for testability
 * - URL.revokeObjectURL() guaranteed on all paths
 * 
 * Exports to globalThis.RealityCheckVideoAdapter in browser.
 * Exports through module.exports in Node.
 */

function getEvidenceBundle() {
  if (typeof globalThis !== 'undefined' && globalThis.RealityCheckEvidenceBundle) {
    return globalThis.RealityCheckEvidenceBundle;
  }
  if (typeof require !== 'undefined') {
    return require('./evidence-bundle.js');
  }
  throw new Error('Evidence Bundle not available');
}

function isSupportedVideoType(file) {
  if (!file || typeof file !== 'object') {
    return false;
  }

  const type = file.type || '';

  if (type.startsWith('video/')) {
    return true;
  }

  return false;
}

function extractFileMetadata(file) {
  return {
    name: file.name !== undefined ? file.name : null,
    size_bytes: file.size !== undefined ? file.size : null,
    mime_type: file.type !== undefined ? file.type : null,
    last_modified: file.lastModified !== undefined ? file.lastModified : null
  };
}

function readVideoMetadata(file, browserAPI) {
  return new Promise((resolve) => {
    if (!browserAPI || !browserAPI.createElement || !browserAPI.createObjectURL || !browserAPI.revokeObjectURL) {
      resolve({
        duration_seconds: null,
        width: null,
        height: null,
        error: 'BROWSER_API_NOT_AVAILABLE'
      });
      return;
    }

    let objectUrl = null;

    try {
      const video = browserAPI.createElement('video');
      objectUrl = browserAPI.createObjectURL(file);

      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const metadata = {
          duration_seconds: video.duration !== undefined ? video.duration : null,
          width: video.videoWidth !== undefined ? video.videoWidth : null,
          height: video.videoHeight !== undefined ? video.videoHeight : null
        };

        if (objectUrl) {
          browserAPI.revokeObjectURL(objectUrl);
        }

        resolve(metadata);
      };

      video.onerror = () => {
        if (objectUrl) {
          browserAPI.revokeObjectURL(objectUrl);
        }

        resolve({
          duration_seconds: null,
          width: null,
          height: null,
          error: 'VIDEO_METADATA_READ_ERROR'
        });
      };

      video.src = objectUrl;
    } catch (err) {
      if (objectUrl && browserAPI.revokeObjectURL) {
        try {
          browserAPI.revokeObjectURL(objectUrl);
        } catch (revokeErr) {
          // Ignore revoke errors
        }
      }

      resolve({
        duration_seconds: null,
        width: null,
        height: null,
        error: 'VIDEO_METADATA_EXCEPTION'
      });
    }
  });
}

function getDefaultBrowserAPI() {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  return {
    createElement: (tag) => document.createElement(tag),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url)
  };
}

async function adaptVideoFile(file, browserAPI) {
  const EvidenceBundle = getEvidenceBundle();
  const { buildEvidenceBundle, createGovernanceContext, ExtractionStatus, createExtractionError } =
    EvidenceBundle;

  if (!browserAPI) {
    browserAPI = getDefaultBrowserAPI();
  }

  if (!file || typeof file !== 'object') {
    return {
      bundle: buildEvidenceBundle({
        extraction_status: ExtractionStatus.REJECTED,
        extraction_errors: [createExtractionError('INVALID_INPUT', 'input', 'File object is invalid')]
      }),
      governanceContext: null
    };
  }

  if (!isSupportedVideoType(file)) {
    return {
      bundle: buildEvidenceBundle({
        extraction_status: ExtractionStatus.REJECTED,
        extraction_errors: [
          createExtractionError('UNSUPPORTED_INPUT', 'file_type_check', `File type "${file.type}" is not a supported video`)
        ]
      }),
      governanceContext: null
    };
  }

  const fileMetadata = extractFileMetadata(file);
  const videoMetadata = await readVideoMetadata(file, browserAPI);

  let extractionStatus = ExtractionStatus.COMPLETE;
  let extractionErrors = [];

  if (videoMetadata.error) {
    extractionErrors.push(
      createExtractionError(videoMetadata.error, 'video_metadata_read', 'Failed to read video metadata')
    );
  }

  const bundle = buildEvidenceBundle({
    file: fileMetadata,
    video: videoMetadata,
    extraction_status: extractionStatus,
    extraction_errors: extractionErrors
  });

  const governanceContext = createGovernanceContext(bundle);

  return {
    bundle,
    governanceContext
  };
}

const api = {
  adaptVideoFile,
  isSupportedVideoType,
  extractFileMetadata,
  readVideoMetadata,
  getDefaultBrowserAPI
};

// Browser context
if (typeof globalThis !== 'undefined') {
  globalThis.RealityCheckVideoAdapter = api;
}

// Node.js context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
