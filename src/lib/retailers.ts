// Shops the product search is limited to. Edit this list to change where
// products are discovered; links to any other domain are discarded.
export const retailers = [
  { name: "Notino", domain: "notino.hr" },
  { name: "Douglas", domain: "douglas.hr" },
  { name: "dm", domain: "dm.hr" },
  { name: "Müller", domain: "mueller.hr" },
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
