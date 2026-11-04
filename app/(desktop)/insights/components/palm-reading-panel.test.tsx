import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n-context";
import deCatalog from "@/messages/de.json";
import palmMessages from "@/messages/en.palm.json";
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

/* The route's 422 for a photo its check refused; its English is not what the panel shows. */
const photoRefusal = (reason: string) =>
  new Response(
    JSON.stringify({ error: { code: "VALIDATION_FAILED", message: "route English", details: { reason } } }),
    { status: 422, headers: { "Content-Type": "application/json" } },
  );

/* German as the provider's baseline: the catalog, and the strings staged for it until the fold. */
function germanMessages(): Record<string, unknown> {
  const merge = (into: Record<string, unknown>, from: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(from)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        into[key] = merge({ ...((into[key] as Record<string, unknown>) ?? {}) }, value as Record<string, unknown>);
      } else {
        into[key] = value;
      }
    }
    return into;
  };
  const tree = merge({}, deCatalog as Record<string, unknown>);
  const dir = join(process.cwd(), "messages", "fragments");
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
      const fragment = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, Record<string, unknown>>;
      if (fragment.de) merge(tree, fragment.de);
    }
  }
  return tree;
}

async function analyzeAPalm(beforePhoto?: () => void, baseMessages: Record<string, unknown> = {}) {
  const { container } = render(
    <LanguageProvider baseMessages={baseMessages as never}>
      <PalmReadingPanel />
    </LanguageProvider>,
  );
  beforePhoto?.();
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

async function landTheReading(reading: object = READING) {
  await act(async () => {
    answer(
      new Response(JSON.stringify(reading), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  await screen.findByText(READING.overall_summary);
}

const sentBody = () =>
  JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>;

describe("PalmReadingPanel", () => {
  it("says when the week's two readings are used, and when the next one opens", async () => {
    setReducedMotion(true);
    await analyzeAPalm();
    await act(async () => {
      answer(
        new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "You have had this week's 2 palm readings. Your next one opens on Monday.",
              details: { scope: "weekly", retryAfterSeconds: 129600, resetsAt: "2026-09-14T00:00:00.000Z" },
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    const opens = new Date("2026-09-14T00:00:00.000Z").toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    expect(
      await screen.findByText(`You've had this week's 2 palm readings. Your next one opens on ${opens}.`),
    ).toBeInTheDocument();
  });

  it.each([
    ["not_a_palm", "This photo doesn't look like an open palm."],
    ["back_of_hand", "This looks like the back of a hand."],
    ["unclear", "The lines on this palm are hard to make out."],
  ])("says why the photo check refused a photo (%s), and that it used no reading", async (reason, opening) => {
    setReducedMotion(true);
    await analyzeAPalm();
    await act(async () => {
      answer(photoRefusal(reason));
    });
    const message = await screen.findByText((text) => text.startsWith(opening));
    expect(message.textContent).toContain("This didn't use up a reading.");
    expect(message.textContent).not.toContain("route English");
  });

  it("words a refused photo in the reader's language", async () => {
    setReducedMotion(true);
    await analyzeAPalm(undefined, germanMessages());
    await act(async () => {
      answer(photoRefusal("back_of_hand"));
    });
    expect(
      await screen.findByText(
        "Das sieht nach einem Handrücken aus. Dreh deine Hand bitte um und fotografiere die Handfläche. Dieses Foto zählt nicht als Deutung.",
      ),
    ).toBeInTheDocument();
  });

  it("asks a German reader to sign in, in German", async () => {
    setReducedMotion(true);
    await analyzeAPalm(undefined, germanMessages());
    await act(async () => {
      answer(
        new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "Sign in to read your palm.", details: { scope: "sign_in" } },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(await screen.findByText("Melde dich an, um deine Hand deuten zu lassen.")).toBeInTheDocument();
  });

  it("words the weekly limit in German, with the day the next reading opens", async () => {
    setReducedMotion(true);
    await analyzeAPalm(undefined, germanMessages());
    await act(async () => {
      answer(
        new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "route English",
              details: { scope: "weekly", resetsAt: "2026-11-09T00:00:00.000Z" },
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    const message = await screen.findByText((text) => text.startsWith("Du hast die "));
    expect(message.textContent).toMatch(
      /^Du hast die \d+ Handdeutungen dieser Woche schon genutzt\. Die nächste ist ab \S.* möglich\.$/,
    );
    expect(message.textContent).not.toContain("route English");
  });

  it("asks the reader to sign in when the route answers 401", async () => {
    setReducedMotion(true);
    await analyzeAPalm();
    await act(async () => {
      answer(
        new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "Sign in to read your palm.", details: { scope: "sign_in" } },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(await screen.findByText(palmMessages.palm.errors.signInRequired)).toBeInTheDocument();
  });

  it("asks whose hand it is, and sends no hand rule until the reader says", async () => {
    setReducedMotion(true);
    await analyzeAPalm(() => {
      expect(screen.getByRole("group", { name: "Whose hand is this?" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Prefer not to say" })).toBeChecked();
      expect(screen.getByText("Photograph the hand you write with.")).toBeInTheDocument();
    });
    expect(sentBody()).not.toHaveProperty("reader");
  });

  it("starts from the chart's sex at birth when the page passes it", () => {
    render(
      <LanguageProvider baseMessages={{}}>
        <PalmReadingPanel initialReader="man" />
      </LanguageProvider>,
    );
    expect(screen.getByRole("radio", { name: "A man's" })).toBeChecked();
    expect(
      screen.getByText("Photograph the right hand: classical palmistry reads a man's right hand."),
    ).toBeInTheDocument();
  });

  it("tells a woman to photograph her left hand, and sends the choice with the photo", async () => {
    setReducedMotion(true);
    await analyzeAPalm(() => {
      fireEvent.click(screen.getByRole("radio", { name: "A woman's" }));
      expect(
        screen.getByText("Photograph the left hand: classical palmistry reads a woman's left hand."),
      ).toBeInTheDocument();
    });
    expect(sentBody()).toMatchObject({ reader: "woman" });
  });

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

  it("shows a classical reading's Sanskrit terms but none of its text references", async () => {
    // The references were written from memory, with nothing checking a text
    // says them. Older readings and a model ignoring the prompt still send them.
    setReducedMotion(true);
    await analyzeAPalm();
    await landTheReading({
      ...READING,
      classical_framework_notes: {
        framework: "Hasta Samudrika Shastra",
        sanskrit_terms: [{ term: "Hridaya Rekha", meaning: "heart line", observation: "Long and unbroken." }],
        classical_text_references: ["Brihat Samhita Ch. 68"],
      },
    });

    expect(screen.getByText("Hridaya Rekha")).toBeInTheDocument();
    expect(screen.queryByText("Brihat Samhita Ch. 68")).not.toBeInTheDocument();
  });

  it("shows everything at once under reduced motion", async () => {
    setReducedMotion(true);
    await analyzeAPalm();
    await landTheReading();

    expect(screen.getByText(READING.guidance)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip animations" })).not.toBeInTheDocument();
  });
});
