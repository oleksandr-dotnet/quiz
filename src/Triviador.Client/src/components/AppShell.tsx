import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export interface AppShellProps {
  topBar: ReactNode
  map: ReactNode
  dock?: ReactNode
  dockKey: string
  roster?: ReactNode
  mapShaking?: boolean
}

// One persistent shell every game screen renders into. The `map` slot is rendered in a stable
// position across every phase switch (App.tsx keeps passing the same GameMap element type here,
// only its props change) so a territory's identity - and any motion animating it - survives base
// selection -> land grab -> battle without a remount. Only the `dock` slot cross-fades between
// phases, keyed by `dockKey`.
export function AppShell({ topBar, map, dock, dockKey, roster, mapShaking }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="shell-top-bar">{topBar}</header>
      <div className={mapShaking ? 'shell-map shake' : 'shell-map'}>{map}</div>
      <aside className="shell-roster">{roster}</aside>
      <div className="shell-dock">
        <AnimatePresence mode="wait">
          <motion.div
            key={dockKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {dock}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
