import React, { useEffect, useRef, useState } from "react";

export default function LiveWaveform() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);
  const streamRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // waveform resolution
      analyser.smoothingTimeConstant = 0.85; // smoother motion
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      dataRef.current = dataArray;

      setRunning(true);
      draw();
    } catch (e) {
      setError(e?.message || "Mic permission failed");
    }
  }

  function stop() {
    setRunning(false);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    analyserRef.current = null;
    dataRef.current = null;
  }

  function draw() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const dataArray = dataRef.current;
    if (!canvas || !analyser || !dataArray) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, w, h);

    // background
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, w, h);

    // waveform line
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();

    const sliceWidth = w / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0; // 0..2
      const y = (v * h) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  }

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Live Waveform</div>
          <div className="text-xs text-white/60">
            Shows mic input waveform while someone talks
          </div>
        </div>

        {!running ? (
          <button
            onClick={start}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Start
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80"
          >
            Stop
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <canvas ref={canvasRef} className="h-28 w-full" />
      </div>

      {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
    </div>
  );
}