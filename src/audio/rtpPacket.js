// RTP-like packet (very small, satellite-friendly)
// Header 24 bytes + payloads
export const HEADER_LEN = 24;

// flags bitmask
export const FLAGS = {
  FEC: 1 << 0,
  DTX: 1 << 1,
  REDUNDANT: 1 << 2,
};

export function packPacket({
  ssrc,           // uint32
  seq,            // uint16
  tsSamples,      // uint32 (sample clock)
  frameSamples,   // uint16 (e.g., 320)
  sendTimeMs,     // uint32 (Date.now()>>>0)
  flags,          // uint8
  opus,           // Uint8Array
  red = null,     // Uint8Array|null (optional redundant previous frame)
}) {
  const redLen = red ? red.length : 0;
  const opusLen = opus.length;

  const total = HEADER_LEN + opusLen + redLen;
  const out = new Uint8Array(total);

  // 0: version + cc (we keep it simple: 0x80)
  out[0] = 0x80;
  // 1: PT (111) + marker bit if needed (we keep marker in flags if you want later)
  out[1] = 111;

  // seq u16 BE
  out[2] = (seq >>> 8) & 0xff;
  out[3] = seq & 0xff;

  // tsSamples u32 BE
  out[4]  = (tsSamples >>> 24) & 0xff;
  out[5]  = (tsSamples >>> 16) & 0xff;
  out[6]  = (tsSamples >>> 8) & 0xff;
  out[7]  = tsSamples & 0xff;

  // ssrc u32 BE
  out[8]  = (ssrc >>> 24) & 0xff;
  out[9]  = (ssrc >>> 16) & 0xff;
  out[10] = (ssrc >>> 8) & 0xff;
  out[11] = ssrc & 0xff;

  // frameSamples u16
  out[12] = (frameSamples >>> 8) & 0xff;
  out[13] = frameSamples & 0xff;

  // flags u8
  out[14] = flags & 0xff;

  // redLen u16 + opusLen u16
  out[15] = (redLen >>> 8) & 0xff;
  out[16] = redLen & 0xff;

  out[17] = (opusLen >>> 8) & 0xff;
  out[18] = opusLen & 0xff;

  // sendTimeMs u32 BE
  out[19] = (sendTimeMs >>> 24) & 0xff;
  out[20] = (sendTimeMs >>> 16) & 0xff;
  out[21] = (sendTimeMs >>> 8) & 0xff;
  out[22] = sendTimeMs & 0xff;

  // reserved
  out[23] = 0;

  // payloads
  out.set(opus, HEADER_LEN);
  if (red) out.set(red, HEADER_LEN + opusLen);

  return out;
}

export function unpackPacket(u8) {
  if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
  if (u8.length < HEADER_LEN) return null;

  const seq = (u8[2] << 8) | u8[3];
  const tsSamples =
    ((u8[4] << 24) >>> 0) | (u8[5] << 16) | (u8[6] << 8) | u8[7];
  const ssrc =
    ((u8[8] << 24) >>> 0) | (u8[9] << 16) | (u8[10] << 8) | u8[11];
  const frameSamples = (u8[12] << 8) | u8[13];
  const flags = u8[14];

  const redLen = (u8[15] << 8) | u8[16];
  const opusLen = (u8[17] << 8) | u8[18];

  const sendTimeMs =
    ((u8[19] << 24) >>> 0) | (u8[20] << 16) | (u8[21] << 8) | u8[22];

  const payloadStart = HEADER_LEN;
  const opusStart = payloadStart;
  const opusEnd = opusStart + opusLen;
  const redEnd = opusEnd + redLen;

  if (redEnd > u8.length) return null;

  return {
    seq,
    tsSamples,
    ssrc,
    frameSamples,
    flags,
    sendTimeMs,
    opus: u8.slice(opusStart, opusEnd),
    red: redLen ? u8.slice(opusEnd, redEnd) : null,
  };
}