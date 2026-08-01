## 1. Generator rewrite

- [x] 1.1 Rewrite `tools/mapgen/generate-map.mjs`: keep the seeded 6x3 grid vertex-lattice
      generation (seed `20260801`, `viewBox 0 0 1200 640`, shared cubic-Bezier edges), add 18
      invented English names and matching invented Russian translations (no real-world place
      references), and compute per region: `centerX`/`centerY` (vertex mean), `radius`
      (`round(min(cellW,cellH)/2 * 0.82)`), `labelX`/`labelY` (same as `centerX`/`centerY`),
      `value` (400 for the middle row, 200 for the outer rows), `adjacentTo` (4-neighbour grid).
- [x] 1.2 In the same script, compute each region's true polygon centroid (shoelace formula) from
      its 4 corner vertices for `centroidX`/`centroidY` in the client output.
- [x] 1.3 Write `src/UI/Triviador.Web/Data/map.json` with `id: "abstract-18"` and the schema
      `MapRepository` parses (`id`, `nameEn`, `nameRu`, `value`, `centerX`, `centerY`, `radius`,
      `labelX`, `labelY`, `adjacentTo` per region, plus top-level `id`/`viewBox`).
- [x] 1.4 Write `src/Triviador.Client/src/components/map/abstractGeography.ts` with a
      `RegionGeometry { path, centroidX, centroidY }` per region id, exported as
      `REGION_GEOMETRY: Record<string, RegionGeometry>`, header-commented as generated/do-not-edit.
- [x] 1.5 Run the rewritten script and commit both generated outputs.

## 2. Client rendering wiring

- [x] 2.1 Update `src/Triviador.Client/src/components/map/RegionShape.tsx` to import
      `REGION_GEOMETRY`/`RegionGeometry` from `./abstractGeography` instead of `EUROPE_GEOGRAPHY`
      from `./europeGeography`, keeping the existing circle-fallback branch unchanged.
- [x] 2.2 Update `src/Triviador.Client/src/components/map/GameMap.tsx`'s `markerPosition` helper
      (and any other reference) the same way.
- [x] 2.3 Delete `src/Triviador.Client/src/components/map/europeGeography.ts`.
- [x] 2.4 Delete `src/Triviador.Client/scripts/generate-europe-paths.mjs`.
- [x] 2.5 Remove the `d3-geo`, `@types/d3-geo`, `topojson-client`, `@types/topojson-client`,
      `world-atlas` devDependencies from `src/Triviador.Client/package.json` and run `npm install`
      in `src/Triviador.Client` to regenerate `package-lock.json`.

## 3. Balance verification

- [x] 3.1 Confirm (by inspection or a throwaway script) that the generated `adjacentTo` lists form
      a fully connected 4-neighbour grid graph with no asymmetric pairs, matching what
      `MapValidator` will independently enforce at host startup.
- [x] 3.2 Confirm the four grid-corner regions are pairwise hop-distance >= 2 apart (per design.md's
      table), so 4-player base selection works under the existing `GameRules.MinimumBaseDistance`
      default without triggering its relax-fallback.

## 4. OpenSpec cleanup

- [x] 4.1 Delete the entire `openspec/changes/realistic-europe-map-responsive-layout/` folder.

## 5. Verification

- [x] 5.1 `dotnet build` from the repo root succeeds (host loads `map.json`, `MapValidator` passes
      with no errors).
- [x] 5.2 `cd src/Triviador.Client && npx tsc -b --noEmit` passes with no type errors.
- [x] 5.3 Started the host standalone (`dotnet run --no-build --urls http://127.0.0.1:5299`) and
      confirmed clean startup with no `MapRepository`/`MapValidator` fail-fast exception against
      the new 18-region `abstract-18` map content. A full interactive browser playtest (per
      CLAUDE.md's two-terminal dev loop) was intentionally skipped in this pass to avoid colliding
      with other parallel agents' dev servers on the shared fixed ports (Vite's proxy targets a
      hardcoded `localhost:5106`); `MapViewport.tsx`/`App.css` were not touched by this change, so
      their behavior is unaffected by the map content swap.
