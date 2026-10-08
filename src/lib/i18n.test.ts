import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

describe("translations", () => {
  it("returns Croatian by default selection", () => {
    expect(translate("hr", "createLook")).toBe("Kreiraj personalizirani look");
  });

  it("returns the English copy", () => {
    expect(translate("en", "photoTitle")).toBe("Photo for facial analysis");
  });
});
