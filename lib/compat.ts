// Asset compatibility check. Each verdict is decided here by explicit rules over
// graph facts, never by the language model, which only summarises the result.
import { compare, edge, edges, hasPhenotypeOnlyIn, node, nodes } from "./graph";
import type { CompatItem, ExpertQuestion } from "./types";

const molecularClass = (diseaseId: string) => {
  const gene = edges.find((e) => e.subject === diseaseId && node(e.object)?.type === "gene")?.object;
  return edges.find((e) => e.subject === gene && node(e.object)?.tier === "molecular");
};

export function compatibility(target: string, source: string) {
  const conn = compare(target, source);
  const t = node(target)!.label, s = node(source)!.label;
  const pEdge = `p-${target}-${source}`;
  const assetsOf = (community: string) => nodes.filter((n) => n.type === "asset" && n.community === community);
  const items: CompatItem[] = [];
  const questions: ExpertQuestion[] = [];

  for (const asset of assetsOf(source)) {
    const assetEdges = edges.filter((e) => e.subject === asset.id);

    if (asset.kind === "registry") {
      const design = assetEdges.find((e) => e.relation === "is a");
      const productObjective = assetEdges.find((e) => e.relation === "has a product-specific objective");
      if (design) {
        items.push({
          component: "Registry design (longitudinal, observational, treated and untreated)",
          verdict: "TRANSFERS",
          reason: `This is a study design, not a biological claim, so it does not depend on ${s}'s mechanism.`,
          edges: [design.id],
          inferred: true,
        });
        const shared = conn.sharedPhenotypes.slice(0, 3).map((p) => p.name);
        items.push({
          component: "Cardiac and skeletal-muscle outcome measures",
          verdict: "ADAPT",
          reason: `Both phenotype profiles include ${shared.join("; ")}, but each has findings the other lacks, so measures need validation in ${t}.`,
          edges: [design.id, pEdge],
          inferred: true,
        });
        questions.push({
          question: `Which ${s} registry cardiac and muscle measures could be harmonised with the existing ${t} natural-history studies, rather than collected again?`,
          edges: [design.id, ...edges.filter((e) => e.object === target && node(e.subject)?.kind === "study" && e.relation === "studies").map((e) => e.id)],
        });
      }
      if (productObjective) {
        items.push({
          component: "Registry objectives tied to enzyme replacement therapy",
          verdict: "DOES_NOT_TRANSFER",
          reason: "One registry objective measures a specific enzyme therapy. That therapy's rationale does not carry over (see below).",
          edges: [productObjective.id],
          inferred: true,
        });
      }
    }

    if (asset.kind === "therapy") {
      const srcClass = molecularClass(source), tgtClass = molecularClass(target);
      const evidence = assetEdges.map((e) => e.id);
      const contrast = edges.filter((e) => e.subject === target && e.object === source).map((e) => e.id);
      if (srcClass && tgtClass && srcClass.object !== tgtClass.object) {
        items.push({
          component: asset.label,
          verdict: "DOES_NOT_TRANSFER",
          reason: `ERT replaces a missing ${node(srcClass.object)!.label.toLowerCase()}. ${t} is caused by loss of a ${node(tgtClass.object)!.label.toLowerCase()}, and acid maltase is normal in ${t}. The therapy's rationale does not apply on this evidence.`,
          edges: [srcClass.id, ...evidence, tgtClass.id, ...contrast],
          inferred: true,
        });
      }
    }

    if (asset.kind === "biomarker") {
      const annotated = assetEdges[0];
      const onlySource = hasPhenotypeOnlyIn(target, source, "HP:6001008");
      items.push({
        component: asset.label,
        verdict: "UNKNOWN",
        reason: onlySource
          ? `Annotated for ${s} in HPO, but there is no ${t} annotation and no ${t} source in this atlas.`
          : `No evidence in this atlas either way for ${t}.`,
        edges: [annotated.id, pEdge],
        inferred: true,
      });
      questions.push({
        question: `Has urine glucose tetrasaccharide (Hex4) been measured in ${t}? Given that acid maltase is normal in ${t}, would it be expected to change?`,
        edges: [annotated.id, ...edges.filter((e) => e.subject === target && e.object === source && e.relation.startsWith("was first described")).map((e) => e.id)],
      });
    }

    if (asset.kind === "research") {
      const fusion = conn.sharedMechanisms.find((m) => m.node === "m_ap_fusion");
      const tested = assetEdges[0];
      const model = edges.find((e) => e.object === target && node(e.subject)?.kind === "model");
      items.push({
        component: asset.label,
        verdict: "UNKNOWN",
        reason: fusion
          ? `Both diseases record impaired autophagosome–lysosome fusion, but the ${s} side rests on a single source. Worth discussing, not assuming.`
          : `No shared autophagy step recorded in this atlas.`,
        edges: [tested.id, ...(fusion?.path.flatMap((p) => (p.edge ? [p.edge] : [])) ?? [])],
        inferred: true,
      });
      if (fusion && model) {
        questions.push({
          question: `Is the fusion defect described in ${s} muscle the same step that LAMP-2 loss disrupts, closely enough to justify testing an autophagy-targeted approach in the LAMP-2-deficient mouse?`,
          edges: [fusion.weakestEdge ?? tested.id, "e004", model.id, tested.id].filter((x, i, a) => a.indexOf(x) === i),
        });
      }
    }
  }

  // What the target community already has, check before building anything.
  const existing = nodes
    .filter((n) => n.type === "asset" && n.community === target)
    .flatMap((n) => edges.filter((e) => e.subject === n.id && e.object === target).map((e) => e.id));

  // Infrastructure the target already shares with a phenotypic look-alike.
  const shared = nodes
    .filter((n) => n.type === "asset" && n.community === "shared")
    .flatMap((n) => edges.filter((e) => e.subject === n.id).map((e) => e.id));
  if (shared.length) {
    const lookAlike = edge(shared.find((id) => edge(id)!.object !== target)!)!.object;
    questions.push({
      question: `The Duke rare glycogen-storage study already enrols both ${t} and ${node(lookAlike)!.label}. Could cardiac endpoints be pooled there while mechanism-specific analyses stay separate?`,
      edges: [...shared, ...edges.filter((e) => e.subject === target && e.object === lookAlike).map((e) => e.id)],
    });
  }

  const contacts = edges.filter((e) => e.object === source && node(e.subject)?.type === "organization").map((e) => e.id);
  return { items, questions, existing, shared, contacts };
}
