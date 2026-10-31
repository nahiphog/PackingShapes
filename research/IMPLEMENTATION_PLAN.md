# Implementation plan for improving packing bounds

Research cutoff: 30 October 2026. This is a proposed implementation, not an optimizer already running. The existing executable is the independent cube feasibility audit.

Build a reproducible search-and-certification pipeline for congruent shapes. The first success criterion is a strictly better, independently checkable container bound against a refreshed incumbent. A second success criterion is an algorithm that improves performance across held-out cases at equal compute. These are separate outcomes: a useful method need not break a record, and a one-off record need not demonstrate a generally better method.

Start with the ten square-in-triangle and square-in-circle cases in [the survey](RESEARCH.md). Defer a universal geometry engine, large-scale 3D searches, and autonomous model orchestration until this narrow pipeline works.

**1. Freeze the mathematical contract and the record registry**

Each instance needs a machine-readable contract with:

- Shape, exact unit convention, count, dimension, and allowed transformations.
- Container family and its fixed parameters; the one scalar being minimized.
- Boundary contact permitted, interiors disjoint, and no reflection unless explicitly allowed.
- Claimed incumbent, certified incumbent, strongest verified impossibility bound, and any newer unverified claim as separate fields.
- Source URL, author, publication date, retrieval date, commit or artifact hash, licence, coordinate file, and verifier version.
- Numeric semantics: exact decimal rational, algebraic expression, interval, or merely truncated display.
- Evidence state: reported, locally feasible, independently certified, globally proved, or superseded. Keep proof status separate from certificate status and record priority.

Keep a source snapshot per experiment. Do not silently replace the baseline halfway through a campaign; compare against both the frozen baseline and the refreshed frontier at publication time. Record a pending submission even if its coordinates are unavailable, because priority may be unresolved.

For the initial shortlist, import full poses where available. A picture can suggest a seed, but digitizing it cannot establish a high-precision incumbent. If reconstruction is necessary, optimize and certify it, and label its relationship to the original. Do not compare a twelve-digit candidate with a five-digit truncated display and claim the difference as a record.

Build these invariants into the importer: fixed count, finite values, positive sizes, correct rotations, correct side/radius conversion, and no mixing of variable-radius and congruent-circle records. Sources with unknown or restrictive licences can supply cited numeric facts without copying their code wholesale.

**Acceptance gate:** ten initial cases have unambiguous contracts and provenance. Any missing full incumbent is marked explicitly; the case may be used for method development but cannot yet support a small record claim.

**2. Geometry and verification before optimization**

For each unit square use a center c_i=(x_i,y_i) and angle theta_i. Its four vertices are c_i+R(theta_i)(+/-1/2,+/-1/2). The first implementation supports a circle and an equilateral triangle as containers. Add square containment as a cheap regression family.

For a convex polygon container written as a_k dot x <= L*b_k, check every transformed vertex against every wall. For a circle centered at the origin, require ||v||^2 <= R^2 for every vertex. Because the square and the container are convex, checking the vertices suffices for containment.

For each pair of convex polygons, interior disjointness is equivalent to the existence of a separating axis among the normals to their edges. Compute the projection intervals on all candidate axes. A gap of zero permits contact; a positive gap gives separation. Use all pairs in the final checker even if the optimizer uses a neighbor list.

Search and verification have different representations:

| Component | Representation | Purpose |
| --- | --- | --- |
| Search | Float64 centers, angles, gradients | Fast proposal and local refinement |
| Candidate screen | Float64 geometry with reported residuals | Reject obvious overlaps and retain promising candidates |
| Certificate construction | Exact rational centers and rational rotation parameters | Turn a numerical arrangement into an exact packing, possibly at a slightly larger container |
| Final checker | Exact rational or outward-rounded algebraic arithmetic | Decide the actual mathematical inequalities |

For square rotations, a rational half-angle parameter t gives cos(theta)=(1-t^2)/(1+t^2) and sin(theta)=2t/(1+t^2). These preserve unit edge lengths exactly. Use multiple charts or the square's rotational symmetry near a chart singularity. Do not round vertices independently: that can change the shape.

Square-in-circle certificates can use rational centers, rotations, and R, with exact squared-distance inequalities. Equilateral-triangle walls introduce sqrt(3); represent them in Q(sqrt(3)) or use rigorously directed algebraic intervals. Later regular pentagons require appropriate algebraic coordinates; approximating their vertices as arbitrary rationals changes the problem.

For certification, round orientations and centers, repair with conservative constraints, and enlarge the container just enough to prove feasibility. The certified size, including that enlargement, must beat the incumbent. A floating-point improvement that vanishes during certification is not a new bound.

**Acceptance gate:** analytical small cases pass; intentional overlaps, wall crossings, wrong counts, degenerate rotations, and incorrectly scaled shapes fail. Property checks cover translation, relabeling, permitted global symmetries, and the equivalence of positive rescaling. Near-contact examples are included. These tests protect the scientific conclusion and are essential.

**3. Establish strong conventional baselines**

Implement five search arms with the same candidate checker and polishing budget:

1. Random and lattice-derived rigid starts, then local constrained optimization.
2. Basin hopping with individual and cluster perturbations.
3. Simulated annealing or perturbation-compression, including temporary container expansion.
4. Shape continuation: start from inscribed disks, deform to squares, then enforce the final exact shape.
5. Structured boundary and contact-pattern proposals, followed by the same local solver.

Use a CPU stack initially: Python, NumPy, SciPy, an LP solver, and an exact/interval arithmetic backend. Pin versions after selecting and testing the environment. Add automatic differentiation or compiled geometry only after profiling. The current machine's `python` command resolves to an unusable Windows application alias, while Node is available; bootstrap an isolated Python environment before implementation. The audit deliberately has no Python dependency.

Use an augmented penalty or constrained local solver to explore centers, orientations, and container size. Report maximum pair penetration and maximum wall violation separately from the objective. A tiny penalized objective is not a feasibility test.

For fixed square orientations and a chosen separating side/direction for each pair, non-overlap and polygonal containment become linear inequalities in centers and L. Solve that LP as a polishing subproblem. In a circular container, fixed orientations and pair separators instead give a convex second-order-cone problem in centers and R. Neither is the global packing problem: choosing different orientations or separating branches can expose better arrangements.

Alternate local orientation updates with these position/size solves, and allow deliberate changes to the separating branches. Preserve the best certified incumbent when an intermediate step overlaps or grows the container.

**Acceptance gate:** reproduce several analytical controls and reach reasonable proximity to imported witnesses from perturbed starts. Compare one modest case with a general-purpose nonlinear/global solver where available. The baseline must work before LLM-generated variants are credited with progress.

**4. Test arrangement-changing hypotheses**

The proposed contribution is a reusable mechanism for changing a packing's structure. A numerical optimizer often settles into the same contact pattern; repeated coordinate noise alone may not escape it.

**Boundary reconstruction.** In circles, enumerate the number of boundary squares, approximate order around the circle, and blocks of similar orientation. In triangles, enumerate occupancy along each side and the three corners. Freeze the interior temporarily, replace a boundary cluster, then relax every object. Compare with equally expensive random cluster moves. Do not force the final arrangement to retain symmetry.

**Insertion and deletion.** Derive starts for n from n-1 and n+1. Remove a low-contact or boundary object from n+1; for insertion, use a temporary expanded container and a largest-gap candidate. Release neighboring clusters rather than trying to fit the new object into a fixed jammed layout. Count all transferred seeds as warm starts and credit their source.

**Container continuation.** Track a packing through a family of enclosing shapes or parameters, then return to the exact target. Examples include a rounded triangle becoming a triangle, or an ellipse approaching a circle. These are search paths only; the final certificate must use the target contract. Run forward and reverse continuation to expose hysteresis.

**Contact-pattern changes.** Extract near-contact graphs as heuristics, record boundary contacts separately, and propose opening a contact, exchanging neighboring objects, rotating a cluster, or changing a block's orientation. A graph inferred at a tolerance is a search descriptor, not an exact geometric proof or a complete isomorphism invariant.

**Structured square layouts.** After the small-case pipeline works, implement a grammar of aligned corner blocks plus tilted strips, bent bands, or several coupled bands. Enumerate discrete counts and orientations before continuous relaxation. Ostashev's work already demonstrates a version of this strategy; our experiment would test transfer and alternative structures, not claim the basic idea as new. [Source](https://ostashev.ai/square-packing/)

**Local softening.** Compare global shape continuation with softening just the boundary or a selected high-stress cluster. Never let the score reward a softened shape at the end. The final geometry must be a congruent square.

Maintain an archive with score, contact descriptors, orientation histogram, boundary occupancy, and lineage. Keep several different arrangements rather than only the numerically best few poses. Deduplicate obvious global symmetries and relabelings, but do not discard geometrically different poses solely because they share a graph.

**Acceptance gate:** a hypothesis improves held-out success rates or time to a fixed threshold, or produces a strictly better certified construction. Otherwise archive it as a negative result and move its compute allocation to stronger methods.

**5. Use LLMs to propose experiments and algorithms**

The model receives a compact experimental record: immutable problem contract, incumbent geometry, plots, contact summaries, unsuccessful ideas, and cost-normalized outcomes. It proposes one explicit change at a time, such as a cluster move, initialization grammar, or continuation schedule.

Generated programs run with a fixed time and memory budget in an isolated worker. They can propose candidate files; they cannot edit the checker, the incumbent table, the objective, or the held-out evaluation set. Reject attempts that change the shape, count, container, or tolerance. Keep the model's proposal and code diff alongside the resulting data.

First compare with a human-written operator library and automatic parameter tuning. Then compare the extra LLM-guided work at equal total compute, including failed compilations and failed searches. Use a separate accounting ledger for model tokens/charges and optimization CPU/GPU time. Select a model and paid budget at campaign setup; this plan makes no API calls or spending commitments.

Do not ask the model to print thousands of raw coordinates as its main strategy. Programs, structural hypotheses, and diagnostic interpretation are more compact and easier to test. A directly proposed construction is still allowed if it passes the same verifier.

**6. Run a predeclared pilot**

Proposed first experiment:

- Ten initial instances: triangle counts 8,12,17,23,30; circle counts 11,13,15,18,20.
- Five search arms, 24 independent runs per arm and instance.
- A budget of 120 CPU seconds per run, including its local polishing; one computational thread per worker for accounting.
- Twelve runs from fresh starts and twelve from incumbent-derived starts per arm, analyzed as separate groups. Every arm gets equivalent access to reference data.
- Separate fixed validation and certification time, measured and reported rather than hidden.
- Use triangle counts 8 and 12 and circle counts 11 and 13 for development; freeze code and tuning before evaluating the other six counts. Adjacent counts can be correlated, so also run a later held-out container-family test. Once held-out results inform a redesign, those counts become development data and a fresh test set is needed.

The nominal search budget is 10*5*24*120 = 144,000 CPU seconds = 40 CPU hours. On sixteen fully occupied cores, 2.5 hours is an ideal lower estimate; actual elapsed time depends on solver scaling, contention, and certification. This is a planning assumption, not measured throughput.

The proposed instance list and budget are in `research/pilot_targets.json`. Its `not_imported` fields make the outstanding incumbent-acquisition work explicit.

Report best certified size, median best feasible size, fraction reaching predefined thresholds, time to threshold, distinct arrangements, and total compute. Use repeated seeds and uncertainty intervals when comparing methods. Best-of-many scores alone favor methods that were given more trials.

Use normalized improvement (U_baseline-U_candidate)/U_baseline for the minimization instances, and report the absolute improvement too. Use no blanket numerical epsilon as a mathematical validity rule. For a practical record claim, require that the exact objective comparison proves strict improvement and that the gain exceeds any uncertainty remaining in the prior record.

Advance the strongest methods to another independently seeded campaign, refreshing competing records first. If no case improves, publish the method benchmark and failure evidence without calling it a packing breakthrough.

**7. Keep lower-bound proofs as a separate pipeline**

Construction search cannot establish global optimality through repeated failure. A local Hessian, rigidity calculation, or exhausted random search proves neither that all arrangements were considered nor that a better packing cannot exist.

For nine squares in a circle, first reconstruct and certify the known construction and audit the existing n<=8 proof definitions. Develop geometric exclusions and interval branch-and-bound over centers and angles, with only justified symmetry reductions. A restriction such as all squares touching the wall is not allowed unless proved. Start by excluding a small radius interval well below the incumbent; measure tree growth before aiming at equality.

For eighteen squares in a square, a more reusable route is a nonnegative weighted unavoidable-set certificate. Search for points and weights in a candidate container with total weight below eighteen, but with every admissible unit square collecting mass at least one. The continuum coverage condition needs a certified event sweep or interval subdivision; a finite orientation sample alone is insufficient.

Handle boundary counting rigorously: to rule out a container of side smaller than L, dilate a hypothetical packing to side L, making each piece larger than a unit square. Closed unit-square cores strictly inside these pieces are disjoint, so atoms cannot be counted twice. A coverage certificate for every such core then contradicts the total mass. An equivalent strict-core/direction-net argument must carry its shrink margin explicitly. [Technical account](https://squaremath.org/tutorial-advanced.html)

Use an LP to suggest weights, rationalize them, and independently verify total mass and coverage. Generate violating poses to refine the LP. The proof artifact is the verified certificate and its theorem, not the LP solver's floating-point status. Reserve a pilot proof budget, for example 80 CPU hours, to estimate tractability; this is not an estimate that a proof will finish in that time.

Once a finite certificate or rigorous branch partition exists, formalize the exact statement and trusted arithmetic in Lean. Pin toolchains, audit axioms, distinguish kernel evaluation from native-code decisions, and rebuild from source where practical. An uncompiled proof sketch stays a report.

**8. Proposed repository architecture**

```text
packing_shapes/
  contracts/            instance definitions and normalization
  geometry/             shapes, walls, support functions, separating axes
  search/               initializers, moves, continuation, local solvers
  polish/               LP and SOCP subproblems
  certify/              rationalization and certificate construction
  workers/              budgeted candidate execution
  registry/             provenance, records, pending claims, lineage
checkers/               small independently implemented certificate readers
benchmarks/             frozen instances, seeds, controls, reference hashes
experiments/            immutable configurations and event logs
results/                candidates, certified witnesses, comparisons
proofs/                 lower-bound certificates and optional Lean projects
research/               this survey, plan, and completed cube audit
```

Keep the checker dependency graph small. A second checker should use a materially different route where possible: support-function SAT versus vertex projection, or exact algebraic arithmetic versus interval verification. Two wrappers around the same geometry code do not provide independent verification.

Every result bundle contains the problem contract, full witness, exact objective, certificate, source lineage, solver and environment versions, random seed, compute use, verifier output, checksums, and a drawing. Also include a short statement of what is proved and what is only conjectured.

**9. Delivery sequence and decision points**

| Milestone | Estimated engineering effort | Deliverable and gate |
| --- | --- | --- |
| A | Days 1–2 | Registry, ten contracts, incumbent import, initial exact square checker. Resolve missing precision and stale records. |
| B | Days 3–5 | Local solver, conventional starts, LP/SOCP polishing, certificate repair. Reproduce analytical controls and reference neighborhoods. |
| C | Days 6–8 | Budgeted five-arm pilot and a frozen result table. Choose methods from evidence. |
| D | Week 2 | Boundary reconstruction, neighbor-count transfer, and contact-pattern mutations. Evaluate on held-out counts. |
| E | Week 3 | Expand the winning methods to larger square layouts or triangles; start the independently budgeted proof pilot. |
| F | Week 4 | Independent replay, refreshed record comparison, figures, and a publishable result bundle or honest negative-result report. |

These are implementation estimates for one developer, not guarantees of a new mathematical result. Hardware is assumed to be a workstation with approximately sixteen CPU cores and adequate RAM; a GPU is optional until batch geometry becomes a measured bottleneck.

Stop spending heavily on a family when two predeclared extensions show no benefit and the archive repeatedly returns the same arrangements. Continue when a method discovers distinct feasible structures, transfers across held-out cases, or yields a certifiable improvement. Near misses are useful diagnostics, not bounds.

The first concrete task is milestone A. The desired first scientific output is one new certified upper bound in the initial square-container portfolio. A robust lower-bound improvement or a reproducible negative method comparison is a separate worthwhile outcome.
