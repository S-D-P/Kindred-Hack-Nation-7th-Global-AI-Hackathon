# Kindred submission kit

Three ideas to leave with the judges:

1. *The disease that looks most like yours isn't necessarily the disease most worth learning from.*
2. *Kindred doesn't just connect diseases. It connects them responsibly.*
3. *Similarity branches. Evidence decides the connection.*

---

## 1. Demo video (60 s)

Record at 1280×800, browser zoom 90%. Start a fresh page. Every click below is real; nothing is mocked.

| Time | Screen | Voice-over |
|---|---|---|
| 0–5 | Home. The mark draws in. | "What if the disease that looks most like yours isn't the disease most worth learning from?" |
| 5–12 | Click **Who shares our biology?**, then **Danon disease**. Dossier appears. | "Maria leads a patient group for Danon disease. No treatment exists. She starts here." |
| 12–25 | Scroll to the discovery panel. Pause on the bars. | "By symptoms, the closest disease is PRKAG2: 0.18. But by mechanism, it's Pompe: 0.50. A symptom-first search points here. A mechanism-first search points somewhere else." |
| 25–38 | Click **Explore connection** on Pompe. Show the scorecard, the three *whys*, the path with **weakest link**, then scroll to *What exists around this connection*. | "Kindred shows why they're connected, why they're different, and what already exists: a global registry, the papers, the groups behind them. And it names the weakest link: one review." |
| 38–48 | Back up, click **Why isn't PRKAG2 a relative?** Show **No supported route found**, then **Evidence disagrees**, click one side to open the provenance trace. | "Similarity alone never creates a connection. And when the evidence disagrees, Kindred doesn't guess. Every claim traces back to a verified passage." |
| 48–55 | Click **Research brief**. | "Maria leaves with a brief, and the questions to ask an expert, not a treatment recommendation." |
| 55–60 | `/story` footer, or home wordmark. | "Kindred. Find the connection. Check the difference." |

## 2. Technical video (60 s)

Screen: `/how`, then the evidence drawer, then a terminal.

| Time | Screen | Voice-over |
|---|---|---|
| 0–8 | `/how` header and the four numbers | "Kindred is not an LLM wrapper. The graph decides what is supported. OpenAI helps explain it." |
| 8–22 | Scroll the pipeline | "Sources: PubMed, ClinicalTrials.gov, MedlinePlus and the Human Phenotype Ontology. Entities are normalised to OMIM, Orphanet and MONDO IDs. Every edge carries its source, a verbatim passage, provenance and a status." |
| 22–34 | Pipeline: engine and integrity | "Symptom overlap is simGIC over HPO, weighted by information content across 12,867 diseases. Mechanism overlap walks disease, gene, mechanism. Paths take their weakest link. Contradictions are shown, never resolved." |
| 34–44 | *One claim, traced*, then an evidence drawer | "Here's one claim, traced: passage, source, status. A script fetches every source and confirms all 53 quotes appear verbatim." |
| 44–54 | Terminal: `npm test`, `npm run data:verify` | "OpenAI parses intent into a schema of atlas IDs and writes explanations from only the supplied edges. Any invented citation, PMID or trial ID is rejected, and a deterministic explanation is shown instead. 12 tests cover the engine and the guards." |
| 54–60 | `/how`: *What Kindred deliberately does not do* | "No diagnosis. No treatment advice. No relationship from similarity alone." |

## 3. Team video (60 s)

Not a list of résumés. Suggested shape:

- **0–15:** "We started with a simple question: if the knowledge a rare-disease community needs already exists somewhere else, why should finding it depend on one researcher knowing where to look?"
- **15–25:** "We're the Kindred team. We built an evidence-first atlas that helps people look across disease boundaries without pretending uncertainty doesn't exist."
- **25–50:** Each person, about 8 seconds: name, and one sentence on what they cared about in this build (the evidence, the reasoning, the experience).
- **50–60:** "We kept the atlas small on purpose. Every relationship you see has provenance. Kindred: find the connection, check the difference."

## 4. Hosted demo

Vercel is the shortest path for this Next.js app:

1. Push `kindred/` to a public GitHub repository (it is its own git repo; `.env.local` and `data/raw/` are ignored).
2. On vercel.com, choose **Add New → Project**, import the repository, framework *Next.js*, root directory = the repository root.
3. Optional: add `OPENAI_API_KEY` (and `OPENAI_MODEL=gpt-4.1`) under *Environment Variables*. Without it the app runs on its deterministic path.
4. Deploy. `data/phenotypes.json`, `data/quote-check.json` and `data/publications.json` are committed, so no data step runs at build time.

## 5. Checklist

- [ ] Demo video ≤ 60 s
- [ ] Tech video ≤ 60 s
- [ ] Team video ≤ 60 s
- [ ] Team picture
- [ ] Public GitHub repository (README with screenshots)
- [ ] Hosted demo URL in the README
- [ ] OpenAI credits added, and one real synthesis checked (the label reads "written from the supplied evidence only, citations checked")
