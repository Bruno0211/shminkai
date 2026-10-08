// Shops the product search is limited to. Edit this list to change where
// products are discovered; links to any other domain are discarded.
// - productPath: URL path pattern of a single product page on that shop
//   (category, brand and article pages are rejected).
// - verify: how a product link is proven to exist before it is shown.
//   "page": the product page must load with HTTP 200 (shop returns real 404s).
//   "dm-api": dm pages always return 200, so the product id from the URL is
//   looked up in dm's product service instead.
// Shops whose product pages cannot be verified (e.g. Notino, behind a bot
// challenge) should not be added.
export const retailers = [
  { name: "Douglas", domain: "douglas.hr", productPath: /^\/p\/[^/]+/, verify: "page" },
  { name: "dm", domain: "dm.hr", productPath: /^\/p\/d\/\d+\//, verify: "dm-api" },
  { name: "Müller", domain: "mueller.hr", productPath: /^\/p\/[^/]+/, verify: "page" },
] as const;

export type Retailer = (typeof retailers)[number];

export function retailerForUrl(url: string): Retailer | undefined {
  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return retailers.find(
    (retailer) => hostname === retailer.domain || hostname.endsWith(`.${retailer.domain}`),
  );
}

export function isProductPage(url: string) {
  const retailer = retailerForUrl(url);
  return Boolean(retailer && retailer.productPath.test(new URL(url).pathname));
}
