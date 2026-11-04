import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n-context";
import PalmReadingPanel from "./palm-reading-panel";

/*
 * The camera's photo goes to the palm reader, so it must be the frame alone.
 * The live view draws MediaPipe's landmarks (teal connectors, gold dots) on an
 * overlay canvas; until this test, the capture drew them onto the photo as
 * well, and the model read a palm with lines across it.
 *
 * jsdom has no canvas or camera, so both are recorders: every 2D call and
 * every encode is logged against the canvas it happened on. The stand-in
 * DrawingUtils strokes the context it was built on, as the real one does, so
 * landmarks drawn on the photo would show in the photo canvas's log. Nothing
 * reaches the paid route: fetch is stubbed and never answers.
 */

const recorder = vi.hoisted(() => ({
  log: [] as { canvas: HTMLCanvasElement; call: string }[],
}));

vi.mock("@mediapipe/tasks-vision", () => {
  class DrawingUtils {
    constructor(private readonly ctx: CanvasRenderingContext2D) {}
    drawConnectors() {
      this.ctx.beginPath();
      this.ctx.lineTo(1, 1);
      this.ctx.stroke();
    }
    drawLandmarks() {
      this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  return {
    FilesetResolver: { forVisionTasks: async () => ({}) },
    HandLandmarker: {
      HAND_CONNECTIONS: [{ start: 0, end: 1 }],
      createFromOptions: async () => ({
        detectForVideo: () => ({
          landmarks: [[{ x: 0.4, y: 0.5, z: 0 }, { x: 0.6, y: 0.5, z: 0 }]],
          handedness: [[{ score: 0.95 }]],
        }),
        close: () => {},
      }),
    },
    DrawingUtils,
  };
});
vi.mock("./PalmAnnotation", () => ({ default: () => <div data-testid="annotation" /> }));
vi.mock("./palm-qa-panel", () => ({ default: () => <div data-testid="qa-panel" /> }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({ children, className }: { children?: ReactNode; className?: string }) =>
          createElement(tag, { className }, children),
    },
  ),
}));

const PHOTO_BASE64 = "Q0xFQU4=";
const contexts = new WeakMap<HTMLCanvasElement, unknown>();

function recordingContext(canvas: HTMLCanvasElement) {
  return new Proxy(
    { canvas },
    {
      get: (target, name: string) =>
        name === "canvas"
          ? target.canvas
          : () => {
              recorder.log.push({ canvas, call: name });
            },
    },
  );
}

beforeEach(() => {
  recorder.log = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 5) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    if (!contexts.has(this)) contexts.set(this, recordingContext(this));
    return contexts.get(this) as RenderingContext;
  } as HTMLCanvasElement["getContext"]);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement) {
    recorder.log.push({ canvas: this, call: "toDataURL" });
    return `data:image/jpeg;base64,${PHOTO_BASE64}`;
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4);
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(1280);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(720);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PalmReadingPanel camera capture", () => {
  it("sends the reader the frame alone, with the landmarks left on the live view", async () => {
    const { container } = render(
      <LanguageProvider baseMessages={{}}>
        <PalmReadingPanel />
      </LanguageProvider>,
    );
    // MediaPipe's stand-in resolves on the mount effect's microtasks.
    await act(async () => {});

    fireEvent.click(container.querySelector(".palm-btn-camera") as HTMLButtonElement);

    // The shutter opens once a hand is seen with confidence.
    const shutter = await waitFor(() => {
      const button = container.querySelector(".palm-capture-btn") as HTMLButtonElement | null;
      if (!button || button.disabled) throw new Error("no hand detected yet");
      return button;
    });
    const overlay = container.querySelector(".palm-camera-overlay") as HTMLCanvasElement;
    fireEvent.click(shutter);

    // The live overlay did get the landmarks: the stand-in really draws.
    expect(recorder.log.some((e) => e.canvas === overlay && e.call === "stroke")).toBe(true);

    // The photo's canvas saw the video drawn, then the encode, and nothing else.
    const encode = recorder.log.find((e) => e.call === "toDataURL");
    expect(encode).toBeDefined();
    const photo = encode!.canvas;
    expect(photo).not.toBe(overlay);
    expect(recorder.log.filter((e) => e.canvas === photo).map((e) => e.call)).toEqual([
      "drawImage",
      "toDataURL",
    ]);

    // And that encode is exactly what the reading is sent.
    const analyze = await waitFor(() => {
      const button = container.querySelector(".palm-submit");
      if (!button) throw new Error("no analyze button yet");
      return button as HTMLButtonElement;
    });
    fireEvent.click(analyze);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/palm-reading");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      image: PHOTO_BASE64,
      mediaType: "image/jpeg",
    });
  });
});
