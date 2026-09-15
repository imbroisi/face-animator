import type { MouthTimeline } from '../../audio/mouthCycles';
import type { FaceType } from '../../faces/Faces';

export type Track = {
  id: number;
  file: File;
  name: string;
  duration: number;
  peaks: Float32Array;
  mouthTimeline: MouthTimeline;
};

export type FaceDrop = {
  id: number;
  start: number;
  end: number;
  face: FaceType;
};

export type PaletteDrag = {
  width: number;
  height: number;
  hotX: number;
  hotY: number;
  face: FaceType;
};
