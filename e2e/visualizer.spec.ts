import { expect, test, type Page } from '@playwright/test';

const cycles = (page: Page) =>
  page.evaluate(() => (globalThis as any).__ngxRenderVisualizer.recorder.cycles.length as number);
const shadowCount = (page: Page, sel: string) =>
  page.evaluate((s) => document.querySelector('ngx-render-visualizer')!.shadowRoot!.querySelectorAll(s).length, sel);

for (const mode of ['', 'zone']) {
  test.describe(`mode: ${mode || 'zoneless'}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(mode ? `/?mode=${mode}` : '/');
      await page.waitForFunction(() => !!(globalThis as any).__ngxRenderVisualizer);
    });

    test('filter interaction produces a cycle with flash boxes over components', async ({ page }) => {
      const before = await cycles(page);
      await page.locator('app-filters input[type=search]').fill('ada');
      await expect.poll(() => cycles(page)).toBeGreaterThan(before);
      const last = await page.evaluate(() => {
        const c = (globalThis as any).__ngxRenderVisualizer.recorder.cycles.at(-1);
        return c.checked.map((v: any) => v.name);
      });
      expect(last).toContain('FiltersPanel');
      expect(await shadowCount(page, '.box')).toBeGreaterThan(0);
      await expect(page.locator('ngx-render-visualizer .toolbar .status')).toContainText(/Cycle #\d+ caused by/);
    });

    test('OnPush siblings are skipped while Eager components are checked', async ({ page }) => {
      await page.locator('app-filters input[type=search]').fill('x');
      await expect.poll(() => cycles(page)).toBeGreaterThan(0);
      const names = await page.evaluate(() => {
        const cs = (globalThis as any).__ngxRenderVisualizer.recorder.cycles as any[];
        return cs.at(-1).checked.map((v: any) => `${v.name}:${v.strategy}`);
      });
      // KpiCards did not change, so (OnPush) they must not be in the checked list.
      expect(names.some((n: string) => n.startsWith('KpiCard:'))).toBe(false);
    });

    test('the visualizer UI does not cause cycles on its own', async ({ page }) => {
      // Let startup settle and the app's own timers (clock, data) be the only source; a feedback loop
      // would show up as a cycle rate far above the ~3/s the demo generates.
      await page.waitForTimeout(1500);
      const a = await cycles(page);
      await page.waitForTimeout(4000);
      const rate = ((await cycles(page)) - a) / 4;
      expect(rate).toBeLessThan(6);
    });
  });
}

test.describe('script-tag build', () => {
  test('works on a page that does not use the provider', async ({ page }) => {
    await page.goto('/?viz=off');
    expect(await page.evaluate(() => !!(globalThis as any).__ngxRenderVisualizer)).toBe(false);
    await page.addScriptTag({ path: 'dist/ngx-render-visualizer/ngx-render-visualizer.global.js' });
    await page.waitForFunction(() => !!(globalThis as any).__ngxRenderVisualizer, undefined, { timeout: 5000 });

    await page.getByRole('button', { name: '+ Burst of orders' }).dispatchEvent('click');
    await expect.poll(() => cycles(page)).toBeGreaterThan(0);
    const names = await page.evaluate(() => (globalThis as any).__ngxRenderVisualizer.recorder.cycles.flatMap((c: any) => c.checked.map((v: any) => v.name)));
    expect(names).toContain('OrdersTable');
    // DOM writes are inferred from a MutationObserver here, so re-rendered components still show up.
    await expect.poll(() => page.evaluate(() => (globalThis as any).__ngxRenderVisualizer.recorder.cycles.some(
      (c: any) => c.checked.some((v: any) => v.name === 'OrdersTable' && v.domOps.length > 0)))).toBe(true);
    expect(await shadowCount(page, '.hud .metric')).toBe(4);
  });
});

test('HUD shows FPS, cycle time, changed count and slowest component', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(globalThis as any).__ngxRenderVisualizer);
  await page.locator('app-filters input[type=search]').fill('x');
  const hud = page.locator('ngx-render-visualizer .hud');
  await expect(hud).toContainText('FPS');
  await expect(hud).toContainText('Cycle');
  await expect(hud).toContainText('Changed');
  await expect(hud).toContainText('Slowest');
  await expect(hud).toContainText(/\d+ of \d+ checked/);
});
