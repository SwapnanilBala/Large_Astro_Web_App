"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/* ─── Shared mouse-position context ─── */
interface MousePos {
  /** normalised –1 … +1 horizontal (0 = centre) */
  x: number;
  /** normalised –1 … +1 vertical   (0 = centre) */
  y: number;
}

const ParallaxCtx = createContext<MousePos>({ x: 0, y: 0 });
export const useParallax = () => useContext(ParallaxCtx);

/* ─── Spring physics helper ─── */
function springLerp(current: number, target: number, velocity: number, stiffness: number, damping: number, dt: number) {
  const force = -stiffness * (current - target);
  const dampingForce = -damping * velocity;
  const newVelocity = velocity + (force + dampingForce) * dt;
  const newValue = current + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}

/* Below these the spring is close enough to its target that another frame
   would move nothing a person could see, so the loop stops. */
const SETTLE_DISTANCE = 0.0005;
const SETTLE_VELOCITY = 0.01;
/** Smallest change worth a React render. */
const EMIT_THRESHOLD = 0.001;

/* ─── ParallaxContainer ─── */
interface ParallaxContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function ParallaxContainer({
  children,
  className,
  style,
}: ParallaxContainerProps) {
  const [pos, setPos] = useState<MousePos>({ x: 0, y: 0 });
  const targetRef = useRef<MousePos>({ x: 0, y: 0 });
  const currentRef = useRef<MousePos>({ x: 0, y: 0 });
  const velocityRef = useRef<MousePos>({ x: 0, y: 0 });
  /** null when the loop is not running — also the guard against double-starting. */
  const rafRef = useRef<number | null>(null);
  const enabledRef = useRef(true);
  const lastTimeRef = useRef<number>(0);
  /** Last value handed to React. Compared against to decide if a render is worth it. */
  const emittedRef = useRef<MousePos>({ x: 0, y: 0 });
  /** Set by the loop effect so the pointer handler can wake it. */
  const startRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  /* Check for mobile / reduced-motion and disable */
  useEffect(() => {
    const mqlMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqlMobile = window.matchMedia("(max-width: 767px)");

    const update = () => {
      enabledRef.current = !mqlMotion.matches && !mqlMobile.matches;
      if (!enabledRef.current) {
        /* Park everything at centre and stop. Previously the loop kept
           requesting frames here and simply skipped the maths, so a phone or a
           reduced-motion visitor still paid a callback every frame forever. */
        stopRef.current();
        targetRef.current = { x: 0, y: 0 };
        currentRef.current = { x: 0, y: 0 };
        velocityRef.current = { x: 0, y: 0 };
        emittedRef.current = { x: 0, y: 0 };
        setPos({ x: 0, y: 0 });
      }
    };
    update();
    mqlMotion.addEventListener("change", update);
    mqlMobile.addEventListener("change", update);
    return () => {
      mqlMotion.removeEventListener("change", update);
      mqlMobile.removeEventListener("change", update);
    };
  }, []);

  /* Track raw mouse position → normalised target, and wake the spring. */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!enabledRef.current) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetRef.current = { x: nx, y: ny };
    startRef.current();
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  /*
   * Spring loop — runs only while the spring is actually moving.
   *
   * It used to call requestAnimationFrame unconditionally at the end of every
   * tick, so once mounted it woke on every frame for the life of the page even
   * with the pointer still and the spring long settled. Now the pointer handler
   * starts it and the settle check stops it.
   *
   * No visibilitychange handling: requestAnimationFrame does not fire on a
   * hidden document, so a backgrounded tab already costs nothing, and dt is
   * clamped below to keep the first frame after returning from exploding.
   */
  useEffect(() => {
    const STIFFNESS = 120;
    const DAMPING = 14;

    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = 0;
    };

    const tick = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      // clamp dt to avoid spring explosion on tab-switch
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.064);
      lastTimeRef.current = time;

      if (!enabledRef.current) {
        rafRef.current = null;
        return;
      }

      const target = targetRef.current;
      const sx = springLerp(currentRef.current.x, target.x, velocityRef.current.x, STIFFNESS, DAMPING, dt);
      const sy = springLerp(currentRef.current.y, target.y, velocityRef.current.y, STIFFNESS, DAMPING, dt);

      const settled =
        Math.abs(sx.value - target.x) < SETTLE_DISTANCE &&
        Math.abs(sy.value - target.y) < SETTLE_DISTANCE &&
        Math.abs(sx.velocity) < SETTLE_VELOCITY &&
        Math.abs(sy.velocity) < SETTLE_VELOCITY;

      if (settled) {
        /* Snap to the target so stopping cannot leave a sub-threshold offset
           frozen on screen. */
        currentRef.current = { x: target.x, y: target.y };
        velocityRef.current = { x: 0, y: 0 };
      } else {
        currentRef.current = { x: sx.value, y: sy.value };
        velocityRef.current = { x: sx.velocity, y: sy.velocity };
      }

      /* Compare against the last value actually handed to React. This used to
         read `pos` from a closure with an empty dependency array, so it was
         pinned at the initial {0,0} and the check never suppressed anything. */
      const dx = Math.abs(currentRef.current.x - emittedRef.current.x);
      const dy = Math.abs(currentRef.current.y - emittedRef.current.y);
      if (settled || dx > EMIT_THRESHOLD || dy > EMIT_THRESHOLD) {
        emittedRef.current = currentRef.current;
        setPos(currentRef.current);
      }

      if (settled) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafRef.current !== null || !enabledRef.current) return;
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    };

    startRef.current = start;
    stopRef.current = stop;
    return stop;
  }, []);

  return (
    <ParallaxCtx.Provider value={pos}>
      <div className={className} style={style}>
        {children}
      </div>
    </ParallaxCtx.Provider>
  );
}
