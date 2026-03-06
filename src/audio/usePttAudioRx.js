import { useEffect, useRef } from "react";
import { unpackPacket } from "./rtpPacket";
import { JitterBuffer } from "./jitterBuffer";

export function usePttAudioRx({ mqttClient, channelId, mySsrc = null }) {
  const audioCtxRef = useRef(null);
  const playoutNodeRef = useRef(null);
  const workerRef = useRef(null);

  const jbMapRef = useRef(new Map());
  const workerReadyRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!mqttClient) return;

    runIdRef.current += 1;
    const myRunId = runIdRef.current;

    let cancelled = false;
    const topic = `skytrac/rtp/${channelId}`;

    async function stop() {
      workerReadyRef.current = false;

      try {
        playoutNodeRef.current?.disconnect();
      } catch {}

      try {
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close().catch(() => {});
        }
      } catch {}

      try {
        workerRef.current?.terminate();
      } catch {}

      playoutNodeRef.current = null;
      audioCtxRef.current = null;
      workerRef.current = null;
      jbMapRef.current.clear();
    }

    async function startAudio() {
      try {
        const ac = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ac;

        await ac.resume();

        if (runIdRef.current !== myRunId) {
          await stop();
          return;
        }

        await ac.audioWorklet.addModule(
          new URL("./audioPlayoutWorklet.js", import.meta.url)
        );

        if (runIdRef.current !== myRunId || ac.state === "closed") {
          await stop();
          return;
        }

        const playout = new AudioWorkletNode(ac, "playout-processor");
        playout.connect(ac.destination);
        playoutNodeRef.current = playout;

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

        // Decode callback: push PCM to playout worklet
        w.onmessage = (e) => {
          if (runIdRef.current !== myRunId) return;

          const msg = e.data;

          if (msg.type === "debug_opus_globals") {
            console.log("[OpusWorker RX globals FULL]", msg);
            return;
          }

          if (msg.type === "inited") {
            workerReadyRef.current = true;
            console.log("[OpusWorker RX inited FULL]", msg);
            return;
          }

          if (msg.type === "error") {
            console.error("[OpusWorker RX error FULL]", msg);
            return;
          }

          if (msg.type === "decoded") {
            // msg.pcm should be Float32Array
            console.log("[RX] decoded pcm", msg.pcm.length);
            playout.port.postMessage(
              { type: "push", pcm: msg.pcm },
              [msg.pcm.buffer]
            );
          }
        };

        // Playout scheduler: every 20ms pop jitter buffers
        const interval = setInterval(() => {
          if (cancelled) return;
          if (!workerReadyRef.current) return;

          for (const [ssrc, jb] of jbMapRef.current.entries()) {
            const now = Date.now();
            if ((jb.lastPushAt && now - jb.lastPushAt > 3000)) {
              console.log("[RX] removing stale jitter buffer", ssrc >>> 0);
              jbMapRef.current.delete(ssrc);
              continue;
            }
            const res = jb.popNext();
            console.log("[RX] jitter result", {
              ssrc,
              kind: res.kind,
              buffered: jb.map?.size,
            });

            if (res.kind === "WAIT") {
              continue;
            }

            if (res.kind === "PKT") {
              console.log("[RX] REAL packet decode", res.pkt.seq);
              // console.log("[RX] decode packet from", ssrc, "seq=", res.pkt.seq);
              workerRef.current?.postMessage(
                {
                  type: "decode",
                  id: (Math.random() * 1e9) | 0,
                  opus: res.pkt.opus,
                },
                [res.pkt.opus.buffer]
              );
            } else if (res.kind === "PLC") {
              // console.log("[RX] PLC for", ssrc);
              workerRef.current?.postMessage({
                type: "plc",
                id: (Math.random() * 1e9) | 0,
              });
            }
          }
        }, 20);

        // MQTT subscribe
        mqttClient.subscribe(topic);
        console.log("[RX] subscribed to", topic);

        const onMessage = (t, payload) => {
          console.log("[RX] raw mqtt message", t, payload?.byteLength || payload?.length);
          if (cancelled) return;
          if (t !== topic) return;

          const raw = new Uint8Array(payload);
          const pkt = unpackPacket(raw);
          console.log("[RX] parsed packet", { 
            ssrc: pkt.ssrc >>> 0,
            seq: pkt.seq,
            ts: pkt.tsSamples,
          });

          if (!pkt) {
            console.error("[RX] unpackPacket FAILED", {
              rawBytes: raw.byteLength,
              firstBytes: Array.from(raw.slice(0, 24)),
            });
            return;
          }

          console.log("[RX] packet parsed", {
            ssrc: pkt.ssrc,
            seq: pkt.seq,
            tsSamples: pkt.tsSamples,
            opusBytes: pkt.opus?.length,
            flags: pkt.flags,
          });

          // Optional: ignore self-loop if needed
          if (mySsrc !== null && pkt.ssrc === mySsrc) {
            return;
          }

          // console.log("[RX] packet received", {
          //   ssrc: pkt.ssrc,
          //   seq: pkt.seq,
          //   tsSamples: pkt.tsSamples,
          //   opusBytes: pkt.opus?.length,
          // });

          let jb = jbMapRef.current.get(pkt.ssrc);
          if (!jb) {
            jb = new JitterBuffer({
              targetMs: 120,
              maxMs: 220,
              dropLateMs: 1000,
            });
            jbMapRef.current.set(pkt.ssrc, jb);
          }
          if (
            jb.expectedTs !== null &&
            ((pkt.tsSamples - jb.expectedTs) >>> 0) > 0x80000000
          ) {
            console.warn("[RX] timestamp went backwards, resetting jitter buffer", {
              ssrc: pkt.ssrc >>> 0,
              pktTs: pkt.tsSamples,
              expectedTs: jb.expectedTs,
            });
            jb.reset();
          }

          jb.push(pkt);
          console.log("[RX] pushed to jitter", {
            ssrc: pkt.ssrc,
            seq: pkt.seq,
            mapSize: jb.map?.size,
          });
          jb.lastPushAt = Date.now();
        };

        mqttClient.on("message", onMessage);

        return () => {
          clearInterval(interval);
          mqttClient.unsubscribe(topic);
          mqttClient.removeListener("message", onMessage);
        };
      } catch (err) {
        console.error("[usePttAudioRx startAudio error]", err);
        await stop();
      }
    }

    let cleanup = null;

    startAudio()
      .then((c) => {
        cleanup = c;
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      runIdRef.current += 1;

      try {
        cleanup?.();
      } catch {}

      stop();
    };
  }, [mqttClient, channelId, mySsrc]);
}