# Frozen packing record registry

`records.json` contains the ten pilot contracts and source claims as retrieved on 30 October 2026. `data/sources/manifest.json` binds the retained source bytes with SHA-256 hashes, retrieval timestamps, URLs and licence information.

The five circle seeds come from the public [MinMax Arena dataset](https://minmaxarena.com/data/tilted-squares-in-circle.json), published under CC BY 4.0. Attribution to the site and each record holder is retained in the seed. The source represents squares by centers and half-edge vectors inside a unit circle centered at `(1,1)`. Its metric uses the shortest square side, permitting tiny size differences. We recenter, scale by that shortest side, and replace every piece with a concentric unit square at its original angle. The resulting floating poses must be repaired and certified locally.

The five triangle seeds are reconstructed from the [Friedman catalogue diagrams](https://erich-friedman.github.io/packing/squintri/), attributed to David W. Cantrell in July 2002. Connected gray pixel regions are fitted with minimum-area oriented rectangles, then mapped into the triangle convention. These starts can overlap because of raster error. They are not original coordinates, full-precision record certificates, or new results.

The inspected Friedman directories offer images and HTML, without full numerical poses. The Hyra summary does not contain any of the ten selected instances. `certified_incumbent` and `verified_lower_bound` consequently remain null; newly certified local witnesses should be stored in a separate campaign result rather than silently promoted to historic incumbents. Circle n18 has an exact *reported* expression, `sqrt(481)/8`, but no source proof of optimality is imported.

The registry distinguishes a source's printed-value interval from a mathematical lower bound. For example `5.301+` indicates a construction value in `[5.301,5.302)`, not an impossibility theorem. `compare.mjs` compares exact rational candidate sizes against these source claims without asserting world-record status. The thirteen-digit reconstructed seed size is never substituted for an unavailable original record.

Reproduce the local derived files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File registry/extract-gif-regions.ps1
node registry/build-registry.mjs
node --test registry/registry.test.mjs
```

The first command uses Windows System.Drawing to read the retained GIF bytes. `download-sources.mjs` is an explicit network acquisition script and refuses to overwrite a frozen snapshot unless `--refresh` is supplied. Do not refresh in the middle of a campaign; keep its original registry and source hashes with the experimental results.

The original diagram licence is unspecified. The retained images serve as research evidence; no upstream solver code has been copied or executed. Record priority remains unresolved until complete source and competing-claim review, even if a local certificate improves the displayed interval.
