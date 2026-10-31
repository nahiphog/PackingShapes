# Exact square packing checker

`squares.mjs` uses only Node's standard library and exact BigInt fractions. It does not import optimizer code. Unit congruence follows from the rational rotation formula `(cos,sin)=((1-t²)/(1+t²),2t/(1+t²))`, rather than trusting rounded vertices.

Certificate schema:

```json
{
  "schema_version": 1,
  "shape": "unit_square",
  "container": "circle",
  "n": 1,
  "size": "707106781187/1000000000000",
  "pieces": [{"x":"0","y":"0","t":"0"}]
}
```

Exact numbers must be strings: fractions, finite decimals, or decimal scientific notation. `n` must be an integer equal to the number of pieces. Circle `size` is its radius, centered at the origin. Square `size` is its side, with bounds `[0,size]²`. An equilateral triangle of side `size` has vertices `(-size/2,0)`, `(size/2,0)`, `(0,sqrt(3)*size/2)`.

Boundary contact is allowed; interiors may not overlap. Every vertex and every pair is checked. Separating axes are the two edge directions of each square. Equilateral triangle inequalities use exact signs of `a+b*sqrt(3)`, decided by rational arithmetic. There is no numerical tolerance.

```powershell
node checkers/squares.mjs verify certificate.json verification.json
node checkers/squares.mjs certify candidate.json certification.json
node --test tests/checker.test.mjs
```

The numerical candidate uses the same shape, container and count, with pieces `{ "x": 0, "y": 0, "theta": 0 }` where the angle is in radians. Its optional `size` is recorded but does not control certification. The CLI writes an envelope containing `certificate`, `verification` and `repair`; feed the extracted `certificate` to `verify` for an independent replay.

`certifyCandidate` first rounds centers and rationalizes rotations. For each pair it calculates the exact minimum center dilation that establishes separation on one of the four separating axes, then takes a common outward-rounded dilation. Coincident centers cannot be repaired by this method and are rejected. Triangle arrangements are translated vertically so the bottommost vertex lies on the base; square arrangements are translated to both lower walls. Circle arrangements retain their origin.

The container bound is recomputed outward: exact squared norms and integer square-root rounding for circles, rational extrema for squares, and exact algebraic comparisons for triangles. Certification may make the container larger. It proves feasibility of the output witness, not optimality, priority, or closeness to the candidate's proposed score. The repair is deliberately distinct from local optimization.

Exported functions: `verifyCertificate(certificate, {expectedN,expectedContainer})`, `certifyCandidate(candidate, {digits:12})`, `Rational`, and `signSqrt3`. The optional expected fields tie verification to an external instance contract; the pilot should provide both. Malformed input throws; geometrically invalid certificates return `valid:false` with all violations.

The test suite covers wall equality, contact versus extremely small exact overlap, rotated-pair separation, triangle irrational wall boundaries, wrong contracts, count mismatches, global rotation, relabeling, malformed numeric inputs and outward repair.

To rank a whole numerical shortlist after certification, use:

```powershell
node checkers/select-best.mjs shortlist.json selected.json
```

The input is `{ "instance": {"n": 2, "container": "circle"}, "candidates": [...] }`, where each candidate follows the numerical proposal schema above. The selector checks every proposal against the external contract, certifies it, independently replays its certificate, then compares the resulting container sizes as exact rationals. Equal sizes retain the first witness. Only the winning certificate is saved; summaries and failures retain every candidate's outcome. Output includes input, checker and selector SHA-256 hashes. A geometrically bad proposal that can be repaired remains eligible, but its actual repaired size determines the ranking.

An optional `baseline_certificate` preserves an existing exact witness without conversion through floating point. It is verified against the external contract before comparison. The baseline wins an exact tie; if selected, `selected_index` is null, `selected_baseline` is true, and repair method is `unchanged exact baseline`. `baseline_considered` records whether one was supplied, and any invalid baseline appears explicitly in `failures`. `candidate_count` includes only numerical candidates.

Performance optimization preserves exact decisions: the combined support extent of two squares is the same on their four edge axes, so it is computed once. Approximate projections only order the axes. A pair's dilation calculation stops early only after an exact comparison proves that the current common scale already separates that pair. Otherwise all axes are evaluated and the least required dilation is selected exactly. The final checker likewise accepts only an exact separating inequality.

Outward rounding of a triangle side also uses a floating-point initial guess only to locate an integer bracket. Both bracket endpoints are checked and expanded with exact algebraic comparisons before exact integer bisection, so an inaccurate guess cannot change the certified bound.
