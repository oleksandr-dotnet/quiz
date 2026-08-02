## 1. Fix stray-touch pinch interruption

- [x] 1.1 In `MapViewport.tsx`'s `endPointer`, after `pointersRef.current.delete(e.pointerId)`,
      branch on the remaining pointer count: if `>= 2`, re-baseline `pinchStartRef` from the two
      remaining pointers' current positions and the current `transformRef` scale/offset (same
      computation as `handlePointerDown`'s two-pointer branch), and clear `panStartRef`; if `=== 1`
      and zoomed, keep the existing drop-to-pan behavior; otherwise clear both refs as today.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright's `browser_evaluate` to dispatch a
      synthetic multi-pointer sequence directly on the map viewport (pointerdown A, pointerdown B,
      pointermove both apart to zoom in, pointerdown C, pointerup C, pointermove A/B further apart)
      and confirm the map's scale keeps increasing after C lifts, rather than freezing at whatever
      scale it was at when C landed. Confirm the existing single-pinch (no stray touch) and
      drag-pan cases are unaffected. Confirm zero console errors.
      (Verified: dispatched synthetic PointerEvents (pointerType 'touch', distinct pointerIds)
      directly on `.map-viewport`. Two-finger pinch-out took scale 1→3. A third pointer landing
      and lifting left scale unchanged at 3 (correct - a stray touch shouldn't itself zoom).
      Continuing to pinch the original two fingers further apart afterward increased scale to 4
      (clamped at MAX_SCALE) - proving the pinch kept responding instead of freezing at 3, exactly
      the bug this fixes. Separately confirmed single-pointer drag-pan while zoomed still moves the
      offset correctly (`translate(0,0)` → `translate(50px,10px)`). Zero console errors.)
