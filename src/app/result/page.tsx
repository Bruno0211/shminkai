"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Download,
  ExternalLink,
  Shirt,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { AppHeader } from "@/components/ui";
import {
  generationResponseSchema,
  recommendationResponseSchema,
  type GenerationResponse,
  type ProductCategory,
  type ProductRecommendation,
} from "@/lib/schemas";

const productCategories: ProductCategory[] = [
  "complexion",
  "concealer",
  "blush",
  "bronzer",
  "eyeshadow",
  "eyeliner",
  "mascara",
  "brows",
  "lips",
];

const categoryTranslationKeys = {
  complexion: "categoryComplexion",
  concealer: "categoryConcealer",
  blush: "categoryBlush",
  bronzer: "categoryBronzer",
  eyeshadow: "categoryEyeshadow",
  eyeliner: "categoryEyeliner",
  mascara: "categoryMascara",
  brows: "categoryBrows",
  lips: "categoryLips",
} as const;

export default function ResultPage() {
  const { locale, t } = useLocale();
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [recommendations, setRecommendations] = useState<ProductRecommendation[] | null>(null);
  const [recommendationLocale, setRecommendationLocale] = useState("");
  const [activeProductCategory, setActiveProductCategory] =
    useState<ProductCategory>("complexion");

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

  useEffect(() => {
    if (!productsOpen && !explanationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductsOpen(false);
        setExplanationOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [productsOpen, explanationOpen]);

  const loadRecommendations = async () => {
    if (!result || productsLoading) return;
    setProductsError("");
    if (recommendationLocale !== locale) setRecommendations(null);
    setProductsLoading(true);
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, lookProfile: result.lookProfile }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error("Recommendation request failed");
      const parsed = recommendationResponseSchema.parse(data);
      setRecommendations(parsed.recommendations);
      setRecommendationLocale(locale);
    } catch {
      setProductsError(t("productError"));
    } finally {
      setProductsLoading(false);
    }
  };

  const openRecommendations = () => {
    setProductsOpen(true);
    if ((!recommendations || recommendationLocale !== locale) && !productsLoading) {
      void loadRecommendations();
    }
  };

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
          {result.outfit && (
            <p className="outfit-match">
              <Shirt size={15} />
              <span><strong>{t("outfitMatched")}:</strong> {result.outfit.summary}</span>
            </p>
          )}
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
              download="shminkAI-look.png"
            >
              <Download size={17} /> {t("download")}
            </a>
            <button
              type="button"
              className="secondary-button"
              onClick={openRecommendations}
            >
              <ShoppingBag size={17} /> {t("shopThisLook")}
            </button>
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
              {result.outfit?.colors.map((color) => <span key={color}>{color}</span>)}
            </div>
            <ul className="explanation-list">
              {result.explanation.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>
      )}

      {productsOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setProductsOpen(false)}>
          <section
            className="product-panel"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-title"
          >
            <button
              type="button"
              className="dialog-close"
              onClick={() => setProductsOpen(false)}
              aria-label={t("close")}
              autoFocus
            >
              <X size={19} />
            </button>
            <p className="eyebrow">{t("matchedProducts")}</p>
            <h2 id="products-title">{t("productsTitle")}</h2>
            <p className="product-panel-intro">{t("productsIntro")}</p>

            {productsLoading && (
              <div className="product-status" role="status" aria-live="polite">
                <p>{t("loadingProducts")}</p>
                <div
                  className="product-progress"
                  role="progressbar"
                  aria-label={t("productSearchProgress")}
                  aria-valuetext={t("loadingProducts")}
                >
                  <span />
                </div>
                <small>{t("productSearchWait")}</small>
              </div>
            )}
            {productsError && (
              <div className="product-status" role="alert">
                <p>{productsError}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void loadRecommendations()}
                >
                  {t("retry")}
                </button>
              </div>
            )}
            {recommendations && (
              <>
                <div
                  className="product-category-tabs"
                  role="tablist"
                  aria-label={t("productCategories")}
                >
                  {productCategories.map((category) => (
                    <button
                      type="button"
                      id={`product-tab-${category}`}
                      role="tab"
                      aria-selected={activeProductCategory === category}
                      aria-controls={`product-panel-${category}`}
                      className={activeProductCategory === category ? "active" : ""}
                      onClick={() => setActiveProductCategory(category)}
                      key={category}
                    >
                      {t(categoryTranslationKeys[category])}
                    </button>
                  ))}
                </div>
                <div className="product-groups">
                {productCategories.map((category) => {
                  if (category !== activeProductCategory) return null;
                  const products = recommendations.filter(
                    (recommendation) => recommendation.category === category,
                  ).sort((a, b) => b.matchScore - a.matchScore);
                  if (products.length === 0) return null;
                  return (
                    <section
                      className="product-group"
                      id={`product-panel-${category}`}
                      role="tabpanel"
                      aria-labelledby={`product-tab-${category}`}
                      key={category}
                    >
                      <h3>{t(categoryTranslationKeys[category])}</h3>
                      <div
                        className="product-grid"
                        role="list"
                        aria-label={t(categoryTranslationKeys[category])}
                        tabIndex={0}
                      >
                        {products.map((product, index) => (
                          <article className="product-card" key={product.id} role="listitem">
                            <div className="product-card-meta">
                              {index === 0 && <span>{t("bestMatch")}</span>}
                              {product.priceTier && (
                                <span>{product.priceTier === "affordable"
                                  ? t("priceAffordable")
                                  : t("pricePremium")}</span>
                              )}
                            </div>
                            <p className="product-brand">{product.brand}</p>
                            <h4>{product.name}</h4>
                            <p>{product.matchReason}</p>
                            <p className="shade-guidance">
                              <strong>{t("shadeGuidance")}:</strong> {product.shadeGuidance}
                            </p>
                            <a
                              className="product-link"
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {product.kind === "product" ? t("viewProduct") : t("searchShopping")}
                              {" · "}{product.retailer}
                              <ExternalLink size={15} />
                            </a>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
                </div>
              </>
            )}
            <p className="product-disclaimer">{t("productDisclaimer")}</p>
          </section>
        </div>
      )}
    </main>
  );
}
