"use client";

import Image from "next/image";
import { useState } from "react";
import type { CarouselLook } from "@/lib/carousel";
import { useLocale } from "./locale-provider";

function LookPair({
  look,
  className,
  decorative = false,
  onAnimationEnd,
}: {
  look: CarouselLook;
  className: string;
  decorative?: boolean;
  onAnimationEnd?: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className={className} aria-hidden={decorative || undefined}>
      <div className="look-card look-card-before">
        <div className="look-card-photo">
          <Image src={look.before} alt={decorative ? "" : `${t("before")} makeup`} fill priority sizes="(max-width: 700px) 68vw, 520px" />
        </div>
        <span>{t("before")}</span>
      </div>
      <div className="look-card look-card-after" onAnimationEnd={onAnimationEnd}>
        <div className="look-card-photo">
          <Image src={look.after} alt={decorative ? "" : `${t("after")} makeup`} fill priority sizes="(max-width: 700px) 68vw, 520px" />
        </div>
        <span>{t("after")}</span>
      </div>
    </div>
  );
}

// `step` comes from the home page timer that also swaps the headline ending, so
// each swap drops the current pair out to the bottom left and raises the next
// one from the bottom right. The swap ends when the new pair has settled.
export function BeforeAfterCarousel({
  looks,
  step,
  onSelect,
}: {
  looks: CarouselLook[];
  step: number;
  onSelect: (step: number) => void;
}) {
  const count = Math.max(looks.length, 1);
  const index = step % count;
  const [shownStep, setShownStep] = useState(step);
  const [leaving, setLeaving] = useState<{ index: number; step: number } | null>(null);

  // Adjust state during render when the step changes (no extra effect pass).
  if (step !== shownStep) {
    const previousIndex = shownStep % count;
    setShownStep(step);
    setLeaving(previousIndex === index ? null : { index: previousIndex, step: shownStep });
  }

  const look = looks[index] ?? looks[0];
  if (!look) return null;
  const leavingLook = leaving ? looks[leaving.index] : undefined;

  return (
    <div className={`look-carousel${leaving ? " is-swapping" : ""}`} aria-live="polite">
      {leaving && leavingLook && (
        <LookPair
          key={`leaving-${leaving.step}`}
          look={leavingLook}
          className="look-pair is-leaving"
          decorative
        />
      )}
      <LookPair
        key={`pair-${step}`}
        look={look}
        className={`look-pair${leaving ? " is-entering" : ""}`}
        onAnimationEnd={leaving ? () => setLeaving(null) : undefined}
      />
      <div className="carousel-dots" aria-label="Slides">
        {looks.map((_, dot) => (
          <button
            type="button"
            key={dot}
            aria-label={`Slide ${dot + 1}`}
            aria-current={dot === index}
            onClick={() => {
              if (dot !== index) onSelect(step + ((dot - index + count) % count));
            }}
          />
        ))}
      </div>
    </div>
  );
}
