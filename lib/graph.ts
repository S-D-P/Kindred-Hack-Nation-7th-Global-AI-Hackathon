// Deterministic evidence-graph engine. Everything the UI claims is computed
// here from data/graph.json and data/phenotypes.json, the language model
// only ever narrates these results.
import graphData from "@/data/graph.json";
import phenoData from "@/data/phenotypes.json";
import quoteData from "@/data/quote-check.json";
import type {
  Connection,
  Edge,
  EdgeView,
  GraphNode,
  Kinship,
  PathStep,
  SharedMechanism,
  Status,
} from "./types";

export const nodes = graphData.nodes as GraphNode[];
export const edges = graphData.edges as Edge[];
const byId = new Map(nodes.map((n) => [n.id, n]));
const edgeById = new Map(edges.map((e) => [e.id, e]));

export const node = (id: string) => byId.get(id);
export const edge = (id: string) => edgeById.get(id);
export const diseases = nodes.filter((n) => n.type === "disease");
export const hpoVersion = phenoData.hpoVersion as string;

const TIER_WEIGHT = graphData.meta.mechanismWeights as Record<string, number>;

/** Thresholds for the two-axis classifier. Shown to the user under the plot. */
export const THRESHOLDS = { mechanism: 0.3, phenotype: 0.15, minPhenotypeTerms: 10 };

// Strongest first. A path is only as strong as its weakest edge.
const RANK: Status[] = ["SUPPORTED", "SINGLE_SOURCE", "INFERRED", "CONTESTED", "UNKNOWN"];
export function weakest(statuses: Status[]): Status {
  return statuses.reduce<Status>((w, s) => (RANK.indexOf(s) > RANK.indexOf(w) ? s : w), "SUPPORTED");
}

// --- entity reconciliation (deterministic fallback; also validates model output)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function resolveEntity(text: string): string | undefined {
  const t = ` ${norm(text)} `;
  let best: { id: string; len: number } | undefined;
  for (const d of diseases) {
    const names = [d.label, ...(d.aliases ?? []), d.gene ?? "", ...Object.values(d.ids ?? {})];
    for (const name of names) {
      const n = norm(name);
      if (n.length < 3) continue;
      if (t.includes(` ${n} `) && (!best || n.length > best.len)) best = { id: d.id, len: n.length };
    }
  }
  return best?.id;
}

/** Every atlas disease named in the text, in order of first mention. */
export function mentionedEntities(text: string): string[] {
  const t = ` ${norm(text)} `;
  const hits: { id: string; at: number }[] = [];
  for (const d of diseases) {
    const names = [d.label, ...(d.aliases ?? []), d.gene ?? "", ...Object.values(d.ids ?? {})];
    const at = Math.min(...names.map((n) => norm(n)).filter((n) => n.length >= 3).map((n) => {
      const i = t.indexOf(` ${n} `);
      return i < 0 ? Infinity : i;
    }));
    if (at < Infinity) hits.push({ id: d.id, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.id);
}

// --- mechanism profile: disease → gene → mechanism, or disease → mechanism
interface MechHit {
  steps: { node: string; edge: string }[]; // walking from the disease outward
  status: Status;
}
function mechanismProfile(diseaseId: string): Map<string, MechHit> {
  const out = new Map<string, MechHit>();
  const consider = (mech: string, steps: MechHit["steps"]) => {
    const status = weakest(steps.map((s) => edgeById.get(s.edge)!.status));
    const prev = out.get(mech);
    if (!prev || RANK.indexOf(status) < RANK.indexOf(prev.status) || (status === prev.status && steps.length < prev.steps.length))
      out.set(mech, { steps, status });
  };
  for (const e of edges) {
    if (e.subject !== diseaseId) continue;
    const obj = byId.get(e.object);
    if (obj?.type === "mechanism") consider(obj.id, [{ node: obj.id, edge: e.id }]);
    if (obj?.type === "gene") {
      for (const g of edges) {
        if (g.subject === obj.id && byId.get(g.object)?.type === "mechanism")
          consider(g.object, [{ node: obj.id, edge: e.id }, { node: g.object, edge: g.id }]);
      }
    }
  }
  return out;
}

function sharedPath(a: string, b: string, mech: string, pa: MechHit, pb: MechHit): PathStep[] {
  const steps: PathStep[] = [];
  const add = (id: string, edgeId?: string, reversed?: boolean) => {
    const n = byId.get(id)!;
    steps.push({ node: id, label: n.label, type: n.type, edge: edgeId, reversed });
  };
  // a ──e1──▶ gene ──e2──▶ mech ◀──e2'── gene' ◀──e1'── b
  add(a, pa.steps[0].edge);
  for (let i = 0; i < pa.steps.length - 1; i++) add(pa.steps[i].node, pa.steps[i + 1].edge);
  const back = [...pb.steps].reverse();
  add(mech, back[0].edge, true);
  for (let i = 1; i < back.length; i++) add(back[i].node, back[i].edge, true);
  add(b);
  return steps;
}

type PhenoPair = {
  simGIC: number;
  shared: { id: string; name: string; ic: number }[];
  onlyA: { id: string; name: string; ic: number }[];
  onlyB: { id: string; name: string; ic: number }[];
};
function phenotypePair(a: string, b: string) {
  const pairs = phenoData.pairs as Record<string, PhenoPair>;
  const [x, y] = a < b ? [a, b] : [b, a];
  const p = pairs[`${x}|${y}`];
  if (!p) return undefined;
  return a < b ? p : { ...p, onlyA: p.onlyB, onlyB: p.onlyA };
}
export const phenotypeTermCount = (id: string) =>
  (phenoData.diseases as Record<string, { directTermCount: number }>)[id]?.directTermCount ?? 0;

export function compare(focal: string, other: string): Connection {
  const pa = mechanismProfile(focal);
  const pb = mechanismProfile(other);
  let inter = 0, union = 0;
  const shared: SharedMechanism[] = [];
  for (const m of new Set([...pa.keys(), ...pb.keys()])) {
    const n = byId.get(m)!;
    const w = TIER_WEIGHT[n.tier!];
    union += w;
    if (pa.has(m) && pb.has(m)) {
      inter += w;
      const path = sharedPath(focal, other, m, pa.get(m)!, pb.get(m)!);
      const pathEdges = path.flatMap((s) => (s.edge ? [s.edge] : []));
      const status = weakest(pathEdges.map((id) => edgeById.get(id)!.status));
      const weakestEdge = pathEdges.find((id) => edgeById.get(id)!.status === status && status !== "SUPPORTED") ?? null;
      shared.push({ node: m, label: n.label, tier: n.tier!, path, weakest: status, weakestEdge });
    }
  }
  // Most specific shared mechanism first: higher tier weight, then fewer diseases sharing it.
  const diseaseCount = (m: string) => diseases.filter((d) => mechanismProfile(d.id).has(m)).length;
  shared.sort((x, y) => TIER_WEIGHT[y.tier] - TIER_WEIGHT[x.tier] || diseaseCount(x.node) - diseaseCount(y.node));

  const only = (p: Map<string, MechHit>, q: Map<string, MechHit>) =>
    [...p.entries()]
      .filter(([m]) => !q.has(m))
      .map(([m, hit]) => ({ id: m, label: byId.get(m)!.label, tier: byId.get(m)!.tier!, edge: hit.steps.at(-1)!.edge }))
      .sort((x, y) => TIER_WEIGHT[y.tier] - TIER_WEIGHT[x.tier]);

  const pheno = phenotypePair(focal, other);
  const mechanism = union ? inter / union : 0;
  const phenotype = pheno?.simGIC ?? 0;
  const termCount = phenotypeTermCount(other);

  let kinship: Kinship;
  if (mechanism >= THRESHOLDS.mechanism) kinship = "RELATIVE";
  else if (termCount < THRESHOLDS.minPhenotypeTerms) kinship = "UNKNOWN";
  else if (phenotype >= THRESHOLDS.phenotype) kinship = "LOOK_ALIKE";
  else kinship = "DISTANT";

  const directEdges = edges
    .filter((e) => (e.subject === focal && e.object === other) || (e.subject === other && e.object === focal))
    .map((e) => e.id);
  const sharedAssets = nodes
    .filter((n) => n.type === "asset")
    .filter((n) => edges.some((e) => e.subject === n.id && e.object === focal) && edges.some((e) => e.subject === n.id && e.object === other))
    .map((n) => n.id);

  const contested = edges
    .filter((e) => e.status === "CONTESTED" && (e.subject === focal || e.subject === other))
    .flatMap((e) => [e.id, ...(e.contradictedBy ?? [])])
    .filter((id, i, a) => a.indexOf(id) === i);

  const o = byId.get(other)!;
  const top = shared[0]?.label.toLowerCase();
  const summary = {
    RELATIVE: `Shares ${shared.length} mechanism nodes, most specifically ${top}.`,
    LOOK_ALIKE: `Strongest symptom overlap, but ${top ? `the only shared mechanism node is ${top}` : "no shared mechanism"}.`,
    DISTANT: top ? `Shares only a broad mechanism (${top}); little symptom overlap.` : "No shared mechanism or notable symptom overlap.",
    UNKNOWN: `Too few phenotype annotations (${termCount}) to judge resemblance.`,
  }[kinship];

  return {
    disease: other,
    label: o.label,
    gene: o.gene,
    phenotype,
    mechanism: Number(mechanism.toFixed(3)),
    kinship,
    phenotypeTermCount: termCount,
    sharedMechanisms: shared,
    onlyFocal: only(pa, pb),
    onlyOther: only(pb, pa),
    sharedPhenotypes: (pheno?.shared ?? []).slice(0, 8).map(({ id, name, ic }) => ({ id, name, ic })),
    directEdges,
    sharedAssets,
    contested,
    summary,
  };
}

export function connections(focal: string): Connection[] {
  const order: Kinship[] = ["RELATIVE", "LOOK_ALIKE", "DISTANT", "UNKNOWN"];
  return diseases
    .filter((d) => d.id !== focal)
    .map((d) => compare(focal, d.id))
    .sort((a, b) => order.indexOf(a.kinship) - order.indexOf(b.kinship) || b.mechanism + b.phenotype - (a.mechanism + a.phenotype));
}

// --- edges for the browser ---------------------------------------------------
const checks = quoteData.checks as { edge: string; index: number; result: EdgeView["quoteChecks"][number] }[];
export function edgeViews(ids: Iterable<string>): Record<string, EdgeView> {
  const out: Record<string, EdgeView> = {};
  for (const id of ids) {
    const e = edgeById.get(id);
    if (!e) continue;
    out[id] = {
      ...e,
      subjectLabel: byId.get(e.subject)?.label ?? e.subject,
      subjectType: byId.get(e.subject)?.type,
      objectType: byId.get(e.object)?.type,
      objectLabel: byId.get(e.object)?.label ?? e.object,
      quoteChecks: checks.filter((c) => c.edge === id).sort((a, b) => a.index - b.index).map((c) => c.result),
    };
  }
  return out;
}

/**
 * Phenotype overlap is computed, not curated, so it is exposed as an INFERRED
 * pseudo-edge ("p-danon-pompe") that the drawer can open like any other edge.
 */
export function phenotypeEdge(a: string, b: string): EdgeView | undefined {
  const p = phenotypePair(a, b);
  if (!p) return undefined;
  const la = byId.get(a)!.label, lb = byId.get(b)!.label;
  return {
    id: `p-${a}-${b}`,
    subject: a,
    relation: "has phenotype overlap with",
    object: b,
    label: `simGIC ${p.simGIC.toFixed(2)} over HPO annotations`,
    subjectLabel: la,
    objectLabel: lb,
    source: `Human Phenotype Ontology annotations (${hpoVersion}) · overlap computed by Kindred`,
    sourceUrl: "https://hpo.jax.org/",
    evidence:
      `Most informative shared terms: ${p.shared.slice(0, 6).map((t) => t.name).join("; ")}.` +
      (p.onlyA.length ? ` Only in ${la}: ${p.onlyA.slice(0, 4).map((t) => t.name).join("; ")}.` : "") +
      (p.onlyB.length ? ` Only in ${lb}: ${p.onlyB.slice(0, 4).map((t) => t.name).join("; ")}.` : ""),
    provenance: "INFERRED",
    status: "INFERRED",
    quoteChecks: [],
  };
}

export const hasPhenotypeOnlyIn = (a: string, b: string, hpo: string) =>
  phenotypePair(a, b)?.onlyB.some((t) => t.id === hpo) ?? false;

export function connectionEdgeIds(c: Connection): string[] {
  return [
    ...c.sharedMechanisms.flatMap((s) => s.path.flatMap((p) => (p.edge ? [p.edge] : []))),
    ...c.onlyFocal.map((x) => x.edge),
    ...c.onlyOther.map((x) => x.edge),
    ...c.directEdges,
    ...c.contested,
    ...c.sharedAssets.flatMap((a) => edges.filter((e) => e.subject === a).map((e) => e.id)),
  ];
}

export const keyTerms = (id: string) =>
  ((phenoData.diseases as Record<string, { keyTerms?: { name: string; frequency: number }[] }>)[id]?.keyTerms ?? []);

/** Distinct sources behind a set of edges, counting corroborating sources. */
export function sourceCount(ids: Iterable<string>): number {
  const urls = new Set<string>();
  for (const id of ids) {
    const e = edgeById.get(id);
    if (!e) continue;
    urls.add(e.sourceUrl);
    e.corroboratedBy?.forEach((c) => urls.add(c.sourceUrl));
  }
  return urls.size;
}

export const coverage = () => ({
  diseases: diseases.map((d) => d.label),
  edges: edges.length,
  sources: new Set(edges.flatMap((e) => [e.sourceUrl, ...(e.corroboratedBy ?? []).map((c) => c.sourceUrl)])).size,
  hpoVersion,
});
