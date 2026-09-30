import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n-context";
import PalmReadingPanel from "./palm-reading-panel";

/*
 * The panel only renders on the members-only advanced page, which a
 * signed-out browser cannot reach, so its analysis and reveal are pinned
 * here: the loading copy opening on its first stage, the first section at
 * once and the rest staggered, "Skip animations", and reduced motion showing
 * everything at once. The reading is canned -- nothing reaches the paid
 * route -- and MediaPipe, the annotation canvas, the Q&A thread and
 * framer-motion are stood in for.
 */

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: () => Promise.reject(new Error("no WASM under jsdom")) },
  HandLandmarker: { HAND_CONNECTIONS: [] },
  DrawingUtils: class {},
}));
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

const line = (name: string) => ({
  description: `${name} line description`,
  interpretation: `${name} line interpretation`,
  strength: "strong",
});

const READING = {
  overall_summary: "An overall summary of this palm.",
  dominant_hand_note: "Read from the right hand.",
  lines: {
    heart_line: line("Heart"),
    head_line: line("Head"),
    life_line: line("Life"),
    fate_line: line("Fate"),
  },
  guidance: "Guidance written for this reader.",
};

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

let answer: (response: Response) => void;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function analyzeAPalm() {
  const { container } = render(
    <LanguageProvider baseMessages={{}}>
      <PalmReadingPanel />
    </LanguageProvider>,
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const photo = new File([new Uint8Array([137, 80, 78, 71])], "palm.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [photo] } });

  const analyze = await waitFor(() => {
    const button = container.querySelector(".palm-submit");
    if (!button) throw new Error("no analyze button yet");
    return button as HTMLButtonElement;
  });
  fireEvent.click(analyze);
  return container;
}

async function landTheReading() {
  await act(async () => {
    answer(
      new Response(JSON.stringify(READING), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  await screen.findByText(READING.overall_summary);
}

describe("PalmReadingPanel", () => {
  it("opens the loading copy on its first stage", async () => {
    setReducedMotion(false);
    await analyzeAPalm();
    expect(screen.getByText("Reading your palm")).toBeInTheDocument();
  });

  it("shows the first section at once and staggers in the rest", async () => {
    setReducedMotion(false);
    await analyzeAPalm();
    await landTheReading();

    expect(screen.queryByText(READING.guidance)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip animations" })).toBeInTheDocument();

    await screen.findByText(READING.guidance, undefined, { timeout: 4000 });
    expect(screen.queryByRole("button", { name: "Skip animations" })).not.toBeInTheDocument();
  });

  it("shows everything when the reader skips the animation", async () => {
    setReducedMotion(false);
    await analyzeAPalm();
    await landTheReading();

    fireEvent.click(screen.getByRole("button", { name: "Skip animations" }));
    expect(screen.getByText(READING.guidance)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip animations" })).not.toBeInTheDocument();
  });

  it("shows everything at once under reduced motion", async () => {
    setReducedMotion(true);
    await analyzeAPalm();
    await landTheReading();

    expect(screen.getByText(READING.guidance)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip animations" })).not.toBeInTheDocument();
  });
});
