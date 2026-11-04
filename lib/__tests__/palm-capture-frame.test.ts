import { describe, expect, it, vi } from "vitest";
import { encodeCleanFrame, PALM_CAPTURE_JPEG_QUALITY } from "@/lib/palm-readings/capture-frame";

/*
 * The captured frame is what the palm reader is sent, so nothing but the
 * video may be drawn on it before it is encoded. jsdom has no canvas, so the
 * context is a recorder: every call on it, and the encode, land in one log in
 * the order they happened.
 */

type Call = { name: string; args: unknown[] };

function recordingCanvas() {
  const calls: Call[] = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (...args: unknown[]) => {
          calls.push({ name, args });
        },
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn((): unknown => ctx),
    toDataURL: vi.fn((...args: unknown[]) => {
      calls.push({ name: "toDataURL", args });
      return "data:image/jpeg;base64,Q0xFQU4=";
    }),
  };
  return { canvas, element: canvas as unknown as HTMLCanvasElement, calls };
}

const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;

describe("encodeCleanFrame", () => {
  it("draws the video and encodes it, with nothing drawn in between", () => {
    const { element, calls } = recordingCanvas();
    const frame = encodeCleanFrame(video, element);

    expect(calls).toEqual([
      { name: "drawImage", args: [video, 0, 0] },
      { name: "toDataURL", args: ["image/jpeg", 0.92] },
    ]);
    expect(PALM_CAPTURE_JPEG_QUALITY).toBe(0.92);
    expect(frame).toEqual({ dataUrl: "data:image/jpeg;base64,Q0xFQU4=", base64: "Q0xFQU4=" });
  });

  it("sizes the canvas to the video before drawing", () => {
    const { element } = recordingCanvas();
    encodeCleanFrame(video, element);
    expect([element.width, element.height]).toEqual([1280, 720]);
  });

  it("encodes nothing when the browser gives no 2D context", () => {
    const { canvas, element } = recordingCanvas();
    canvas.getContext.mockReturnValue(null);
    expect(encodeCleanFrame(video, element)).toBeNull();
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });
});
