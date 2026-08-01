import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_MAX_DELAY_MS = 300
const DOUBLE_TAP_MAX_DISTANCE_PX = 24
const WHEEL_ZOOM_SPEED = 0.0015
const DRAG_THRESHOLD_PX = 6

interface Transform {
  scale: number
  x: number
  y: number
}

interface Point {
  x: number
  y: number
}

interface PinchStart {
  distance: number
  scale: number
  offsetX: number
  offsetY: number
}

interface PanStart {
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  // A plain tap and the start of a drag look identical until the pointer actually moves - capture
  // is deferred until movement crosses DRAG_THRESHOLD_PX (see handlePointerMove) so an
  // uncommitted tap's native click still reaches the real target underneath (a region or the
  // reset button) instead of being swallowed by the container's capture.
  dragging: boolean
}

interface TapRecord {
  time: number
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Every offset/scale math here shares one model: transform-origin stays the CSS default (center),
// so `translate(x, y) scale(s)` places screen point P at `center + s * (local - center) + (x, y)`.
// That makes the pan clamp a simple `|offset| <= (scale - 1) * containerSize / 2` (content can
// never be dragged past its own edge) and zoom-to-point a closed form: to keep point P fixed while
// scale moves from s0 to s1, `newOffset = p + (oldOffset - p) * (s1 / s0)`, where p is P relative to
// the container's center. See design.md decision 4 for the full derivation.
function zoomToPoint(offset: Point, pointRelCenter: Point, ratio: number): Point {
  return {
    x: pointRelCenter.x + (offset.x - pointRelCenter.x) * ratio,
    y: pointRelCenter.y + (offset.y - pointRelCenter.y) * ratio,
  }
}

function clampOffset(offset: Point, scale: number, width: number, height: number): Point {
  if (scale <= 1) return { x: 0, y: 0 }
  const maxX = ((scale - 1) * width) / 2
  const maxY = ((scale - 1) * height) / 2
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) }
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// A pointer can go away (OS-level gesture interrupt, stray pointercancel) between the event that
// decided to capture it and this call actually running - worst case we just miss capturing and a
// drag stops updating mid-gesture, recoverable via "Reset view"; it must never throw and abort the
// rest of the handler (see design.md's hand-rolled-gesture risk note).
function tryCapturePointer(target: Element, pointerId: number): void {
  try {
    target.setPointerCapture(pointerId)
  } catch {
    // Pointer already released or invalid - nothing to capture.
  }
}

export interface MapViewportProps {
  children: ReactNode
}

// Wraps the map in pinch-zoom, drag-pan, double-tap/click zoom toggle, and desktop wheel-zoom -
// all hand-rolled on native Pointer Events (see design.md decision 4 for why no pan-zoom library).
// GameMap itself needs no changes: this only ever applies a CSS transform to a wrapper div.
// Pointer capture is deferred until a drag is actually confirmed (see PanStart.dragging) -
// capturing eagerly on every pointerdown would retarget the resulting native `click` to this
// container instead of the region/button underneath, silently swallowing plain taps.
export function MapViewport({ children }: MapViewportProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 })
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const pinchStartRef = useRef<PinchStart | null>(null)
  const panStartRef = useRef<PanStart | null>(null)
  const lastTapRef = useRef<TapRecord | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  const applyTouchAction = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const pinching = pointersRef.current.size >= 2
    container.style.touchAction = pinching || transformRef.current.scale > 1 ? 'none' : 'pan-y'
  }, [])

  const applyTransform = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const { scale, x, y } = transformRef.current
    content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }, [])

  const setTransform = useCallback(
    (next: Transform) => {
      const container = containerRef.current
      const width = container?.clientWidth ?? 0
      const height = container?.clientHeight ?? 0
      const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE)
      const offset = clampOffset({ x: next.x, y: next.y }, scale, width, height)
      transformRef.current = { scale, x: offset.x, y: offset.y }
      applyTransform()
      applyTouchAction()
      setIsZoomed(scale !== 1)
    },
    [applyTransform, applyTouchAction],
  )

  const relativeToCenter = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
  }, [])

  const resetView = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 })
  }, [setTransform])

  const toggleDoubleTapZoom = useCallback(
    (clientX: number, clientY: number) => {
      if (transformRef.current.scale !== 1) {
        resetView()
        return
      }
      const p = relativeToCenter(clientX, clientY)
      const offset = zoomToPoint({ x: 0, y: 0 }, p, DOUBLE_TAP_SCALE)
      setTransform({ scale: DOUBLE_TAP_SCALE, x: offset.x, y: offset.y })
    },
    [relativeToCenter, resetView, setTransform],
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size === 2) {
        // A second finger landing is unambiguously a pinch, never a tap - capturing immediately
        // is safe here.
        tryCapturePointer(e.currentTarget, e.pointerId)
        const [a, b] = [...pointersRef.current.values()]
        pinchStartRef.current = {
          distance: distanceBetween(a, b),
          scale: transformRef.current.scale,
          offsetX: transformRef.current.x,
          offsetY: transformRef.current.y,
        }
        panStartRef.current = null
      } else if (pointersRef.current.size === 1 && transformRef.current.scale > 1) {
        // Don't capture yet: a tap and the start of a drag are indistinguishable until the
        // pointer actually moves. handlePointerMove commits (and captures) once the drag
        // threshold is crossed.
        panStartRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          offsetX: transformRef.current.x,
          offsetY: transformRef.current.y,
          dragging: false,
        }
      }
      applyTouchAction()
    },
    [applyTouchAction],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size >= 2 && pinchStartRef.current) {
        const [a, b] = [...pointersRef.current.values()]
        const distance = distanceBetween(a, b)
        const ratio = distance / pinchStartRef.current.distance
        const newScale = clamp(pinchStartRef.current.scale * ratio, MIN_SCALE, MAX_SCALE)
        const mid = midpointOf(a, b)
        const midpoint = relativeToCenter(mid.x, mid.y)
        const offset = zoomToPoint(
          { x: pinchStartRef.current.offsetX, y: pinchStartRef.current.offsetY },
          midpoint,
          newScale / pinchStartRef.current.scale,
        )
        setTransform({ scale: newScale, x: offset.x, y: offset.y })
        return
      }

      const pan = panStartRef.current
      if (pan && pan.pointerId === e.pointerId) {
        const dx = e.clientX - pan.startX
        const dy = e.clientY - pan.startY
        if (!pan.dragging) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
          pan.dragging = true
          tryCapturePointer(e.currentTarget, e.pointerId)
        }
        setTransform({
          scale: transformRef.current.scale,
          x: pan.offsetX + dx,
          y: pan.offsetY + dy,
        })
      }
    },
    [relativeToCenter, setTransform],
  )

  const endPointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(e.pointerId)
      pinchStartRef.current = null
      panStartRef.current = null

      if (pointersRef.current.size === 1 && transformRef.current.scale > 1) {
        // A pinch that just dropped to one finger is already mid-gesture, not a fresh tap -
        // capturing immediately (rather than deferring to a drag threshold) is correct here.
        const [remaining] = [...pointersRef.current.entries()]
        const [pointerId, point] = remaining
        tryCapturePointer(e.currentTarget, pointerId)
        panStartRef.current = {
          pointerId,
          startX: point.x,
          startY: point.y,
          offsetX: transformRef.current.x,
          offsetY: transformRef.current.y,
          dragging: true,
        }
      }
      applyTouchAction()
    },
    [applyTouchAction],
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const wasSinglePointer = pointersRef.current.size === 1
      const wasDragging = panStartRef.current?.pointerId === e.pointerId && panStartRef.current.dragging
      endPointer(e)

      if (!wasSinglePointer || wasDragging) return
      const now = e.timeStamp
      const last = lastTapRef.current
      if (last && now - last.time <= DOUBLE_TAP_MAX_DELAY_MS && distanceBetween(last, { x: e.clientX, y: e.clientY }) <= DOUBLE_TAP_MAX_DISTANCE_PX) {
        toggleDoubleTapZoom(e.clientX, e.clientY)
        lastTapRef.current = null
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY }
      }
    },
    [endPointer, toggleDoubleTapZoom],
  )

  // React registers onWheel as a passive root listener, so a JSX handler's preventDefault() would
  // silently no-op (and warn) - the page would scroll/zoom underneath our own transform. A native
  // listener with passive:false is the only way to actually own wheel-driven zoom.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return () => {}
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { scale, x, y } = transformRef.current
      const newScale = clamp(scale * (1 - e.deltaY * WHEEL_ZOOM_SPEED), MIN_SCALE, MAX_SCALE)
      const p = relativeToCenter(e.clientX, e.clientY)
      const offset = zoomToPoint({ x, y }, p, newScale / scale)
      setTransform({ scale: newScale, x: offset.x, y: offset.y })
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [relativeToCenter, setTransform])

  // Re-clamp on resize so a viewport rotation/resize can't leave the map stranded outside the
  // container's edge with a now-stale offset computed against the old size.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return () => {}
    const observer = new ResizeObserver(() => setTransform(transformRef.current))
    observer.observe(container)
    return () => observer.disconnect()
  }, [setTransform])

  return (
    <div
      ref={containerRef}
      className="map-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div ref={contentRef} className="map-viewport-content">
        {children}
      </div>
      {isZoomed && (
        <button type="button" className="map-viewport-reset" onClick={resetView}>
          {t('map.resetView')}
        </button>
      )}
    </div>
  )
}
