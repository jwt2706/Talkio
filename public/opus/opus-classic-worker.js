/* public/opus/opus-classic-worker.js */

self.OPUS_SCRIPT_LOCATION = "/opus/"; // MUST end with /

function safeImport(url) {
  try {
    importScripts(url);
    return true;
  } catch (e) {
    self.postMessage({
      type: "error",
      message: `importScripts failed: ${url} :: ${e?.message || e}`,
    });
    return false;
  }
}

safeImport("/opus/libopus-encoder.wasm.js");
safeImport("/opus/libopus-decoder.wasm.js");

(function debugGlobals() {
  const keys = Object.keys(self);
  const opusLike = keys.filter(
    (k) => k.toLowerCase().includes("opus") || k.toLowerCase().includes("ogg")
  );
  self.postMessage({
    type: "debug_opus_globals",
    opusLike,
    sample: opusLike.slice(0, 40),
  });
})();

let EncLib = null;
let DecLib = null;

let encoderPtr = 0;
let decoderPtr = 0;

let sampleRate = 16000;
let channels = 1;
let frameSize = 320; // 20ms @ 16k mono

const OPUS_APPLICATION_VOIP = 2048;

// -------- helpers --------

function waitUntilReady(lib) {
  return new Promise((resolve, reject) => {
    try {
      if (!lib) {
        reject(new Error("lib is null"));
        return;
      }

      // already ready
      if (lib.calledRun || lib.isReady) {
        resolve();
        return;
      }

      const done = () => resolve();

      // emscripten runtime callback
      lib.onRuntimeInitialized = done;
      lib.onready = done;

      // some builds need explicit run()
      if (typeof lib.run === "function") {
        try {
          lib.run();
        } catch (_) {
          // ignore; maybe auto-runs
        }
      }

      // fallback timeout
      setTimeout(() => {
        if (lib.calledRun || lib.isReady) resolve();
        else reject(new Error("WASM runtime not ready"));
      }, 3000);
    } catch (err) {
      reject(err);
    }
  });
}

function writeFloat32ToHeap(lib, float32) {
  const bytes = float32.length * 4;
  const ptr = lib._malloc(bytes);
  lib.HEAPF32.set(float32, ptr >> 2);
  return ptr;
}

function allocU8(lib, size) {
  return lib._malloc(size);
}

function readU8FromHeap(lib, ptr, len) {
  const out = new Uint8Array(len);
  out.set(lib.HEAPU8.subarray(ptr, ptr + len));
  return out;
}

function allocI32(lib, value = 0) {
  const ptr = lib._malloc(4);
  lib.HEAP32[ptr >> 2] = value;
  return ptr;
}

function freeIf(lib, ptr) {
  if (lib && ptr) {
    try {
      lib._free(ptr);
    } catch (_) {}
  }
}

function createEncoder(lib, sr, ch) {
  const errPtr = allocI32(lib, 0);
  const ptr = lib._opus_encoder_create(sr, ch, OPUS_APPLICATION_VOIP, errPtr);
  const err = lib.HEAP32[errPtr >> 2];
  freeIf(lib, errPtr);

  if (!ptr || err !== 0) {
    throw new Error(`_opus_encoder_create failed, err=${err}, ptr=${ptr}`);
  }
  return ptr;
}

function createDecoder(lib, sr, ch) {
  const errPtr = allocI32(lib, 0);
  const ptr = lib._opus_decoder_create(sr, ch, errPtr);
  const err = lib.HEAP32[errPtr >> 2];
  freeIf(lib, errPtr);

  if (!ptr || err !== 0) {
    throw new Error(`_opus_decoder_create failed, err=${err}, ptr=${ptr}`);
  }
  return ptr;
}

// -------- worker API --------

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "init") {
    sampleRate = msg.sampleRate ?? sampleRate;
    channels = msg.channels ?? channels;
    frameSize = msg.frameSize ?? frameSize;

    EncLib = self.OpusEncoderLib;
    DecLib = self.OpusDecoderLib;

    if (!EncLib || !DecLib) {
      self.postMessage({
        type: "error",
        message:
          "OpusEncoderLib/OpusDecoderLib not found. Check /public/opus files and OPUS_SCRIPT_LOCATION.",
      });
      return;
    }

    try {
      await waitUntilReady(EncLib);
      await waitUntilReady(DecLib);

      encoderPtr = createEncoder(EncLib, sampleRate, channels);
      decoderPtr = createDecoder(DecLib, sampleRate, channels);

      self.postMessage({
        type: "inited",
        encType: "low-level-wasm",
        decType: "low-level-wasm",
        encoderPtr,
        decoderPtr,
      });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: `Init failed: ${err?.message || err}`,
      });
    }
    return;
  }

  if (msg.type === "encode") {
    if (!EncLib || !encoderPtr) {
      self.postMessage({ type: "error", message: "Encoder not initialized" });
      return;
    }

    let pcmPtr = 0;
    let outPtr = 0;

    try {
      const pcm = msg.pcm; // Float32Array of length 320
      if (!(pcm instanceof Float32Array)) {
        throw new Error("encode expects Float32Array pcm");
      }

      pcmPtr = writeFloat32ToHeap(EncLib, pcm);

      // max packet size for opus voice is usually small; 400 bytes is safe for 20ms speech
      const maxPacketBytes = 400;
      outPtr = allocU8(EncLib, maxPacketBytes);

      const encodedLen = EncLib._opus_encode_float(
        encoderPtr,
        pcmPtr,
        frameSize,
        outPtr,
        maxPacketBytes
      );

      if (encodedLen < 0) {
        throw new Error(`_opus_encode_float failed with code ${encodedLen}`);
      }

      const opus = readU8FromHeap(EncLib, outPtr, encodedLen);
      self.postMessage({ type: "encoded", id: msg.id, opus }, [opus.buffer]);
    } catch (err) {
      self.postMessage({
        type: "error",
        message: `Encode failed: ${err?.message || err}`,
      });
    } finally {
      freeIf(EncLib, pcmPtr);
      freeIf(EncLib, outPtr);
    }
    return;
  }

  if (msg.type === "decode") {
    if (!DecLib || !decoderPtr) {
      self.postMessage({ type: "error", message: "Decoder not initialized" });
      return;
    }

    let inPtr = 0;
    let outPtr = 0;

    try {
      const opus = msg.opus; // Uint8Array
      if (!(opus instanceof Uint8Array)) {
        throw new Error("decode expects Uint8Array opus");
      }

      inPtr = allocU8(DecLib, opus.length);
      DecLib.HEAPU8.set(opus, inPtr);

      const outSamples = frameSize * channels;
      outPtr = DecLib._malloc(outSamples * 4); // float32 output

      const decodedSamplesPerChannel = DecLib._opus_decode_float(
        decoderPtr,
        inPtr,
        opus.length,
        outPtr,
        frameSize,
        0 // decode_fec = false
      );

      if (decodedSamplesPerChannel < 0) {
        throw new Error(`_opus_decode_float failed with code ${decodedSamplesPerChannel}`);
      }

      const totalSamples = decodedSamplesPerChannel * channels;
      const pcm = new Float32Array(totalSamples);
      pcm.set(
        DecLib.HEAPF32.subarray(outPtr >> 2, (outPtr >> 2) + totalSamples)
      );

      self.postMessage({ type: "decoded", id: msg.id, pcm }, [pcm.buffer]);
    } catch (err) {
      self.postMessage({
        type: "error",
        message: `Decode failed: ${err?.message || err}`,
      });
    } finally {
      freeIf(DecLib, inPtr);
      freeIf(DecLib, outPtr);
    }
    return;
  }

  if (msg.type === "plc") {
    if (!DecLib || !decoderPtr) {
      self.postMessage({ type: "error", message: "Decoder not initialized" });
      return;
    }

    let outPtr = 0;

    try {
      const outSamples = frameSize * channels;
      outPtr = DecLib._malloc(outSamples * 4);

      const decodedSamplesPerChannel = DecLib._opus_decode_float(
        decoderPtr,
        0,    // null packet
        0,    // len = 0
        outPtr,
        frameSize,
        0
      );

      let pcm;
      if (decodedSamplesPerChannel < 0) {
        pcm = new Float32Array(frameSize * channels);
      } else {
        const totalSamples = decodedSamplesPerChannel * channels;
        pcm = new Float32Array(totalSamples);
        pcm.set(
          DecLib.HEAPF32.subarray(outPtr >> 2, (outPtr >> 2) + totalSamples)
        );
      }

      self.postMessage({ type: "decoded", id: msg.id, pcm }, [pcm.buffer]);
    } catch (_) {
      const pcm = new Float32Array(frameSize * channels);
      self.postMessage({ type: "decoded", id: msg.id, pcm }, [pcm.buffer]);
    } finally {
      freeIf(DecLib, outPtr);
    }
  }
};

// Clean up if worker is closed
self.addEventListener("close", () => {
  try {
    if (EncLib && encoderPtr) EncLib._opus_encoder_destroy(encoderPtr);
  } catch (_) {}
  try {
    if (DecLib && decoderPtr) DecLib._opus_decoder_destroy(decoderPtr);
  } catch (_) {}
  encoderPtr = 0;
  decoderPtr = 0;
});