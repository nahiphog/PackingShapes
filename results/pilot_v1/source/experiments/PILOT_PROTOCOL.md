# Frozen pilot protocol

The campaign runs ten cases, five methods, and 24 runs per method/case, each with a maximum of 120 process CPU seconds. Twelve runs start fresh; twelve use the same certified source reconstruction. The five methods are rigid multistart, basin hopping, annealing, disk-to-square continuation, and structured boundary moves. All share the same geometry, constrained local solver, position polishing, and exact certificate selection.

The development counts are triangle 8/12 and circle 11/13. Code is frozen before the pilot starts and remains unchanged for the six held-out counts. Source reconstruction and certification across all ten cases is baseline preparation, not evidence of method performance. If held-out outcomes later influence algorithm changes, those counts become development data for that subsequent campaign.

**Recorded amendments to the original proposal**

- Original high-precision catalogue witnesses were not available. Warm starts therefore use explicitly attributed public circle layouts and digitized/reconstructed triangle figures. Their exact certified versions are local references, not asserted world-record incumbents.
- Triangle and square position polishing uses LP. Circle position polishing solves the equivalent fixed-separator convex constraints using analytic SLSQP rather than installing a dedicated SOCP solver.
- A shortlist of numerical improvements and clean final iterates is independently certified. Selection uses exact rational objective comparison; an exact warm baseline is retained unchanged if it wins. This prevents feasibility repair from silently worsening an incumbent.
- Soft stages reserve at least the final min(10 seconds, 25% of run budget) for rigid geometry. All accepted candidates are exact unit-square certificates, never softened shapes.
- Search time excludes Python import, source loading, and exact certification. Certification wall time is reported separately. One BLAS thread and one HiGHS thread are used per worker. A solver callback can exceed its nominal deadline slightly before returning; actual CPU time is retained.
- The runner uses six workers by default on the observed eight-logical-core workstation. The aggregate planned search budget remains 40 CPU hours; no elapsed-time guarantee is made.

**Metrics fixed before the pilot**

Report validity counts, best certified size, exact median certified size, baseline recovery within a relative 1e-5, and meaningful improvement over the local reference of at least a relative 1e-6. Also report every strictly positive exact improvement without confusing a last-digit repair with a material advance. Split fresh and warm results. Compare the original catalogue claim using its known precision interval or algebraic value; no global record or optimality follows from a local reference improvement.

Initial controls comprise analytical small packings, invalid geometry mutants, 100 random exact-certification trials checked against separately implemented polygon projections, finite-difference Jacobians across both final and rounded shapes, fixed-angle polishing checks, and a short end-to-end development smoke run. Do not change algorithms during a running campaign. Any change requires a new output directory and source manifest.

**Reproducibility and recovery**

Every campaign keeps code hashes and source snapshots, a copy of its baselines, a task list with random seeds and input hashes, per-run logs, numerical candidates, selected exact certificates, actual CPU/wall costs, and completion status. A completed per-run result is atomically written. Interrupted tasks can resume with the same command; source/task mismatches are rejected. Failed tasks remain visible and must be investigated rather than silently excluded.

CPU-budgeted stochastic searches are not bit-for-bit reproducible across machines: the number of iterations depends on hardware and scheduling. Certificate replay and exact objective comparison are deterministic. All seed-derived claims retain source lineage.
