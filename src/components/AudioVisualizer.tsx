import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isPlaying,
  color = '#14b8a6',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw center subtle glowing line
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();
      } else {
        // Idle gentle breathing baseline wave
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        const t = performance.now() * 0.002;
        for (let x = 0; x < width; x += 4) {
          const y = height / 2 + Math.sin(x * 0.03 + t) * 2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying, color]);

  return (
    <div className="relative w-full h-16 bg-slate-950/60 rounded-lg overflow-hidden border border-slate-800/80 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={400}
        height={64}
        className="w-full h-full block"
      />
      {!isPlaying && (
        <span className="absolute text-[11px] font-mono text-slate-500 tracking-wider">
          ACOUSTIC ENGINE READY · OFFLINE DSP
        </span>
      )}
    </div>
  );
};
