import type { KeyboardEvent, SVGProps } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegionView } from '../../api/contracts'
import { SEAT_COLORS, hatchPatternIdFor } from '../../lib/seats'
import { REGION_GEOMETRY, type RegionGeometry } from './abstractGeography'

export interface RegionShapeProps {
  region: RegionView
  ownerSeat: number | null
  ownerName: string | null
  interactive: boolean
  eligible: boolean
  contested: boolean
  // A duel or an assault on someone else's base (never the calm self-heal case) - a stronger
  // pulse than the plain contested marker below.
  escalated?: boolean
  onSelect?: (regionId: string) => void
}

// Draws the region's abstract shape outline when one was baked by tools/mapgen/generate-map.mjs;
// falls back to the legacy circle (server centerX/centerY/radius) if the client's static geometry
// dataset and the server's map content ever drift out of sync.
function RegionOutline({
  region,
  geometry,
  ...rest
}: { region: RegionView; geometry: RegionGeometry | undefined } & Omit<SVGProps<SVGPathElement>, 'ref' | 'd'>) {
  if (geometry) return <path d={geometry.path} {...rest} />
  return <circle cx={region.centerX} cy={region.centerY} r={region.radius} {...rest} />
}

export function RegionShape({
  region,
  ownerSeat,
  ownerName,
  interactive,
  eligible,
  contested,
  escalated = false,
  onSelect,
}: RegionShapeProps) {
  const { t } = useTranslation()
  const clickable = interactive && eligible && !!onSelect
  const geometry = REGION_GEOMETRY[region.regionId]
  const markerX = geometry ? geometry.centroidX : region.labelX
  const markerY = geometry ? geometry.centroidY : region.labelY
  const label = ownerName
    ? t('map.regionLabelClaimed', { name: region.name, value: region.value, ownerName })
    : t('map.regionLabelUnclaimed', { name: region.name, value: region.value })

  function handleKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (!clickable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect!(region.regionId)
    }
  }

  return (
    <g
      className={clickable ? 'region selectable' : 'region'}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={label}
      data-testid={`region-${region.regionId}`}
      // Ownership isn't otherwise readable from the DOM (fill color / hatch pattern only, both
      // presentational) - the e2e harness's regionOwnerSeatOf/ownedRegionIds helpers (tests/e2e/specs/
      // helpers.ts) key off this instead of parsing SVG fill colors or the localized aria-label.
      data-owner-seat={ownerSeat ?? undefined}
      onClick={clickable ? () => onSelect!(region.regionId) : undefined}
      onKeyDown={handleKeyDown}
    >
      <RegionOutline
        region={region}
        geometry={geometry}
        className="region-base-fill"
        fill="var(--unclaimed)"
        stroke="var(--ink-500)"
        strokeWidth={1}
        filter="url(#territory-grain)"
      />
      {ownerSeat !== null && (
        // Keyed by owner, not just region id: a claim (no prior owner) and a capture (owner
        // change) both force this group to remount, replaying the claim-wash animation - the
        // exact moment a silent fill-color swap used to happen with no feedback at all.
        <g key={`${region.regionId}-${ownerSeat}`} className="region-claim-wash">
          <RegionOutline region={region} geometry={geometry} fill={SEAT_COLORS[ownerSeat]} fillOpacity={0.34} />
          <RegionOutline
            region={region}
            geometry={geometry}
            fill={`url(#${hatchPatternIdFor(ownerSeat)})`}
            fillOpacity={0.22}
          />
          <RegionOutline region={region} geometry={geometry} fill="none" stroke="var(--ink-500)" strokeWidth={1} />
        </g>
      )}
      {/* A faint upper-left relief highlight/lower-right shade over every territory regardless of
          ownership - the difference between a flat vector wash and a piece of lit terrain. */}
      <RegionOutline region={region} geometry={geometry} fill="url(#territory-relief)" pointerEvents="none" />
      {eligible && (
        <RegionOutline
          region={region}
          geometry={geometry}
          fill="none"
          stroke="var(--gilt-500)"
          strokeWidth={2.5}
          strokeDasharray="7 5"
          className="marching-ants"
        />
      )}
      {contested && (
        <g
          transform={`translate(${markerX} ${markerY})`}
          className={escalated ? 'contested-marker contested-marker-escalated' : 'contested-marker'}
        >
          <circle
            r={escalated ? 16 : 13}
            fill="var(--paper-050)"
            fillOpacity={0.85}
            stroke="var(--danger)"
            strokeWidth={escalated ? 2 : 1.5}
          />
          <path
            d="M-6,-6 L6,6 M6,-6 L-6,6"
            stroke="var(--danger)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </g>
      )}
      <title>{label}</title>
    </g>
  )
}
