// Computes phenotype overlap between the atlas diseases from real HPO data.
//
// Inputs (downloaded by `npm run data:download` into data/raw/):
//   hp.obo            — Human Phenotype Ontology
//   phenotype.hpoa    — HPO disease annotations (OMIM + Orphanet)
//
// Method: simGIC (Pesquita et al., 2008). Each disease's annotations are
// propagated to all ancestor terms inside "Phenotypic abnormality"
// (HP:0000118). Each term is weighted by information content
// IC(t) = -ln(diseases annotated with t / all diseases), so broad terms
// ("Abnormality of the heart") count little and specific ones count a lot.
//   simGIC(A, B) = Σ IC(A ∩ B) / Σ IC(A ∪ B)        (0 … 1)
//
// Output: data/phenotypes.json
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const raw = path.join(root, "data", "raw");
const graph = JSON.parse(fs.readFileSync(path.join(root, "data", "graph.json"), "utf8"));

// --- ontology ------------------------------------------------------------
const parents = new Map();
const names = new Map();
let cur = null;
for (const line of fs.readFileSync(path.join(raw, "hp.obo"), "utf8").split(/\r?\n/)) {
  if (line === "[Term]") cur = null;
  else if (line.startsWith("id: HP:")) { cur = line.slice(4); parents.set(cur, []); }
  else if (cur && line.startsWith("name: ")) names.set(cur, line.slice(6));
  else if (cur && line.startsWith("is_a: ")) parents.get(cur).push(line.slice(6, 16));
}
const ancCache = new Map();
function ancestors(t) {
  if (ancCache.has(t)) return ancCache.get(t);
  const out = new Set([t]);
  for (const p of parents.get(t) ?? []) for (const a of ancestors(p)) out.add(a);
  ancCache.set(t, out);
  return out;
}
const PHENO_ROOT = "HP:0000118";
const isPhenotype = (t) => ancestors(t).has(PHENO_ROOT);

// --- annotations -----------------------------------------------------------
const direct = new Map(); // diseaseId -> Map(term -> [references])
const freq = new Map(); // "db|term" -> highest annotated frequency (0..1)
const FREQ_TERMS = { "HP:0040280": 1, "HP:0040281": 0.9, "HP:0040282": 0.55, "HP:0040283": 0.17, "HP:0040284": 0.02, "HP:0040285": 0 };
function parseFrequency(f) {
  if (!f) return null;
  if (f in FREQ_TERMS) return FREQ_TERMS[f];
  const ratio = f.match(/^(\d+)\/(\d+)$/);
  // Case reports (n/1, n/2…) say little about frequency; need at least 5 patients.
  if (ratio) return Number(ratio[2]) >= 5 ? Number(ratio[1]) / Number(ratio[2]) : null;
  const pct = f.match(/^([\d.]+)%$/);
  return pct ? Number(pct[1]) / 100 : null;
}
for (const line of fs.readFileSync(path.join(raw, "phenotype.hpoa"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || line.startsWith("database_id")) continue;
  const [db, , qualifier, hpo, reference, , , frequency, , , aspect] = line.split("\t");
  if (qualifier === "NOT" || aspect !== "P" || !parents.has(hpo)) continue;
  if (!direct.has(db)) direct.set(db, new Map());
  const m = direct.get(db);
  if (!m.has(hpo)) m.set(hpo, []);
  m.get(hpo).push(reference);
  const f = parseFrequency(frequency);
  if (f !== null) freq.set(`${db}|${hpo}`, Math.max(freq.get(`${db}|${hpo}`) ?? 0, f));
}

// Information content over every annotated disease in HPO.
const N = direct.size;
const counts = new Map();
for (const terms of direct.values()) {
  const prop = new Set();
  for (const t of terms.keys()) for (const a of ancestors(t)) prop.add(a);
  for (const a of prop) counts.set(a, (counts.get(a) ?? 0) + 1);
}
const ic = (t) => -Math.log((counts.get(t) ?? 1) / N);

// --- atlas diseases --------------------------------------------------------
const diseases = graph.nodes.filter((n) => n.type === "disease" && n.hpoSources?.length);
const profile = {};
for (const d of diseases) {
  const directTerms = new Map();
  for (const src of d.hpoSources) {
    for (const [t, refs] of direct.get(src) ?? []) {
      if (!isPhenotype(t)) continue;
      directTerms.set(t, [...(directTerms.get(t) ?? []), ...refs.map((r) => `${src} · ${r}`)]);
    }
  }
  const propagated = new Set();
  for (const t of directTerms.keys()) for (const a of ancestors(t)) if (isPhenotype(a)) propagated.add(a);
  propagated.delete(PHENO_ROOT);
  profile[d.id] = { directTerms, propagated };
}

function simGIC(a, b) {
  let inter = 0, union = 0;
  for (const t of new Set([...a, ...b])) {
    const w = ic(t);
    union += w;
    if (a.has(t) && b.has(t)) inter += w;
  }
  return union ? inter / union : 0;
}

// Most informative shared terms, keeping only the most specific
// (drop a shared term if one of its shared descendants is already listed).
function sharedTerms(a, b) {
  const shared = [...profile[a].propagated].filter((t) => profile[b].propagated.has(t));
  const specific = shared.filter(
    (t) => !shared.some((u) => u !== t && ancestors(u).has(t)),
  );
  return specific
    .sort((x, y) => ic(y) - ic(x))
    .map((t) => ({
      id: t,
      name: names.get(t),
      ic: Number(ic(t).toFixed(2)),
      refsA: profile[a].directTerms.get(t) ?? null,
      refsB: profile[b].directTerms.get(t) ?? null,
    }));
}

// Informative terms annotated (directly) for one disease and absent, with all
// descendants, from the other — "what differs" between the two profiles.
function distinctive(a, b) {
  return [...profile[a].directTerms.keys()]
    .filter((t) => !profile[b].propagated.has(t))
    .filter((t) => ic(t) > 3)
    .sort((x, y) => ic(y) - ic(x))
    .slice(0, 12)
    .map((t) => ({ id: t, name: names.get(t), ic: Number(ic(t).toFixed(2)), refs: profile[a].directTerms.get(t) }));
}

// Key findings: annotated as present in at least half of patients, most specific first.
function keyTerms(d) {
  const terms = [...profile[d.id].directTerms.keys()]
    .map((t) => ({ t, f: Math.max(...d.hpoSources.map((src) => freq.get(`${src}|${t}`) ?? -1)) }))
    .filter((x) => x.f >= 0.5);
  const ids = terms.map((x) => x.t);
  return terms
    .filter((x) => !ids.some((u) => u !== x.t && ancestors(u).has(x.t)))
    .filter((x) => ic(x.t) >= 2.5) // skip near-universal terms such as "Muscle weakness"
    .sort((a, b) => b.f - a.f || ic(b.t) - ic(a.t))
    .slice(0, 8)
    .map((x) => ({ id: x.t, name: names.get(x.t), ic: Number(ic(x.t).toFixed(2)), frequency: Number(x.f.toFixed(2)) }));
}

const pairs = {};
for (const a of diseases) {
  for (const b of diseases) {
    if (a.id >= b.id) continue;
    pairs[`${a.id}|${b.id}`] = {
      simGIC: Number(simGIC(profile[a.id].propagated, profile[b.id].propagated).toFixed(3)),
      shared: sharedTerms(a.id, b.id),
      onlyA: distinctive(a.id, b.id),
      onlyB: distinctive(b.id, a.id),
    };
  }
}

const out = {
  method:
    "simGIC over HPO 'Phenotypic abnormality' annotations, ancestor-propagated, IC weighted across all HPO-annotated diseases",
  hpoVersion: fs.readFileSync(path.join(raw, "phenotype.hpoa"), "utf8").match(/#version: (.*)/)?.[1],
  annotatedDiseases: N,
  diseases: Object.fromEntries(
    diseases.map((d) => [d.id, { sources: d.hpoSources, directTermCount: profile[d.id].directTerms.size, keyTerms: keyTerms(d) }]),
  ),
  pairs,
};
fs.writeFileSync(path.join(root, "data", "phenotypes.json"), JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(pairs)) console.log(k.padEnd(20), v.simGIC, v.shared.slice(0, 6).map((s) => s.name).join("; "));
