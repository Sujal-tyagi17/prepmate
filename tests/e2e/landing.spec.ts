import { test, expect } from "@playwright/test";

test("Watch Demo buttons open the demo video and it plays @mobile", async ({ page, request }) => {
    const res = await request.get("/demo/prepmate-demo.mp4", { headers: { Range: "bytes=0-1023" } });
    expect([200, 206]).toContain(res.status());
    expect(res.headers()["content-type"]).toContain("video/mp4");

    await page.goto("/");
    const buttons = page.getByRole("button", { name: "Watch Demo" });
    await expect(buttons.first()).toBeVisible();
    // the bottom call-to-action section is lazy-loaded — scroll down so it renders
    // (sections above it also load lazily and grow, so scroll down in steps)
    await expect.poll(async () => {
        await page.mouse.wheel(0, 1500);
        return buttons.count();
    }, { timeout: 30_000, intervals: [400] }).toBe(2); // hero + bottom call-to-action
    const count = 2;

    for (let i = 0; i < count; i++) {
        await buttons.nth(i).scrollIntoViewIfNeeded();
        await buttons.nth(i).click();
        const dialog = page.getByRole("dialog", { name: "PrepMate demo video" });
        await expect(dialog).toBeVisible();
        const video = dialog.locator("video");
        // the video loads and starts playing (autoplay is muted, so browsers allow it)
        await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
        await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5);
        expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(100);
        // Escape closes it
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
    }

    // backdrop click closes too
    await buttons.first().scrollIntoViewIfNeeded();
    await buttons.first().click();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toHaveCount(0);
});
