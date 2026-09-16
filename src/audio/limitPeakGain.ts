/** Peak ceiling after load: -6 dBFS. Scale down only — never clip or boost. */
export const LOAD_PEAK_DB = -6;
export const LOAD_PEAK_LIMIT = 10 ** (LOAD_PEAK_DB / 20);

export function limitPeakGain(
  channels: readonly Float32Array[],
  peakLimit = LOAD_PEAK_LIMIT,
) {
  let peak = 0;
  for (const channel of channels) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  if (peak <= 0 || peak <= peakLimit) {
    return { channels: copyChannels(channels), changed: false };
  }
  const gain = peakLimit / peak;
  return {
    channels: channels.map((channel) => {
      const next = new Float32Array(channel.length);
      for (let index = 0; index < channel.length; index += 1) {
        next[index] = channel[index] * gain;
      }
      return next;
    }),
    changed: true,
  };
}

function copyChannels(channels: readonly Float32Array[]) {
  return channels.map((channel) => new Float32Array(channel));
}
