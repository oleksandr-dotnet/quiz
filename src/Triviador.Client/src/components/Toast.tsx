import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export interface ToastProps {
  message: string
  tone?: 'error' | 'info'
}

// Replaces the bare red <p className="landing-error"> used for rejections and room-closed
// messages across every screen. The mount transition below fires wherever Toast is rendered (no
// AnimatePresence required at the call site); an exit transition additionally plays wherever the
// call site wraps its conditional render in AnimatePresence (see LandingScreen/LobbyScreen).
export function Toast({ message, tone = 'error' }: ToastProps) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <motion.p
      className={`toast toast-${tone}`}
      role="alert"
      initial={reducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {message}
    </motion.p>
  )
}
