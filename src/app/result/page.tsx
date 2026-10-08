"use client";

import Image from "next/image";
import Link from "next/link";
import { Download, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { AppHeader } from "@/components/ui";
import {
  generationResponseSchema,
  type GenerationResponse,
} from "@/lib/schemas";

export default function ResultPage() {
  const { t } = useLocale();
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("kreirai-result");
    if (!raw) return;
    try {
      const parsed = generationResponseSchema.safeParse(JSON.parse(raw));
      if (parsed.success) queueMicrotask(() => setResult(parsed.data));
    } catch {
      sessionStorage.removeItem("kreirai-result");
    }
  }, []);

  if (!result) {
    return (
      <main className="result-shell">
        <AppHeader />
        <div className="empty-result">
          <h1>{t("error")}</h1>
          <Link href="/create" className="primary-button">{t("startAgain")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="result-shell">
      <AppHeader />
      <div className="result-main">
        <div className="result-image">
          <Image src={result.image} alt={result.lookName} fill unoptimized priority />
        </div>
        <section className="result-copy">
          <p className="eyebrow">{t("resultEyebrow")}</p>
          <h1>{result.lookName}</h1>
          <div className="result-actions">
            <button
              className="primary-button"
              onClick={() => setExplanationOpen(true)}
            >
              {t("whyThisLook")} <Sparkles size={17} />
            </button>
            <a
              className="secondary-button"
              href={result.image}
              download="kreirAI-look.png"
            >
              <Download size={17} /> {t("download")}
            </a>
            <Link href="/create" className="secondary-button">{t("startAgain")}</Link>
          </div>
          <p className="disclaimer">{t("disclaimer")}</p>
        </section>
      </div>

      {explanationOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setExplanationOpen(false)}>
          <section
            className="explanation-panel"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className="dialog-close" onClick={() => setExplanationOpen(false)}>
              <X size={19} />
            </button>
            <p className="eyebrow">AI analysis</p>
            <h2>{t("whyThisLook")}</h2>
            <div className="analysis-tags">
              <span>{result.analysis.skinTone}</span>
              <span>{result.analysis.eyeColor}</span>
              <span>{result.analysis.faceShape}</span>
              <span>{result.analysis.hairColor}</span>
            </div>
            <ul className="explanation-list">
              {result.explanation.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
