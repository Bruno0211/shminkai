"use client";

import Image from "next/image";
import { ChevronsLeftRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./locale-provider";

// Positions (percent) the handle sweeps through once on load, so people see the
// image can be dragged.
const HINT_SWEEP = [22, 78, 50];
const HINT_STEP_MS = 650;

export function BeforeAfterSlider({
  before,
  after,
  alt,
}: {
  before: string;
  after: string;
  alt: string;
}) {
  const { t } = useLocale();
  const [position, setPosition] = useState(50);
  const [hinting, setHinting] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = window.setTimeout(() => setHinting(true), 500);
    const steps = HINT_SWEEP.map((value, index) =>
      window.setTimeout(() => setPosition(value), 600 + index * HINT_STEP_MS));
    const end = window.setTimeout(
      () => setHinting(false),
      600 + HINT_SWEEP.length * HINT_STEP_MS,
    );
    timers.current = [start, ...steps, end];
    return () => timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const move = (value: number) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setHinting(false);
    setPosition(value);
  };

  return (
    <div
      className={`compare${hinting ? " compare-hinting" : ""}`}
      style={{ "--compare-position": `${position}%` } as React.CSSProperties}
    >
      <Image src={after} alt={alt} fill unoptimized priority />
      <div className="compare-before" aria-hidden="true">
        <Image src={before} alt="" fill unoptimized priority />
      </div>
      <span className="compare-label compare-label-before" aria-hidden="true">{t("before")}</span>
      <span className="compare-label compare-label-after" aria-hidden="true">{t("after")}</span>
      <div className="compare-handle" aria-hidden="true">
        <span><ChevronsLeftRight size={18} /></span>
      </div>
      <input
        className="compare-range"
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label={t("compareSlider")}
        aria-valuetext={`${t("before")} ${position}%`}
        onChange={(event) => move(Number(event.target.value))}
      />
    </div>
  );
}
