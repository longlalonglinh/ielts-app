/**
 * Audio URL Resolution and Stream Normalizer
 * Resolves Google Drive, Dropbox, external CDNs and proxies them through server for reliable playback
 */

export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  // Pattern 1: /file/d/{ID}/view or /file/d/{ID}
  const fileDMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/i);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Pattern 2: id={ID} in query parameters
  const idQueryMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]{20,})/i);
  if (idQueryMatch && idQueryMatch[1]) return idQueryMatch[1];

  // Pattern 3: open?id={ID}
  const openIdMatch = clean.match(/open\?id=([a-zA-Z0-9_-]{20,})/i);
  if (openIdMatch && openIdMatch[1]) return openIdMatch[1];

  // Pattern 4: uc?id={ID} or uc?export=download&id={ID}
  const ucMatch = clean.match(/uc\?(?:.*&)?id=([a-zA-Z0-9_-]{20,})/i);
  if (ucMatch && ucMatch[1]) return ucMatch[1];

  return null;
}

export function isGoogleDriveAudio(url: string): boolean {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('drive.usercontent.google.com');
}

/**
 * Transforms external audio links into direct streamable URLs
 */
export function formatDirectAudioUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();

  // Handle Google Drive
  const driveId = extractGoogleDriveFileId(clean);
  if (driveId) {
    return `https://drive.usercontent.google.com/download?id=${driveId}&export=download&authuser=0`;
  }

  // Handle Dropbox (change dl=0 to raw=1 for streaming)
  if (clean.includes('dropbox.com')) {
    clean = clean.replace(/[?&]dl=0/g, '').replace(/[?&]dl=1/g, '');
    clean += (clean.includes('?') ? '&' : '?') + 'raw=1';
    return clean;
  }

  return clean;
}

/**
 * Returns a server-proxied audio URL to bypass CORS, Range request, and cookie restrictions
 */
export function getProxyAudioUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (clean.startsWith('/api/audio-proxy')) return clean;
  return `/api/audio-proxy?url=${encodeURIComponent(clean)}`;
}

/**
 * Master audio URL resolver
 * In development and production environments, always prefers proxy for Google Drive or cross-domain links to prevent mobile/iframe playback failure
 */
export function resolvePlayableAudioUrl(url: string | undefined | null, forceDirect = false): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const clean = url.trim();

  if (forceDirect) {
    return formatDirectAudioUrl(clean);
  }

  // If already proxied, return as is
  if (clean.startsWith('/api/audio-proxy')) {
    return clean;
  }

  // Google Drive URLs MUST be proxied because modern browsers reject direct audio elements embedding drive.google.com
  if (isGoogleDriveAudio(clean)) {
    return getProxyAudioUrl(clean);
  }

  // If http:// on https site (mixed content security restriction), proxy it
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && clean.startsWith('http://')) {
    return getProxyAudioUrl(clean);
  }

  // Default: Use proxy to guarantee HTTP Range 206 Partial Content and iOS/Android playback compatibility
  return getProxyAudioUrl(clean);
}
