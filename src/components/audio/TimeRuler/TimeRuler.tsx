import { useEffect, useRef } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';
import {
  formatSpeechSecond,
  isWholeSecond,
  speechLabelStep,
  speechMarkTimes,
} from '../speechTimeMarks';

const RULER_INK = '#c8d8ea';
const LABEL_SIZE = 15;
const LABEL_TOP = 0;
const MAJOR_TICK = 10;
const MINOR_TICK = MAJOR_TICK / 2;
export const RULER_HEIGHT = LABEL_TOP + LABEL_SIZE + 2 + MAJOR_TICK + 1;

export function TimeRuler({ duration }: { duration: number }) {
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
      if (!context || !width || duration <= 0) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.strokeStyle = RULER_INK;
      context.fillStyle = RULER_INK;
      context.lineWidth = 1;
      context.font = `${LABEL_SIZE}px ui-sans-serif, system-ui, sans-serif`;
      context.textBaseline = 'top';
      const baseline = height - 0.5;
      const marks = speechMarkTimes(duration);
      const sample = context.measureText(formatSpeechSecond(Math.floor(duration))).width;
      const labelStep = speechLabelStep(duration, width, sample);
      context.beginPath();
      context.moveTo(0, baseline);
      context.lineTo(width, baseline);
      for (const time of marks) {
        const x = Math.min(width - 0.5, Math.round(time / duration * width) + 0.5);
        const major = isWholeSecond(time);
        const tick = major ? MAJOR_TICK : MINOR_TICK;
        context.moveTo(x, baseline);
        context.lineTo(x, baseline - tick);
      }
      context.stroke();
      for (const time of marks) {
        if (!isWholeSecond(time)) continue;
        const second = Math.round(time);
        if (second % labelStep !== 0) continue;
        const label = formatSpeechSecond(time);
        const textWidth = context.measureText(label).width;
        const x = time / duration * width;
        let left = x - textWidth / 2;
        if (time === 0) left = 1;
        else if (left + textWidth > width - 1) left = width - 1 - textWidth;
        context.fillText(label, left, LABEL_TOP);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [duration]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={copy.timeMarks}
      style={{ display: 'block', width: '100%', height: RULER_HEIGHT }}
    />
  );
}
