"use client";

import { useRef, useEffect, useCallback } from "react";

/**
 * Data sent to the constellation worker.
 */
export type ChartWorkerInput = {
  planets: {
    name: string;
    longitude: number;
    sign: string;
    degree_in_sign: number;
    house: number;
    is_retrograde?: boolean;
  }[];
  ascendantSign: string;
};

/**
 * Data returned from the constellation worker.
 */
export type ChartWorkerOutput = {
  stars: { x: number; y: number; r: number; dur: number; delay: number }[];
  planetPositions: {
    name: string;
    longitude: number;
    sign: string;
    degree_in_sign: number;
    house: number;
    is_retrograde: boolean;
    angle: number;
    cx: number;
    cy: number;
  }[];
  conjunctionLines: { x1: number; y1: number; x2: number; y2: number }[];
};

/**
 * Hook that lazily creates a Web Worker for constellation chart calculations.
 *
 * - Returns a `compute` function that sends data to the worker and returns a
 *   Promise resolving with the computed result.
 * - Falls back to `null` (worker unavailable) so the caller can use
 *   synchronous computation instead. Check `workerAvailable` to decide.
 * - Cleans up the worker on unmount.
 */
export function useChartWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbackRef = useRef<((data: ChartWorkerOutput) => void) | null>(null);
  const availableRef = useRef<boolean | null>(null);

  // Lazily initialize the worker on first compute call
  const getWorker = useCallback((): Worker | null => {
    // Already determined unavailable
    if (availableRef.current === false) return null;

    // Already created
    if (workerRef.current) return workerRef.current;

    // SSR guard
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      availableRef.current = false;
      return null;
    }

    try {
      const worker = new Worker("/workers/constellation-worker.js");
      worker.onmessage = (e: MessageEvent<ChartWorkerOutput>) => {
        callbackRef.current?.(e.data);
        callbackRef.current = null;
      };
      worker.onerror = () => {
        // Worker failed to load — mark unavailable so future calls fall back
        availableRef.current = false;
        workerRef.current = null;
        callbackRef.current = null;
      };
      workerRef.current = worker;
      availableRef.current = true;
      return worker;
    } catch {
      availableRef.current = false;
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      callbackRef.current = null;
    };
  }, []);

  /**
   * Send data to the worker and get the result as a Promise.
   * Returns `null` if workers are unavailable (caller should fall back).
   */
  const compute = useCallback(
    (input: ChartWorkerInput): Promise<ChartWorkerOutput> | null => {
      const worker = getWorker();
      if (!worker) return null;

      return new Promise<ChartWorkerOutput>((resolve) => {
        callbackRef.current = resolve;
        worker.postMessage(input);
      });
    },
    [getWorker],
  );

  return { compute };
}
