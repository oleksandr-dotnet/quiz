import { useEffect, useRef } from 'react'

// Returns the value this hook was called with on the previous render, or undefined on the first.
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}
