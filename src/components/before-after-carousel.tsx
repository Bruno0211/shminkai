"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { CarouselLook } from "@/lib/carousel";
import { useLocale } from "./locale-provider";

export function BeforeAfterCarousel({ looks }: { looks: CarouselLook[] }) {
  const [index, setIndex] = useState(0);
  const { t } = useLocale();

  useEffect(() => {
    if (looks.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % looks.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [looks.length]);

  const look = looks[index] ?? looks[0];
  if (!look) return null;

  return (
    <div className="look-carousel" aria-live="polite">
      <div className="look-card look-card-before">
        <div className="look-card-photo">
          <Image src={look.before} alt={`${t("before")} makeup`} fill priority sizes="(max-width: 700px) 68vw, 520px" />
        </div>
        <span>{t("before")}</span>
      </div>
      <div className="look-card look-card-after">
        <div className="look-card-photo">
          <Image src={look.after} alt={`${t("after")} makeup`} fill priority sizes="(max-width: 700px) 68vw, 520px" />
        </div>
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
