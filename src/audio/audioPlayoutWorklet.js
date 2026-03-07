class PlayoutProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.readIndex = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "push") {
        // msg.pcm is Float32Array frame
        this.queue.push(msg.pcm);
      } else if (msg.type === "reset") {
        this.queue = [];
        this.readIndex = 0;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const ch0 = output[0];
    ch0.fill(0);

    let outOffset = 0;
    while (outOffset < ch0.length) {
      if (this.queue.length === 0) break;

      const cur = this.queue[0];
      const remain = cur.length - this.readIndex;
      const need = ch0.length - outOffset;
      const take = Math.min(remain, need);

      ch0.set(cur.subarray(this.readIndex, this.readIndex + take), outOffset);

      this.readIndex += take;
      outOffset += take;

      if (this.readIndex >= cur.length) {
        this.queue.shift();
        this.readIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("playout-processor", PlayoutProcessor);