import type { FaceDrop } from './timelineTypes';

export const DROP_SECONDS = 2;
const MIN_DROP = 0.5;

export function dropTimeOk(start: number, duration: number) {
  return Number.isFinite(start) && start >= 0 && start < duration;
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1;
}

export function dropBlocked(
  start: number,
  duration: number,
  drops: readonly FaceDrop[],
  ignoreId?: number,
) {
  if (!dropTimeOk(start, duration)) return true;
  const end = Math.min(start + DROP_SECONDS, duration);
  return drops.some((drop) => (
    drop.id !== ignoreId && rangesOverlap(start, end, drop.start, drop.end)
  ));
}

export function clampDropStart(
  start: number,
  duration: number,
  drops: readonly FaceDrop[],
  ignoreId: number,
  originStart: number,
) {
  const moving = drops.find((drop) => drop.id === ignoreId);
  const span = moving ? moving.end - moving.start : DROP_SECONDS;
  const others = drops.filter((drop) => drop.id !== ignoreId);
  let prev: FaceDrop | undefined;
  let next: FaceDrop | undefined;
  for (const drop of others) {
    if (drop.start <= originStart) {
      if (!prev || drop.start > prev.start) prev = drop;
    } else if (!next || drop.start < next.start) {
      next = drop;
    }
  }
  const lo = prev ? prev.end : 0;
  const hi = next ? next.start - span : duration - span;
  if (hi < lo) return originStart;
  return Math.min(Math.max(start, lo), Math.max(lo, hi));
}

export function clampDropEdge(
  drop: FaceDrop,
  edge: 'start' | 'end',
  time: number,
  duration: number,
  drops: readonly FaceDrop[],
) {
  const others = drops.filter((other) => other.id !== drop.id);
  let prev: FaceDrop | undefined;
  let next: FaceDrop | undefined;
  for (const other of others) {
    if (other.start <= drop.start) {
      if (!prev || other.start > prev.start) prev = other;
    } else if (!next || other.start < next.start) {
      next = other;
    }
  }
  if (edge === 'start') {
    const lo = prev ? prev.end : 0;
    const hi = drop.end - MIN_DROP;
    const start = Math.min(Math.max(time, lo), Math.max(lo, hi));
    return { start, end: drop.end };
  }
  const lo = drop.start + MIN_DROP;
  const hi = next ? next.start : duration;
  const end = Math.min(Math.max(time, lo), Math.max(lo, hi));
  return { start: drop.start, end };
}

export function faceAtTime(time: number, drops: readonly FaceDrop[]) {
  for (const drop of drops) {
    if (time >= drop.start && time < drop.end) return drop.face;
  }
  return 'normal' as const;
}

export function rectsOverlap(
  a: DOMRect,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  return left < a.right && left + width > a.left && top < a.bottom && top + height > a.top;
}
