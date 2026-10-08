"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Shirt, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "./locale-provider";
import { AppHeader } from "./ui";
import { resizeImage } from "@/lib/resize-image";
import type { Preferences } from "@/lib/schemas";

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

export function GenerationFlow({ mode }: { mode: "random" | "custom" }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [outfit, setOutfit] = useState<File | null>(null);
  const [outfitPreview, setOutfitPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    intensity: "soft",
    finish: "natural",
  });

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (outfitPreview) URL.revokeObjectURL(outfitPreview);
    };
  }, [outfitPreview]);

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

  const chooseOutfit = (file?: File) => {
    setError("");
    if (!file || !VALID_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setError(t("invalidPhoto"));
      return;
    }
    if (outfitPreview) URL.revokeObjectURL(outfitPreview);
    setOutfit(file);
    setOutfitPreview(URL.createObjectURL(file));
  };

  const removeOutfit = () => {
    if (outfitPreview) URL.revokeObjectURL(outfitPreview);
    setOutfit(null);
    setOutfitPreview("");
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
      form.append("photo", await resizeImage(photo));
      if (mode === "custom" && outfit) form.append("outfit", await resizeImage(outfit));
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
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(null);
      setPreview("");
      removeOutfit();
      setConsent(false);
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
                <div className="capture-choice">
                  <div className="capture-choice-heading">
                    <div className="capture-icon"><Camera size={27} /></div>
                    <strong>{t("choosePhotoSource")}</strong>
                    <span>{t("choosePhotoSourceHint")}</span>
                  </div>
                  <div className="source-choice-buttons">
                    <button
                      type="button"
                      className="source-choice source-choice-camera"
                      onClick={() => setCameraOpen(true)}
                    >
                      <Camera size={24} />
                      <span>
                        <strong>{t("openCamera")}</strong>
                        <small>{t("liveCameraHint")}</small>
                      </span>
                    </button>
                    <label className="source-choice source-choice-gallery">
                      <ImagePlus size={24} />
                      <span>
                        <strong>{t("chooseGallery")}</strong>
                        <small>{t("galleryHint")}</small>
                      </span>
                      <input
                        className="source-choice-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label={t("chooseGallery")}
                        onChange={(event) => choosePhoto(event.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {preview && (
              <div className="capture-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera size={17} />
                  {t("retakeLive")}
                </button>
                <label className="secondary-button inline-file">
                  <ImagePlus size={17} />
                  {t("chooseGallery")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => choosePhoto(event.target.files?.[0])}
                  />
                </label>
              </div>
            )}
          </section>

          <section className="preferences-card">
            {mode === "custom" ? (
              <PreferencesForm
                value={preferences}
                onChange={setPreferences}
                outfit={(
                  <OutfitPicker
                    preview={outfitPreview}
                    onChoose={chooseOutfit}
                    onRemove={removeOutfit}
                  />
                )}
              />
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
      {cameraOpen && (
        <LiveCamera
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            choosePhoto(file);
            setCameraOpen(false);
          }}
        />
      )}
    </main>
  );
}

function LiveCamera({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t("cameraUnsupported"));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        if (mounted) setCameraError(t("cameraPermissionError"));
      }
    };

    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [t]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], "live-camera.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="camera-backdrop" role="presentation">
      <section
        className="camera-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label={t("close")}>
          <X size={20} />
        </button>
        <p className="eyebrow">shminkAI camera</p>
        <h2 id="camera-title">{t("cameraTitle")}</h2>
        <div className="camera-view">
          <video ref={videoRef} playsInline muted aria-label={t("cameraTitle")} />
          {!ready && !cameraError && <div className="camera-loading">{t("cameraStarting")}</div>}
          {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}
          {ready && <div className="face-guide" aria-hidden="true" />}
        </div>
        <div className="camera-dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={capture}
            disabled={!ready}
          >
            <Camera size={18} />
            {t("capturePhoto")}
          </button>
        </div>
      </section>
    </div>
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

function OutfitPicker({
  preview,
  onChoose,
  onRemove,
}: {
  preview: string;
  onChoose: (file?: File) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="field">
      <span>{t("outfitLabel")}</span>
      {preview ? (
        <div className="outfit-selected">
          <div className="outfit-thumb">
            <Image src={preview} alt={t("outfitPreviewAlt")} fill unoptimized />
          </div>
          <p>{t("outfitSelected")}</p>
          <button type="button" className="outfit-remove" onClick={onRemove}>
            <X size={15} /> {t("outfitRemove")}
          </button>
        </div>
      ) : (
        <label className="source-choice source-choice-gallery outfit-upload">
          <Shirt size={22} />
          <span>
            <strong>{t("outfitUpload")}</strong>
            <small>{t("outfitHint")}</small>
          </span>
          <input
            className="source-choice-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t("outfitUpload")}
            onChange={(event) => {
              onChoose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function PreferencesForm({
  value,
  onChange,
  outfit,
}: {
  value: Preferences;
  onChange: (value: Preferences) => void;
  outfit: ReactNode;
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
      {outfit}
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
