// One-off generator: bakes real country outlines (from world-atlas / Natural Earth, public domain)
// into a static TS module keyed by this game's own RegionIds. Re-run only if Data/map.json's region
// set changes; d3-geo/topojson-client/world-atlas are devDependencies, never shipped at runtime.
//
// Usage: node scripts/generate-europe-paths.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import countries50m from 'world-atlas/countries-50m.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// RegionId -> ISO-3166-1 numeric id, read off Data/map.json's nameEn.
const REGION_TO_ISO_NUMERIC = {
  r01: '724', // Spain
  r03: '250', // France
  r04: '826', // United Kingdom
  r08: '276', // Germany
  r10: '380', // Italy
  r12: '616', // Poland
  r15: '752', // Sweden
  r16: '804', // Ukraine
}

const mapJsonPath = path.resolve(__dirname, '../../UI/Triviador.Web/Data/map.json')
const mapJson = JSON.parse(readFileSync(mapJsonPath, 'utf-8'))
const [, , viewBoxWidth, viewBoxHeight] = mapJson.viewBox.split(' ').map(Number)

const featureCollection = feature(countries50m, countries50m.objects.countries)
const isoToFeature = new Map(featureCollection.features.map((f) => [f.id, f]))

// Several countries (France, Netherlands, Denmark, ...) carry overseas territories/exclaves far
// outside Europe in this dataset (French Guiana, Reunion, ...). Left in, they blow out the fitted
// bounding box and squash mainland Europe into a corner. Drop any polygon ring whose centroid falls
// outside a generous continental-Europe longitude/latitude box before projecting.
const EUROPE_LON = [-25, 45]
const EUROPE_LAT = [34, 72]

function ringCentroid(ring) {
  let sumLon = 0
  let sumLat = 0
  for (const [lon, lat] of ring) {
    sumLon += lon
    sumLat += lat
  }
  return [sumLon / ring.length, sumLat / ring.length]
}

function isInEurope([lon, lat]) {
  return lon >= EUROPE_LON[0] && lon <= EUROPE_LON[1] && lat >= EUROPE_LAT[0] && lat <= EUROPE_LAT[1]
}

function clipToEurope(geometry) {
  if (geometry.type === 'Polygon') {
    return isInEurope(ringCentroid(geometry.coordinates[0])) ? geometry : null
  }
  if (geometry.type === 'MultiPolygon') {
    const kept = geometry.coordinates.filter((polygon) => isInEurope(ringCentroid(polygon[0])))
    return kept.length > 0 ? { type: 'MultiPolygon', coordinates: kept } : null
  }
  return geometry
}

const regionFeatures = []
for (const region of mapJson.regions) {
  const iso = REGION_TO_ISO_NUMERIC[region.id]
  const found = iso ? isoToFeature.get(iso) : null
  if (!found) {
    console.warn(`No geography match for region ${region.id} (${region.nameEn}) - skipping`)
    continue
  }
  const clippedGeometry = clipToEurope(found.geometry)
  if (!clippedGeometry) {
    console.warn(`${region.id} (${region.nameEn}) had no polygon within continental Europe - skipping`)
    continue
  }
  regionFeatures.push({ regionId: region.id, name: region.nameEn, feature: { ...found, geometry: clippedGeometry } })
}

// Padding keeps island/coastal edges (e.g. Ireland, Sweden) from touching the viewBox border.
const padding = 24
const projection = geoMercator().fitExtent(
  [
    [padding, padding],
    [viewBoxWidth - padding, viewBoxHeight - padding],
  ],
  { type: 'FeatureCollection', features: regionFeatures.map((r) => r.feature) },
)
const pathGenerator = geoPath(projection)

// A handful of small countries sit close enough together in real geography that their name+value
// label blocks overlap when anchored at the true centroid. Nudge just the marker point apart for
// those pairs - the filled shape itself always stays at its true geographic position, only the
// label/badge/wax-seal anchor moves.
const LABEL_NUDGES = {}

const entries = regionFeatures.map(({ regionId, name, feature: f }) => {
  const d = pathGenerator(f)
  const [rawCx, rawCy] = pathGenerator.centroid(f)
  const nudge = LABEL_NUDGES[regionId] ?? { dx: 0, dy: 0 }
  return { regionId, name, d, cx: rawCx + nudge.dx, cy: rawCy + nudge.dy }
})

const missing = mapJson.regions.filter((r) => !entries.some((e) => e.regionId === r.id))
if (missing.length > 0) {
  console.warn(
    `Warning: ${missing.length} region(s) have no generated geometry and will use the circle fallback: ${missing.map((r) => r.id).join(', ')}`,
  )
}

const banner = `// GENERATED FILE - do not hand-edit.
// Produced by scripts/generate-europe-paths.mjs from world-atlas (Natural Earth, public domain).
// Re-run that script if src/UI/Triviador.Web/Data/map.json's region set changes.
`

const body = `${banner}
export interface RegionGeometry {
  path: string
  centroidX: number
  centroidY: number
}

export const EUROPE_GEOGRAPHY: Record<string, RegionGeometry> = {
${entries
  .map(
    (e) =>
      `  ${e.regionId}: { path: ${JSON.stringify(e.d)}, centroidX: ${e.cx.toFixed(2)}, centroidY: ${e.cy.toFixed(2)} }, // ${e.name}`,
  )
  .join('\n')}
}
`

const outPath = path.resolve(__dirname, '../src/components/map/europeGeography.ts')
writeFileSync(outPath, body, 'utf-8')
console.log(`Wrote ${entries.length} region shapes to ${outPath}`)
