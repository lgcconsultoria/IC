/* IC Clínica — Smoke test de UI (Playwright + Chromium local).
 *
 * Renderiza as páginas públicas num Chromium headless e falha se encontrar:
 *   - resíduos de demonstração ("Modo demonstração", "9 integrações", nomes fake);
 *   - erros de página não tratados (ex.: crash de gráfico vazio);
 *   - "Application error" (tela branca do Next).
 *
 * Uso:  BASE_URL=http://127.0.0.1:4321 node scripts/smoke.mjs
 * (o runner `pnpm --filter @ic/web smoke` sobe o `next start` sozinho)
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4321';
const EXEC =
  process.env.CHROMIUM_BIN ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.env.SMOKE_OUT || '/tmp/ic-smoke';
mkdirSync(OUT, { recursive: true });

// strings que NUNCA podem aparecer (dados de demonstração)
const FORBIDDEN = [
  'Modo demonstração',
  'dados fictícios',
  '9 integrações',
  'Application error',
];

const ROUTES = ['/', '/login', '/portal/login'];

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let failures = 0;
const report = [];

for (const route of ROUTES) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const url = BASE + route;
  let bodyText = '';
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200); // deixa o React montar / efeitos rodarem
    bodyText = await page.evaluate(() => document.body.innerText);
  } catch (e) {
    pageErrors.push('goto: ' + e.message);
  }

  const slug = route === '/' ? 'root' : route.replace(/\//g, '_');
  await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: true }).catch(() => {});

  const hits = FORBIDDEN.filter((f) => bodyText.includes(f));
  const ok = hits.length === 0 && pageErrors.length === 0;
  if (!ok) failures++;
  report.push({
    route,
    ok,
    forbiddenHits: hits,
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 5),
  });
  await page.close();
}

await browser.close();

console.log('\n=== IC UI smoke ===  base=' + BASE);
for (const r of report) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.route}`);
  if (r.forbiddenHits.length) console.log('   demo/erro:', r.forbiddenHits.join(', '));
  if (r.pageErrors.length) console.log('   pageErrors:', r.pageErrors.join(' | '));
  if (r.consoleErrors.length) console.log('   consoleErrors:', r.consoleErrors.join(' | '));
}
console.log(`\nscreenshots em ${OUT}`);
console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
