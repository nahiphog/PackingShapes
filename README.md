# PackingShapes

Research and implementation planning for improving bounds on packing congruent shapes into bounded containers. Research cutoff: 30 October 2026.

- [Research findings and candidate problems](research/RESEARCH.md)
- [Implementation plan](research/IMPLEMENTATION_PLAN.md)
- [Independent exact replay of a published 12-cube construction](research/AUDIT.md)
- [Proposed pilot instances and compute budget](research/pilot_targets.json)

The repository now implements a provenance registry, exact feasibility checker, five-arm numerical search, and certificate-based reports. The full pilot is running in `results/pilot_v2`: ten cases, five arms, 24 repetitions per arm, 120 search CPU seconds per run, six workers. The planned search budget is 40 CPU hours plus certification. This is not a claim of a new packing record. The first launch was interrupted before a completed run to fix candidate retention; its evidence remains in `results/pilot_v1`.

Original full-precision witnesses were unavailable for these ten catalogue entries. Triangle warm starts were reconstructed from diagrams; circle warm starts were derived from public MinMax arrangements. Locally polished and exactly certified baselines remain derived references. Improving them does not establish improvement of the historical incumbent or record priority.

## Commands

Node.js runs the registry, exact checker, and reporting without third-party packages:

```text
node registry/build-registry.mjs
node --test registry/registry.test.mjs
node checkers/squares.mjs certify candidate.json certificate.json
node checkers/squares.mjs verify exact-certificate.json
node --test reporting/report.test.mjs
node reporting/report.mjs results/pilot_v2
node research/audit_cube.mjs
```

`certify` writes an envelope containing the exact `certificate`, verification, and repair metadata. `verify` takes that inner certificate object. Coordinates, size, and half-angle parameters use rational strings. Exact rational and quadratic-field predicates permit boundary contacts and reject overlapping interiors. Certification can enlarge a numerical proposal to produce a valid construction.

The Python runner uses NumPy and SciPy from the local pinned `.deps` directory. Invoke with the configured Python executable:

```text
python run_pilot.py prepare --output results/prepare_new
python run_pilot.py smoke --output results/smoke_new
python run_pilot.py pilot --workers 6 --output results/pilot_new
```

Preparation writes derived baselines; do not run it against baselines used by an active campaign. Use new output directories for changed code or configuration. Arms use rigid local optimization, basin hopping, annealing, homotopy, and structured moves. Fresh and warm starts share seeds across arms. A development/held-out barrier separates execution phases; source hashes and task manifests record the configuration. Existing task outputs support resumability.

Reports independently replay the selected certificates, rank exact rational sizes, and write JSON, Markdown, and standalone HTML with paired baseline/best SVGs. Recovery and meaningful local improvement rates use campaign thresholds; strict exact improvements are counted separately. Failed and missing runs remain visible. Wilson intervals describe marginal rates, not significance tests between paired arms. Partial reporting is supported. Search CPU time excludes certification, which is separately reported as summed wall time.

See [registry documentation](registry/README.md) and [report documentation](reporting/README.md) for provenance and evaluation details.
