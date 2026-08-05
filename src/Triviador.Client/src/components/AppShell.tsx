import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Transition, type Variants } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export interface AppShellProps {
  topBar: ReactNode
  map: ReactNode
  dock?: ReactNode
  dockKey: string
  roster?: ReactNode
  mapShaking?: boolean
  // Sustained (not edge-triggered like mapShaking) - stays on for as long as the viewer's own base
  // is under assault by another player, a calmer danger vignette rather than a repeated jolt.
  mapDanger?: boolean
  // True while a question (with its answer options) or a correct/incorrect reveal is on screen -
  // at phone width the map is hidden entirely for that window (App.css's hide-mobile, mobile
  // breakpoint only; a no-op on desktop) rather than just shrunk, since a shrunk map was too small
  // to read for the few seconds it'd be up and the room is better spent on the dock.
  mapHiddenMobile?: boolean
}

const EASE_PAPER: Transition['ease'] = [0.22, 0.61, 0.36, 1]

// Per-phase dock transition "tone": every variant shares the same easing curve so they read as one
// family (louder/quieter), while the shape of the motion hints at what kind of moment is entering -
// a sharper, quicker snap for Battle's tension, a fuller reveal-style rise+scale for the game-over
// outcome, and the original gentle fade for the two picking phases.
const DOCK_VARIANTS: Record<string, { variants: Variants; transition: Transition }> = {
  Battle: {
    variants: {
      initial: { opacity: 0, y: 4, scale: 0.99 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -4, scale: 0.99 },
    },
    transition: { duration: 0.16, ease: EASE_PAPER },
  },
  Finished: {
    variants: {
      initial: { opacity: 0, y: 18, scale: 0.96 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -8, scale: 0.99 },
    },
    transition: { duration: 0.42, ease: EASE_PAPER },
  },
}

const DEFAULT_DOCK_VARIANT = {
  variants: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  transition: { duration: 0.22, ease: EASE_PAPER },
}

function dockToneFor(dockKey: string) {
  const phase = dockKey.split('-', 1)[0]
  return DOCK_VARIANTS[phase] ?? DEFAULT_DOCK_VARIANT
}

// One persistent shell every game screen renders into. The `map` slot is rendered in a stable
// position across every phase switch (App.tsx keeps passing the same GameMap element type here,
// only its props change) so a territory's identity - and any motion animating it - survives base
// selection -> land grab -> battle without a remount. Only the `dock` slot cross-fades between
// phases, keyed by `dockKey`.
// .shell-dock is the one "nothing ever scrolls" game's sole exception (App.css: overflow-y: auto,
// a sanctioned fallback for rare long content) - but a scrollable panel with no visible cue is a
// trap precisely because nothing else here trains a player to try swiping it. Confirmed live: a
// routine Tip-question Reveal already exceeds the dock's mobile height budget on iPhone 16/17,
// silently hiding the bottom of the ranked list. These two small edge overlays (painted after, so
// above, the dock's opaque .paper-card content) fade in only on the edge that actually has more to
// reveal, tracking real scroll position rather than a static hint that would lie once you'd already
// scrolled.
function useDockScrollShadows(dockKey: string) {
  const ref = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [shadows, setShadows] = useState({ top: false, bottom: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function update() {
      if (!el) return
      setShadows({
        top: el.scrollTop > 1,
        bottom: el.scrollTop < el.scrollHeight - el.clientHeight - 1,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (contentRef.current) observer.observe(contentRef.current)
    // Belt-and-suspenders: confirmed live that .shell-dock's own box can already be settled while
    // its content's natural (scrollHeight-driving) height is still a couple px taller for one more
    // frame - e.g. web-font metrics swapping in just after first paint - and neither `el` nor the
    // content wrapper necessarily fires a ResizeObserver callback for that (their own measured box
    // may not have visibly changed yet at the moment the observer's first callback runs). A stale
    // "visible" shadow with nothing left to scroll to is worse than a missing one, so poll for a
    // brief settle window after every dock-content swap rather than trust being notified.
    let ticks = 0
    const settle = window.setInterval(() => {
      update()
      if (++ticks >= 8) window.clearInterval(settle)
    }, 120)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
      window.clearInterval(settle)
    }
  }, [dockKey])

  return { ref, contentRef, ...shadows }
}

export function AppShell({ topBar, map, dock, dockKey, roster, mapShaking, mapDanger, mapHiddenMobile }: AppShellProps) {
  const reducedMotion = usePrefersReducedMotion()
  const tone = dockToneFor(dockKey)
  const transition = reducedMotion ? { duration: 0 } : tone.transition
  const mapClassName = ['shell-map', mapShaking && 'shake', mapDanger && 'danger', mapHiddenMobile && 'hide-mobile']
    .filter(Boolean)
    .join(' ')
  const { ref: dockRef, contentRef, top: showTopShadow, bottom: showBottomShadow } = useDockScrollShadows(dockKey)
  return (
    <div className="app-shell">
      <header className="shell-top-bar">{topBar}</header>
      <div className={mapClassName}>{map}</div>
      <aside className="shell-roster">{roster}</aside>
      <div className="shell-dock" ref={dockRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={dockKey}
            ref={contentRef}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={tone.variants}
            transition={transition}
          >
            {dock}
          </motion.div>
        </AnimatePresence>
        <div className={showTopShadow ? 'dock-scroll-shadow dock-scroll-shadow-top visible' : 'dock-scroll-shadow dock-scroll-shadow-top'} aria-hidden="true" />
        <div className={showBottomShadow ? 'dock-scroll-shadow dock-scroll-shadow-bottom visible' : 'dock-scroll-shadow dock-scroll-shadow-bottom'} aria-hidden="true" />
      </div>
    </div>
  )
}
