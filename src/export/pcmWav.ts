function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function pcmWav(channels: Float32Array[], sampleRate: number) {
  const frames = channels[0]?.length ?? 0;
  const channelCount = channels.length;
  const dataSize = frames * channelCount * 2;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    }
  }
  return new Uint8Array(bytes);
}

export function silentChannels(seconds: number, sampleRate: number, channelCount: number) {
  const frames = Math.round(seconds * sampleRate);
  return Array.from({ length: channelCount }, () => new Float32Array(frames));
}

export function toneChannels(
  seconds: number,
  sampleRate: number,
  channelCount: number,
  frequency: number,
  volume: number,
) {
  const frames = Math.round(seconds * sampleRate);
  return Array.from({ length: channelCount }, () => {
    const data = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame += 1) {
      data[frame] = Math.sin((2 * Math.PI * frequency * frame) / sampleRate) * volume;
    }
    return data;
  });
}

export function concatChannels(head: Float32Array[], tail: Float32Array[]) {
  return head.map((channel, index) => {
    const next = new Float32Array(channel.length + tail[index].length);
    next.set(channel);
    next.set(tail[index], channel.length);
    return next;
  });
}
