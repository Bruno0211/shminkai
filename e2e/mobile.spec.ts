import { expect, test, type Page } from "@playwright/test";

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

const responsiveViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 667 },
  { width: 390, height: 844 },
  { width: 760, height: 900 },
  { width: 761, height: 700 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const responsiveResult = {
  image:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2UwMTA3NCIvPjwvc3ZnPg==",
  lookName: "Responsive test look",
  analysis: {
    skinTone: "medium",
    undertone: "warm",
    eyeColor: "brown",
    hairColor: "brown",
    faceShape: "oval",
    eyeShape: "almond",
    lipShape: "full",
  },
  explanation: ["Responsive explanation."],
  lookProfile,
};

async function expectNoPageOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

async function seedResponsiveResult(page: Page) {
  await page.goto("/");
  await page.evaluate((result) => {
    sessionStorage.setItem("kreirai-result", JSON.stringify(result));
    sessionStorage.setItem("kreirai-mode", "custom");
  }, responsiveResult);
}

test("home info and bilingual toggle work", async ({ page }) => {
  await page.goto("/");
  const brandAi = page.getByRole("link", { name: "ShminkAI home" }).locator("span");
  await expect(brandAi).toHaveCSS("font-style", "normal");
  await expect(page.locator(".carousel-dots button")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Makeup prilagođen tvom licu." })).toBeVisible();
  await page.getByRole("button", { name: "Info" }).click();
  await expect(page.getByRole("dialog")).toContainText("Kako radi");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Makeup designed for your face." })).toBeVisible();
});

test("home cards stay clear of the CTA across responsive sizes", async ({ page }) => {
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const cards = await page.locator(".look-card").all();
    const cardBoxes = await Promise.all(cards.map((card) => card.boundingBox()));
    const buttonBox = await page.getByRole("link", {
      name: /Kreiraj personalizirani look/,
    }).boundingBox();

    expect(buttonBox).not.toBeNull();
    for (const cardBox of cardBoxes) {
      expect(cardBox).not.toBeNull();
      expect(cardBox!.y + cardBox!.height).toBeLessThan(buttonBox!.y);
    }

    await expectNoPageOverflow(page);
  }
});

test("all screens and overlays scale across supported viewports", async ({ page }) => {
  test.slow();
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
  await page.route("**/api/recommendations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ recommendations: [] }),
    });
  });

  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);

    for (const route of ["/", "/create", "/create/random", "/create/custom"]) {
      await page.goto(route);
      await expect(page.locator(".app-header")).toBeVisible();
      await expectNoPageOverflow(page);
    }

    await page.goto("/create");
    const card = await page.locator(".option-card.active").boundingBox();
    const hint = await page.locator(".option-slide-hint").boundingBox();
    expect(card).not.toBeNull();
    expect(hint).not.toBeNull();
    expect(card!.x).toBeGreaterThanOrEqual(0);
    expect(card!.x + card!.width).toBeLessThanOrEqual(viewport.width);
    expect(hint!.x).toBeGreaterThanOrEqual(0);
    expect(hint!.x + hint!.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.locator(".option-card.active .primary-button")).toBeVisible();

    await page.goto("/create/custom");
    const palette = page.locator(".palette-grid");
    await expect(palette).toHaveCSS("overflow-x", "auto");
    await page.getByRole("button", { name: "Otvori kameru" }).click();
    const camera = await page.locator(".camera-dialog").boundingBox();
    expect(camera).not.toBeNull();
    expect(camera!.x).toBeGreaterThanOrEqual(0);
    expect(camera!.x + camera!.width).toBeLessThanOrEqual(viewport.width);
    expect(camera!.y).toBeGreaterThanOrEqual(0);
    expect(camera!.y + camera!.height).toBeLessThanOrEqual(viewport.height);
    await page.locator(".camera-dialog .dialog-close").click();

    await seedResponsiveResult(page);
    await page.goto("/result");
    await expect(page.locator(".result-image")).toBeVisible();
    await expectNoPageOverflow(page);

    await page.getByRole("button", { name: /Zašto ti ovaj look pristaje/ }).click();
    const explanation = await page.locator(".explanation-panel").boundingBox();
    expect(explanation).not.toBeNull();
    expect(explanation!.width).toBeLessThanOrEqual(viewport.width);
    expect(explanation!.height).toBeLessThanOrEqual(viewport.height);
    await page.locator(".explanation-panel .dialog-close").click();

    await page.getByRole("button", { name: "Pronađi proizvode" }).click();
    const products = await page.locator(".product-panel").boundingBox();
    expect(products).not.toBeNull();
    expect(products!.width).toBeLessThanOrEqual(viewport.width);
    expect(products!.height).toBeLessThanOrEqual(viewport.height);
    await page.locator(".product-panel .dialog-close").click();
  }
});

test("both generation options are selectable", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByRole("link", { name: "Natrag" })).toHaveAttribute("href", "/");
  await page.getByRole("button", { name: "Promijeni opciju" }).click();
  await expect(page.getByRole("link", { name: /Nastavi/ })).toHaveAttribute(
    "href",
    "/create/custom",
  );
  await page.goto("/create/custom");
  await expect(page.getByRole("link", { name: "Natrag" })).toHaveAttribute("href", "/create");
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
  await page.getByRole("button", { name: /Kreiraj moj personalizirani look/ }).click();
  await expect(page).toHaveURL(/\/result/);
  await expect(page.getByRole("link", { name: "Natrag" })).toHaveAttribute(
    "href",
    "/create/random",
  );
  await expect(page.getByRole("heading", { name: "Soft bronze" })).toBeVisible();
  await expect(page.locator(".result-image")).toHaveCSS("aspect-ratio", "1 / 1");
  await expect(page.locator(".result-image")).toHaveCSS("border-radius", "6px");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Otvori kameru" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Kreiraj moj personalizirani look/ }),
  ).toBeDisabled();
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

test("look builder sends tapped choices as preferences", async ({ page }) => {
  let metadata: { preferences?: Record<string, string> } = {};
  await page.route("**/api/generate", async (route) => {
    const body = route.request().postDataBuffer()?.toString("utf8") ?? "";
    const metadataPart = body.slice(body.indexOf('name="metadata"'));
    const jsonStart = metadataPart.indexOf("{");
    const jsonEnd = metadataPart.indexOf("\r\n--", jsonStart);
    metadata = JSON.parse(metadataPart.slice(jsonStart, jsonEnd));
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto("/create/custom");
  await page.getByRole("button", { name: "Večer van" }).click();
  await page.getByRole("slider", { name: "Intenzitet" }).fill("2");
  await page.getByRole("button", { name: "Bobičasta" }).click();
  await page.getByRole("button", { name: "Zlatna" }).click();
  await page.getByRole("button", { name: "Saten" }).click();
  await page.getByRole("button", { name: /Mačje oko/ }).click();
  await expect(page.locator(".look-summary")).toContainText("Večer van");
  await expect(page.locator(".look-summary")).toContainText("Odvažno");

  await page.getByLabel("Odaberi iz galerije").setInputFiles({
    name: "face.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Kreiraj moj personalizirani look/ }).click();

  await expect.poll(() => metadata.preferences).toEqual({
    occasion: "Večer van",
    intensity: "bold",
    colors: "berry, gold",
    finish: "satin",
    wishes: "Mačje oko",
  });
});

test("suggested combination fills in a complete look", async ({ page }) => {
  await page.goto("/create/custom");
  await page.getByRole("button", { name: /Predloži kombinaciju/ }).click();
  await expect(page.locator(".occasion-card[aria-pressed=\"true\"]")).toHaveCount(1);
  await expect(page.locator(".swatch[aria-pressed=\"true\"]")).not.toHaveCount(0);
});

test("starting a new look after a result begins from a clean photo step", async ({ page }) => {
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

  await page.goto("/create/custom");
  await page.getByLabel("Odaberi iz galerije").setInputFiles({
    name: "face.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Kreiraj moj personalizirani look/ }).click();
  await expect(page).toHaveURL(/\/result/);

  await page.getByRole("link", { name: "Novi look" }).click();
  await page.getByRole("button", { name: /Prema mojim željama/ }).click();
  await page.getByRole("link", { name: /Nastavi/ }).click();
  await expect(page).toHaveURL(/\/create\/custom/);

  await expect(page.getByText("Upoznajemo tvoje lice")).toBeHidden();
  await expect(page.getByRole("button", { name: "Otvori kameru" })).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
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
  await page.getByRole("button", { name: /Kreiraj moj personalizirani look/ }).click();

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
