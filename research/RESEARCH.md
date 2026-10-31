# Recent packing results and opportunities

Research cutoff: 30 October 2026, Asia/Kuala_Lumpur.

The most promising starting project is a certifying search engine for freely rotated unit squares in circles and equilateral triangles, followed by structured searches for squares in squares. These share a small geometry kernel, have explicit existing constructions to compare against, and support useful experiments on search methods. A separate proof track can investigate the nine-squares-in-a-circle case. This is a proposed research priority, not evidence that these cases are easy or untouched.

The recent wave is real, but it combines improved constructions, numerical refinements, independent certification, and optimality proofs. Those are different achievements. Claude has contributed to several of them, usually through human-directed code generation and research workflows. Gemini-based AlphaEvolve, other research agents, and conventional optimization solvers also matter.

**What the bounds mean**

Let L*(n) be the smallest container size holding n congruent copies of a specified shape, with translations and rotations allowed and disjoint interiors. A verified packing at size U proves L*(n) <= U. A proof excluding every packing below B establishes B <= L*(n). Improving U is a construction result; improving B is an impossibility result. Equality requires both.

For a fixed container and a common shape scale r, the directions reverse: a construction gives a lower bound on the maximum feasible r. Every record must state the normalization. Side length, inradius, circumradius, diameter, and area are not interchangeable.

An arbitrary-radius circle problem maximizing sum(r_i) is not a congruent-circle problem. Heilbronn point placement, sphere kissing, covering, and packing infinite space also require separate labels. They can inspire methods without answering the finite congruent-container problem in the question.

**Documented breakthroughs**

| Work | Concrete contribution | What it establishes |
| --- | --- | --- |
| AlphaEvolve, 2025 | Eleven and twelve unit hexagons in a hexagon: reported enclosing sides improved from approximately 3.943 and 4 to 3.931 and 3.942. | Historical construction improvements for identical shapes, not optimality. Its circle results instead maximize total radii: n=26 and 32 in a square, and n=21 in a perimeter-4 rectangle. [Paper](https://arxiv.org/html/2506.13131v1) |
| ImprovEvolve, February 2026 | Reports hexagon-in-hexagon improvements at n=11,12,15,16; human-edited variants at 14,17,23. | Program evolution with an improvement operator; historical results must be compared with newer records. [Paper](https://arxiv.org/abs/2602.10233) |
| Tej Stead with Claude, June 2026 | Ellsworth's catalogue explicitly credits Claude-assisted refinements, including n=180,181,182 and numerous larger square-in-square cases. | Better constructions from existing packings; attribution is to a human-AI collaboration. [Catalogue](https://kingbird.myphotos.cc/packing/squares_in_squares.html) |
| Tencent Hyra, July 2026 | The release reports 100 improved packings across 28 shape-container families; Friedman credits these to Haowei Lin. | Broad finite-packing coverage, not just circles or squares. Current record ownership can differ from the July release. [Release](https://github.com/Tencent-Hunyuan/Hyra-results/blob/main/README.md) |
| Bake AI Épi, September 2026 | Reports 46 quadrant-circle, 36 four-dimensional ball, nine pentagon-in-triangle, five semicircle-circle, and one octagon-circle construction improvements. | These families have already received agent-driven searches. Its 100 construction total also includes non-packing tasks. [Result inventory](https://github.com/BakeLab/Epi-results/blob/main/README.md) |
| Sander's Discovery Loop with Claude, September 2026 | Reports improvements at n=101,102,103,105,106,107,108,109,111,114 for variable-radius circles, with 2.4–5.4% gains against its chosen prior table. | Sum-of-radii results, outside the identical-shape scope. The paper reports $27.72 in LLM charges and approximately eight hours on a consumer PC; this is not a universal cost estimate or proof of optimality. [Paper](https://arxiv.org/html/2609.05093v1) |
| Ostashev, October 2026 | Twelve reported square-packing records; for example n=204, 14.822875656 to 14.808663234. | Structured tilted bands, aligned corner blocks, local optimization, and exact certificates. Several release-time records have since moved again. [Author's account](https://ostashev.ai/square-packing/) |
| Nakajima with Claude, October 2026 | Twelve unit cubes in a cube of side 2.9315185094797, improving the cited 2.9327717687048653 construction. | A feasible 3D upper bound. This repository independently replays the coordinates exactly; see the audit. [Source](https://github.com/yoheinakajima/soft-to-rigid-packing/blob/main/README.md) |
| Ahmed and collaborators, September–October 2026 | The Squares Project registers the AI-assisted optimality result s(11)=3.877083590022814… for Trump's 1979 arrangement. | A proof advance, not discovery of that arrangement. Consult the maintained review and provenance rather than attributing the entire result to one model. [Project account](https://github.com/jlevy/squares/blob/main/README.md) |
| Vu-Le and AI collaborators, September–October 2026 | Public Lean proofs for the minimum circle enclosing n=1 through 8 unit squares, including classification of optimal arrangements. | Proof/formalization progress; the source names ChatGPT and Claude assistance. The Lean project was inspected but not rebuilt in this audit. [Proof repository](https://github.com/vltanh/lean4-squares-in-circles) |

These examples are a verified-source survey, not an exhaustive census of every numerical refinement. The broad Hyra and Épi campaigns are particularly important: a problem can look neglected on an old survey while already having an agent-generated improvement.

**What changed after the headline announcements**

The hexagon catalogue now lists approximately 3.92450 for eleven hexagons, credited to Johann Schellhorn, and 3.94164 for twelve. It also records October changes at other counts. Beating the original AlphaEvolve number alone is therefore insufficient. [Current hexagon catalogue](https://erich-friedman.github.io/packing/hexinhex/)

For square packing, the Squares Project frontier inspected here tracks 324 counts, describes 77 as having proved optima, and keeps 247 open. Its distinction between reported and verified bounds is essential. These are the registry's classifications, not 324 proofs independently checked in this project. [Frontier](https://squaremath.org/frontier.html)

The square cases n=12,17,19 are not clean untouched targets. The project news records a reported n=12 Lean proof awaiting replay. The n=17 and n=19 case records retain optimality claims separately from their established verified lower bounds. A repository containing Lean files is not, by itself, evidence that the intended unrestricted theorem has been independently replayed. [n=12 report](https://squaremath.org/news.html), [n=17 record](https://github.com/jlevy/squares/blob/main/packing/frontier/n-017.md), [n=19 record](https://github.com/jlevy/squares/blob/main/packing/frontier/n-019.md)

Packomania's landing page asks for no further October submissions because its queue exceeds 5,000 candidates. Its dated queue includes equal-circle and variable-radius families, as well as a large multi-category submission. The last accepted table is not a complete account of competing discoveries. Check the queue and public source artifacts before declaring novelty. [Maintainer notice](https://packomania.com/), [Queue dated 17 October](https://packomania.com/pending-requests.html)

**What has not been tackled**

There is no defensible evidence that any familiar broad family here has never been tackled. Squares, triangles, pentagons, hexagons, circles, and cubes in bounded containers all have extensive prior work. Nor can a web search establish that no private LLM experiment exists.

Use three narrower labels:

| Label | Meaning | Example |
| --- | --- | --- |
| Open optimum | A construction exists, but no accepted matching lower bound was located. | The square-in-square n=18 case discussed below. |
| Limited documented agent coverage | Classical work exists; the sources examined do not establish a systematic recent LLM campaign for the specified slice. | A provisional slice of equal circles in regular 7-, 9-, 11-, and 13-gons. This must be checked against pending submissions. |
| Benchmark extension | Our searched range or parameter grid has no imported comparison record yet. | A new aspect-ratio grid for capsules in rectangles. Producing its first entry is not automatically breaking a world record. |

Equal circles in regular polygons are not a new mathematical problem: Amore's systematic study includes polygons through sixteen sides and up to 200 circles, with larger runs for the triangle and hexagon. [Primary paper](https://arxiv.org/abs/2212.12287)

Even capsule packing in a square has prior optimization work. A capsule project could provide a useful parameterized benchmark, but should not be marketed as an untouched family. [Aalto thesis](https://sal.aalto.fi/publications/pdf-files/tjok19_public.pdf)

**Recommended target portfolio**

The numeric values below are catalogue displays, not full-precision certificates or claim thresholds. A trailing '+' in the original catalogue means the display is truncated. Reconstruct or obtain the complete incumbent before measuring a small improvement.

| Priority | Target and initial instances | Published reference | Why investigate |
| --- | --- | --- | --- |
| 1 | Unit squares in an equilateral triangle: n=8,12,17,23,30 | Displayed sides 5.301+, 6.301+, 7.301+, 8.301+, 9.301+. | An older repeated boundary pattern provides a focused transfer experiment. Optimize translated and rotated clusters near the triangle's edges. Age does not imply an easy improvement. [Catalogue](https://erich-friedman.github.io/packing/squintri/) |
| 1 | Unit squares in a circle: n=11,13,15,18,20 | Displayed radii 2.21386+, 2.3607+, 2.533+, 2.74146+, 2.893+. | Modest dimensions, exact square geometry, and convex circular containment after orientations and separating directions are fixed. [Catalogue](https://erich-friedman.github.io/packing/squincir/) |
| 2 | Equilateral unit triangles in a circle: n=11,12,15,16,17,20,21,22,25,27 | The catalogue retains several pre-2026 constructions in this slice while recording newer improvements elsewhere. | Test whether boundary-ring reconstruction can outperform local perturbations. Triangles require algebraic geometry support. [Catalogue](https://erich-friedman.github.io/packing/triincir/) |
| 2 | Larger square-in-square packings, initially n=129,155,156,175,176,204,211,232,241,264,303,304 | A documented structured-search campaign supplies reusable construction ideas; import current records, not its old release table. | Best for testing discrete layout grammars and cross-instance transfer; heavily contested. [Construction artifacts](https://github.com/dostashev/square-packing) |
| 3 | Equal circles in regular 7-, 9-, 11-, 13-gons, provisional n=21–80 | Classical systematic tables exist. | Easy geometry relative to rotated polygons; investigate boundary defects and neighbor-count continuation. Coverage and pending-record audit is mandatory. [Paper](https://arxiv.org/abs/2212.12287) |
| Stretch | Unit cubes in a cube, n=14–17, after reproducing 9–13 | Check catalogue and newer repositories at campaign start. | Genuine 3D exploration, but much greater search difficulty. A public soft-to-rigid n=13 run explicitly reports matching the old record, not improving it. [n=13 experiment](https://github.com/tronford/cubes-in-cube-n13) |
| Proof track | Nine unit squares in a circle | Catalogue construction R=sqrt(1105)/16; catalogue says only n=1–8 proved optimal. | A natural next proof case, not a promise that the existing proof decomposition scales. [Catalogue](https://erich-friedman.github.io/packing/squincir/) |
| Proof track | Eighteen unit squares in a square | Verified lower bound 4.705; best construction approximately 4.82287566. | Explicit unresolved gap, suitable for developing lower-bound certificates. Already attacked with AI assistance. [Case record](https://github.com/jlevy/squares/blob/main/packing/frontier/n-018.md) |

For comparison, the n=17 square record has verified lower bound 4.66044275 and construction approximately 4.6755300936, with a candidate equality claim pending in the inspected registry. The n=19 record similarly separates its 4.825 verified floor from a later equality report. Those cases are useful verification projects, but poor choices for a claim of unexplored discovery. [n=17](https://github.com/jlevy/squares/blob/main/packing/frontier/n-017.md), [n=19](https://github.com/jlevy/squares/blob/main/packing/frontier/n-019.md)

**Which methods deserve investment**

A strong classical baseline is necessary. Berthold and colleagues found that unmodified Xpress and SCIP could reproduce and sometimes improve the LLM benchmark constructions. A successful LLM-assisted run must be compared with conventional optimization at comparable compute, not just with an old human result. [Primary paper](https://arxiv.org/html/2601.05943v1)

Shape continuation should be one search arm, not the default winner. Nakajima's 188-instance study found that tuned rigid starts won more often overall, while hardening reached different square packings. The tested policy did not establish that splitting a fixed budget always improves performance. [Study](https://arxiv.org/html/2610.14463v1)

The principal research hypothesis is that discrete arrangement changes offer more opportunity than repeatedly polishing one contact pattern. Examples to test are replacing a boundary ring, changing the count and angle of a tilted band, removing and reinserting a cluster, or transferring a layout from an adjacent count or container parameter. These are proposed experiments; some ingredients already appear in the cited literature.

**What this repository establishes now**

One published construction was independently checked: all 66 pairs of the twelve cubes separate under exact rational arithmetic, all cubes lie inside the stated container, and the rotations preserve congruence. Deliberately duplicated cubes, an undersized container, a zero quaternion, and use of the truncated display side are rejected. This validates feasibility of that published witness, not global optimality, the discovery history, or current record priority. See [the audit](AUDIT.md).

No new bound has been discovered here, and no claim is made that every cited proof or construction has been replayed. The next deliverable is the dated registry and the first two-dimensional search-and-certification pipeline in [the implementation plan](IMPLEMENTATION_PLAN.md).
