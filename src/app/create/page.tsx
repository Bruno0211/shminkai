"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Info, Palette, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { AppHeader, Dialog } from "@/components/ui";

const options = [
  {
    id: "random",
    title: "surpriseTitle",
    body: "surpriseBody",
    href: "/create/random",
    icon: Sparkles,
  },
  {
    id: "custom",
    title: "customTitle",
    body: "customBody",
    href: "/create/custom",
    icon: Palette,
  },
] as const;

export default function CreatePage() {
  const { t } = useLocale();
  const [active, setActive] = useState(0);
  const [info, setInfo] = useState<number | null>(null);
  const startX = useRef(0);

  const selectFromSwipe = (endX: number) => {
    const delta = endX - startX.current;
    if (Math.abs(delta) > 45) setActive(delta < 0 ? 1 : 0);
  };

  return (
    <main className="page-shell selector-shell">
      <AppHeader backHref="/" />
      <div className="selector-main">
        <header className="section-heading">
          <p className="eyebrow">01 / 03</p>
          <h1>{t("choosePath")}</h1>
          <p>{t("choosePathBody")}</p>
        </header>

        <div className="selector-layout">
          <nav className="option-list" aria-label={t("choosePath")}>
            {options.map((option, index) => (
              <button
                key={option.id}
                className={index === active ? "active" : ""}
                onClick={() => setActive(index)}
                aria-current={index === active}
              >
                <small>0{index + 1}</small>
                <strong>{t(option.title)}</strong>
              </button>
            ))}
          </nav>

          <div
            className="option-deck"
            onTouchStart={(event) => (startX.current = event.touches[0].clientX)}
            onTouchEnd={(event) => selectFromSwipe(event.changedTouches[0].clientX)}
          >
            {options.map((option, index) => {
              const Icon = option.icon;
              return (
                <article
                  key={option.id}
                  className={`option-card ${index === active ? "active" : "passive"}`}
                  aria-hidden={index !== active}
                  onClick={() => setActive(index)}
                >
                  <button
                    className="icon-button option-card-info"
                    onClick={(event) => {
                      event.stopPropagation();
                      setInfo(index);
                    }}
                    aria-label={`Info: ${t(option.title)}`}
                    tabIndex={index === active ? 0 : -1}
                  >
                    <Info size={18} />
                  </button>
                  <div className="option-visual">
                    <Icon size={67} strokeWidth={1.15} />
                  </div>
                  <div className="option-card-copy">
                    <h2>{t(option.title)}</h2>
                    <p>{t(option.body)}</p>
                  </div>
                  <Link
                    href={option.href}
                    className="primary-button"
                    tabIndex={index === active ? 0 : -1}
                  >
                    {t("continue")}
                    <span>→</span>
                  </Link>
                  {index === active && (
                    <button
                      type="button"
                      className="option-slide-hint"
                      aria-label={t("switchOption")}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActive(active === 0 ? 1 : 0);
                      }}
                    >
                      {active === 0
                        ? <ChevronRight size={21} strokeWidth={2.4} />
                        : <ChevronLeft size={21} strokeWidth={2.4} />}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog
        open={info !== null}
        onClose={() => setInfo(null)}
        title={info === null ? "" : t(options[info].title)}
      >
        <p>{info === null ? "" : t(options[info].body)}</p>
      </Dialog>
    </main>
  );
}
