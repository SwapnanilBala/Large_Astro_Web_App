import { describe, expect, it } from "vitest";
import type { AshtakavargaData, ShadbalaResult } from "@/lib/astro-types";
import {
  getSarvashtakavargaSignExtremes,
  getShadbalaRatioExtremes,
} from "./shadbala-panel";

function makeAshtakavarga(sarvashtakavarga: number[]): AshtakavargaData {
  return {
    bhinnashtakavarga: {},
    sarvashtakavarga,
    totalBindus: sarvashtakavarga.reduce((total, score) => total + score, 0),
    strongSigns: [],
    weakSigns: [],
  };
}

function makeShadbala(
  planet: string,
  totalVirupas: number,
  strengthRatio: number,
): ShadbalaResult {
  return {
    planet,
    sthanaBala: 0,
    digBala: 0,
    kalaBala: 0,
    cheshtaBala: 0,
    naisargikaBala: 0,
    drikBala: 0,
    totalVirupas,
    totalRupas: totalVirupas / 60,
    requiredMinimum: totalVirupas / strengthRatio,
    strengthRatio,
    isStrong: strengthRatio >= 1,
  };
}

describe("getSarvashtakavargaSignExtremes", () => {
  it("finds the highest and lowest SAV signs using the zodiac display order", () => {
    const result = getSarvashtakavargaSignExtremes(
      makeAshtakavarga([31, 27, 28, 26, 29, 24, 30, 25, 23, 28, 27, 26]),
    );

    expect(result).toEqual({
      strongestSigns: ["Aries"],
      weakestSigns: ["Sagittarius"],
      strongestScore: 31,
      weakestScore: 23,
    });
  });

  it("keeps all tied strongest and weakest signs", () => {
    const result = getSarvashtakavargaSignExtremes(
      makeAshtakavarga([31, 27, 31, 22, 29, 24, 30, 22, 23, 28, 27, 26]),
    );

    expect(result?.strongestSigns).toEqual(["Aries", "Gemini"]);
    expect(result?.weakestSigns).toEqual(["Cancer", "Scorpio"]);
    expect(result?.strongestScore).toBe(31);
    expect(result?.weakestScore).toBe(22);
  });

  it("returns null when SAV data is missing or incomplete", () => {
    expect(getSarvashtakavargaSignExtremes()).toBeNull();
    expect(
      getSarvashtakavargaSignExtremes(makeAshtakavarga([28, 27, 26])),
    ).toBeNull();
    expect(
      getSarvashtakavargaSignExtremes(
        makeAshtakavarga([28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, Number.NaN]),
      ),
    ).toBeNull();
  });
});

describe("getShadbalaRatioExtremes", () => {
  it("ranks planets by normalized Shadbala ratio before raw virupas", () => {
    const result = getShadbalaRatioExtremes([
      makeShadbala("Jupiter", 390, 1.0),
      makeShadbala("Mars", 360, 1.2),
      makeShadbala("Saturn", 300, 0.75),
    ]);

    expect(result?.strongest.planet).toBe("Mars");
    expect(result?.weakest.planet).toBe("Saturn");
  });

  it("returns null when no Shadbala results are supplied", () => {
    expect(getShadbalaRatioExtremes([])).toBeNull();
  });
});
