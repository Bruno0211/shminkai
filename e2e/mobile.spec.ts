import { expect, test } from "@playwright/test";

const lookProfile = {
  intensity: "soft",
  complexionDepth: "medium",
  complexionUndertone: "warm",
  complexionFinish: "radiant",
  blushFamily: "peach",
  bronzerFamily: "warm",
  eyeFamilies: ["bronze", "gold"],
  eyelinerColor: "brown",
  mascaraColor: "brown",
  browColor: "brown",
  lipFamily: "nude",
  lipFinish: "satin",
} as const;

test("home info and bilingual toggle work", async ({ page }) => {
  await page.goto("/");
  const brandAi = page.getByRole("link", { name: "ShminkAI home" }).locator("span");
  await expect(brandAi).toHaveCSS("font-style", "normal");
  await expect(page.getByRole("heading", { name: "Makeup koji počinje s tobom." })).toBeVisible();
  await page.getByRole("button", { name: "Info" }).click();
  await expect(page.getByRole("dialog")).toContainText("Kako radi");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Makeup that starts with you." })).toBeVisible();
});

test("home cards stay clear of the CTA across responsive sizes", async ({ page }) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 760, height: 900 },
    { width: 761, height: 700 },
    { width: 1024, height: 768 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const cards = await page.locator(".look-card").all();
    const cardBoxes = await Promise.all(cards.map((card) => card.boundingBox()));
    const buttonBox = await page.getByRole("link", { name: /Kreiraj svoj look/ }).boundingBox();

    expect(buttonBox).not.toBeNull();
    for (const cardBox of cardBoxes) {
      expect(cardBox).not.toBeNull();
      expect(cardBox!.y + cardBox!.height).toBeLessThan(buttonBox!.y);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  }
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
  await expect(page.getByRole("link", { name: "Preuzmi fotografiju" })).toHaveAttribute(
    "download",
    "face.jpg",
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Kreiraj moj look/ }).click();
  await expect(page).toHaveURL(/\/result/);
  await expect(page.getByRole("heading", { name: "Soft bronze" })).toBeVisible();
  await expect(page.locator(".result-image")).toHaveCSS("aspect-ratio", "1 / 1");
  await expect(page.locator(".result-image")).toHaveCSS("border-radius", "6px");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Otvori kameru" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kreiraj moj look/ })).toBeDisabled();
});

test("result compares the original photo with the makeup look", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((profile) => {
    const svg = (color: string) =>
      `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${color}"/></svg>`)}`;
    sessionStorage.setItem("kreirai-before", svg("#777777"));
    sessionStorage.setItem("kreirai-result", JSON.stringify({
      image: svg("#e10174"),
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

  const slider = page.getByRole("slider", { name: "Usporedba prije i poslije" });
  await expect(slider).toBeVisible();
  await expect(page.getByRole("img", { name: "Soft bronze" })).toBeVisible();
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await slider.press("End");
  await expect(slider).toHaveValue("100");
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
        recommendations: [
          {
            id: "nars-light-reflecting-foundation",
            category: "complexion",
            brand: "NARS",
            name: "Light Reflecting Foundation",
            shadeGuidance: "Medium with warm undertones.",
            priceTier: "premium",
            matchScore: 96,
            retailer: "Douglas",
            url: "https://www.douglas.hr/p/nars-foundation",
            matchReason: "Matches the radiant finish.",
          },
          {
            id: "nars-radiant-concealer",
            category: "concealer",
            brand: "NARS",
            name: "Radiant Creamy Concealer",
            shadeGuidance: "Medium with warm undertones.",
            priceTier: "premium",
            matchScore: 94,
            retailer: "Douglas",
            url: "https://www.douglas.hr/p/nars-concealer",
            matchReason: "Matches the complexion depth and undertone.",
          },
        ],
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

  const productLink = dialog.getByRole("link", { name: /Pretraži proizvode/ }).first();
  await expect(productLink).toBeVisible();
  await expect(productLink).toHaveAttribute("target", "_blank");
  await expect(productLink).toHaveAttribute("rel", "noopener noreferrer");
  const categoryTabs = dialog.getByRole("tablist", { name: "Kategorije proizvoda" });
  await expect(categoryTabs.getByRole("tab", { name: "Korektor" })).toBeVisible();
  expect(await categoryTabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await categoryTabs.getByRole("tab", { name: "Korektor" }).click();
  await expect(dialog.getByRole("heading", { name: "Korektor" })).toBeVisible();

  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "Shop this look" }).click();
  await expect(page.getByRole("dialog", { name: "Recreate this look" })).toBeVisible();
});
