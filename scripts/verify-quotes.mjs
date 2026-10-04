// Checks that every evidence quote in data/graph.json literally appears in its source.
// PubMed → abstract via NCBI E-utilities; ClinicalTrials.gov → API v2 record;
// MedlinePlus → page text. Other sources are reported as "not text-checkable".
// Output: data/quote-check.json  (the UI shows a "quote verified" mark from it)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const graph = JSON.parse(fs.readFileSync(path.join(root, "data", "graph.json"), "utf8"));

const norm = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—‐]/g, "-")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

const cache = new Map();
async function sourceText(url) {
  if (cache.has(url)) return cache.get(url);
  let text = null;
  const pmid = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1];
  const nct = url.match(/clinicaltrials\.gov\/study\/(NCT\d+)/)?.[1];
  if (pmid) {
    const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`);
    text = await r.text();
    await new Promise((res) => setTimeout(res, 400)); // NCBI rate limit
  } else if (nct) {
    text = await (await fetch(`https://clinicaltrials.gov/api/v2/studies/${nct}`)).text();
  } else if (url.includes("medlineplus.gov")) {
    text = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  }
  const out = text ? norm(text) : null;
  cache.set(url, out);
  return out;
}

const checks = [];
for (const e of graph.edges) {
  const items = [{ sourceUrl: e.sourceUrl, evidence: e.evidence }, ...(e.corroboratedBy ?? [])];
  for (const [i, it] of items.entries()) {
    const text = await sourceText(it.sourceUrl);
    let result;
    if (text === null) result = "NOT_CHECKABLE";
    else {
      // Quotes may elide with "…"; every fragment must appear.
      const parts = norm(it.evidence).replace(/^"|"$/g, "").split("…").map((p) => p.trim().replace(/^"|"$/g, "")).filter((p) => p.length > 3);
      result = parts.every((p) => text.includes(p)) ? "VERIFIED" : "NOT_FOUND";
    }
    checks.push({ edge: e.id, index: i, sourceUrl: it.sourceUrl, result });
    console.log(result.padEnd(14), e.id, i, it.evidence.slice(0, 70));
  }
}
fs.writeFileSync(
  path.join(root, "data", "quote-check.json"),
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2),
);
const bad = checks.filter((c) => c.result === "NOT_FOUND");
console.log(`\n${checks.length} quotes · ${checks.filter((c) => c.result === "VERIFIED").length} verified · ${bad.length} not found`);
process.exitCode = bad.length ? 1 : 0;
