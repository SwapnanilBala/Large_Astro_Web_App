// @vitest-environment node
/**
 * The palm photo's pixel size, read from the header of each type the route
 * accepts (lib/palm-readings/image-size.ts). Built here byte by byte, so each
 * case is the smallest header that format allows.
 */
import { describe, expect, it } from "vitest";
import { photoFrame, readPhotoHeader } from "../palm-readings/image-size";

const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");

function png(width: number, height: number): number[] {
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32be(13), ...ascii("IHDR"), ...u32be(width), ...u32be(height), 8, 6, 0, 0, 0];
}

/** An APP1 Exif segment, big-endian, whose IFD0 holds only the orientation tag. */
function exif(orientation: number): number[] {
  const tiff = [...ascii("MM"), 0x00, 0x2a, ...u32be(8), ...u16be(1), ...u16be(0x0112), ...u16be(3), ...u32be(1), ...u16be(orientation), 0, 0, ...u32be(0)];
  const body = [...ascii("Exif"), 0, 0, ...tiff];
  return [0xff, 0xe1, ...u16be(body.length + 2), ...body];
}

function jpeg(width: number, height: number, { orientation, sof = 0xc0 }: { orientation?: number; sof?: number } = {}): number[] {
  const app0 = [0xff, 0xe0, ...u16be(16), ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const dqt = [0xff, 0xdb, ...u16be(67), 0, ...new Array(64).fill(1)];
  const frame = [0xff, sof, ...u16be(17), 8, ...u16be(height), ...u16be(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return [0xff, 0xd8, ...app0, ...(orientation ? exif(orientation) : []), ...dqt, ...frame, 0xff, 0xda, ...u16be(12), 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0, 0xff, 0xd9];
}

function riff(chunk: string, payload: number[]): number[] {
  const body = [...ascii("WEBP"), ...ascii(chunk), payload.length & 0xff, (payload.length >> 8) & 0xff, 0, 0, ...payload];
  return [...ascii("RIFF"), body.length & 0xff, (body.length >> 8) & 0xff, 0, 0, ...body];
}

const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];

const webpLossy = (w: number, h: number) => riff("VP8 ", [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h), 0, 0]);
function webpLossless(w: number, h: number) {
  const bits = (w - 1) | ((h - 1) << 14);
  return riff("VP8L", [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff, 0, 0, 0, 0]);
}
const webpExtended = (w: number, h: number) => riff("VP8X", [0x10, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]);

describe("readPhotoHeader", () => {
  it.each([
    ["PNG", png(960, 1508), 960, 1508],
    ["baseline JPEG", jpeg(1200, 1600), 1200, 1600],
    ["progressive JPEG", jpeg(1080, 1440, { sof: 0xc2 }), 1080, 1440],
    ["lossy WebP", webpLossy(720, 1131), 720, 1131],
    ["lossless WebP", webpLossless(3000, 4000), 3000, 4000],
    ["extended WebP", webpExtended(4032, 3024), 4032, 3024],
  ])("reads a %s", (_type, bytes, width, height) => {
    expect(readPhotoHeader(Uint8Array.from(bytes))).toEqual({ width, height, orientation: 1 });
  });

  it("reads a JPEG's EXIF orientation from behind APP0", () => {
    expect(readPhotoHeader(Uint8Array.from(jpeg(4032, 3024, { orientation: 6 })))).toEqual({ width: 4032, height: 3024, orientation: 6 });
    expect(readPhotoHeader(Uint8Array.from(jpeg(3024, 4032, { orientation: 1 })))).toEqual({ width: 3024, height: 4032, orientation: 1 });
  });

  it.each([
    ["nothing", []],
    ["text", ascii("not an image at all, just words")],
    ["a JPEG cut off before its frame", jpeg(1200, 1600).slice(0, 30)],
    ["a PNG of no size", png(0, 0)],
    ["a GIF", [...ascii("GIF89a"), 10, 0, 10, 0, 0, 0, 0, ...new Array(20).fill(0)]],
  ])("is null for %s", (_label, bytes) => {
    expect(readPhotoHeader(Uint8Array.from(bytes))).toBeNull();
  });
});

describe("photoFrame", () => {
  it("reads the size from the base64 photo the route is sent", () => {
    expect(photoFrame(b64(jpeg(1200, 1600)))).toEqual({ width: 1200, height: 1600 });
    expect(photoFrame(b64(png(960, 1508)))).toEqual({ width: 960, height: 1508 });
  });

  it("reads past line breaks in the base64", () => {
    const wrapped = b64(png(960, 1508)).replace(/(.{8})/g, "$1\n");
    expect(photoFrame(wrapped)).toEqual({ width: 960, height: 1508 });
  });

  it("only needs the start of a large photo", () => {
    const large = [...jpeg(1200, 1600).slice(0, -2), ...new Array(3 * 1024 * 1024).fill(0x55), 0xff, 0xd9];
    expect(photoFrame(b64(large))).toEqual({ width: 1200, height: 1600 });
  });

  it("will not say for a JPEG its EXIF turns on its side, or for what it cannot read", () => {
    expect(photoFrame(b64(jpeg(4032, 3024, { orientation: 6 })))).toBeNull();
    expect(photoFrame(b64(jpeg(4032, 3024, { orientation: 3 })))).toEqual({ width: 4032, height: 3024 });
    expect(photoFrame("aGVsbG8gcGFsbQ==")).toBeNull();
    expect(photoFrame("")).toBeNull();
  });
});
