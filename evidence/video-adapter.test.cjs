'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  adaptVideoFile,
  readVideoMetadata
} = require('./video-adapter.cjs');

const {
  CoverageStatus,
  ExtractionStatus,
  getEvidenceState
} = require('./evidence-bundle.cjs');

function createMockVideoFile(overrides = {}) {
  return {
    name: 'sample.mp4',
    size: 5_000_000,
    type: 'video/mp4',
    lastModified: 1_700_000_000_000,
    ...overrides
  };
}

function createSuccessBrowserAPI(metadata = {}) {
  let revokeCount = 0;
  const api = {
    createElement(tagName) {
      assert.equal(tagName, 'video');
      const video = {
        preload: '',
        onloadedmetadata: null,
        onerror: null,
        duration: metadata.duration_seconds ?? 12.5,
        videoWidth: metadata.width ?? 1920,
        videoHeight: metadata.height ?? 1080
      };

      Object.defineProperty(video, 'src', {
        set() {
          queueMicrotask(() => {
            if (typeof video.onloadedmetadata === 'function') {
              video.onloadedmetadata();
            }
          });
        }
      });

      return video;
    },
    createObjectURL() {
      return 'blob:success';
    },
    revokeObjectURL() {
      revokeCount += 1;
    },
    getRevokeCount() {
      return revokeCount;
    }
  };
  return api;
}

function createFailureBrowserAPI(code = 'VIDEO_METADATA_READ_FAILED') {
  let revokeCount = 0;
  const api = {
    createElement() {
      const video = {
        preload: '',
        onloadedmetadata: null,
        onerror: null
      };

      Object.defineProperty(video, 'src', {
        set() {
          queueMicrotask(() => {
            if (typeof video.onerror === 'function') {
              video.onerror(new Error(code));
            }
          });
        }
      });

      return video;
    },
    createObjectURL() {
      return 'blob:failure';
    },
    revokeObjectURL() {
      revokeCount += 1;
    },
    getRevokeCount() {
      return revokeCount;
    }
  };
  return api;
}

/* T01 */
test('T01 valid video metadata', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI({ duration_seconds: 60, width: 1280, height: 720 });

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.schema_version, 'rc-evidence-0.1');
  assert.equal(result.bundle.coverage.file_metadata, CoverageStatus.CHECKED);
  assert.equal(result.bundle.coverage.video_metadata, CoverageStatus.CHECKED);
  assert.equal(result.bundle.extraction.status, ExtractionStatus.COMPLETE);
  assert.equal(result.bundle.video.duration_seconds, 60);
  assert.equal(result.bundle.video.width, 1280);
  assert.equal(result.bundle.video.height, 720);
  assert.equal(result.governanceContext.evidence_state, 'INCONCLUSIVE');
});

/* T02 */
test('T02 unsupported input', async () => {
  const file = createMockVideoFile({ type: 'image/jpeg', name: 'img.jpg' });
  const browserAPI = createSuccessBrowserAPI();

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.extraction.status, ExtractionStatus.REJECTED);
  assert.equal(result.governanceContext, null);
  assert.equal(result.bundle.extraction.errors[0].code, 'UNSUPPORTED_INPUT');
});

/* T03 */
test('T03 metadata read failure', async () => {
  const file = createMockVideoFile();
  const browserAPI = createFailureBrowserAPI();

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.coverage.video_metadata, CoverageStatus.FAILED);
  assert.equal(result.bundle.extraction.status, ExtractionStatus.FAILED);
  assert.equal(result.bundle.extraction.errors.some((e) => e.stage === 'video_metadata_read'), true);
  assert.equal(getEvidenceState(result.bundle), 'ANALYSIS_FAILED');
});

/* T04 */
test('T04 invalid numeric metadata', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI({ duration_seconds: NaN, width: 1280, height: null });

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.coverage.video_metadata, CoverageStatus.PARTIAL);
  assert.notEqual(result.bundle.coverage.video_metadata, CoverageStatus.CHECKED);
  const videoObservation = result.bundle.observations.find((obs) => obs.class === 'VIDEO_METADATA');
  assert.deepEqual(videoObservation.fields, { width: 1280 });
  assert.equal(result.bundle.extraction.errors.some((e) => e.code === 'VIDEO_METADATA_VALIDATION_FAILED'), true);
});

/* T05 */
test('T05 unsupported capability isolation', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI();

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.coverage.provenance, CoverageStatus.NOT_SUPPORTED);
  assert.equal(result.bundle.coverage.ai_watermark, CoverageStatus.NOT_SUPPORTED);
  assert.equal(result.bundle.coverage.visual_ai_signal, CoverageStatus.NOT_SUPPORTED);
  assert.equal(result.bundle.coverage.audio_ai_signal, CoverageStatus.NOT_SUPPORTED);
});

/* T06 */
test('T06 raw file not serialized', async () => {
  const file = createMockVideoFile({ bytes: Buffer.from('abc') });
  const browserAPI = createSuccessBrowserAPI();

  const result = await adaptVideoFile(file, browserAPI);
  const serialized = JSON.stringify(result.bundle);

  assert.equal(serialized.includes('bytes'), false);
  assert.equal(serialized.includes('blob:'), false);
  assert.equal(serialized.includes('ArrayBuffer'), false);
});

/* T07 */
test('T07 local-only/no-network invariant', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI();

  let fetchCalled = false;
  let xhrUsed = false;
  const originalFetch = global.fetch;
  const originalXHR = global.XMLHttpRequest;

  global.fetch = () => {
    fetchCalled = true;
    throw new Error('Unexpected fetch');
  };
  global.XMLHttpRequest = function XMLHttpRequestMock() {
    xhrUsed = true;
  };

  try {
    const result = await adaptVideoFile(file, browserAPI);
    assert.equal(result.bundle.source.processing_location, 'local_device');
    assert.equal(fetchCalled, false);
    assert.equal(xhrUsed, false);
  } finally {
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXHR;
  }

  const adapterSource = fs.readFileSync(path.resolve(__dirname, 'video-adapter.js'), 'utf8');
  assert.equal(adapterSource.includes('fetch('), false);
  assert.equal(adapterSource.includes('XMLHttpRequest'), false);
  assert.equal(adapterSource.includes('http://'), false);
  assert.equal(adapterSource.includes('https://'), false);
});

/* T08 */
test('T08 failure never becomes authentic/safe/not-AI/real', async () => {
  const file = createMockVideoFile();
  const browserAPI = createFailureBrowserAPI();

  const result = await adaptVideoFile(file, browserAPI);
  const serialized = JSON.stringify(result.bundle).toLowerCase();

  assert.equal(getEvidenceState(result.bundle), 'ANALYSIS_FAILED');
  assert.equal(serialized.includes('authentic'), false);
  assert.equal(serialized.includes('safe'), false);
  assert.equal(serialized.includes('not-ai'), false);
  assert.equal(serialized.includes('real'), false);
});

/* T09 */
test('T09 deterministic normalization', async () => {
  const file = createMockVideoFile();
  const browserAPI1 = createSuccessBrowserAPI({ duration_seconds: 30, width: 640, height: 360 });
  const browserAPI2 = createSuccessBrowserAPI({ duration_seconds: 30, width: 640, height: 360 });

  const result1 = await adaptVideoFile(file, browserAPI1);
  const result2 = await adaptVideoFile(file, browserAPI2);

  assert.deepEqual(result1.bundle, result2.bundle);
});

/* T10 */
test('T10 governance-ready mapping to INCONCLUSIVE', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI();

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.governanceContext.evidence_state, 'INCONCLUSIVE');
  assert.equal(Array.isArray(result.governanceContext.evidence), true);
  assert.equal(result.governanceContext.evidence.length, 2);
});

test('zero-valued fields are preserved', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI({ duration_seconds: 0, width: 0, height: 0 });

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.video.duration_seconds, 0);
  assert.equal(result.bundle.video.width, 0);
  assert.equal(result.bundle.video.height, 0);
  assert.equal(result.bundle.coverage.video_metadata, CoverageStatus.CHECKED);
});

test('partial metadata remains PARTIAL, not CHECKED', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI({ duration_seconds: 0, width: 1280, height: undefined });

  const result = await adaptVideoFile(file, browserAPI);

  assert.equal(result.bundle.coverage.video_metadata, CoverageStatus.PARTIAL);
  assert.notEqual(result.bundle.coverage.video_metadata, CoverageStatus.CHECKED);
});

test('revokeObjectURL called exactly once on metadata success path', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI({ duration_seconds: 9, width: 320, height: 240 });

  const metadata = await readVideoMetadata(file, browserAPI);

  assert.equal(metadata.error, undefined);
  assert.equal(browserAPI.getRevokeCount(), 1);
});

test('revokeObjectURL called exactly once on metadata failure path', async () => {
  const file = createMockVideoFile();
  const browserAPI = createFailureBrowserAPI();

  const metadata = await readVideoMetadata(file, browserAPI);

  assert.equal(metadata.error.code, 'VIDEO_METADATA_READ_FAILED');
  assert.equal(browserAPI.getRevokeCount(), 1);
});

test('dependency injection works without DOM globals', async () => {
  const file = createMockVideoFile();
  const browserAPI = createSuccessBrowserAPI({ duration_seconds: 5, width: 100, height: 50 });

  const originalDocument = global.document;
  const originalURL = global.URL;
  delete global.document;
  delete global.URL;

  try {
    const result = await adaptVideoFile(file, browserAPI);
    assert.equal(result.bundle.coverage.video_metadata, CoverageStatus.CHECKED);
  } finally {
    if (originalDocument !== undefined) {
      global.document = originalDocument;
    }
    if (originalURL !== undefined) {
      global.URL = originalURL;
    }
  }
});
