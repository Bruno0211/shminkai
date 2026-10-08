"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { CarouselLook } from "@/lib/carousel";
import { BeforeAfterCarousel } from "@/components/before-after-carousel";
import { useLocale } from "@/components/locale-provider";
import { AppHeader, Dialog } from "@/components/ui";

export function HomePageContent({ looks }: { looks: CarouselLook[] }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { t } = useLocale();

  return (
    <main className="home-shell">
      <AppHeader onInfo={() => setInfoOpen(true)} />
      <div className="home-orb home-orb-one" />
      <div className="home-orb home-orb-two" />

      <section className="hero">
        <div className="hero-copy hero-copy-top">
          <p className="eyebrow">{t("brandTagline")}</p>
          <h1>{t("homeTitle")}</h1>
        </div>
        <BeforeAfterCarousel looks={looks} />
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
