/*
 * The pixel size of a palm photo, read from its header, so the reading model
 * can be told the frame its line_coordinates are fractions of, and so the
 * trace check (trace-check.ts) knows whether the photo is portrait.
 *
 * The three types the route accepts, and only their headers: PNG's IHDR,
 * JPEG's SOF segment (with the EXIF orientation from APP1), and WebP's
 * VP8, VP8L or VP8X chunk. No image library: this is a few dozen bytes of
 * each format, and anything it does not recognise is null, which the route
 * reads as "say nothing about the size".
 */

export type PhotoFrame = { width: number; height: number };

export type PhotoHeader = PhotoFrame & {
  /** EXIF orientation, 1 to 8, for a JPEG that carries one; 1 otherwise. */
  orientation: number;
};

/* A JPEG's SOF can sit behind a large EXIF block (a thumbnail, XMP, an ICC
   profile), each segment up to 64KB. This is several of those, and still a
   small slice of a 5MB photo. */
const HEADER_BYTES = 1024 * 1024;

function pngHeader(b: Uint8Array): PhotoHeader | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || signature.some((byte, i) => b[i] !== byte)) return null;
  if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== "IHDR") return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20), orientation: 1 };
}

/** The orientation tag (0x0112) of IFD0 in an APP1 Exif segment, or 1. */
function exifOrientation(b: Uint8Array, start: number, end: number): number {
  if (end - start < 14) return 1;
  if (String.fromCharCode(b[start], b[start + 1], b[start + 2], b[start + 3]) !== "Exif") return 1;
  const tiff = start + 6;
  const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
  if (!little && !(b[tiff] === 0x4d && b[tiff + 1] === 0x4d)) return 1;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (at: number) => (at + 2 <= end ? view.getUint16(at, little) : -1);
  const u32 = (at: number) => (at + 4 <= end ? view.getUint32(at, little) : -1);
  const ifd = u32(tiff + 4);
  if (ifd < 0) return 1;
  const count = u16(tiff + ifd);
  for (let i = 0; i < count; i++) {
    const entry = tiff + ifd + 2 + i * 12;
    if (entry + 12 > end) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegHeader(b: Uint8Array): PhotoHeader | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let orientation = 1;
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    /* Fill bytes, and the markers that carry no length. */
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    const length = (b[at + 2] << 8) | b[at + 3];
    if (length < 2) return null;
    const body = at + 4;
    if (marker === 0xe1) orientation = exifOrientation(b, body, Math.min(b.length, at + 2 + length));
    if (SOF_MARKERS.has(marker)) {
      if (body + 5 > b.length) return null;
      const height = (b[body + 1] << 8) | b[body + 2];
      const width = (b[body + 3] << 8) | b[body + 4];
      return { width, height, orientation };
    }
    /* Start of scan: past here is image data, and no SOF came first. */
    if (marker === 0xda) return null;
    at += 2 + length;
  }
  return null;
}

function webpHeader(b: Uint8Array): PhotoHeader | null {
  if (b.length < 25) return null;
  const tag = (at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;
  const chunk = tag(12);
  if (chunk === "VP8 ") {
    /* A key frame's start code, then 14-bit width and height. */
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff, orientation: 1 };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, orientation: 1 };
  }
  if (chunk === "VP8X") {
    if (b.length < 30) return null;
    return {
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
      orientation: 1,
    };
  }
  return null;
}

/** The header's stored size and orientation, or null when the bytes are not a PNG, JPEG or WebP it can read. */
export function readPhotoHeader(bytes: Uint8Array): PhotoHeader | null {
  const header = pngHeader(bytes) ?? jpegHeader(bytes) ?? webpHeader(bytes);
  if (!header || header.width <= 0 || header.height <= 0) return null;
  return header;
}

/**
 * The frame the reading's coordinates are fractions of, from the base64 photo
 * the route was sent, or null when it cannot say.
 *
 * Null too for a JPEG whose EXIF turns it on its side (orientations 5 to 8):
 * the browser draws the traces over the photo turned upright, and whether the
 * model was shown it turned or as stored is not something the header can
 * tell, so a size stated either way could be the wrong one.
 */
export function photoFrame(base64: string): PhotoFrame | null {
  /* Cut before stripping whitespace, so a 5MB photo is not copied whole. */
  const chars = Math.ceil((HEADER_BYTES * 4) / 3 / 4) * 4;
  const head = base64.slice(0, chars + 1024).replace(/\s/g, "").slice(0, chars);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(head, "base64"));
  } catch {
    return null;
  }
  const header = readPhotoHeader(bytes);
  if (!header || header.orientation >= 5) return null;
  return { width: header.width, height: header.height };
}
