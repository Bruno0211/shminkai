import { expect, test } from "@playwright/test";

const lookProfile = {
  intensity: "soft",
  complexionFinish: "radiant",
  blushFamily: "peach",
  bronzerFamily: "warm",
  eyeFamilies: ["bronze", "gold"],
  eyelinerColor: "brown",
  lipFamily: "nude",
  lipFinish: "satin",
} as const;

test("home info and bilingual toggle work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Makeup koji počinje s tobom." })).toBeVisible();
  await page.getByRole("button", { name: "Info" }).click();
  await expect(page.getByRole("dialog")).toContainText("Kako radi");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Makeup that starts with you." })).toBeVisible();
});

test("both generation options are selectable", async ({ page }) => {
  await page.goto("/create");
  await page.getByRole("button", { name: /Moje želje/ }).click();
  await expect(page.getByRole("link", { name: /Nastavi/ })).toHaveAttribute(
    "href",
    "/create/custom",
  );
});

test("live camera opens and explains permission errors", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/create/random");
  await page.getByRole("button", { name: "Otvori kameru" }).click();
  const cameraDialog = page.getByRole("dialog", { name: "Fotografiraj se uživo" });
  await expect(cameraDialog).toBeVisible();
  await expect(cameraDialog.getByRole("alert")).toContainText("Dopusti pristup kameri");
});

test("photo flow reaches the mocked result", async ({ page }) => {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        lookName: "Soft bronze",
        analysis: {
          skinTone: "medium",
          undertone: "warm",
          eyeColor: "brown",
          hairColor: "brown",
          faceShape: "oval",
          eyeShape: "almond",
          lipShape: "full",
        },
        explanation: ["Bronze complements the visible warm undertone."],
        lookProfile,
      }),
    });
  });

  await page.goto("/create/random");
  await page.locator('input[type="file"]').setInputFiles({
    name: "face.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Kreiraj moj look/ }).click();
  await expect(page).toHaveURL(/\/result/);
  await expect(page.getByRole("heading", { name: "Soft bronze" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Otvori kameru" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kreiraj moj look/ })).toBeDisabled();
});

test("custom flow sends an optional outfit and shows the match", async ({ page }) => {
  let sentOutfit = false;
  await page.route("**/api/generate", async (route) => {
    sentOutfit = (route.request().postDataBuffer()?.toString("latin1") ?? "")
      .includes('name="outfit"');
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        lookName: "Evening berry",
        analysis: {
          skinTone: "medium",
          undertone: "warm",
          eyeColor: "brown",
          hairColor: "brown",
          faceShape: "oval",
          eyeShape: "almond",
          lipShape: "full",
        },
        explanation: ["Berry lips echo the dress."],
        lookProfile,
        outfit: {
          hasClothing: true,
          summary: "tamnoplava satenska haljina",
          colors: ["tamnoplava"],
          pattern: "solid",
          formality: "evening",
          metals: "gold",
        },
      }),
    });
  });

  const jpeg = (name: string) => ({
    name,
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  });
  await page.goto("/create/custom");
  await page.getByLabel("Odaberi iz galerije").setInputFiles(jpeg("face.jpg"));
  await page.getByLabel("Učitaj fotografiju odjeće").setInputFiles(jpeg("outfit.jpg"));
  await expect(page.getByText("Makeup ćemo uskladiti s ovom odjećom.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Kreiraj moj look/ }).click();

  await expect(page).toHaveURL(/\/result/);
  expect(sentOutfit).toBe(true);
  await expect(page.getByText("tamnoplava satenska haljina")).toBeVisible();
});

test("matched products support retry, safe links, and both languages", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/recommendations", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unavailable" }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        recommendations: [{
          id: "nars-light-reflecting-foundation",
          category: "complexion",
          brand: "NARS",
          name: "Light Reflecting Foundation",
          shadeGuidance: "Choose your own shade.",
          priceTier: "premium",
          market: "global",
          retailer: "Sephora",
          url: "https://www.sephora.com/product/nars-light-reflecting-advance-skincare-foundation-P479338",
          matchReason: "Matches the radiant finish.",
        }],
      }),
    });
  });

  await page.goto("/");
  await page.evaluate((profile) => {
    sessionStorage.setItem("kreirai-result", JSON.stringify({
      image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
      lookName: "Soft bronze",
      analysis: {
        skinTone: "medium",
        undertone: "warm",
        eyeColor: "brown",
        hairColor: "brown",
        faceShape: "oval",
        eyeShape: "almond",
        lipShape: "full",
      },
      explanation: ["Bronze complements the visible warm undertone."],
      lookProfile: profile,
    }));
  }, lookProfile);
  await page.goto("/result");

  await page.getByRole("button", { name: "Pronađi proizvode" }).click();
  const dialog = page.getByRole("dialog", { name: "Kreiraj ovaj look" });
  await expect(dialog.getByRole("progressbar", {
    name: "Napredak pretraživanja proizvoda",
  })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("trenutačno nisu dostupne");
  await dialog.getByRole("button", { name: "Pokušaj ponovno" }).click();

  const productLink = dialog.getByRole("link", { name: /Pretraži proizvode/ });
  await expect(productLink).toBeVisible();
  await expect(productLink).toHaveAttribute("target", "_blank");
  await expect(productLink).toHaveAttribute("rel", "noopener noreferrer");

  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "Shop this look" }).click();
  await expect(page.getByRole("dialog", { name: "Recreate this look" })).toBeVisible();
});
