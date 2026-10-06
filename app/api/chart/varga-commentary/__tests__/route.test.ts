// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  budget: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const { default: Anthropic } = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    default: class extends Anthropic {
      messages = { parse: mocks.parse } as unknown as InstanceType<typeof Anthropic>["messages"];
    },
  };
});
vi.mock("@/lib/llm-budget", () => ({ consumeLlmBudget: mocks.budget }));

function request(language: unknown) {
  return new NextRequest("https://example.test/api/chart/varga-commentary", {
    method: "POST",
    body: JSON.stringify({
      divisions: [{ division: 9, positions: [{ name: "Sun", rashi: "Aries", divisional: "Leo" }] }],
      language,
    }),
  });
}

const instruction = () => String(mocks.parse.mock.calls[0][0].messages[0].content);

let POST: typeof import("../route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.parse.mockResolvedValue({
    stop_reason: "end_turn",
    parsed_output: { notes: [{ division: 9, note: "Your navamsa Sun in Leo." }] },
    usage: { input_tokens: 100, output_tokens: 20 },
  });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  POST = (await import("../route")).POST;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the varga notes' language", () => {
  it("is the reader's when the table has it", async () => {
    expect((await POST(request("hi"))).status).toBe(200);
    expect(instruction()).toContain("Write every note in Hindi.");
  });

  it.each(["constructor", "__proto__", "toString", "xx", 7])("is English for %j", async (language) => {
    expect((await POST(request(language))).status).toBe(200);
    expect(instruction()).toContain("Write every note in English.");
    expect(instruction()).not.toContain("native code");
  });
});
