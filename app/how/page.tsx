import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import phenoData from "@/data/phenotypes.json";
import publications from "@/data/publications.json";
import quoteData from "@/data/quote-check.json";
import { compare, edges, nodes } from "@/lib/graph";

export const metadata: Metadata = {
  title: "How Kindred knows",
  description: "From sources to a grounded explanation: Kindred's evidence pipeline.",
};

const count = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

export default function How() {
  const checks = quoteData.checks;
  const verified = count(checks, (c) => c.result === "VERIFIED");
  const checkable = count(checks, (c) => c.result !== "NOT_CHECKABLE");
  const urls = new Set(edges.flatMap((e) => [e.sourceUrl, ...(e.corroboratedBy ?? []).map((c) => c.sourceUrl)]));
  const nct = count([...urls], (u) => u.includes("clinicaltrials.gov"));
  const medline = count([...urls], (u) => u.includes("medlineplus"));
  const tests = (fs.readFileSync(path.join(process.cwd(), "tests", "kindred.test.ts"), "utf8").match(/^test\(/gm) ?? []).length;
  const diseases = nodes.filter((n) => n.type === "disease");
  const mech = nodes.filter((n) => n.type === "mechanism");
  const status = (s: string) => count(edges, (e) => e.status === s);
  const prov = (p: string) => count(edges, (e) => e.provenance === p);
  const traced = edges.find((e) => e.id === "e014")!;
  const pompe = compare("danon", "pompe").sharedMechanisms[0];

  const STAGES = [
    {
      name: "Sources",
      detail: `${Object.keys(publications).length} PubMed publications · ${nct} ClinicalTrials.gov records · ${medline} MedlinePlus Genetics pages · HPO annotations (${phenoData.hpoVersion}, ${phenoData.annotatedDiseases.toLocaleString()} diseases)`,
    },
    {
      name: "Entity normalisation",
      detail: `${diseases.length} diseases with OMIM / Orphanet / MONDO identifiers and aliases · genes · ${mech.length} mechanism nodes in three tiers (gene product, pathway, cellular consequence)`,
    },
    {
      name: "Evidence-backed graph",
      detail: `${nodes.length} nodes · ${edges.length} edges · ${prov("CURATED")} curated, ${prov("EXTRACTED")} from literature · ${status("SUPPORTED")} supported, ${status("SINGLE_SOURCE")} single source, ${status("CONTESTED")} contested`,
    },
    {
      name: "Deterministic relationship engine",
      detail: "Symptom overlap: simGIC over ancestor-propagated HPO terms, weighted by information content. Mechanism overlap: weighted Jaccard over disease → gene → mechanism. Compatibility: explicit rules.",
    },
    {
      name: "Evidence integrity",
      detail: `${verified}/${checkable} quotes found verbatim in their source by an automated check · weakest-link rule on every path · contradictions shown, never resolved · no route inferred from similarity alone`,
    },
    {
      name: "OpenAI grounded synthesis",
      detail: "Intent and entity reconciliation through a schema constrained to atlas IDs. Explanations may cite only the evidence IDs supplied. Unknown citations, uncited sentences, or a PMID or trial ID not in the evidence → rejected, deterministic text shown.",
    },
    { name: "Research brief", detail: "Leads, infrastructure, limitations, evidence weakness and questions for expert review, every row cited." },
  ];

  return (
    <main className="how">
      <nav className="story-nav"><Link href="/">Kindred</Link></nav>
      <header className="story-head">
        <div className="caps story-kicker">How Kindred knows what it knows</div>
        <h1>The graph decides what is supported. OpenAI helps explain it.</h1>
      </header>

      <div className="how-stats">
        <div><b>{verified}</b><span>quotes machine-verified against their sources</span></div>
        <div><b>{edges.length}</b><span>evidence edges, each with provenance</span></div>
        <div><b>{tests}</b><span>automated tests on engine, evidence and guards</span></div>
        <div><b>0</b><span>relationships invented by a language model</span></div>
      </div>

      <ol className="pipeline">
        {STAGES.map((s, i) => (
          <li key={s.name} style={{ ["--i" as string]: i }} className={s.name.startsWith("OpenAI") ? "llm" : ""}>
            <span className="pl-node" />
            <div>
              <h2>{s.name}</h2>
              <p>{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="trace-demo">
        <h2 className="section-title">One claim, traced</h2>
        <div className="trace-row">
          <div className="tr-cell">
            <span className="caps">Claim</span>
            <p>Danon and Pompe meet at <b>{pompe.label.toLowerCase()}</b></p>
          </div>
          <span className="tr-arrow">→</span>
          <div className="tr-cell">
            <span className="caps">Evidence passage</span>
            <p className="serif">“{traced.evidence}”</p>
            <small className="verified">✓ found verbatim in the abstract</small>
          </div>
          <span className="tr-arrow">→</span>
          <div className="tr-cell">
            <span className="caps">Source</span>
            <p><a href={traced.sourceUrl} target="_blank" rel="noreferrer">{traced.source}</a></p>
          </div>
          <span className="tr-arrow">→</span>
          <div className="tr-cell">
            <span className="caps">Status</span>
            <p><span className="pill SINGLE_SOURCE">Single source</span></p>
            <small>The weakest link, so the whole Danon–Pompe path is shown as single source.</small>
          </div>
        </div>
      </section>

      <section className="not-do">
        <h2 className="section-title">What Kindred deliberately does not do</h2>
        <ul>
          <li>Diagnose, or advise on any individual&apos;s care</li>
          <li>Recommend treatment, or imply that shared biology means a shared therapy</li>
          <li>Infer a biological relationship from symptom similarity alone</li>
          <li>Hide or resolve contradictory evidence</li>
          <li>Let a language model decide which diseases are related</li>
        </ul>
        <p className="dnote">We kept the atlas small on purpose rather than filling it with synthetic relationships. Every displayed relationship has provenance.</p>
      </section>
    </main>
  );
}
