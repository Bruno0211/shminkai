"use client";

import {
  Briefcase,
  Camera,
  Check,
  Dices,
  Heart,
  PartyPopper,
  PenLine,
  Plus,
  Sun,
  Wine,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocale } from "./locale-provider";
import type { Locale, Preferences } from "@/lib/schemas";

type Intensity = NonNullable<Preferences["intensity"]>;
type Finish = NonNullable<Preferences["finish"]>;

const occasions: Array<{ key: string; icon: LucideIcon; label: Record<Locale, string> }> = [
  { key: "everyday", icon: Sun, label: { hr: "Dnevni", en: "Everyday" } },
  { key: "work", icon: Briefcase, label: { hr: "Posao", en: "Work" } },
  { key: "night", icon: Wine, label: { hr: "Večer van", en: "Night out" } },
  { key: "wedding", icon: Heart, label: { hr: "Vjenčanje", en: "Wedding" } },
  { key: "party", icon: PartyPopper, label: { hr: "Party", en: "Party" } },
  { key: "photo", icon: Camera, label: { hr: "Fotkanje", en: "Photoshoot" } },
];

// Values match the AI's color families, so picks map directly onto the look plan.
const palette: Array<{ value: string; hex: string; label: Record<Locale, string> }> = [
  { value: "nude", hex: "#c9967c", label: { hr: "Nude", en: "Nude" } },
  { value: "rose", hex: "#d46a85", label: { hr: "Ružičasta", en: "Rose" } },
  { value: "peach", hex: "#f2a07b", label: { hr: "Breskva", en: "Peach" } },
  { value: "red", hex: "#c8102e", label: { hr: "Crvena", en: "Red" } },
  { value: "berry", hex: "#8e1b4e", label: { hr: "Bobičasta", en: "Berry" } },
  { value: "plum", hex: "#6b2d5c", label: { hr: "Šljiva", en: "Plum" } },
  { value: "bronze", hex: "#a8642e", label: { hr: "Bronca", en: "Bronze" } },
  { value: "gold", hex: "#d4a73a", label: { hr: "Zlatna", en: "Gold" } },
];
const MAX_COLORS = 3;

const intensities: Intensity[] = ["soft", "medium", "bold"];
const finishes: Finish[] = ["natural", "matte", "glowy", "satin"];

const wishSuggestions: Record<Locale, string[]> = {
  hr: ["Mačje oko", "Crveni ruž", "Bez sjenila", "Glitter", "Prirodne obrve", "Grafički eyeliner"],
  en: ["Cat eye", "Red lips", "No eyeshadow", "Glitter", "Natural brows", "Graphic liner"],
};

const SHUFFLE_STEPS = 7;
const SHUFFLE_STEP_MS = 85;

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomColors() {
  const shuffled = [...palette].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.floor(Math.random() * 2)).map((color) => color.value);
}

function hasWish(wishes: string, wish: string) {
  return wishes.split(",").some((part) => part.trim().toLowerCase() === wish.toLowerCase());
}

function toggleWish(wishes: string, wish: string) {
  const parts = wishes.split(",").map((part) => part.trim()).filter(Boolean);
  const next = hasWish(wishes, wish)
    ? parts.filter((part) => part.toLowerCase() !== wish.toLowerCase())
    : [...parts, wish];
  return next.join(", ").slice(0, 500);
}

export function LookBuilder({
  value,
  onChange,
  outfit,
}: {
  value: Preferences;
  onChange: Dispatch<SetStateAction<Preferences>>;
  outfit: ReactNode;
}) {
  const { locale, t } = useLocale();
  const [occasionKey, setOccasionKey] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [shuffling, setShuffling] = useState(false);
  const shuffleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(shuffleTimer.current), []);

  const set = (next: Partial<Preferences>) => {
    onChange((current) => ({ ...current, ...next }));
  };

  const chooseOccasion = (key: string) => {
    setOccasionKey(key);
    const preset = occasions.find((occasion) => occasion.key === key);
    set({ occasion: preset ? preset.label[locale] : "" });
  };

  const applyColors = (next: string[]) => {
    setColors(next);
    set({ colors: next.join(", ") });
  };

  const toggleColor = (color: string) => {
    if (colors.includes(color)) applyColors(colors.filter((item) => item !== color));
    else if (colors.length < MAX_COLORS) applyColors([...colors, color]);
  };

  const surprise = () => {
    const randomLook = () => {
      const occasion = pick(occasions);
      const nextColors = randomColors();
      setOccasionKey(occasion.key);
      setColors(nextColors);
      return {
        occasion: occasion.label[locale],
        intensity: pick(intensities),
        finish: pick(finishes),
        colors: nextColors.join(", "),
      };
    };
    window.clearInterval(shuffleTimer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onChange((current) => ({ ...current, ...randomLook() }));
      return;
    }
    let step = 0;
    setShuffling(true);
    shuffleTimer.current = window.setInterval(() => {
      onChange((current) => ({ ...current, ...randomLook() }));
      step += 1;
      if (step >= SHUFFLE_STEPS) {
        window.clearInterval(shuffleTimer.current);
        setShuffling(false);
      }
    }, SHUFFLE_STEP_MS);
  };

  const intensityIndex = intensities.indexOf(value.intensity ?? "soft");
  const selectedPalette = colors
    .map((color) => palette.find((item) => item.value === color))
    .filter((item) => item !== undefined);
  const occasionLabel = occasionKey === "other"
    ? value.occasion
    : occasions.find((occasion) => occasion.key === occasionKey)?.label[locale];

  return (
    <div
      className={`look-builder${shuffling ? " is-shuffling" : ""}`}
      style={{ "--look-intensity": String(0.45 + intensityIndex * 0.275) } as CSSProperties}
    >
      <div className="look-builder-head">
        <h2>{t("lookBuilderTitle")}</h2>
        <button type="button" className="surprise-button" onClick={surprise}>
          <Dices size={17} /> {t("surpriseMe")}
        </button>
      </div>

      <div className="look-summary" aria-live="polite">
        {occasionLabel && <span>{occasionLabel}</span>}
        <span>{t(value.intensity ?? "soft")}</span>
        {selectedPalette.length > 0 && (
          <span className="look-summary-colors" aria-label={selectedPalette.map((c) => c.label[locale]).join(", ")}>
            {selectedPalette.map((color) => (
              <i key={color.value} style={{ background: color.hex }} />
            ))}
          </span>
        )}
        <span>{t(value.finish ?? "natural")}</span>
      </div>

      <div className="field">
        <span>{t("occasion")}</span>
        <div className="occasion-row">
          {occasions.map(({ key, icon: Icon, label }) => (
            <button
              type="button"
              key={key}
              className="occasion-card"
              aria-pressed={occasionKey === key}
              onClick={() => chooseOccasion(occasionKey === key ? "" : key)}
            >
              <Icon size={22} />
              <span>{label[locale]}</span>
            </button>
          ))}
          <button
            type="button"
            className="occasion-card"
            aria-pressed={occasionKey === "other"}
            onClick={() => chooseOccasion(occasionKey === "other" ? "" : "other")}
          >
            <PenLine size={22} />
            <span>{t("occasionOther")}</span>
          </button>
        </div>
        {occasionKey === "other" && (
          <input
            className="occasion-other-input"
            value={value.occasion ?? ""}
            maxLength={60}
            placeholder={t("occasionPlaceholder")}
            aria-label={t("occasion")}
            autoFocus
            onChange={(event) => set({ occasion: event.target.value })}
          />
        )}
      </div>

      <div className="field">
        <span>{t("intensity")}</span>
        <div className="intensity-slider">
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={intensityIndex}
            aria-label={t("intensity")}
            aria-valuetext={t(intensities[intensityIndex])}
            onChange={(event) => set({ intensity: intensities[Number(event.target.value)] })}
          />
          <div className="intensity-labels" aria-hidden="true">
            {intensities.map((item, index) => (
              <button
                type="button"
                tabIndex={-1}
                key={item}
                className={index === intensityIndex ? "active" : ""}
                onClick={() => set({ intensity: item })}
              >
                {t(item)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <span>
          {t("paletteTitle")} <small>{t("paletteHint")}</small>
        </span>
        <div className="palette-grid">
          {palette.map((color) => {
            const selected = colors.includes(color.value);
            const full = !selected && colors.length >= MAX_COLORS;
            return (
              <button
                type="button"
                key={color.value}
                className="swatch"
                aria-pressed={selected}
                aria-label={color.label[locale]}
                title={color.label[locale]}
                disabled={full}
                onClick={() => toggleColor(color.value)}
              >
                <i style={{ background: color.hex }}>{selected && <Check size={15} />}</i>
              </button>
            );
          })}
        </div>
        <p className="palette-picked" aria-live="polite">
          {selectedPalette.length > 0
            ? selectedPalette.map((color) => color.label[locale]).join(" · ")
            : t("paletteEmpty")}
        </p>
      </div>

      <div className="field">
        <span>{t("finish")}</span>
        <div className="finish-grid">
          {finishes.map((item) => (
            <button
              type="button"
              key={item}
              className={`finish-tile finish-${item}`}
              aria-pressed={value.finish === item}
              onClick={() => set({ finish: item })}
            >
              <i aria-hidden="true" />
              <span>{t(item)}</span>
            </button>
          ))}
        </div>
      </div>

      {outfit}

      <div className="field">
        <span>{t("wishes")}</span>
        <div className="wish-chips">
          {wishSuggestions[locale].map((wish) => {
            const active = hasWish(value.wishes ?? "", wish);
            return (
              <button
                type="button"
                key={wish}
                aria-pressed={active}
                onClick={() => set({ wishes: toggleWish(value.wishes ?? "", wish) })}
              >
                {active ? <Check size={13} /> : <Plus size={13} />} {wish}
              </button>
            );
          })}
        </div>
        <textarea
          className="wish-input"
          value={value.wishes ?? ""}
          maxLength={500}
          placeholder={t("wishesPlaceholder")}
          aria-label={t("wishes")}
          onChange={(event) => set({ wishes: event.target.value })}
        />
      </div>
    </div>
  );
}
