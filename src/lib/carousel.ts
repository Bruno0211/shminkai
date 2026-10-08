export type CarouselLook = {
  before: string;
  after: string;
};

const carouselFilePattern = /^(before|after)-(\d+)\.(avif|jpe?g|png|webp)$/i;

export function pairCarouselFiles(files: readonly string[]): CarouselLook[] {
  const pairs = new Map<string, Partial<CarouselLook>>();

  for (const file of [...files].sort((left, right) => left.localeCompare(right))) {
    const match = carouselFilePattern.exec(file);
    if (!match) continue;

    const [, side, number] = match;
    const pair = pairs.get(number) ?? {};
    const key = side.toLowerCase() as keyof CarouselLook;
    pair[key] ??= `/carousel/${file}`;
    pairs.set(number, pair);
  }

  return [...pairs.entries()]
    .filter((entry): entry is [string, CarouselLook] => {
      const pair = entry[1];
      return typeof pair.before === "string" && typeof pair.after === "string";
    })
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )
    .map(([, pair]) => pair);
}
