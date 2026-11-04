/**
 * Turns the camera's current frame into the JPEG the palm reader is sent.
 *
 * The frame is drawn onto the canvas and encoded straight away, with nothing
 * else painted on it. The camera view shows MediaPipe's hand landmarks (teal
 * connectors, gold dots) on its own overlay canvas; those used to be drawn
 * onto this canvas too before encoding, so the reading model was handed a
 * palm with straight lines across it that it could take for palm lines. The
 * same image is the on-screen preview, the base of the annotated palm and the
 * photo saved to history, so it stays clean everywhere.
 *
 * Takes only the video and the canvas, so there is nothing here to draw
 * landmarks with. lib/__tests__/palm-capture-frame.test.ts pins the calls.
 */

/** JPEG quality for a captured frame. */
export const PALM_CAPTURE_JPEG_QUALITY = 0.92;

export type CapturedFrame = {
  /** data:image/jpeg;base64,... for the preview. */
  dataUrl: string;
  /** The base64 payload alone, as /api/palm-reading takes it. */
  base64: string;
};

export function encodeCleanFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): CapturedFrame | null {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", PALM_CAPTURE_JPEG_QUALITY);
  return { dataUrl, base64: dataUrl.split(",")[1] ?? "" };
}
