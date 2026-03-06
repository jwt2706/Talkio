export class JitterBuffer {
  constructor({
    frameMs = 20,
    targetMs = 60,
    maxMs = 220,
    dropLateMs = 1000,
  } = {}) {
    this.frameMs = frameMs;
    this.targetMs = targetMs;
    this.maxMs = maxMs;
    this.dropLateMs = dropLateMs;

    this.map = new Map(); // tsSamples -> packet
    this.baseTs = null;
    this.expectedTs = null;
    this.frameSamples = 320;
    this.missCount = 0;
  }

  reset() {
    this.map.clear();
    this.baseTs = null;
    this.expectedTs = null;
    this.missCount = 0;
  }

  push(pkt) {
    const now = Date.now() >>> 0;
    const age = (now - (pkt.sendTimeMs >>> 0)) >>> 0;

    // Optional late drop
    if (age > this.dropLateMs) return;

    this.frameSamples = pkt.frameSamples || this.frameSamples;

    // Insert packet
    this.map.set(pkt.tsSamples >>> 0, pkt);

    // Keep map bounded by count, not by baseTs math
    const maxFrames = Math.max(4, Math.round(this.maxMs / this.frameMs));
    if (this.map.size > maxFrames) {
      const sorted = [...this.map.keys()].sort((a, b) => a - b);
      while (sorted.length > maxFrames) {
        const oldest = sorted.shift();
        this.map.delete(oldest);
      }
    }
  }

  _enoughToStart() {
    const needFrames = Math.max(1, Math.round(this.targetMs / this.frameMs));
    return this.map.size >= needFrames;
  }

  _startIfNeeded() {
    if (this.baseTs !== null) return true;
    if (!this._enoughToStart()) return false;

    const sorted = [...this.map.keys()].sort((a, b) => a - b);
    this.baseTs = sorted[0];
    this.expectedTs = this.baseTs;
    this.missCount = 0;
    return true;
  }

  popNext() {
    if (!this._startIfNeeded()) {
      return { kind: "WAIT" };
    }

    const expected = this.expectedTs >>> 0;
    const pkt = this.map.get(expected) || null;

    if (pkt) {
      this.map.delete(expected);
      this.expectedTs = (expected + this.frameSamples) >>> 0;
      this.missCount = 0;
      return { kind: "PKT", pkt };
    }

    const sorted = [...this.map.keys()].sort((a, b) => a - b);

    // ✅ Nếu buffer trống hẳn thì đừng PLC mãi
    if (sorted.length === 0) {
      this.missCount += 1;

      // chỉ PLC tối đa vài frame ngắn rồi chuyển về WAIT
      if (this.missCount <= 2) {
        this.expectedTs = (expected + this.frameSamples) >>> 0;
        return { kind: "PLC" };
      }

      // coi như talkspurt kết thúc / hết dữ liệu
      this.baseTs = null;
      this.expectedTs = null;
      this.missCount = 0;
      return { kind: "WAIT" };
    }

    const earliest = sorted[0] >>> 0;
    const gap = ((earliest - expected) >>> 0);

    // ✅ Nếu lệch nhiều hoặc miss liên tiếp, resync sang packet thật
    if (gap > this.frameSamples * 2 || this.missCount >= 2) {
      this.expectedTs = earliest;
      this.missCount = 0;

      const pkt2 = this.map.get(earliest);
      if (pkt2) {
        this.map.delete(earliest);
        this.expectedTs = (earliest + this.frameSamples) >>> 0;
        return { kind: "PKT", pkt: pkt2 };
      }
    }

    // ✅ chỉ PLC cho khoảng mất gói ngắn
    this.expectedTs = (expected + this.frameSamples) >>> 0;
    this.missCount += 1;
    return { kind: "PLC" };
  }
}