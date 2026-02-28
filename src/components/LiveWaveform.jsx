import React, { useEffect, useRef } from "react";

/**
 * LiveWaveform component
 * Props:
 *   running: boolean (whether to show live waveform)
 *   onError: function (optional, called with error message)
 */
const LiveWaveform = React.forwardRef(function LiveWaveform(
  { running, onError },
  ref
) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);
  const streamRef = useRef(null);

  // Expose start/stop for advanced use
  React.useImperativeHandle(ref, () => ({
    start, stop
  }));

  async function start() {
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
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;
      source.connect(analyser);
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      dataRef.current = dataArray;
      draw();
    } catch (e) {
      if (onError) onError(e?.message || "Mic permission failed");
    }
  }

  function stop() {
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
    clearCanvas();
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
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    const sliceWidth = w / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    rafRef.current = requestAnimationFrame(draw);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // React to running prop
  useEffect(() => {
    if (running) {
      start();
    } else {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => () => stop(), []);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <canvas ref={canvasRef} className="h-28 w-full" />
      </div>
    </div>
  );
});

export default LiveWaveform;