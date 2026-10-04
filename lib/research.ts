// The research layer: dossier, connection stories, research landscape,
// evidence matrix, brief and the Kindred Path. All deterministic; every
// statement carries the edge IDs it rests on.
import publications from "@/data/publications.json";
import { compatibility } from "./compat";
import { compare, connectionEdgeIds, connections, edge, edges, keyTerms, node, nodes, sourceCount, weakest } from "./graph";
import type {
  AssetGroup,
  BriefRow,
  Cited,
  Connection,
  Discovery,
  Dossier,
  ExpertQuestion,
  MatrixRow,
  Status,
  Story,
  TreeBranch,
} from "./types";

const lc = (s: string) => s.split(" ").map((w) => (/^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w)).join(" ");
const short = (label: string) => label.replace(/ disease$/, "");
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const pathEdges = (c: Connection, i = 0) => c.sharedMechanisms[i]?.path.flatMap((s) => (s.edge ? [s.edge] : [])) ?? [];

const geneEdge = (d: string) => edges.find((e) => e.subject === d && node(e.object)?.type === "gene");
const molecularEdge = (d: string) => {
  const g = geneEdge(d)?.object;
  return edges.find((e) => e.subject === g && node(e.object)?.tier === "molecular");
};
const assetsAbout = (d: string) => edges.filter((e) => e.object === d && node(e.subject)?.type === "asset");
const orgsAbout = (d: string) => edges.filter((e) => e.object === d && node(e.subject)?.type === "organization");

export function askFor(focalLabel: string, c: Connection) {
  return c.kinship === "RELATIVE"
    ? `Why are ${focalLabel} and ${c.label} connected?`
    : `Why don't you think ${c.kinship === "LOOK_ALIKE" && c.gene ? c.gene : short(c.label)} is a relative?`;
}

// --- Why connected / why different / why investigate --------------------------
export function story(focal: string, c: Connection): Story {
  const f = node(focal)!;
  const pid = `p-${focal}-${c.disease}`;

  let connected: Cited;
  if (c.kinship === "RELATIVE") {
    const top = c.sharedMechanisms.slice(0, 2);
    connected = {
      text: `Both diseases record ${top.map((m) => lc(m.label)).join(" and ")}${c.sharedMechanisms.length > 2 ? `, plus ${c.sharedMechanisms.length - 2} more shared nodes` : ""}.`,
      edges: uniq(top.flatMap((_, i) => pathEdges(c, i))),
    };
  } else if (c.kinship === "LOOK_ALIKE") {
    const resemble = c.directEdges.filter((id) => edge(id)?.relation.includes("resembles"));
    connected = {
      text: `The strongest symptom overlap in this atlas: ${c.sharedPhenotypes.slice(0, 3).map((p) => p.name).join(", ")}.`,
      edges: [pid, ...resemble],
    };
  } else if (c.sharedMechanisms.length) {
    connected = { text: `Only a broad pathway is shared: ${lc(c.sharedMechanisms[0].label)}.`, edges: pathEdges(c) };
  } else {
    const d = c.directEdges[0];
    connected = d
      ? { text: `${f.label} ${edge(d)!.relation} ${c.label}, but no shared mechanism is recorded.`, edges: [d] }
      : { text: "No shared mechanism or notable symptom overlap is recorded.", edges: [] };
  }

  const fm = molecularEdge(focal), om = molecularEdge(c.disease);
  const contrast = c.directEdges.filter((id) => edge(id)?.relation.startsWith("differs"));
  const different: Cited = {
    text:
      fm && om
        ? `${short(f.label)} involves ${f.gene}, ${/^[aeiou]/i.test(node(fm.object)!.label) ? "an" : "a"} ${lc(node(fm.object)!.label)}. ${short(c.label)} involves ${c.gene}, ${/^[aeiou]/i.test(node(om.object)!.label) ? "an" : "a"} ${lc(node(om.object)!.label)}.`
        : `${short(c.label)} has no molecular mechanism recorded in this atlas.`,
    edges: uniq([fm?.id, om?.id, ...contrast].filter(Boolean) as string[]),
  };

  let investigate: Cited;
  const shared = c.sharedAssets.map((a) => node(a)!);
  const theirs = assetsAbout(c.disease);
  if (shared.length) {
    investigate = {
      text: `${shared.map((a) => a.label).join("; ")} already enrols patients with both diseases.`,
      edges: c.sharedAssets.flatMap((a) => edges.filter((e) => e.subject === a).map((e) => e.id)),
    };
  } else if (c.kinship === "RELATIVE" && theirs.length) {
    investigate = {
      text: `The ${short(c.label)} community has built: ${theirs.map((e) => node(e.subject)!.label).join("; ")}.`,
      edges: theirs.map((e) => e.id),
    };
  } else {
    investigate = { text: "No shared study or reusable asset is recorded in this atlas.", edges: [] };
  }

  const m1 = c.sharedMechanisms[0] ? lc(c.sharedMechanisms[0].label) : "";
  const implication = {
    RELATIVE: `Shared ${m1} biology makes ${short(c.label)} worth investigating alongside ${short(f.label)}, but the different molecular causes mean nothing can be assumed to transfer.`,
    LOOK_ALIKE: `A partner for clinical infrastructure, such as cardiac endpoints and natural-history data, not for mechanism-based research. More symptom overlap does not make it the stronger biological connection.`,
    DISTANT: `A distant branch: only a broad pathway is shared, so it is unlikely to be the first place to look.`,
    UNKNOWN: `Too little phenotype data in this atlas to judge; the branch stays open until better annotations exist.`,
  }[c.kinship];

  const ids = connectionEdgeIds(c);
  const upstream = c.sharedMechanisms.some((m) => m.tier !== "cellular");
  const tone = (s: Status | null) => (s === "SUPPORTED" ? "good" : s === "CONTESTED" ? "bad" : s ? "warn" : "none") as Story["scorecard"][number]["tone"];
  const evidenceStatus: Status | null = c.contested.length ? "CONTESTED" : c.sharedMechanisms[0]?.weakest ?? (c.directEdges[0] ? edge(c.directEdges[0])!.status : null);
  const scorecard: Story["scorecard"] = [
    upstream
      ? {
          label: "Biology",
          value: (() => {
            const n = c.sharedMechanisms.filter((m) => m.tier !== "cellular").length;
            return n > 1 ? `Shared pathways (${n})` : "Shared pathway";
          })(),
          tone: c.kinship === "RELATIVE" ? "good" : "warn",
        }
      : c.sharedMechanisms.length
        ? { label: "Biology", value: "Downstream only", tone: "warn" }
        : { label: "Biology", value: "None recorded", tone: "none" },
    c.phenotypeTermCount < 10
      ? { label: "Phenotype", value: "Limited data", tone: "none" }
      : c.phenotype >= 0.15
        ? { label: "Phenotype", value: "Similar", tone: "good" }
        : c.phenotype >= 0.1
          ? { label: "Phenotype", value: "Partial", tone: "warn" }
          : { label: "Phenotype", value: "Low", tone: "none" },
    c.sharedAssets.length
      ? { label: "Research asset", value: "Shared study", tone: "good" }
      : c.kinship === "RELATIVE" && theirs.length
        ? { label: "Research asset", value: "Found", tone: "good" }
        : { label: "Research asset", value: "Not found", tone: "none" },
    { label: "Transferability", value: "Expert review", tone: "warn" },
    { label: "Evidence", value: evidenceStatus ? (({ SUPPORTED: "Supported", SINGLE_SOURCE: "Single source", CONTESTED: "Contested", INFERRED: "Computed", UNKNOWN: "Unknown" }) as Record<Status, string>)[evidenceStatus] : "Unknown", tone: tone(evidenceStatus) },
  ];
  return {
    scorecard,
    noRoute: !upstream,
    disease: c.disease,
    label: c.label,
    kinship: c.kinship,
    mechanism: c.mechanism,
    phenotype: c.phenotype,
    connected,
    different,
    investigate,
    implication,
    sources: sourceCount(ids) + (c.phenotype > 0 ? 1 : 0),
    claims: uniq(ids).length,
    weakest: c.sharedMechanisms[0]?.weakest ?? null,
    ask: askFor(f.label, c),
  };
}

// --- The counterintuitive contrast ------------------------------------------------------
/**
 * Symptom-first vs mechanism-first. Returns null when both questions point at the
 * same disease (then there is nothing counterintuitive to show).
 */
export function discovery(focal: string): Discovery | null {
  const conns = connections(focal).filter((c) => c.phenotypeTermCount >= 10);
  if (conns.length < 2) return null;
  const bySym = [...conns].sort((a, b) => b.phenotype - a.phenotype)[0];
  const byMech = [...conns].sort((a, b) => b.mechanism - a.mechanism)[0];
  if (bySym.disease === byMech.disease) return null;
  const pick = (c: Connection) => ({ label: c.label, phenotype: c.phenotype, mechanism: c.mechanism });
  return {
    focalLabel: node(focal)!.label,
    bySymptoms: pick(bySym),
    byMechanism: pick(byMech),
    edges: [`p-${focal}-${bySym.disease}`, `p-${focal}-${byMech.disease}`, ...pathEdges(byMech)],
  };
}

// --- Disease dossier -----------------------------------------------------------------
export function dossier(focal: string): Dossier {
  const d = node(focal)!;
  const ge = geneEdge(focal), me = molecularEdge(focal);
  const conns = connections(focal);
  const gene = d.gene ?? "";

  const mechanism: Cited[] = edges
    .filter((e) => (e.subject === gene && node(e.object)?.tier === "pathway") || (e.subject === focal && node(e.object)?.type === "mechanism"))
    .map((e) => ({ text: node(e.object)!.label, edges: [e.id] }));

  const own = assetsAbout(focal);
  const studies = own.filter((e) => node(e.subject)?.kind === "study" && node(e.subject)?.community === focal);
  const models = own.filter((e) => node(e.subject)?.kind === "model");
  const sharedStudies = nodes.filter((n) => n.community === "shared" && edges.some((e) => e.subject === n.id && e.object === focal));
  const orgs = orgsAbout(focal);
  const landscape: Cited[] = [
    studies.length
      ? { text: `${studies.length} registered studies and trials on ClinicalTrials.gov`, edges: studies.map((e) => e.id) }
      : { text: "No studies curated in this atlas yet", edges: [] },
    ...(sharedStudies.length ? [{ text: `${sharedStudies.length} study shared with another disease community`, edges: sharedStudies.flatMap((n) => edges.filter((e) => e.subject === n.id).map((e) => e.id)) }] : []),
    ...(models.length ? [{ text: `${models.length} animal model described in the literature`, edges: models.map((e) => e.id) }] : []),
    orgs.length
      ? { text: `${orgs.length} patient organizations`, edges: orgs.map((e) => e.id) }
      : { text: "No patient organization verified in this atlas yet", edges: [] },
  ];

  const gaps: Cited[] = [];
  for (const c of conns) {
    const w = c.sharedMechanisms[0];
    if (c.kinship === "RELATIVE" && w?.weakestEdge)
      gaps.push({ text: `The ${short(c.label)} connection rests on a single source at its weakest link.`, edges: [w.weakestEdge] });
    if (c.contested.length) gaps.push({ text: `Sources disagree about one ${short(c.label)} finding.`, edges: c.contested });
    if (c.kinship === "UNKNOWN") gaps.push({ text: `${short(c.label)} has too few phenotype annotations (${c.phenotypeTermCount}) to compare.`, edges: [] });
  }
  if (focal === "danon") gaps.push({ text: "No Danon data on the Pompe urine biomarker (Hex4).", edges: ["e063"] });

  return {
    disease: focal,
    label: d.label,
    subtitle: `${gene}-related rare disease`,
    ids: d.ids ?? {},
    cause: {
      text: me ? `Variants in ${gene}, which encodes ${/^[aeiou]/i.test(node(me.object)!.label) ? "an" : "a"} ${lc(node(me.object)!.label)}.` : `Variants in ${gene}.`,
      edges: [ge?.id, me?.id].filter(Boolean) as string[],
    },
    mechanism,
    phenotypes: keyTerms(focal),
    phenotypeNote: "Most specific HPO findings recorded in at least half of patients",
    related: conns.map((c) => ({ label: c.label, kinship: c.kinship })),
    landscape,
    gaps,
  };
}

// --- What exists around this connection? --------------------------------------
type Pub = { pmid: string; title: string; journal: string; year: string; authors: string[]; url: string };
export function landscape(focal: string, other: string): AssetGroup[] {
  const c = compare(focal, other);
  const groups: AssetGroup[] = [];
  const asItem = (id: string) => {
    const e = edge(id)!;
    const n = node(e.subject)!;
    return { label: n.label, detail: e.label ?? `${e.relation} ${node(e.object)!.label}`, edges: [id], url: n.url };
  };

  const shared = c.sharedAssets.flatMap((a) => edges.filter((e) => e.subject === a && e.object === focal).map((e) => e.id));
  const studies = [...shared, ...assetsAbout(other).filter((e) => node(e.subject)?.kind === "study" && !c.sharedAssets.includes(e.subject)).map((e) => e.id)];
  const ownStudies = assetsAbout(focal).filter((e) => node(e.subject)?.kind === "study" && node(e.subject)?.community === focal).map((e) => e.id);
  groups.push({
    title: "Studies",
    note: "Shared study infrastructure says nothing about shared biology.",
    items: [
      ...studies.map((id) => ({ ...asItem(id), detail: c.sharedAssets.includes(edge(id)!.subject) ? `Enrols both ${short(node(focal)!.label)} and ${short(c.label)} patients` : edge(id)!.relation })),
      ...(ownStudies.length ? [{ label: `${ownStudies.length} ${short(node(focal)!.label)} studies and trials`, detail: "Already registered; check these before building anything new", edges: ownStudies }] : []),
    ],
  });

  const registries = assetsAbout(other).filter((e) => node(e.subject)?.kind === "registry").map((e) => e.id);
  const orgs = [...orgsAbout(other), ...orgsAbout(focal)].map((e) => e.id);
  if (registries.length || orgs.length)
    groups.push({
      title: "Patient and registry infrastructure",
      note: "Organizations and registries that already exist around this connection.",
      items: [...registries.map(asItem), ...orgs.map((id) => ({ ...asItem(id), detail: `Patient organization for ${node(edge(id)!.object)!.label}` }))],
    });

  const ids = uniq(connectionEdgeIds(c));
  const byPmid = new Map<string, string[]>();
  for (const id of ids) {
    const e = edge(id)!;
    for (const url of [e.sourceUrl, ...(e.corroboratedBy ?? []).map((x) => x.sourceUrl)]) {
      const pmid = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1];
      if (pmid) byPmid.set(pmid, uniq([...(byPmid.get(pmid) ?? []), id]));
    }
  }
  const pubs = publications as Record<string, Pub>;
  groups.push({
    title: "Research literature",
    note: "Publications behind the edges in this connection, with the groups that wrote them.",
    items: [...byPmid.entries()].map(([pmid, es]) => {
      const p = pubs[pmid];
      return {
        label: p?.title ?? `PMID ${pmid}`,
        detail: p ? `${p.authors[0]}${p.authors.length > 1 ? ` … ${p.authors.at(-1)}` : ""} · ${p.journal}${p.year ? ` ${p.year}` : ""} · PMID ${pmid}` : `PMID ${pmid}`,
        edges: es,
        url: p?.url ?? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    }),
  });

  const knowledge = [...assetsAbout(other), ...assetsAbout(focal)].filter((e) => ["research", "model"].includes(node(e.subject)?.kind ?? ""));
  if (knowledge.length)
    groups.push({ title: "Potentially reusable knowledge", note: "Research context worth discussing, not assuming.", items: knowledge.map((e) => asItem(e.id)) });

  const review: { label: string; detail: string; edges: string[] }[] = [];
  const w = c.sharedMechanisms[0];
  if (w?.weakestEdge) review.push({ label: "Weakest link in the connection", detail: `${edge(w.weakestEdge)!.subject === "GAA" ? "The Pompe side of the shared step" : "One edge"} rests on a single source`, edges: [w.weakestEdge] });
  for (const e of assetsAbout(other).filter((e) => node(e.subject)?.kind === "therapy"))
    review.push({ label: node(e.subject)!.label, detail: "A therapy for one disease cannot be assumed to apply to another", edges: [e.id] });
  if (c.contested.length) review.push({ label: "Contested finding", detail: "Two sources disagree", edges: c.contested });
  if (review.length) groups.push({ title: "Requires expert review", note: "Nothing here should be treated as transferable.", items: review });

  return groups;
}

// --- How well do we know it? ------------------------------------------------------
const evidenceKind = (ids: string[]) => {
  const p = new Set(ids.map((id) => (id.startsWith("p-") ? "INFERRED" : edge(id)?.provenance)));
  const parts = [p.has("CURATED") && "Curated database", p.has("EXTRACTED") && "Literature", p.has("INFERRED") && "Computed"].filter(Boolean);
  return parts.join(" + ") || "None";
};
const statusOf = (ids: string[]): Status => weakest(ids.map((id) => (id.startsWith("p-") ? "INFERRED" : edge(id)!.status)));

export function matrix(focal: string): MatrixRow[] {
  const f = short(node(focal)!.label);
  const rows: MatrixRow[] = [];
  const row = (claim: string, ids: string[], status?: Status, evidence?: string) =>
    rows.push({ claim, evidence: evidence ?? evidenceKind(ids), sources: sourceCount(ids.filter((id) => !id.startsWith("p-"))) + (ids.some((id) => id.startsWith("p-")) ? 1 : 0), status: status ?? statusOf(ids), edges: ids });

  const ge = geneEdge(focal), me = molecularEdge(focal);
  if (ge) row(`${f} is caused by ${node(focal)!.gene} variants`, [ge.id]);
  if (me) row(`${node(focal)!.gene} encodes ${/^[aeiou]/i.test(node(me.object)!.label) ? "an" : "a"} ${lc(node(me.object)!.label)}`, [me.id]);

  for (const c of connections(focal)) {
    const o = short(c.label);
    if (c.sharedMechanisms.length && c.kinship !== "LOOK_ALIKE") row(`${f} ↔ ${o}: shared ${lc(c.sharedMechanisms[0].label)}`, pathEdges(c));
    if (c.kinship === "LOOK_ALIKE") {
      row(`${f} ↔ ${o}: symptom overlap (simGIC ${c.phenotype.toFixed(2)})`, [`p-${focal}-${c.disease}`]);
      for (const id of c.directEdges.filter((id) => edge(id)?.relation.includes("resembles"))) row(`${f} and ${o} resemble each other clinically`, [id]);
      if (c.sharedMechanisms[0]) row(`${f} ↔ ${o}: shared ${lc(c.sharedMechanisms[0].label)} (downstream only)`, pathEdges(c));
    }
    for (const a of c.sharedAssets) row(`${f} and ${o} share ${node(a)!.label.split(" (")[0]}`, edges.filter((e) => e.subject === a).map((e) => e.id));
    for (let i = 0; i < c.contested.length; i += 2) {
      const pair = c.contested.slice(i, i + 2).map((id) => edge(id)!);
      const ph = pair.find((e) => node(e.object)?.type === "phenotype");
      row(ph ? `${o}: ${node(ph.object)!.label.split(" (")[0].toLowerCase()} present?` : pair[0].label ?? pair[0].relation, c.contested.slice(i, i + 2), "CONTESTED", "Conflicting sources");
    }
    if (c.kinship === "UNKNOWN") row(`${f} ↔ ${o}: symptom comparison`, [`p-${focal}-${c.disease}`], "UNKNOWN", `Only ${c.phenotypeTermCount} HPO terms`);
  }
  if (focal === "danon") {
    row("Pompe enzyme replacement rationale applies to Danon", ["e011", "e032", "e033"], "INFERRED", "Computed: does not apply");
    row("Hex4 urine biomarker is informative in Danon", ["e063"], "UNKNOWN", "No Danon evidence");
  }
  return rows;
}

// --- Research brief -------------------------------------------------------------------
export function brief(focal: string): { rows: BriefRow[]; questions: ExpertQuestion[] } {
  const conns = connections(focal);
  const rel = conns.find((c) => c.kinship === "RELATIVE");
  const look = conns.find((c) => c.kinship === "LOOK_ALIKE");
  const rows: BriefRow[] = [{ label: "Starting disease", value: `${node(focal)!.label} (${node(focal)!.gene})`, edges: [geneEdge(focal)!.id] }];
  if (rel) rows.push({ label: "Strongest mechanistic connection", value: `${rel.label}: mechanism overlap ${rel.mechanism.toFixed(2)}, symptom overlap ${rel.phenotype.toFixed(2)}`, edges: pathEdges(rel) });
  if (look) rows.push({ label: "Strongest phenotypic resemblance", value: `${look.label}: symptom overlap ${look.phenotype.toFixed(2)}, mechanism overlap ${look.mechanism.toFixed(2)}`, edges: [`p-${focal}-${look.disease}`, ...look.directEdges] });
  if (rel) rows.push({ label: "Research direction", value: `Investigate shared ${lc(rel.sharedMechanisms[0].label)} with the ${short(rel.label)} research community`, edges: pathEdges(rel) });

  const own = assetsAbout(focal).filter((e) => node(e.subject)?.kind === "study" && node(e.subject)?.community === focal);
  const sharedIds = conns.flatMap((c) => c.sharedAssets).flatMap((a) => edges.filter((e) => e.subject === a && e.object === focal).map((e) => e.id));
  rows.push({ label: "Existing infrastructure", value: `${own.length ? `${own.length} ${short(node(focal)!.label)} studies and trials` : `No ${short(node(focal)!.label)} studies curated in this atlas yet`}${sharedIds.length ? `, plus a natural-history study shared with ${short(look?.label ?? "another disease")}` : ""}`, edges: uniq([...own.map((e) => e.id), ...sharedIds]) });
  rows.push(
    focal === "danon"
      ? { label: "Important limitation", value: "Shared biology does not establish that any treatment transfers. In this atlas, Pompe enzyme replacement does not apply to Danon on the evidence.", edges: ["e032", "e011"] }
      : { label: "Important limitation", value: "Shared biology does not establish that any treatment transfers. No transferability check is curated for this disease yet.", edges: [] },
  );
  const w = rel?.sharedMechanisms[0];
  if (w?.weakestEdge) rows.push({ label: "Evidence weakness", value: `The ${short(rel!.label)} mechanistic connection has a single-source weakest link`, edges: [w.weakestEdge] });
  if (look?.contested.length) rows.push({ label: "Contested evidence", value: `Sources disagree about one ${short(look.label)} finding`, edges: look.contested });

  const questions = focal === "danon" && rel?.disease === "pompe" ? compatibility(focal, "pompe").questions : [];
  return { rows, questions };
}

// --- Kindred Path ---------------------------------------------------------------------
export function tree(focal: string): TreeBranch[] {
  const conns = connections(focal);
  const f = node(focal)!.label;
  const branches: TreeBranch[] = [];
  const rel = conns.filter((c) => c.kinship === "RELATIVE");
  const look = conns.filter((c) => c.kinship === "LOOK_ALIKE");
  const far = conns.filter((c) => c.kinship === "DISTANT" || c.kinship === "UNKNOWN");
  if (rel.length)
    branches.push({ kind: "mechanism", label: "Mechanistic path", leaves: rel.map((c) => ({ label: short(c.label), detail: `Shared ${lc(c.sharedMechanisms[0].label)}`, ask: askFor(f, c), edges: pathEdges(c) })) });
  if (look.length)
    branches.push({ kind: "phenotype", label: "Phenotypic path", leaves: look.map((c) => ({ label: short(c.label), detail: `${c.sharedPhenotypes.slice(0, 2).map((p) => p.name).join(", ")}; different mechanism`, ask: askFor(f, c), edges: [`p-${focal}-${c.disease}`] })) });
  const shared = uniq(conns.flatMap((c) => c.sharedAssets));
  branches.push({
    kind: "asset",
    label: "Research infrastructure",
    leaves: [
      ...shared.map((a) => ({ label: "Shared clinical study", detail: node(a)!.label, ask: `What exists around ${short(f)} and ${short(look[0]?.label ?? "")}?`, edges: edges.filter((e) => e.subject === a).map((e) => e.id) })),
      ...(rel[0] ? [{ label: `${short(rel[0].label)} community assets`, detail: "Registry, therapy, biomarker, research", ask: `Can we reuse what the ${short(rel[0].label)} community built?`, edges: assetsAbout(rel[0].disease).map((e) => e.id) }] : []),
    ],
  });
  const gaps = dossier(focal).gaps.slice(0, 2);
  branches.push({ kind: "gap", label: "Evidence gaps", leaves: gaps.map((g) => ({ label: g.text.split(/[.:]/)[0], detail: "See the evidence matrix", ask: "How well do we know this?", edges: g.edges })) });
  if (far.length)
    branches.push({ kind: "distant", label: "Weaker branches", leaves: far.map((c) => ({ label: short(c.label), detail: c.summary, ask: askFor(f, c), edges: [] })) });
  return branches;
}
