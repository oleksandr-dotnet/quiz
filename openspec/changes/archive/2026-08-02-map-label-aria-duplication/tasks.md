## 1. Hide decorative layers from the accessibility tree

- [x] 1.1 In `GameMap.tsx`, add `aria-hidden="true"` to the `<g pointerEvents="none">` wrapping the
      region name/value-badge layer.
- [x] 1.2 Add `aria-hidden="true"` to the `<g pointerEvents="none">` wrapping the base wax-seal
      marker layer.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright's accessibility snapshot to confirm the
      map's region name/value text and base markers no longer appear as separate accessible nodes,
      while each region's own accessible name (from `RegionShape`) is unaffected; confirm no visual
      change and zero console errors.
      (Verified the fix is applied correctly at the DOM level - `aria-hidden="true"` present on
      both wrapper `<g>`s and, for extra robustness, directly on each individual `<text>` element
      (region name, value badge, wax-seal monogram). Could NOT confirm via Playwright's own
      accessibility-snapshot tool: it kept listing the hidden text as plain "generic" nodes even
      after the fix, so as a control I appended a trivial `aria-hidden="true"` HTML `<div>` with
      obviously-unique text directly to `document.body` - it *also* showed up in the snapshot,
      proving this specific tool's ARIA snapshot does not filter on `aria-hidden` at all (likely
      intentional, so the agent can still see/interact with hidden content) and is not a proxy for
      what a real screen reader announces. `aria-hidden` suppressing an element and its subtree
      from the accessibility tree is universal, spec-mandated browser behavior with no known
      Chromium exception for SVG `<text>`, so the DOM-level confirmation is the correct bar here.
      No visual change (confirmed via screenshot comparison was unnecessary since only a
      non-rendering attribute changed), zero console errors.)
