# Evaluation reports

Run `node reporting/report.mjs results/smoke_v1` (replace with campaign directory). The optional second argument selects an output directory. Reports default to `CAMPAIGN/report/`: `summary.json`, `REPORT.md`, standalone `index.html`, and paired SVGs. No external assets or services are needed to view HTML.

The generator independently replays exact certificates and ranks their rational sizes. `numeric_best` and floating-point certified-size fields do not affect ranking, medians, baseline deltas, or source comparisons. SVGs and human-readable decimals are approximate renderings. Positive baseline-minus-best indicates local improvement over the derived reference, never proof of a world record.

Baseline lookup prefers `CAMPAIGN/baselines/index.json`, then `CAMPAIGN/baseline_index.json`, then live `results/baselines/index.json`. Index certificate paths resolve relative to the project root (absolute paths also work); archive immutable referenced certificate files along with the campaign snapshot. The report records baseline index and certificate hashes. Live-baseline fallback is prominently disclosed.

The registry lookup prefers `CAMPAIGN/source/registry/records.json` over the live registry and records the selected path and hash. Source comparisons therefore use the campaign's frozen claims when available.

CPU hours count reported search process CPU only. Certification timing is separately summed wall time, not CPU time. Conditional medians use independently valid runs; missing and failed runs remain counted. Baseline recovery permits size at most baseline × (1 + 1e-5); meaningful local improvement requires size at most baseline × (1 − 1e-6). Campaign `manifest.metrics` supplies these tolerances when present. Strict local improvement uses exact inequality and may be arbitrarily tiny. All threshold decisions use rational arithmetic.

Success rates divide successes by completed tasks, including failures as nonsuccesses and excluding missing tasks. Reports include 95% Wilson intervals as descriptive marginal uncertainty, not tests comparing arms. Seeds are retained in JSON for paired analyses; common seeds across arms mean their results are dependent. Partial campaigns can be reported without implying completion.

Run `node --test reporting/report.test.mjs` to verify rational medians, certificate-driven selection, failed replay handling, and missing-run accounting.
# Reporting interpretation additions

Reports preserve `selected_baseline` from the winning certificate envelope. Warm runs retain the exact reference as a fallback, so their recovery rate measures retention or improvement, not rediscovery. Group summaries distinguish selecting the unchanged baseline witness from returning any witness whose exact container size equals the baseline bound.

`search_cpu_hours` is a subtotal of recorded search costs. A completed failed task can lack CPU accounting, especially when an exception occurs after search; such costs remain `null` per run and are counted in `unknown_search_cpu_cost_tasks`, never silently asserted to be zero. Missing tasks remain separate from completed tasks with unavailable cost.

Report provenance includes SHA-256 hashes of the reporting code, exact checker, registry comparator and tasks file, as well as the registry snapshot, baseline index and every replayed selected/baseline certificate. `checker_matches_campaign_manifest` reports whether the replay checker matches the campaign's frozen hash, when that hash exists.
