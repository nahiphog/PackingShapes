# Exact replay of the twelve cube construction

On 30 October 2026 this repository checked the published coordinates for Yohei Nakajima's Claude-assisted packing of twelve unit cubes in a cube. The source witness is [cubincub_n12.json](https://github.com/yoheinakajima/soft-to-rigid-packing/blob/main/claims/cubincub_n12/cubincub_n12.json), retrieved through the GitHub connector. A local copy is retained in `evidence/cubincub_n12.json`, with source and checker hashes in `evidence/cube_audit.json`.

The upstream exact checker was read for comparison but was not run. This replay uses a separately written support-function separating-axis test, rather than the upstream linear-program-generated separating planes. It is an independent implementation within the same research session, not a separate human review or formal proof-assistant replay.

The local program interprets the JSON decimal tokens as exact rational numbers. Each nonzero scalar-first quaternion defines an exact orthogonal rotation through homogeneous normalization; orthogonality and determinant +1 are checked. Centers and container size are also exact rationals. This precisely specifies a nearby congruent-cube packing even when the printed quaternion is not exactly unit length.

For every cube, exact support extents establish containment against the six walls. For each of the 66 pairs, the checker searches the three face normals of each cube and the nine cross products of their edge axes. A nonzero axis with disjoint projected interiors certifies non-overlap. No square root or floating-point tolerance participates in those decisions. The saved projection gaps are unnormalized axis margins, not Euclidean distances.

Result: all twelve cubes fit at side **2.9315185094797**, and all 66 pairs have strictly positive separating margins. The program also rejects four deliberately invalid inputs: duplicate cubes, side 2, a zero quaternion, and using the truncated catalogue display **2.93151** as the full container size.

This is a feasibility certificate for the explicit decimal-rational interpretation. It is not a proof of global optimality or current world-record priority. It is not a newly discovered packing.

Reproduce with:

```powershell
node research/audit_cube.mjs
```

The program uses Node's standard library and BigInt arithmetic, needs no external packages, and regenerates `research/evidence/cube_audit.json`. The evidence copy contains the published geometric data and attribution; no upstream solver or verifier was copied into this repository.
