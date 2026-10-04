// Fetches bibliographic metadata (title, journal, year, authors) from PubMed
// for every PMID cited in data/graph.json. Output: data/publications.json
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const graph = JSON.parse(fs.readFileSync(path.join(root, "data", "graph.json"), "utf8"));
const urls = graph.edges.flatMap((e) => [e.sourceUrl, ...(e.corroboratedBy ?? []).map((c) => c.sourceUrl)]);
const pmids = [...new Set(urls.map((u) => u.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1]).filter(Boolean))];

const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(",")}`);
const json = await res.json();
const out = {};
for (const id of pmids) {
  const r = json.result[id];
  out[id] = {
    pmid: id,
    title: r.title.replace(/\.$/, ""),
    journal: r.source || r.booktitle?.replace("(®)", ""),
    year: r.source ? r.pubdate.slice(0, 4) : "", // a book pubdate is the series start, not the chapter
    // Book chapters (GeneReviews) list editors too; keep authors only.
    authors: r.authors.filter((a) => a.authtype !== "Editor").map((a) => a.name),
    url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
  };
}
fs.writeFileSync(path.join(root, "data", "publications.json"), JSON.stringify(out, null, 2));
for (const p of Object.values(out)) console.log(p.pmid, p.year, p.journal, "|", p.authors[0], "…", p.authors.at(-1), "|", p.title.slice(0, 60));
