import "server-only";

import { readdir } from "node:fs/promises";
import path from "node:path";
import { pairCarouselFiles, type CarouselLook } from "./carousel";

const carouselDirectory = path.join(process.cwd(), "public", "carousel");
const fallbackLooks: CarouselLook[] = [
  { before: "/look-natural.svg", after: "/look-rose.svg" },
  { before: "/look-rose.svg", after: "/look-natural.svg" },
];

export async function getCarouselLooks(): Promise<CarouselLook[]> {
  "use cache";

  try {
    const looks = pairCarouselFiles(await readdir(carouselDirectory));
    return looks.length > 0 ? looks : fallbackLooks;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return fallbackLooks;
    }
    throw error;
  }
}
