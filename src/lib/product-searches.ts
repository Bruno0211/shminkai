import type {
  Locale,
  LookProfile,
  ProductCategory,
  ProductRecommendation,
} from "./schemas";
import { retailers, type Retailer } from "./retailers";

const croatianLabels: Record<string, string> = {
  natural: "prirodni",
  matte: "mat",
  radiant: "blistavi",
  satin: "satenski",
  glossy: "sjajni",
  soft: "nježni",
  medium: "srednji",
  bold: "odvažni",
  fair: "vrlo svijetla",
  light: "svijetla",
  tan: "preplanula",
  deep: "duboka",
  cool: "hladni",
  neutral: "neutralni",
  warm: "topli",
  olive: "maslinasti",
  rose: "ružičasti",
  peach: "breskvasti",
  coral: "koraljni",
  berry: "bobičasti",
  mauve: "ljubičasto-ružičasti",
  red: "crveni",
  nude: "nude",
  brown: "smeđi",
  bronze: "brončani",
  gold: "zlatni",
  champagne: "šampanj",
  taupe: "sivo-smeđi",
  plum: "boje šljive",
  black: "crni",
  auburn: "kestenjasti",
  blonde: "plavi",
};

function display(value: string, locale: Locale) {
  return locale === "hr" ? (croatianLabels[value] ?? value) : value;
}

function shoppingUrl(query: string, locale: Locale, retailer?: Retailer) {
  const sites = retailer
    ? `site:${retailer.domain}`
    : retailers.map((item) => `site:${item.domain}`).join(" OR ");
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("hl", locale);
  url.searchParams.set("q", `${query} (${sites})`);
  return url.toString();
}

export type CategorySearch = {
  category: ProductCategory;
  query: string;
  name: string;
  shadeGuidance: string;
  matchReason: string;
};

export function buildCategorySearches({
  lookProfile,
  locale,
}: {
  lookProfile: LookProfile;
  locale: Locale;
}): CategorySearch[] {
  const {
    intensity,
    complexionDepth,
    complexionUndertone,
    complexionFinish,
    blushFamily,
    bronzerFamily,
    eyeFamilies,
    eyelinerColor,
    mascaraColor,
    browColor,
    lipFamily,
    lipFinish,
  } = lookProfile;
  const hr = locale === "hr";
  const eyeColors = eyeFamilies.map((color) => display(color, locale)).join(", ");

  return [
    {
      category: "complexion",
      query: `${complexionDepth} ${complexionUndertone} undertone ${complexionFinish} finish foundation shade`,
      name: hr
        ? `Puder – ${display(complexionDepth, locale)}, ${display(complexionUndertone, locale)} podton`
        : `${display(complexionDepth, locale)}, ${display(complexionUndertone, locale)} foundation`,
      shadeGuidance: hr
        ? `${display(complexionDepth, locale)} dubina, ${display(complexionUndertone, locale)} podton`
        : `${display(complexionDepth, locale)} depth, ${display(complexionUndertone, locale)} undertone`,
      matchReason: hr
        ? "Prati procijenjenu dubinu, podton i završetak tena."
        : "Matches the estimated complexion depth, undertone, and finish.",
    },
    {
      category: "concealer",
      query: `${complexionDepth} ${complexionUndertone} undertone concealer shade`,
      name: hr
        ? `Korektor – ${display(complexionDepth, locale)}, ${display(complexionUndertone, locale)} podton`
        : `${display(complexionDepth, locale)}, ${display(complexionUndertone, locale)} concealer`,
      shadeGuidance: hr
        ? `${display(complexionDepth, locale)} dubina, ${display(complexionUndertone, locale)} podton`
        : `${display(complexionDepth, locale)} depth, ${display(complexionUndertone, locale)} undertone`,
      matchReason: hr
        ? "Prati procijenjenu dubinu i podton tena."
        : "Matches the estimated complexion depth and undertone.",
    },
    {
      category: "blush",
      query: `${blushFamily} blush`,
      name: hr ? `${display(blushFamily, locale)} rumenilo` : `${display(blushFamily, locale)} blush`,
      shadeGuidance: display(blushFamily, locale),
      matchReason: hr ? "Prati dominantnu boju rumenila." : "Matches the look's dominant blush family.",
    },
    {
      category: "bronzer",
      query: `${bronzerFamily} bronzer`,
      name: hr ? `${display(bronzerFamily, locale)} bronzer` : `${display(bronzerFamily, locale)} bronzer`,
      shadeGuidance: display(bronzerFamily, locale),
      matchReason: hr ? "Prati toplinu i definiciju looka." : "Matches the look's warmth and definition.",
    },
    {
      category: "eyeshadow",
      query: `${eyeFamilies.join(" ")} eyeshadow palette`,
      name: hr ? `Sjenila: ${eyeColors}` : `${eyeColors} eyeshadow`,
      shadeGuidance: eyeColors,
      matchReason: hr ? "Traži palete s bojama generiranog looka." : "Finds palettes with the generated look's colors.",
    },
    {
      category: "eyeliner",
      query: `${eyelinerColor} eyeliner`,
      name: hr ? `${display(eyelinerColor, locale)} tuš ili olovka` : `${display(eyelinerColor, locale)} eyeliner`,
      shadeGuidance: display(eyelinerColor, locale),
      matchReason: hr ? "Prati definiranu boju linije oka." : "Matches the defined eye-line color.",
    },
    {
      category: "mascara",
      query: `${mascaraColor} ${intensity} effect mascara`,
      name: hr ? `${display(mascaraColor, locale)} maskara` : `${display(mascaraColor, locale)} mascara`,
      shadeGuidance: display(mascaraColor, locale),
      matchReason: hr ? "Prati intenzitet generiranog looka." : "Matches the generated look's intensity.",
    },
    {
      category: "brows",
      query: `${browColor} ${intensity} brow makeup`,
      name: hr ? `${display(browColor, locale)} proizvodi za obrve` : `${display(browColor, locale)} brow products`,
      shadeGuidance: display(browColor, locale),
      matchReason: hr ? "Prati nijansu i intenzitet obrva." : "Matches the brow shade and intensity.",
    },
    {
      category: "lips",
      query: `${lipFamily} ${lipFinish} lipstick`,
      name: hr
        ? `${display(lipFamily, locale)} ruž – ${display(lipFinish, locale)} završetak`
        : `${display(lipFamily, locale)} lipstick – ${display(lipFinish, locale)} finish`,
      shadeGuidance: `${display(lipFamily, locale)}, ${display(lipFinish, locale)}`,
      matchReason: hr ? "Prati boju i završetak usana." : "Matches the lip color family and finish.",
    },
  ];
}

export function fallbackSearch(
  search: CategorySearch,
  locale: Locale,
  retailer?: Retailer,
  rank = 0,
): ProductRecommendation {
  return {
    id: `search-${search.category}-${retailer?.domain ?? "all"}`,
    kind: "search",
    category: search.category,
    brand: retailer?.name ?? retailers.map((item) => item.name).join(", "),
    name: search.name,
    shadeGuidance: search.shadeGuidance,
    matchScore: Math.max(1, 40 - rank),
    retailer: retailer?.name ?? "Google",
    url: shoppingUrl(search.query, locale, retailer),
    matchReason: search.matchReason,
  };
}

export function buildShoppingSearches(input: {
  lookProfile: LookProfile;
  locale: Locale;
}): ProductRecommendation[] {
  return buildCategorySearches(input).flatMap((search) =>
    retailers.slice(0, 3).map((retailer, index) =>
      fallbackSearch(search, input.locale, retailer, index),
    ),
  );
}
