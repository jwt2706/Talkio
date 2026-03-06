import { useEffect, useRef } from "react";
import { packPacket, FLAGS } from "./rtpPacket";

export function usePttAudioTx({ mqttClient, channelId, talking, ssrc }) {
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const workerRef = useRef(null);
  const streamRef = useRef(null);

  const seqRef = useRef(0);
  const tsRef = useRef(0);
  const prevOpusRef = useRef(null);

  const runIdRef = useRef(0);
  const runningRef = useRef(false);
  const workerReadyRef = useRef(false);

  useEffect(() => {
    runIdRef.current += 1;
    const myRunId = runIdRef.current;

    async function stop() {
      workerReadyRef.current = false;
      runningRef.current = false;

      try {
        workletNodeRef.current?.disconnect();
      } catch {}

      try {
        workerRef.current?.terminate();
      } catch {}

      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}

      try {
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close().catch(() => {});
        }
      } catch {}

      workletNodeRef.current = null;
      workerRef.current = null;
      streamRef.current = null;
      audioCtxRef.current = null;

      prevOpusRef.current = null;
      //seqRef.current = 0;
      //tsRef.current = 0;
    }

    async function start() {
      // Avoid duplicate starts (React StrictMode can mount/unmount twice)
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        // 1) Create context
        const ac = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ac;

        // 2) Must resume (especially important on Chrome/Electron)
        // If this throws, we should stop.
        await ac.resume();

        // If this run is stale, abort
        if (runIdRef.current !== myRunId) {
          await stop();
          return;
        }

        // 3) Load worklet module, then create node
        await ac.audioWorklet.addModule(
          new URL("./audioCaptureWorklet.js", import.meta.url)
        );

        if (runIdRef.current !== myRunId || ac.state === "closed") {
          await stop();
          return;
        }

        const node = new AudioWorkletNode(ac, "capture-processor");
        workletNodeRef.current = node;

        // 4) Get mic stream and connect
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        if (runIdRef.current !== myRunId || ac.state === "closed") {
          await stop();
          return;
        }

        const src = ac.createMediaStreamSource(stream);
        src.connect(node);

        // 5) Opus classic worker (local)
        const w = new Worker("/opus/opus-classic-worker.js");
        workerRef.current = w;
        workerReadyRef.current = false;

        w.postMessage({
          type: "init",
          sampleRate: 16000,
          channels: 1,
          frameSize: 320,
          bitrate: 12000,
        });

        // 6) handle frames -> encode -> publish
        const pending = new Map();
        let nextId = 1;

        w.onmessage = (e) => {
          if (runIdRef.current !== myRunId) return;

          const msg = e.data;

          if (msg.type === "debug_opus_globals") {
            console.log("[OpusWorker globals FULL]", msg);
            return;
          }

          if (msg.type === "inited") {
            workerReadyRef.current = true;
            console.log("[OpusWorker inited FULL]", msg);
            return;
          }

          if (msg.type === "error") {
            console.error("[OpusWorker error FULL]", msg);
            return;
          }

          if (msg.type === "encoded") {
            console.log("encoding frame");
            const { id, opus } = msg;
            console.log("opus frame size:", opus.length);
            if (!pending.has(id)) return;
            pending.delete(id);

            const nowMs = Date.now() >>> 0;
            const seq = seqRef.current & 0xffff;
            seqRef.current = (seqRef.current + 1) & 0xffff;

            const tsSamples = tsRef.current >>> 0;
            tsRef.current = (tsRef.current + 320) >>> 0;

            const red = prevOpusRef.current;
            prevOpusRef.current = opus;

            const baseFlags = 0; // set if you implement DTX/FEC signals later
            const flags = red ? (baseFlags | FLAGS.REDUNDANT) : baseFlags;

            const pkt = packPacket({
              ssrc,
              seq,
              tsSamples,
              frameSamples: 320,
              sendTimeMs: nowMs,
              flags,
              opus,
              red,
            });

            const topic = `skytrac/rtp/${channelId}`;
            mqttClient?.publish(topic, pkt);
            console.log("[TX] publishing RTP", {
              topic,
              bytes: pkt.byteLength,
              seq,
              tsSamples,
              ssrc,
            });
          }
          if (msg.type === "inited") {
          workerReadyRef.current = true;
          console.log("[OpusWorker] inited with", msg.enc, msg.dec);
          return;
        }
        if (msg.type === "debug_opus_globals") {
          console.log("[OpusWorker globals]", msg);
          return;
        }
        };

        node.port.onmessage = (e) => {
          if (runIdRef.current !== myRunId) return;
          if (!workerReadyRef.current) return;

          const msg = e.data;
          if (msg.type === "frame") {
            const id = nextId++;
            pending.set(id, true);
            w.postMessage({ type: "encode", id, pcm: msg.frame }, [msg.frame.buffer]);
          }
        };
      } catch (err) {
        console.error("[usePttAudioTx start error]", err);
        // If anything fails, make sure we clean up
        await stop();
      }
    }

    // Start/stop based on talking
    if (talking) start();
    else stop();

    // cleanup for this effect run
    return () => {
      // Invalidate this run and stop resources
      runIdRef.current += 1;
      stop();
    };
  }, [talking, mqttClient, channelId, ssrc]);
}