"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "./locale-provider";
import { AppHeader } from "./ui";
import type { Preferences } from "@/lib/schemas";

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

export function GenerationFlow({ mode }: { mode: "random" | "custom" }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    intensity: "soft",
    finish: "natural",
  });

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const choosePhoto = (file?: File) => {
    setError("");
    if (!file || !VALID_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setError(t("invalidPhoto"));
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    setError("");
    if (!photo) {
      setError(t("invalidPhoto"));
      return;
    }
    if (!consent) {
      setError(t("consentRequired"));
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("photo", photo);
      form.append(
        "metadata",
        JSON.stringify({
          mode,
          locale,
          preferences: mode === "custom" ? preferences : undefined,
        }),
      );
      const response = await fetch("/api/generate", { method: "POST", body: form });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error("Generation failed");
      sessionStorage.setItem("kreirai-result", JSON.stringify(data));
      router.push("/result");
    } catch {
      setError(t("error"));
      setLoading(false);
    }
  };

  return (
    <main className="page-shell flow-shell">
      <AppHeader backHref="/create" />
      <div className="flow-main">
        <header className="flow-heading">
          <p className="eyebrow">02 / 03</p>
          <h1>{t("photoTitle")}</h1>
          <p>{t("photoBody")}</p>
        </header>

        <div className="flow-grid">
          <section className="capture-card">
            <div className="capture-area">
              {preview ? (
                <Image src={preview} alt="Face preview" fill unoptimized />
              ) : (
                <div className="capture-placeholder">
                  <div className="capture-icon"><Camera size={27} /></div>
                  <strong>{t("takePhoto")}</strong>
                  <span>{t("uploadPhoto")}</span>
                </div>
              )}
              {!preview && (
                <input
                  className="file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={(event) => choosePhoto(event.target.files?.[0])}
                  aria-label={t("takePhoto")}
                />
              )}
            </div>

            {preview && (
              <div className="capture-actions">
                <label className="secondary-button inline-file">
                  <ImagePlus size={17} />
                  {t("retake")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={(event) => choosePhoto(event.target.files?.[0])}
                  />
                </label>
              </div>
            )}
          </section>

          <section className="preferences-card">
            {mode === "custom" ? (
              <PreferencesForm value={preferences} onChange={setPreferences} />
            ) : (
              <>
                <p className="eyebrow">AI analysis</p>
                <h2>{t("surpriseTitle")}</h2>
                <p className="hero-body">{t("surpriseBody")}</p>
                <FeaturePills />
              </>
            )}

            <label className="consent-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>{t("consent")}</span>
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button
              type="button"
              className="primary-button flow-submit"
              onClick={submit}
              disabled={!photo || loading}
            >
              {t("generate")} <span>✦</span>
            </button>
          </section>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay" role="status">
          <div className="loading-face"><div className="scan-line" /></div>
          <h2>{t("generating")}</h2>
          <p>{t("generatingBody")}</p>
        </div>
      )}
    </main>
  );
}

function FeaturePills() {
  return (
    <div className="feature-pills">
      {["Skin tone", "Eye color", "Hair color", "Face shape"].map((feature) => (
        <span key={feature}>{feature}</span>
      ))}
    </div>
  );
}

function PreferencesForm({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (value: Preferences) => void;
}) {
  const { t } = useLocale();
  const set = <K extends keyof Preferences>(key: K, next: Preferences[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <>
      <h2>{t("requirementsTitle")}</h2>
      <label className="field">
        <span>{t("occasion")}</span>
        <input
          value={value.occasion ?? ""}
          maxLength={60}
          placeholder="Date night, wedding…"
          onChange={(event) => set("occasion", event.target.value)}
        />
      </label>
      <div className="field">
        <span>{t("intensity")}</span>
        <div className="choice-grid">
          {(["soft", "medium", "bold"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={value.intensity === item ? "active" : ""}
              onClick={() => set("intensity", item)}
            >
              {t(item)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{t("colors")}</span>
        <input
          value={value.colors ?? ""}
          maxLength={120}
          placeholder="Berry, bronze, rose…"
          onChange={(event) => set("colors", event.target.value)}
        />
      </label>
      <div className="field">
        <span>{t("finish")}</span>
        <div className="choice-grid four">
          {(["natural", "matte", "glowy", "satin"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={value.finish === item ? "active" : ""}
              onClick={() => set("finish", item)}
            >
              {t(item)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{t("wishes")}</span>
        <textarea
          value={value.wishes ?? ""}
          maxLength={500}
          onChange={(event) => set("wishes", event.target.value)}
        />
      </label>
    </>
  );
}
