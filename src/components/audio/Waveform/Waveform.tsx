import { useEffect, useRef } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';
import type { FaceDrop } from '../timelineTypes';

const WAVEFORM_BG = '#1e3e68';
const WAVEFORM_HIGHLIGHT = '#2d5a8f';
const WAVEFORM_PEAK = '#508fc5';

export function Waveform({
  peaks,
  duration,
  highlights,
}: {
  peaks: Float32Array;
  duration: number;
  highlights: readonly FaceDrop[];
}) {
  const { copy } = useLocale();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext('2d');
      if (!context || !width) return;
      context.scale(ratio, ratio);
      context.fillStyle = WAVEFORM_BG;
      context.fillRect(0, 0, width, height);
      if (duration > 0) {
        context.fillStyle = WAVEFORM_HIGHLIGHT;
        for (const drop of highlights) {
          const left = drop.start / duration * width;
          const right = drop.end / duration * width;
          context.fillRect(left, 0, Math.max(1, right - left), height);
        }
      }
      context.fillStyle = WAVEFORM_PEAK;
      for (let x = 0; x < width; x++) {
        const start = Math.floor(x * peaks.length / width);
        const end = Math.min(
          peaks.length,
          Math.max(start + 1, Math.ceil((x + 1) * peaks.length / width)),
        );
        let peak = 0;
        for (let i = start; i < end; i++) peak = Math.max(peak, peaks[i]);
        const amplitude = Math.max(1, peak * (height - 8));
        context.fillRect(x, height - amplitude, 1, amplitude);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [peaks, duration, highlights]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={copy.waveform}
      style={{ display: 'block', width: '100%', height: 150 }}
    />
  );
}
