import type {
  Locale,
  LookProfile,
  ProductCategory,
  ProductRecommendation,
} from "./schemas";
import { retailers } from "./retailers";

const croatianLabels: Record<string, string> = {
  natural: "prirodni",
  matte: "mat",
  radiant: "blistavi",
  satin: "satenski",
  glossy: "sjajni",
  soft: "nježni",
  medium: "srednji",
  bold: "odvažni",
  neutral: "neutralni",
  warm: "topli",
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
};

function display(value: string, locale: Locale) {
  return locale === "hr" ? (croatianLabels[value] ?? value) : value;
}

function shoppingUrl(query: string, locale: Locale) {
  const sites = retailers.map((retailer) => `site:${retailer.domain}`).join(" OR ");
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
    complexionFinish,
    blushFamily,
    bronzerFamily,
    eyeFamilies,
    eyelinerColor,
    lipFamily,
    lipFinish,
  } = lookProfile;
  const hr = locale === "hr";
  const eyeColors = eyeFamilies.map((color) => display(color, locale)).join(", ");

  return [
    {
      category: "complexion",
      query: `${complexionFinish} finish foundation`,
      name: hr
        ? `Puder – ${display(complexionFinish, locale)} završetak`
        : `${display(complexionFinish, locale)} finish foundation`,
      shadeGuidance: hr ? "Odaberi nijansu koja odgovara tvojoj koži." : "Choose your own skin-matching shade.",
      matchReason: hr ? "Traži formule sa završetkom ovog looka." : "Finds formulas matching this look's finish.",
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
      query: `${intensity} effect mascara`,
      name: hr ? `${display(intensity, locale)} efekt maskare` : `${display(intensity, locale)} effect mascara`,
      shadeGuidance: hr ? "Crna ili smeđa prema željenom intenzitetu." : "Black or brown for the preferred intensity.",
      matchReason: hr ? "Prati intenzitet generiranog looka." : "Matches the generated look's intensity.",
    },
    {
      category: "brows",
      query: `${intensity} brow makeup`,
      name: hr ? `${display(intensity, locale)} proizvodi za obrve` : `${display(intensity, locale)} brow products`,
      shadeGuidance: hr ? "Odaberi nijansu prema prirodnoj boji obrva." : "Choose a shade matching your natural brows.",
      matchReason: hr ? "Dopunjuje intenzitet looka bez procjene nijanse." : "Complements the look without estimating your shade.",
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

export function fallbackSearch(search: CategorySearch, locale: Locale): ProductRecommendation {
  return {
    id: `search-${search.category}`,
    kind: "search",
    category: search.category,
    brand: retailers.map((retailer) => retailer.name).join(", "),
    name: search.name,
    shadeGuidance: search.shadeGuidance,
    market: "hr",
    retailer: "Google",
    url: shoppingUrl(search.query, locale),
    matchReason: search.matchReason,
  };
}

export function buildShoppingSearches(input: {
  lookProfile: LookProfile;
  locale: Locale;
}): ProductRecommendation[] {
  return buildCategorySearches(input).map((search) => fallbackSearch(search, input.locale));
}
