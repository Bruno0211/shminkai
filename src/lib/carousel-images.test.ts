import { describe, expect, it } from "vitest";
import { pairCarouselFiles } from "./carousel";

describe("pairCarouselFiles", () => {
  it("pairs matching images numerically and ignores incomplete or unsupported files", () => {
    expect(pairCarouselFiles([
      "after-10.webp",
      "before-2.png",
      "before-10.jpg",
      "after-2.jpeg",
      "before-3.gif",
      "before-4.jpg",
      "notes.txt",
    ])).toEqual([
      {
        before: "/carousel/before-2.png",
        after: "/carousel/after-2.jpeg",
      },
      {
        before: "/carousel/before-10.jpg",
        after: "/carousel/after-10.webp",
      },
    ]);
  });
});
