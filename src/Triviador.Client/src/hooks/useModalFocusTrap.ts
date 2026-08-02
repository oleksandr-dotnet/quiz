import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled'),
  )
}

// HowToPlayModal stays mounted as a React component across visibility toggles (its parent renders
// it unconditionally; only its own `if (!open) return null` changes) - so this can't key off
// mount/unmount. It keys off the `active` flag instead: the effect re-runs its setup/teardown each
// time `active` flips, and by the time it runs the container ref is already populated since the
// dialog's JSX rendered in the same commit.
export function useModalFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const initial = focusableElements(container)[0] ?? container
    initial.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return
      const els = focusableElements(container)
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
