'use strict';

function resolveEvidenceBundleAPI() {
  if (typeof globalThis !== 'undefined' && globalThis.RealityCheckEvidenceBundle) {
    return globalThis.RealityCheckEvidenceBundle;
  }
  if (typeof require !== 'undefined') {
    return require('./evidence-bundle.js');
  }
  throw new Error('RealityCheckEvidenceBundle is not available');
}

function valueOrNull(value) {
  return value === undefined ? null : value;
}

function isSupportedVideoType(file) {
  if (!file || typeof file !== 'object') {
    return false;
  }

  const type = typeof file.type === 'string' ? file.type : '';
  return type.startsWith('video/');
}

function extractFileMetadata(file) {
  return {
    name: valueOrNull(file.name),
    size_bytes: valueOrNull(file.size),
    mime_type: valueOrNull(file.type),
    last_modified: valueOrNull(file.lastModified)
  };
}

function getDefaultBrowserAPI() {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  return {
    createElement: (tagName) => document.createElement(tagName),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url)
  };
}

function readVideoMetadata(file, browserAPI) {
  return new Promise((resolve) => {
    if (
      !browserAPI ||
      typeof browserAPI.createElement !== 'function' ||
      typeof browserAPI.createObjectURL !== 'function' ||
      typeof browserAPI.revokeObjectURL !== 'function'
    ) {
      resolve({
        video: {
          duration_seconds: null,
          width: null,
          height: null
        },
        error: {
          code: 'BROWSER_API_NOT_AVAILABLE',
          stage: 'video_metadata_read',
          message: 'Browser metadata APIs are unavailable'
        }
      });
      return;
    }

    let videoElement;
    let objectUrl;
    let settled = false;
    let revoked = false;

    const revokeOnce = () => {
      if (!revoked && objectUrl !== undefined) {
        revoked = true;
        browserAPI.revokeObjectURL(objectUrl);
      }
    };

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        revokeOnce();
      } finally {
        resolve(result);
      }
    };

    try {
      videoElement = browserAPI.createElement('video');
      objectUrl = browserAPI.createObjectURL(file);
      videoElement.preload = 'metadata';

      videoElement.onloadedmetadata = () => {
        finish({
          video: {
            duration_seconds: valueOrNull(videoElement.duration),
            width: valueOrNull(videoElement.videoWidth),
            height: valueOrNull(videoElement.videoHeight)
          }
        });
      };

      videoElement.onerror = () => {
        finish({
          video: {
            duration_seconds: null,
            width: null,
            height: null
          },
          error: {
            code: 'VIDEO_METADATA_READ_FAILED',
            stage: 'video_metadata_read',
            message: 'Unable to read video metadata from selected file'
          }
        });
      };

      videoElement.src = objectUrl;
    } catch (error) {
      finish({
        video: {
          duration_seconds: null,
          width: null,
          height: null
        },
        error: {
          code: 'VIDEO_METADATA_READ_EXCEPTION',
          stage: 'video_metadata_read',
          message: error && error.message ? error.message : 'Unexpected metadata read exception'
        }
      });
    }
  });
}

async function adaptVideoFile(file, injectedBrowserAPI) {
  const {
    buildEvidenceBundle,
    createGovernanceContext,
    ExtractionStatus,
    createExtractionError
  } = resolveEvidenceBundleAPI();

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

  const browserAPI = injectedBrowserAPI || getDefaultBrowserAPI();
  const fileMetadata = extractFileMetadata(file);
  const metadataResult = await readVideoMetadata(file, browserAPI);
  const extractionErrors = metadataResult.error
    ? [
        createExtractionError(
          metadataResult.error.code,
          metadataResult.error.stage,
          metadataResult.error.message
        )
      ]
    : [];

  const bundle = buildEvidenceBundle({
    file: fileMetadata,
    video: metadataResult.video,
    extraction_status: metadataResult.error ? ExtractionStatus.FAILED : ExtractionStatus.COMPLETE,
    extraction_errors: extractionErrors
  });

  return {
    bundle,
    governanceContext: createGovernanceContext(bundle)
  };
}

const api = {
  adaptVideoFile,
  isSupportedVideoType,
  extractFileMetadata,
  readVideoMetadata,
  getDefaultBrowserAPI
};

if (typeof globalThis !== 'undefined') {
  globalThis.RealityCheckVideoAdapter = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
