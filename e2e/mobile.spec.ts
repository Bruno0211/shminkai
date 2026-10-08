import { expect, test } from "@playwright/test";

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
