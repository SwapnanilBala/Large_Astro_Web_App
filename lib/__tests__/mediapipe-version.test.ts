import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEDIAPIPE_WASM_BASE, MEDIAPIPE_WASM_VERSION } from "../palm-readings/mediapipe";

describe("MediaPipe WASM pin", () => {
  it("matches the installed @mediapipe/tasks-vision", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "node_modules/@mediapipe/tasks-vision/package.json"), "utf8"),
    ) as { version: string };
    expect(MEDIAPIPE_WASM_VERSION).toBe(pkg.version);
  });

  it("never floats on a dist-tag", () => {
    expect(MEDIAPIPE_WASM_BASE).not.toMatch(/@(latest|next)\b/);
    expect(MEDIAPIPE_WASM_BASE).toContain(`@${MEDIAPIPE_WASM_VERSION}/`);
  });
});
