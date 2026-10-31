# Pilot interpretation audit

Reviewed on 30 October 2026. Scope: the frozen `pilot_v1` search, geometry, polishing, checker selection and runner, followed by the candidate-retention correction before `pilot_v2`. This is an implementation review, not a formal proof of the software. No computationally heavy experiments were run alongside the pilot.

**Corrected defect before the retained campaign**

The original search's twelve-entry certification shortlist could evict the best numerical pose when later, slightly larger clean final iterates were appended. The separate `numeric_best` field preserved that pose, but the selector did not receive it explicitly. This could understate an arm's best result; it did not accept invalid geometry. The parent stopped `pilot_v1` before its first batch completed, retained its interrupted artifacts, and added the best numerical pose explicitly to the certification list before starting a new manifest. Treat `pilot_v2` as the retained campaign; do not combine partial `pilot_v1` results with it.

**What the five labels mean**

| Arm | Actual implemented experiment | Interpretation limit |
| --- | --- | --- |
| Rigid | Repeated rigid starts or perturbations, followed by constrained local optimization | A multistart baseline, not a global solver |
| Basin | Perturbation of the best current pose, with alternating individual and cluster proposals | Cluster proposals translate a group and alter its piece angles; they are not always rigid transformations of the entire cluster |
| Anneal | A temperature-dependent acceptance step on locally optimized feasible proposals | More precisely annealed basin hopping, not simulated annealing over raw configurations |
| Homotopy | Diameter-one disks, then rounded-square stages at alpha 0.3, 0.6 and 0.85, then exact target-square optimization | A short, fixed continuation schedule; failure does not rule out other schedules or continuation methods |
| Structured | Boundary-ranked collective moves and periodic grid starts | A small boundary-operator library; it does not implement a general contact-graph search or discrete layout grammar |

All five share a common local solver and fixed-orientation position polish. They compare these particular implementations under this budget. They do not measure general model capability, prove that LLM-generated code is superior, or constitute a running program-evolution experiment. No external model is asked to adapt algorithms during the frozen campaign.

**Geometry and polishing**

The rounded shape is an alpha-side square plus a disk of radius `(1-alpha)/2`. Disjoint square cores use their actual closest vertex-edge distance; overlapping cores use signed separating-axis penetration. This avoids the error of testing rounded corners with only the four face-normal axes. At alpha zero the shapes are disks; at alpha one they are congruent unit squares. Intermediate penalty stages may overlap. Only the final exact unit-square certificate establishes a bound.

Polygon polishing is an LP with orientations and one separating axis/order per pair held fixed. Circle polishing is a convex position/radius subproblem solved numerically by SLSQP, not a dedicated SOCP solver. A returned feasible improvement is useful even if the numerical solver reports imperfect convergence, because the independent checker establishes the resulting construction. Conversely, a successful solve does not establish the global packing optimum or optimality over other orientations and separation choices.

Circle numerical wall residuals are squared lengths; triangle wall residuals and pair gaps are lengths. Do not compare their raw tolerance magnitudes as a uniform geometric clearance. Exact certification uses neither tolerance. Its rational rotation and outward repair may increase the objective, so rank certificate sizes rather than raw solver sizes.

**Starts and recovery metrics**

Every fresh run retains the same family-specific feasible grid construction at time zero. Odd seeds may begin the first local search from random poses, but the grid is still available as fallback. Thus fresh means no catalogue-derived warm start, not exclusively random initialization.

Warm runs retain their exact source-reconstruction baseline unchanged. Recovering that baseline is guaranteed by retention and is not evidence that the search rediscovered it. Report fresh recovery separately; for warm runs, emphasize improvements beyond the retained reference and whether the selected result is the unchanged baseline.

The local references are derived reconstructions, not the unavailable original high-precision catalogue witnesses. Small improvements over them can reflect reconstruction error, floating-point repair, or polishing of an already known arrangement. A catalogue's printed precision interval describes its construction value; its lower endpoint is not a mathematical impossibility bound on the optimum.

**Costs and comparisons**

Search receives a maximum of 120 process CPU seconds per run, with actual CPU and wall time retained. Imports, source loading and the separate exact-certification subprocess are outside that search budget. Certification wall time is recorded; certification CPU time is not. Therefore 40 CPU hours describes nominal search allocation, not total end-to-end resource consumption.

The fixed-angle polishing call additionally has a short wall-time cap inside the search CPU budget. Scheduling and contention can therefore affect how much polish is completed, even at equal nominal CPU budgets. The campaign uses one BLAS and one HiGHS thread per worker, but hardware, scheduling and nonsmooth solver behavior still affect iteration counts and outcomes.

Arms are scheduled in blocks rather than randomized throughout the whole run. Treat cross-arm differences as a workstation pilot, with per-instance and fresh/warm results shown. Avoid strong claims from a single best score or an aggregate that mixes cases of different size. Repeated runs and held-out counts help, but they do not eliminate shared basin structure, ordering effects, or uncertainty from only twelve runs per start category.

Certificate comparison is deterministic. CPU-limited search is not bit-for-bit reproducible across machines. Any interrupted or failed attempts must remain visible and must not silently disappear from denominators or cost accounting.

**Artifact custody**

The runner records code hashes and snapshots, task seeds, warm-input hashes and copied baseline files. It executes the live root code; launch-time hashes and the protocol's no-edit rule preserve consistency operationally. The copied exact baseline certificates are not separately content-hashed in each task. Keep them unchanged during the campaign and include their final hashes in the delivered result inventory. No current mutation or contract mismatch was found in this review.

No additional blocker to the corrected pilot was found. A successful final certificate proves a feasible upper bound for its exact instance. It does not by itself establish novelty, priority, a globally optimal packing, or a broadly superior search method.
