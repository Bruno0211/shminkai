"use client";

import Link from "next/link";
import { Info, X } from "lucide-react";
import { useEffect } from "react";
import { useLocale } from "./locale-provider";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="ShminkAI home">
      Shmink<span>AI</span>
    </Link>
  );
}

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="language-toggle" aria-label="Language">
      <button
        type="button"
        className={locale === "hr" ? "active" : ""}
        onClick={() => setLocale("hr")}
        aria-pressed={locale === "hr"}
      >
        HR
      </button>
      <span />
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}

export function AppHeader({
  onInfo,
  backHref,
}: {
  onInfo?: () => void;
  backHref?: string;
}) {
  return (
    <header className="app-header">
      <Brand href={backHref ?? "/"} />
      <div className="header-actions">
        <LanguageToggle />
        {onInfo && (
          <button className="icon-button" onClick={onInfo} aria-label="Info">
            <Info size={19} strokeWidth={1.7} />
          </button>
        )}
      </div>
    </header>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <p className="eyebrow">ShminkAI</p>
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog-content">{children}</div>
      </section>
    </div>
  );
}
