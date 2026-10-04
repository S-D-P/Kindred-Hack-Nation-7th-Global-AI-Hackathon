import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import quoteData from "../data/quote-check.json";
import { compatibility } from "../lib/compat";
import { compare, connections, edges, nodes } from "../lib/graph";
import { checkGeneration, parseIntentRules } from "../lib/llm";
import { brief, discovery, dossier, landscape, matrix, story } from "../lib/research";

test("Danon: Pompe is a mechanistic relative, PRKAG2 a phenotypic look-alike", () => {
  const byId = Object.fromEntries(connections("danon").map((c) => [c.disease, c]));
  assert.equal(byId.pompe.kinship, "RELATIVE");
  assert.equal(byId.prkag2.kinship, "LOOK_ALIKE");
  assert.equal(byId.fabry.kinship, "DISTANT");
  assert.equal(byId.hcm.kinship, "UNKNOWN");
  // The central idea: more symptom overlap, less mechanism overlap.
  assert.ok(byId.prkag2.phenotype > byId.pompe.phenotype);
  assert.ok(byId.pompe.mechanism > byId.prkag2.mechanism);
});

test("weakest-link rule: the Danon–Pompe path is single source at e014", () => {
  const m = compare("danon", "pompe").sharedMechanisms[0];
  assert.equal(m.node, "m_ap_fusion");
  assert.equal(m.weakest, "SINGLE_SOURCE");
  assert.equal(m.weakestEdge, "e014");
});

test("compatibility verdicts come from rules, not the model", () => {
  const items = Object.fromEntries(compatibility("danon", "pompe").items.map((i) => [i.component, i.verdict]));
  assert.equal(items["Enzyme replacement therapy (recombinant GAA)"], "DOES_NOT_TRANSFER");
  assert.equal(items["Urine glucose tetrasaccharide (Hex4)"], "UNKNOWN");
  assert.equal(items["Registry design (longitudinal, observational, treated and untreated)"], "TRANSFERS");
});

test("every edge is complete and every checkable quote was verified", () => {
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    for (const k of ["id", "subject", "relation", "object", "source", "sourceUrl", "evidence", "provenance", "status"] as const)
      assert.ok(e[k], `${e.id} missing ${k}`);
    assert.ok(ids.has(e.subject) && ids.has(e.object), `${e.id} points at an unknown node`);
  }
  assert.equal(quoteData.checks.filter((c) => c.result === "NOT_FOUND").length, 0);
  const checked = new Set(quoteData.checks.map((c) => c.edge));
  for (const e of edges) assert.ok(checked.has(e.id), `${e.id} has not been through verify-quotes`);
});

test("contested evidence is paired and surfaced in the matrix", () => {
  const rows = matrix("danon");
  const contested = rows.find((r) => r.status === "CONTESTED");
  assert.ok(contested);
  assert.deepEqual([...contested.edges].sort(), ["e034", "e035"]);
});

test("dossier, story and brief cite only edges that exist", () => {
  const known = new Set(edges.map((e) => e.id));
  const ok = (id: string) => known.has(id) || /^p-[a-z0-9]+-[a-z0-9]+$/.test(id);
  const d = dossier("danon");
  for (const c of [d.cause, ...d.mechanism, ...d.landscape, ...d.gaps]) c.edges.forEach((id) => assert.ok(ok(id), id));
  for (const c of connections("danon")) {
    const s = story("danon", c);
    [...s.connected.edges, ...s.different.edges, ...s.investigate.edges].forEach((id) => assert.ok(ok(id), id));
  }
  const b = brief("danon");
  b.rows.flatMap((r) => r.edges).forEach((id) => assert.ok(ok(id), id));
  assert.ok(b.questions.length >= 2 && b.questions.length <= 4);
});

test("generation guard rejects invented citations and identifiers", () => {
  const evidence = JSON.stringify([{ id: "e014", evidence: "The autophagic process in Pompe skeletal muscle is affected at the termination stage-impaired autophagosomal-lysosomal fusion.", source: "PMID 25183957" }]);
  assert.deepEqual(checkGeneration("Pompe muscle shows impaired fusion, from one review [e014].", ["e014"], evidence), []);
  assert.ok(checkGeneration("Danon is linked to Pompe [e999].", ["e014"], evidence).length);
  assert.ok(checkGeneration("A trial NCT01234567 shows it works [e014].", ["e014"], evidence).length);
  assert.ok(checkGeneration("No citation at all in this rather long sentence.", ["e014"], evidence).length);
  // A valid citation must not smuggle in an entity the evidence never mentions.
  const danon = JSON.stringify([{ id: "e001", claim: "Danon disease | is caused by variants in | LAMP2", evidence: "Danon disease is caused by variants (also called mutations) in the LAMP2 gene." }]);
  assert.deepEqual(checkGeneration("Danon disease is caused by variants in the LAMP2 gene [e001].", ["e001"], danon), []);
  assert.ok(checkGeneration("Danon disease resembles Batten disease [e001].", ["e001"], danon).some((p) => p.includes("Batten disease")));
  assert.ok(checkGeneration("Danon disease resembles Pompe disease [e001].", ["e001"], danon).some((p) => p.includes("Pompe")));
  assert.ok(checkGeneration("Danon disease is linked to the GBA1 gene [e001].", ["e001"], danon).some((p) => p.includes("GBA1")));
  assert.deepEqual(checkGeneration("The disease is caused by variants in LAMP2 [e001].", ["e001"], danon), []);
});

test("intent rules route the demo questions", () => {
  const ctx = { focal: "danon" };
  assert.equal(parseIntentRules("Who shares our biology?", {}).intent, "find_connections");
  assert.equal(parseIntentRules("Why don't you think PRKAG2 is a relative?", ctx).intent, "explain_difference");
  assert.equal(parseIntentRules("Can we reuse what the Pompe community built?", ctx).intent, "reuse_assets");
  assert.equal(parseIntentRules("How well do we know this?", ctx).intent, "evidence_matrix");
  assert.equal(parseIntentRules("Prepare a research brief", ctx).intent, "next_steps");
  assert.equal(parseIntentRules("Should my son take enzyme replacement?", ctx).intent, "out_of_scope");
  assert.equal(parseIntentRules("Danon disease: What could we reuse?", {}).entity, "danon");
});

test("no em dashes anywhere in the app or data", () => {
  const root = path.resolve(__dirname, "..");
  const files = ["app", "components", "lib", "data"].flatMap((dir) =>
    fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile() && /\.(tsx?|css|json|md)$/.test(f.name))
      .map((f) => path.join(f.parentPath, f.name)),
  );
  for (const f of files) assert.ok(!fs.readFileSync(f, "utf8").includes("—"), `em dash in ${path.relative(root, f)}`);
});

test("research landscape lists each asset once", () => {
  for (const other of ["pompe", "prkag2", "fabry", "hcm"])
    for (const g of landscape("danon", other)) {
      const labels = g.items.map((i) => i.label);
      assert.equal(new Set(labels).size, labels.length, `${other}/${g.title}: ${labels.join(" | ")}`);
    }
});

test("discovery: symptom-first and mechanism-first point at different diseases", () => {
  const d = discovery("danon");
  assert.ok(d);
  assert.equal(d.bySymptoms.label, "PRKAG2 cardiac syndrome");
  assert.equal(d.byMechanism.label, "Pompe disease");
  assert.equal(d.bySymptoms.phenotype.toFixed(2), "0.18");
  assert.equal(d.byMechanism.mechanism.toFixed(2), "0.50");
});

test("no supported route: similarity alone never creates a biological connection", () => {
  const s = Object.fromEntries(connections("danon").map((c) => [c.disease, story("danon", c)]));
  assert.equal(s.pompe.noRoute, false);
  assert.equal(s.prkag2.noRoute, true); // only a downstream consequence is shared
  assert.equal(s.hcm.noRoute, true); // clinical resemblance, nothing shared
  const card = Object.fromEntries(s.prkag2.scorecard.map((x) => [x.label, x.value]));
  assert.equal(card.Biology, "Downstream only");
  assert.equal(card.Evidence, "Contested");
  assert.equal(card.Transferability, "Expert review");
});
