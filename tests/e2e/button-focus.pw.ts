import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const buttonCss = readFileSync(new URL('../../src/components/btn.css', import.meta.url), 'utf8');
const materialCss = readFileSync(new URL('../../src/components/material.css', import.meta.url), 'utf8');

test('modern button surface preserves the keyboard focus ring', async ({ page }) => {
  await page.setContent(`<!doctype html><html data-icen-style="modern"><head><style>
    @layer icen.tokens, icen.base, icen.components;
    ${buttonCss}
    ${materialCss}
    :root {
      --icen-ring: 0 0 0 3px #315948;
      --icen-token-shadow-control: 0 1px 2px rgb(0 0 0 / .15);
    }
    </style></head><body>
      <button class="icen-btn icen-btn-primary">允许并继续</button>
      <a href="#next">下一项</a>
    </body></html>`);
  const button = page.getByRole('button', { name: '允许并继续' });
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('box-shadow', /rgb\(49, 89, 72\).*3px/);
  await page.keyboard.press('Tab');
  await expect(button).not.toBeFocused();
  await expect(button).not.toHaveCSS('box-shadow', /rgb\(49, 89, 72\)/);
});
