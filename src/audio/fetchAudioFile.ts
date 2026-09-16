const AUDIO_MIME_BY_EXT: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  wave: 'audio/wav',
  webm: 'audio/webm',
};

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function fetchAudioFile(url: string) {
  if (!isHttpUrl(url)) {
    throw new Error('errorInvalidAudioUrl');
  }
  const parsed = new URL(url.trim());
  let response: Response;
  try {
    response = await fetch(parsed.href, {
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
    });
  } catch {
    throw new Error('errorLoadAudioUrl');
  }
  if (!response.ok) {
    throw new Error('errorLoadAudioUrl');
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('errorLoadAudioUrl');
  }
  const mime = blob.type.toLowerCase();
  if (mime.startsWith('text/html')) {
    throw new Error('errorLoadAudioUrl');
  }
  const name = audioFileName(response, parsed);
  return new File([blob], name, { type: audioMimeType(blob.type, name) });
}

function audioFileName(response: Response, parsed: URL) {
  const fromHeader = fileNameFromDisposition(response.headers.get('content-disposition'));
  if (fromHeader) return fromHeader;
  const last = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (!last) return 'audio';
  try {
    return safeFileName(decodeURIComponent(last));
  } catch {
    return safeFileName(last);
  }
}

function fileNameFromDisposition(header: string | null) {
  if (!header) return undefined;
  const encoded = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return safeFileName(decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, '')));
    } catch {
      return safeFileName(encoded[1].trim());
    }
  }
  const plain = /filename=(?:"([^"]+)"|([^;]+))/i.exec(header);
  const raw = plain?.[1] ?? plain?.[2]?.trim();
  return raw ? safeFileName(raw) : undefined;
}

function safeFileName(name: string) {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  if (!base || base === '.' || base === '..') return 'audio';
  return base.slice(0, 180);
}

function audioMimeType(blobType: string, name: string) {
  if (blobType.toLowerCase().startsWith('audio/')) return blobType;
  const ext = name.split('.').at(-1)?.toLowerCase();
  if (ext && AUDIO_MIME_BY_EXT[ext]) return AUDIO_MIME_BY_EXT[ext];
  return blobType || 'application/octet-stream';
}
