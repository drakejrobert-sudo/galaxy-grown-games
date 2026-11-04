/** Raster-only, embedded backgrounds keep private maps portable without remote requests. */
export const MAX_BACKGROUND_BYTES = 750_000;
export const MAX_UPLOAD_BYTES = 10_000_000;
export function backgroundImageBytes(value: unknown): number | null {
  if (typeof value !== 'string' || value.length > 1_000_100) return null;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  try {
    const bytes = atob(match[2]);
    const validHeader = match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n')
      : match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff')
      : bytes.startsWith('RIFF') && bytes.slice(8,12) === 'WEBP';
    return validHeader && bytes.length <= MAX_BACKGROUND_BYTES ? bytes.length : null;
  } catch { return null; }
}

export async function normalizeBackground(file: File): Promise<string> {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG or WebP image.');
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw Error('Choose an image under 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw Error('This image could not be decoded. Choose another PNG, JPEG or WebP.'); }
    if (image.naturalWidth * image.naturalHeight > 40_000_000) throw Error('Choose an image with at most 40 million pixels.');
    const canvas = document.createElement('canvas');
    canvas.width = 1800; canvas.height = 1000;
    const context = canvas.getContext('2d');
    if (!context) throw Error('This browser could not prepare the background image.');
    context.fillStyle = '#0b1224'; context.fillRect(0,0,canvas.width,canvas.height);
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.drawImage(image,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
    for (const quality of [.88,.75,.6,.45]) {
      const data = canvas.toDataURL('image/jpeg',quality);
      if (backgroundImageBytes(data) !== null) return data;
    }
    throw Error('The prepared image exceeds 750 KB. Choose a simpler image.');
  } finally { URL.revokeObjectURL(url); }
}
