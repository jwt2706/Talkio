/* eslint-disable no-restricted-globals */
// Opus encode/decode in Worker
import { OpusEncoder, OpusDecoder } from "opus-encdec"; // from opus-encdec :contentReference[oaicite:4]{index=4}

let encoder = null;
let decoder = null;

let sampleRate = 16000;
let channels = 1;
let frameSize = 320; // 20ms @ 16k
let bitrate = 12000;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "init") {
    sampleRate = msg.sampleRate ?? sampleRate;
    channels = msg.channels ?? channels;
    frameSize = msg.frameSize ?? frameSize;
    bitrate = msg.bitrate ?? bitrate;

    // API may differ slightly depending on version; adjust if needed.
    encoder = new OpusEncoder(sampleRate, channels, { bitrate });
    decoder = new OpusDecoder(sampleRate, channels);

    self.postMessage({ type: "inited" });
    return;
  }

  if (msg.type === "set") {
    if (msg.bitrate && encoder?.setBitrate) encoder.setBitrate(msg.bitrate);
    self.postMessage({ type: "ok" });
    return;
  }

  if (msg.type === "encode") {
    // pcm: Float32Array length = frameSize
    const pcm = msg.pcm; // Float32Array
    const opus = encoder.encode(pcm); // Uint8Array
    self.postMessage({ type: "encoded", id: msg.id, opus }, [opus.buffer]);
    return;
  }

  if (msg.type === "decode") {
    const opus = msg.opus; // Uint8Array
    const pcm = decoder.decode(opus); // Float32Array length = frameSize
    self.postMessage({ type: "decoded", id: msg.id, pcm }, [pcm.buffer]);
    return;
  }

  if (msg.type === "plc") {
    // If library supports PLC: decode(null) or a dedicated method.
    // Fallback: output silence.
    let pcm = null;
    if (decoder?.decode) {
      try {
        pcm = decoder.decode(null);
      } catch {
        pcm = new Float32Array(frameSize);
      }
    } else {
      pcm = new Float32Array(frameSize);
    }
    self.postMessage({ type: "decoded", id: msg.id, pcm }, [pcm.buffer]);
  }
};