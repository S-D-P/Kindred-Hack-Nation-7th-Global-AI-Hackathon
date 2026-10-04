// Downloads the HPO ontology and disease annotations into data/raw/ (git-ignored).
import fs from "node:fs";
import path from "node:path";

const raw = path.resolve(import.meta.dirname, "..", "data", "raw");
fs.mkdirSync(raw, { recursive: true });
const files = {
  "hp.obo": "https://purl.obolibrary.org/obo/hp.obo",
  "phenotype.hpoa": "https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa",
};
for (const [name, url] of Object.entries(files)) {
  process.stdout.write(`${name} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  fs.writeFileSync(path.join(raw, name), Buffer.from(await res.arrayBuffer()));
  console.log("ok");
}
