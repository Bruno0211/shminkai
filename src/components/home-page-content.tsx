"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { CarouselLook } from "@/lib/carousel";
import { BeforeAfterCarousel } from "@/components/before-after-carousel";
import { useLocale } from "@/components/locale-provider";
import { AppHeader, Dialog } from "@/components/ui";

// One timer drives both the headline ending and the Polaroid pair, so the
// cards change in sync with the text.
const SLIDE_MS = 3200;
const headlineEndings = ["homeTitleFace", "homeTitleNight", "homeTitleOutfit"] as const;

// The last words of the headline cycle through what the look adapts to.
// Screen readers and search get the full static title via aria-label.
function AnimatedHeadline({ step }: { step: number }) {
  const { t } = useLocale();
  const ending = headlineEndings[step % headlineEndings.length];

  return (
    <h1 aria-label={t("homeTitle")}>
      <span aria-hidden="true">
        {t("homeTitlePrefix")}{" "}
        <span className="headline-rotator">
          <span className="headline-ending" key={step}>{t(ending)}</span>
        </span>
      </span>
    </h1>
  );
}

export function HomePageContent({ looks }: { looks: CarouselLook[] }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { t } = useLocale();

  // Restarts after a manual dot click, so the next swap is a full interval away.
  useEffect(() => {
    const timer = window.setTimeout(() => setStep((current) => current + 1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  return (
    <main className="home-shell">
      <AppHeader onInfo={() => setInfoOpen(true)} />
      <div className="home-orb home-orb-one" />
      <div className="home-orb home-orb-two" />

      <section className="hero">
        <div className="hero-copy hero-copy-top">
          <p className="eyebrow">{t("brandTagline")}</p>
          <AnimatedHeadline step={step} />
        </div>
        <BeforeAfterCarousel looks={looks} step={step} onSelect={setStep} />
        <div className="hero-copy hero-copy-bottom">
          <p className="hero-body">{t("homeBody")}</p>
          <Link href="/create" className="primary-button">
            <span>{t("createLook")}</span>
            <ArrowUpRight size={20} />
          </Link>
          <p className="privacy-note">
            <ShieldCheck size={15} />
            {t("privacyShort")}
          </p>
        </div>
      </section>

      <Dialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={t("infoTitle")}
      >
        <p>{t("infoBody")}</p>
        <div className="dialog-privacy">
          <ShieldCheck size={20} />
          <span>{t("privacyShort")}</span>
        </div>
      </Dialog>
    </main>
  );
}
