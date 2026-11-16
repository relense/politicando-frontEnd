"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

type Props = {
  value: number;
  /** Shows value / divisor with one decimal, e.g. 8,7 for 8 656 789 899 over a thousand million. */
  divisor?: number;
  className?: string;
};

const DURATION = 1400;

const oneDecimal = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * A number that counts up once it is on screen. The server renders the final value, so it is right without
 * JavaScript and for screen readers; people who prefer less motion just see it.
 */
export function CountUp({ value, divisor = 1, className }: Props) {
  const [shown, setShown] = useState(value);
  const element = useRef<HTMLSpanElement>(null);
  const text = (current: number) => (divisor === 1 ? formatNumber(Math.round(current)) : oneDecimal.format(current / divisor));

  useEffect(() => {
    const node = element.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION);
        // Ease out, so it slows into the final figure.
        setShown(value * (1 - (1 - progress) ** 3));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      setShown(0);
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span className={className}>
      <span className="sr-only">{text(value)}</span>
      <span ref={element} aria-hidden="true" className="tabular-nums">
        {text(shown)}
      </span>
    </span>
  );
}
