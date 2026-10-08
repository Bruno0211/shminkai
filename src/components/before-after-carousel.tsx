"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale } from "./locale-provider";

const looks = [
  { before: "/look-natural.svg", after: "/look-rose.svg" },
  { before: "/look-rose.svg", after: "/look-natural.svg" },
];

export function BeforeAfterCarousel() {
  const [index, setIndex] = useState(0);
  const { t } = useLocale();

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % looks.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const look = looks[index];
  return (
    <div className="look-carousel" aria-live="polite">
      <div className="look-card look-card-before">
        <Image src={look.before} alt={`${t("before")} makeup`} fill priority sizes="(max-width: 700px) 58vw, 360px" />
        <span>{t("before")}</span>
      </div>
      <div className="look-card look-card-after">
        <Image src={look.after} alt={`${t("after")} makeup`} fill priority sizes="(max-width: 700px) 58vw, 360px" />
        <span>{t("after")}</span>
      </div>
      <div className="carousel-dots" aria-label="Slides">
        {looks.map((_, dot) => (
          <button
            type="button"
            key={dot}
            aria-label={`Slide ${dot + 1}`}
            aria-current={dot === index}
            onClick={() => setIndex(dot)}
          />
        ))}
      </div>
    </div>
  );
}
