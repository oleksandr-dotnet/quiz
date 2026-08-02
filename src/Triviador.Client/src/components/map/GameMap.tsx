import { useTranslation } from 'react-i18next'
import type { GameView, RegionView } from '../../api/contracts'
import { findPlayer, playerDisplayName } from '../../lib/format'
import { seatIndexFor } from '../../lib/seats'
import { REGION_GEOMETRY } from './abstractGeography'
import { HeraldicDefs } from './HeraldicDefs'
import { RegionShape } from './RegionShape'
import { ValueBadge } from './ValueBadge'
import { WaxSeal } from './WaxSeal'

export interface GameMapProps {
  view: GameView
  eligibleRegionIds?: readonly string[]
  contestedRegionId?: string | null
  interactive: boolean
  onSelect?: (regionId: string) => void
}

// The abstract shape's visual centroid rarely matches the old hand-picked circle center, so
// markers/labels/connectors anchor on it instead - falling back to the server's labelX/labelY only
// for a region the static geometry dataset doesn't cover.
function markerPosition(region: RegionView) {
  const geometry = REGION_GEOMETRY[region.regionId]
  return geometry
    ? { x: geometry.centroidX, y: geometry.centroidY }
    : { x: region.labelX, y: region.labelY }
}

export function GameMap({ view, eligibleRegionIds, contestedRegionId, interactive, onSelect }: GameMapProps) {
  const { t } = useTranslation()
  const eligible = new Set(eligibleRegionIds ?? [])
  const byId = new Map(view.regions.map((region) => [region.regionId, region]))
  // A duel or an assault on someone else's base - never the calm self-heal case, where attacker
  // and defender are the same player and nothing is actually at risk.
  const isRealFight = view.battle !== null && view.battle.attackerPlayerId !== view.battle.defenderPlayerId
  const ownBaseUnderAssault =
    isRealFight &&
    view.battle?.kind === 'BaseAssault' &&
    view.battle.defenderPlayerId === view.youPlayerId
  const connectors = view.regions.flatMap((region) =>
    region.adjacentTo
      .filter((neighborId) => region.regionId < neighborId)
      .map((neighborId) => {
        const neighbor = byId.get(neighborId)
        if (!neighbor) return null
        return { key: `${region.regionId}-${neighborId}`, from: markerPosition(region), to: markerPosition(neighbor) }
      })
      .filter((connector) => connector !== null),
  )

  return (
    <svg viewBox={view.mapViewBox} className="game-map" role="group" aria-label={t('map.ariaLabel')}>
      <HeraldicDefs />

      {/* Sea: sits behind the graph so the board reads as a territory map, not a blank void. */}
      <rect x={-40} y={-40} width={9999} height={9999} fill="var(--sea)" />

      {/* Adjacency connectors: one line per bordering pair, drawn beneath the region nodes. */}
      <g className="region-connectors">
        {connectors.map((connector) => (
          <line
            key={connector.key}
            x1={connector.from.x}
            y1={connector.from.y}
            x2={connector.to.x}
            y2={connector.to.y}
            stroke="var(--ink-500)"
            strokeWidth={2}
            strokeOpacity={0.45}
          />
        ))}
      </g>

      <g>
        {view.regions.map((region) => {
          const ownerSeat = seatIndexFor(view, region.ownerPlayerId)
          const ownerName = region.ownerPlayerId ? playerDisplayName(findPlayer(view, region.ownerPlayerId)) : null
          return (
            <RegionShape
              key={region.regionId}
              region={region}
              ownerSeat={ownerSeat}
              ownerName={ownerName}
              interactive={interactive}
              eligible={eligible.has(region.regionId)}
              contested={contestedRegionId === region.regionId}
              escalated={isRealFight && contestedRegionId === region.regionId}
              onSelect={onSelect}
            />
          )
        })}
      </g>

      <g pointerEvents="none" aria-hidden="true">
        {view.regions.map((region) => {
          const { x, y } = markerPosition(region)
          return (
            <g key={region.regionId}>
              <text
                x={x}
                y={y + 26}
                textAnchor="middle"
                className="region-name"
                fontSize={11}
                fill="var(--ink-700)"
                aria-hidden="true"
              >
                {region.name}
              </text>
              <ValueBadge x={x} y={y} value={region.isBase && region.ownerPlayerId ? 1000 : region.value} />
            </g>
          )
        })}
      </g>

      <g pointerEvents="none" aria-hidden="true">
        {view.regions
          .filter((region) => region.isBase && region.ownerPlayerId)
          .map((region) => {
            const owner = findPlayer(view, region.ownerPlayerId)
            const ownerSeat = seatIndexFor(view, region.ownerPlayerId)
            if (!owner || ownerSeat === null) return null
            const { x, y } = markerPosition(region)
            return (
              <WaxSeal
                key={region.regionId}
                x={x}
                y={y - 40}
                seat={ownerSeat}
                hitPoints={owner.baseHitPoints}
                monogram={playerDisplayName(owner).charAt(0).toUpperCase()}
                underAttack={ownBaseUnderAssault && region.regionId === view.battle?.contestedRegionId}
              />
            )
          })}
      </g>
    </svg>
  )
}
