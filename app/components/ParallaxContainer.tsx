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
  const rafRef = useRef<number>(0);
  const enabledRef = useRef(true);
  const lastTimeRef = useRef<number>(0);

  /* Check for mobile / reduced-motion and disable */
  useEffect(() => {
    const mqlMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqlMobile = window.matchMedia("(max-width: 767px)");

    const update = () => {
      enabledRef.current = !mqlMotion.matches && !mqlMobile.matches;
      if (!enabledRef.current) {
        targetRef.current = { x: 0, y: 0 };
        currentRef.current = { x: 0, y: 0 };
        velocityRef.current = { x: 0, y: 0 };
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

  /* Track raw mouse position → normalised target */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!enabledRef.current) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetRef.current = { x: nx, y: ny };
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  /* rAF spring-physics loop */
  useEffect(() => {
    const STIFFNESS = 120;
    const DAMPING = 14;

    const tick = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      // clamp dt to avoid spring explosion on tab-switch
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.064);
      lastTimeRef.current = time;

      if (enabledRef.current) {
        const sx = springLerp(
          currentRef.current.x,
          targetRef.current.x,
          velocityRef.current.x,
          STIFFNESS,
          DAMPING,
          dt
        );
        const sy = springLerp(
          currentRef.current.y,
          targetRef.current.y,
          velocityRef.current.y,
          STIFFNESS,
          DAMPING,
          dt
        );
        currentRef.current = { x: sx.value, y: sy.value };
        velocityRef.current = { x: sx.velocity, y: sy.velocity };

        // only push state when values actually shifted enough to matter
        const dx = Math.abs(sx.value - pos.x);
        const dy = Math.abs(sy.value - pos.y);
        if (dx > 0.001 || dy > 0.001) {
          setPos({ x: sx.value, y: sy.value });
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ParallaxCtx.Provider value={pos}>
      <div className={className} style={style}>
        {children}
      </div>
    </ParallaxCtx.Provider>
  );
}
