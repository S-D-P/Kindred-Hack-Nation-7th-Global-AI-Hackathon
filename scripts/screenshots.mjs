// Captures README screenshots from a running dev server (default http://localhost:3100).
// Uses Playwright if installed: `npx playwright install chromium` once.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.resolve(import.meta.dirname, "..", "..", "node_modules", "playwright"))); }

const base = process.env.KINDRED_URL ?? "http://localhost:3100";
const out = (n) => path.resolve(import.meta.dirname, "..", "docs", "screenshots", n);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const click = (text) => page.getByRole("button", { name: text, exact: true }).first().click();
const settle = () => page.waitForTimeout(1200);

await page.goto(base); await page.waitForTimeout(1800);
await page.screenshot({ path: out("01-home.png") });

await click("Who shares our biology?"); await page.getByRole("button", { name: "Danon disease", exact: true }).waitFor();
await click("Danon disease"); await page.locator(".discovery").waitFor({ timeout: 60000 }); await settle();
// Element shots scroll the page; keep the sticky header and input dock out of them.
const hideChrome = () => page.addStyleTag({ content: ".topbar, .dock { display: none !important; }" });
await hideChrome();
await page.locator(".dossier").screenshot({ path: out("02-dossier.png") });
await page.locator(".discovery").screenshot({ path: out("03-discovery.png") });
await page.locator(".kin-plot").screenshot({ path: out("04-kinship-map.png") });
await page.locator(".cards").screenshot({ path: out("05-connection-cards.png") });
await page.locator(".tree").screenshot({ path: out("06-kindred-path.png") });

await page.locator("button.explore").nth(1).click(); await page.locator(".noroute").waitFor({ timeout: 60000 }); await settle();
await page.locator(".noroute").screenshot({ path: out("07-no-supported-route.png") });
await page.locator(".contested").last().screenshot({ path: out("08-evidence-disagrees.png") });
await page.locator(".contested .side").first().click(); await page.locator(".drawer").waitFor(); await settle();
await page.screenshot({ path: out("09-provenance-trace.png") });
await page.getByRole("button", { name: "Close" }).click();

await click("How well do we know this?"); await page.locator(".matrix").last().waitFor({ timeout: 60000 }); await settle();
await page.locator(".matrix-wrap").last().screenshot({ path: out("10-evidence-matrix.png") });
await click("Research brief"); await page.locator(".brief").last().waitFor({ timeout: 60000 }); await settle();
await page.locator(".brief").last().screenshot({ path: out("11-research-brief.png") });

await page.goto(`${base}/how`); await page.waitForTimeout(2000);
await page.screenshot({ path: out("12-how-kindred-knows.png"), fullPage: true });
await page.goto(`${base}/story`); await page.waitForTimeout(3000);
await page.screenshot({ path: out("13-story.png"), fullPage: true });
await browser.close();
console.log("screenshots written to docs/screenshots");
