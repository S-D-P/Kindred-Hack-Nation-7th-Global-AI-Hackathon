# Kindred, source audit

Every biomedical claim the prototype can display, where it comes from, and whether it is safe to show.
Quotes are machine-checked: `npm run data:verify` fetches each source (PubMed abstract via NCBI E-utilities,
ClinicalTrials.gov API v2, MedlinePlus page) and confirms the quoted passage appears verbatim.
Last run: **57 quotes · 53 verified · 0 not found · 4 not text-checkable** (two HPO annotations, two organization websites).

Provenance: **CURATED** = from a curated reference resource (MedlinePlus Genetics, HPO, ClinicalTrials.gov).
**EXTRACTED** = from a peer-reviewed abstract, quoted verbatim. **INFERRED** = computed or reasoned by Kindred from the above; never shown as fact.
Status: **SUPPORTED** = curated resource or ≥2 independent sources. **SINGLE_SOURCE** = one publication.

## Disease biology

| Edge | Claim | Source | Supporting passage (verbatim) | Prov. | Status | Safe? |
|---|---|---|---|---|---|---|
| e001 | Danon disease is caused by LAMP2 variants | [MedlinePlus Danon](https://medlineplus.gov/genetics/condition/danon-disease/); [PMID 10972294](https://pubmed.ncbi.nlm.nih.gov/10972294/) | "Danon disease is caused by variants (also called mutations) in the LAMP2 gene." | CURATED | SUPPORTED | ✅ |
| e002 | LAMP-2 is a lysosomal membrane protein | [PMID 10972294](https://pubmed.ncbi.nlm.nih.gov/10972294/); [MedlinePlus LAMP2](https://medlineplus.gov/genetics/gene/lamp2/) | "primary deficiencies of LAMP-2, a principal lysosomal membrane protein" | EXTRACTED | SUPPORTED | ✅ |
| e003 | LAMP-2 acts in lysosomal transport/degradation | MedlinePlus LAMP2 | "The LAMP-2 protein helps transport cellular materials or digestive enzymes into the lysosome" | CURATED | SUPPORTED | ✅ |
| e004 | LAMP-2 is needed for autophagosome–lysosome fusion | MedlinePlus LAMP2; [PMID 10972293](https://pubmed.ncbi.nlm.nih.gov/10972293/) | "in cells without the LAMP-2 protein, fusion between autophagic vacuoles and lysosomes occurs more slowly…" | CURATED | SUPPORTED | ✅ |
| e005 | Danon shows autophagic vacuole build-up in heart/skeletal muscle | MedlinePlus LAMP2; PMID 10972294 | "People with Danon disease have an abnormally large number of autophagic vacuoles in their heart and skeletal muscle cells." | CURATED | SUPPORTED | ✅ |
| e006 | Danon muscle vacuoles contain glycogen | PMID 10972294; [PMID 15673802](https://pubmed.ncbi.nlm.nih.gov/15673802/) | "intracytoplasmic vacuoles containing autophagic material and glycogen in skeletal and cardiac muscle cells" | EXTRACTED | SUPPORTED | ✅ |
| e010 | Pompe disease is caused by GAA variants | [MedlinePlus Pompe](https://medlineplus.gov/genetics/condition/pompe-disease/); [PMID 25183957](https://pubmed.ncbi.nlm.nih.gov/25183957/) | "Mutations in the GAA gene cause Pompe disease." | CURATED | SUPPORTED | ✅ |
| e011 | GAA encodes a lysosomal enzyme | [PMID 17151339](https://pubmed.ncbi.nlm.nih.gov/17151339/); PMID 25183957 | "…resulting from deficiency of lysosomal acid alpha-glucosidase (GAA)." | EXTRACTED | SUPPORTED | ✅ |
| e013 | Pompe: glycogen accumulates in lysosomes, heart and skeletal muscle most affected | PMID 25183957; MedlinePlus Pompe | "progressive expansion of glycogen-filled lysosomes in multiple tissues, with cardiac and skeletal muscle being the most severely affected" | EXTRACTED | SUPPORTED | ✅ |
| e014 | **Pompe muscle shows impaired autophagosome–lysosome fusion** (the key shared step with Danon) | PMID 25183957 (review, NIH/NIAMS) | "The autophagic process in Pompe skeletal muscle is affected at the termination stage-impaired autophagosomal-lysosomal fusion." | EXTRACTED | **SINGLE_SOURCE** | ✅ shown as the weakest link |
| e015 | Pompe muscle shows autophagic build-up | PMID 25183957 | "The massive autophagic buildup and lipofuscin inclusions…" | EXTRACTED | SINGLE_SOURCE | ✅ |
| e020 | PRKAG2 cardiac syndrome is caused by PRKAG2 variants | [PMID 11827995](https://pubmed.ncbi.nlm.nih.gov/11827995/); [MedlinePlus PRKAG2](https://medlineplus.gov/genetics/gene/prkag2/) | "Mutations in PRKAG2, the gene for the gamma 2 regulatory subunit of AMP-activated protein kinase, cause cardiac hypertrophy and electrophysiologic abnormalities" | EXTRACTED | SUPPORTED | ✅ |
| e021–e022 | PRKAG2 encodes the AMPK γ2 subunit; AMPK regulates energy (ATP) pathways | MedlinePlus PRKAG2 | "…the gamma-2 subunit) of a larger enzyme called AMP-activated protein kinase (AMPK)." | CURATED | SUPPORTED | ✅ |
| e023 | PRKAG2: glycogen builds up in cardiac muscle cells | MedlinePlus PRKAG2; PMID 11827995 | "changes in AMP-activated protein kinase activity allow a complex sugar called glycogen to build up abnormally within cardiac muscle cells" | CURATED | SUPPORTED | ✅ |
| e024 | PRKAG2 disease is a metabolic storage disease, not sarcomeric HCM | PMID 11827995 | "PRKAG2 mutations do not cause hypertrophic cardiomyopathy but rather lead to a novel myocardial metabolic storage disease" | EXTRACTED | SINGLE_SOURCE | ✅ |
| e030 | **Danon and PRKAG2 disease clinically resemble each other** (both mimic HCM, with ventricular pre-excitation) | PMID 15673802 (NEJM) | "The glycogen-storage cardiomyopathy produced by LAMP2 or PRKAG2 mutations resembles hypertrophic cardiomyopathy but is distinguished by electrophysiological abnormalities, particularly ventricular preexcitation." | EXTRACTED | SINGLE_SOURCE | ✅ |
| e031 | Danon can present as a primary cardiomyopathy | PMID 15673802 | "…but can also present as a primary cardiomyopathy." | EXTRACTED | SINGLE_SOURCE | ✅ |
| e032 | **Danon = structural lysosomal protein defect; not an enzyme defect** | PMID 10972294 | "…caused by mutations in a lysosomal structural protein rather than an enzymatic protein." | EXTRACTED | SINGLE_SOURCE | ✅ |
| e033 | Danon was first described with *normal* acid maltase (= GAA, the Pompe enzyme) | PMID 10972294; MedlinePlus Pompe | "\"Lysosomal glycogen storage disease with normal acid maltase\"…"; "acid alpha-glucosidase (also known as acid maltase)" | EXTRACTED | SINGLE_SOURCE | ✅ |
| e034 | PRKAG2 histology lacks sarcomeric-HCM disarray | PMID 11827995 | "these mutations were not associated with myocyte and myofibrillar disarray…" | EXTRACTED | SINGLE_SOURCE | ✅ |
| e040–e042 | Fabry: GLA variants; lysosomal enzyme α-Gal A; Gb3 build-up | [MedlinePlus Fabry](https://medlineplus.gov/genetics/condition/fabry-disease/) | "Fabry disease is caused by variants (also known as mutations) in the GLA gene." | CURATED | SUPPORTED | ✅ |
| e050–e052 | Sarcomeric HCM: MYH7/MYBPC3; thick-filament protein; impaired sarcomere | [MedlinePlus HCM](https://medlineplus.gov/genetics/condition/nonsyndromic-hypertrophic-cardiomyopathy/) | "variants in the MYH7 and MYBPC3 genes are the most common genetic cause of this condition." | CURATED | SUPPORTED | ✅ |

## Phenotypes

Phenotype overlap is **computed**, not curated: simGIC over HPO annotations (version 2026-09-02; OMIM + Orphanet records listed in `graph.json → hpoSources`),
ancestor-propagated within *Phenotypic abnormality*, IC-weighted over all 12,867 HPO-annotated diseases. Each shared term traces back to its HPO annotation reference.

| Pair | simGIC | Most informative shared terms |
|---|---|---|
| Danon · PRKAG2 | **0.182** | Wolff-Parkinson-White syndrome; abnormal QRS; AV block; palpitations; atrial arrhythmia; syncope |
| Danon · Pompe | 0.128 | Progressive proximal muscle weakness; WPW; myopathic EMG; cardiomegaly; exercise intolerance |
| Danon · Fabry | 0.105 | AV block; exercise intolerance; HCM; heart failure |
| Danon · HCM (MYH7) | 0.050 | HCM; heart failure; arrhythmia (HCM record has only 5 terms → low coverage) |

Safe to display as "phenotype overlap in HPO annotations", **not** as clinical similarity.

## Research assets & communities

| Edge | Claim | Source | Status | Safe? |
|---|---|---|---|---|
| e060 | Pompe Registry: global, longitudinal, observational, treated + untreated | [NCT00231400](https://clinicaltrials.gov/study/NCT00231400) | SUPPORTED | ✅ |
| e061 | Registry has an alglucosidase-alfa effectiveness objective | NCT00231400 | SUPPORTED | ✅ |
| e062 | Recombinant GAA (ERT) is effective in infantile-onset Pompe | PMID 17151339; [GeneReviews PMID 20301438](https://pubmed.ncbi.nlm.nih.gov/20301438/) | SUPPORTED | ✅ (stated for Pompe only) |
| e063 | Urine glucose tetrasaccharide is annotated for Pompe (HP:6001008) | HPO annotation OMIM:232300 (ref PMID 20301438) | SUPPORTED | ✅ |
| e064 | Autophagy-targeted approaches tested in Pompe mouse models | PMID 25183957 | SINGLE_SOURCE | ✅ |
| e070 | Danon Natural History Study, recruiting | [NCT06214507](https://clinicaltrials.gov/study/NCT06214507) | SUPPORTED | ✅ |
| e071 | Retrospective Danon natural history study, completed | [NCT05548855](https://clinicaltrials.gov/study/NCT05548855) | SUPPORTED | ✅ |
| e072 | RP-A501 (AAV9.LAMP2B) phase 2 gene therapy study | [NCT06092034](https://clinicaltrials.gov/study/NCT06092034) | SUPPORTED | ✅ (existence only; no efficacy claim) |
| e073 | LAMP-2-deficient mouse model exists | PMID 10972293 | SINGLE_SOURCE | ✅ |
| e074–e075 | **Duke Rare GSD Natural History Study lists both Danon and PRKAG2** | [NCT06795152](https://clinicaltrials.gov/study/NCT06795152) | SUPPORTED | ✅ |
| e065–e066 | AMDA and International Pompe Association are Pompe patient organizations | amda-pompe.org; worldpompe.org (sites resolve) | SINGLE_SOURCE | ✅ |

## Inferred (computed by Kindred, always labelled INFERRED in the UI)

| Claim | Built from | Wording rule |
|---|---|---|
| Danon and Pompe are *mechanistic relatives* | e004 + e014 (shared fusion step), e003 + e012 (lysosomal), e005 + e015, e006 + e013 | "Kindred classifies… based on the evidence in this prototype" |
| PRKAG2 is a *phenotypic look-alike* | simGIC (highest overlap) + no shared molecular/pathway node; e024, e030 | Same |
| Pompe ERT's rationale does not transfer to Danon | e011 + e062 (ERT replaces a lysosomal enzyme) vs e032 + e033 (Danon: structural protein; acid maltase normal) | "The rationale does not apply on this evidence", never "will not work" |
| Hex4 biomarker relevance to Danon is unknown | e063 present for Pompe; no Danon annotation or source in atlas | "Unknown: expert review" |

## Excluded (could not be verified to our standard)

- **Danon Foundation** website (danonfoundation.org), blocked automated verification (Cloudflare). Not shown.
- **International Danon Disease Registry** (Univ. Colorado / UCSD), found only via web search / medRxiv preprint. Not shown.
- **"GSD IIb"** as a Danon synonym, no source in the atlas. Removed from aliases.
- No contradiction was invented; the only CONTESTED pair is listed below.
- Any efficacy, eligibility or treatment claim for Danon.

## Contested (found in the data, not invented)

| Edge | Claim | Source | Status |
|---|---|---|---|
| e035 | HPO annotates *Myofiber disarray* (HP:0031318) to PRKAG2 cardiomyopathy (CMH6, OMIM:600858) | HPO annotation, evidence code IEA (electronic, derived from OMIM) | CONTESTED |
| e034 | PRKAG2 mutations Arg302Gln, Thr400Asn, Asn488Ile "were not associated with myocyte and myofibrillar disarray" | [PMID 11827995](https://pubmed.ncbi.nlm.nih.gov/11827995/) | CONTESTED |

Shown side by side with the note that an expert should check whether both describe the same variants.

## Added in the research-layer update

| Edge | Claim | Source | Status |
|---|---|---|---|
| e076 | RP-A501 (AAV9.LAMP2B) phase 1 gene therapy study in Danon disease | [NCT03882437](https://clinicaltrials.gov/study/NCT03882437) | SUPPORTED (existence only) |
| e077 | UCSD natural history study of Danon disease | [NCT03766386](https://clinicaltrials.gov/study/NCT03766386) | SUPPORTED (existence only) |

`data/publications.json` holds title, journal, year and authors for every cited PMID, fetched from PubMed esummary
(`npm run data:publications`). Author names are shown as the groups behind the evidence, not as recommended contacts.

Key phenotypes in the dossier are HPO terms annotated in at least half of patients. Ratios from fewer than 5 patients are ignored
as frequency evidence.
