import { useEffect, useState } from "react";

/** A ticking series with a per-node character: stable seed, gentle drift, occasional spike. */
export const useFakeSeries = (seed: string, length = 40, intervalMs = 800): number[] => {
  const [series, setSeries] = useState<number[]>(() => {
    let value = (hash(seed) % 50) + 25;
    return Array.from({ length }, (_, index) => {
      value = step(value, hash(`${seed}:${index}`));
      return value;
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSeries((previous) => {
        const last = previous[previous.length - 1] ?? 50;
        return [...previous.slice(1), step(last, hash(`${seed}:${Date.now()}`))];
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [seed, intervalMs]);

  return series;
};

const hash = (input: string): number => {
  let value = 2166136261;
  for (const character of input) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return value;
};

const step = (previous: number, noise: number): number => {
  const drift = (noise % 21) - 10;
  const spike = noise % 97 === 0 ? 35 : 0;
  return Math.max(2, Math.min(100, previous + drift * 0.6 + spike));
};
