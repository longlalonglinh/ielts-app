/**
 * Image URL Resolution and Normalization Utilities
 * Automatically converts Google Drive sharing URLs to direct high-resolution image thumbnails,
 * bypassing hotlink blocking, cookie restrictions, and CORS errors.
 */

export function normalizeGoogleDriveImageUrl(url: any): string {
  if (!url) return '';
  let str = '';
  if (typeof url === 'string') {
    str = url.trim();
  } else if (typeof url === 'object') {
    str = (url.url || url.src || url.dataUrl || url.imageUrl || url.image_url || '').toString().trim();
  }
  if (!str) return '';

  // Return base64 data URLs, blob URLs, and relative assets directly without regex scanning
  if (str.startsWith('data:image/') || str.startsWith('blob:') || str.startsWith('/') || str.startsWith('./')) {
    return str;
  }

  // Extract FILE_ID from common Google Drive link formats
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)|docs\.google\.com\/drawings\/d\/|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]{20,})/;
  const match = str.match(driveRegex);

  if (match && match[1]) {
    const fileId = match[1];
    // Return high-resolution thumbnail endpoint (prevents CORS and hotlinking blocks)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }

  return str;
}

