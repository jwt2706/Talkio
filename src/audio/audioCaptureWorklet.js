class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._target = 320; // 20ms @ 16k
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // input[0] = Float32Array chunk (typically 128 samples)
    this._buffer.push(input[0].slice());

    // flatten when enough
    let total = 0;
    for (const c of this._buffer) total += c.length;

    while (total >= this._target) {
      const frame = new Float32Array(this._target);
      let offset = 0;

      while (offset < this._target) {
        const head = this._buffer[0];
        const take = Math.min(head.length, this._target - offset);
        frame.set(head.subarray(0, take), offset);

        if (take === head.length) this._buffer.shift();
        else this._buffer[0] = head.subarray(take);

        offset += take;
      }

      // send PCM frame to main thread
      this.port.postMessage({ type: "frame", frame }, [frame.buffer]);

      // recompute total
      total = 0;
      for (const c of this._buffer) total += c.length;
    }

    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);