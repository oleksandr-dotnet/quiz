#!/usr/bin/env node
// Deterministic, dependency-free generator for Triviador's abstract map. Produces three outputs from
// one shared seeded vertex lattice, so they can never drift apart:
//   1. src/UI/Triviador.Web/Data/map.json - the server content MapRepository.cs parses (the 18
//      playable regions only - value/adjacency/names, no path).
//   2. src/Triviador.Client/src/components/map/abstractGeography.ts - the client's baked SVG path +
//      centroid per playable region, consumed by RegionShape.tsx/GameMap.tsx.
//   3. src/Triviador.Client/src/components/map/decorativeGeography.ts - client-only "terra incognita"
//      blobs ringing the playable landmass, purely decorative (no server-side counterpart at all -
//      the server's map contract is untouched by this file's existence).
//
// Topology: 18 playable regions in a 6x3 grid, 4-neighbour (rook) adjacency - trivially fully
// connected. Middle row worth 400, outer rows worth 200. Region names are invented (English +
// Russian), deliberately not real-world places - this is an abstract territory board, not a map of
// anywhere. Re-running this script against an unmodified tree must reproduce every committed output
// byte-for-byte, since the seed and every input here are fixed.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SEED = 20260801;
const COLS = 6; // regions per row
const ROWS = 3; // regions per column
const VIEW_W = 1200;
const VIEW_H = 640;
const PAD = 70;
const RADIUS_FACTOR = 0.82; // fallback-circle radius as a fraction of the half-min-cell-dimension

// Row-major, matching regionId(row, col) below. Invented fantasy names - no real-world country,
// city, or place is referenced by either list.
const NAMES_EN = [
  'Ironreach', 'Vale of Ash', 'Saltmarch', 'Thornhold', 'Greyfen', 'Duskmoor',
  'Highgarth', 'Stonewick', 'Fenmoor', 'Ashvale', 'Ravenhollow', 'Wolfmere',
  'Emberfall', 'Sunreach', 'Thistledown', 'Blackmere', 'Windhaven', 'Grimwood',
];

const NAMES_RU = [
  'Железный Предел', 'Пепельный Дол', 'Соляной Марш', 'Терновый Оплот', 'Серая Трясина', 'Сумеречная Пустошь',
  'Горний Чертог', 'Каменный Починок', 'Болотная Пустошь', 'Пепельная Лощина', 'Вороний Дол', 'Волчье Озеро',
  'Пламенный Обрыв', 'Солнечный Предел', 'Пуховый Дол', 'Чёрное Озеро', 'Ветреная Гавань', 'Мрачный Лес',
];

function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const jitter = (amplitude) => (rand() * 2 - 1) * amplitude;

const vertexCols = COLS + 1;
const vertexRows = ROWS + 1;
const cellW = (VIEW_W - 2 * PAD) / COLS;
const cellH = (VIEW_H - 2 * PAD) / ROWS;
const minCell = Math.min(cellW, cellH);

const vertexIndex = (row, col) => row * vertexCols + col;

// Interior vertices get a modest jitter; boundary vertices get a much larger one so the outer
// edge reads as a ragged coastline rather than a rectangle; the four extreme corners get only a
// small nudge so the landmass doesn't degenerate near the viewBox edges. Amplitudes are pushed
// further than a plain wavy-quad grid (0.16/0.30/0.08 previously) so individual territories read as
// irregular landmasses rather than gently-bowed rectangles - still comfortably below `minCell/2`,
// so no lattice cell can fold over itself.
const vertices = new Array(vertexCols * vertexRows);
for (let row = 0; row < vertexRows; row++) {
  for (let col = 0; col < vertexCols; col++) {
    const baseX = PAD + col * cellW;
    const baseY = PAD + row * cellH;
    const isCorner = (row === 0 || row === vertexRows - 1) && (col === 0 || col === vertexCols - 1);
    const isBoundary = row === 0 || row === vertexRows - 1 || col === 0 || col === vertexCols - 1;
    const amp = isCorner ? minCell * 0.09 : isBoundary ? minCell * 0.34 : minCell * 0.21;
    vertices[vertexIndex(row, col)] = {
      x: baseX + jitter(amp),
      y: baseY + jitter(amp),
    };
  }
}

// Each lattice edge is computed exactly once and shared by both adjoining regions (traversed in
// opposite directions), so territories meet with identical geometry - no seams or gutters. Unlike a
// single symmetric bow, each edge now carries an independently-jittered midpoint plus two half-bows
// (one per half), so a border reads as a small irregular headland/bay pair rather than one smooth
// arc - closer to a real coastline. Every value stored here is an absolute point in board space, not
// a direction-relative offset, which is what makes the whole thing reversal-symmetric for free: a
// neighbour drawing the same edge the other way round just calls bezierSegment with from/to swapped
// against the same cached mid/bow points and traces the identical curve (see bezierSegment's own
// comment).
const edgeCache = new Map();
function edgeBetween(iA, iB) {
  const key = iA < iB ? `${iA}:${iB}` : `${iB}:${iA}`;
  let edge = edgeCache.get(key);
  if (edge) {
    return edge;
  }

  const a = vertices[iA];
  const b = vertices[iB];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const midBaseX = (a.x + b.x) / 2;
  const midBaseY = (a.y + b.y) / 2;
  // The midpoint's own displacement (perpendicular + a touch of along-edge drift) is what turns two
  // independent half-bows into a visible headland rather than just a slightly-off-center single arc.
  const midDisplace = jitter(minCell * 0.11);
  const midDrift = jitter(minCell * 0.05);
  const mid = {
    x: midBaseX + nx * midDisplace + (dx / len) * midDrift,
    y: midBaseY + ny * midDisplace + (dy / len) * midDrift,
  };

  const bow1 = jitter(minCell * 0.1); // a -> mid
  const bow2 = jitter(minCell * 0.1); // mid -> b

  edge = { a, b, mid, bow1, bow2 };
  edgeCache.set(key, edge);
  return edge;
}

// Renders one half-edge as a cubic Bezier from fromPoint to toPoint, bowed toward controlBase offset
// perpendicular to the fromPoint->toPoint direction by `bow`. Direction-agnostic: called with the
// half reversed (to, from swapped) traces the same physical curve, which is what lets two regions -
// or a region and a decorative "terra incognita" blob across the coastline - share a border with no
// seam regardless of which side draws it forward.
function bowSegment(fromPoint, toPoint, bow) {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const midX = (fromPoint.x + toPoint.x) / 2 + nx * bow;
  const midY = (fromPoint.y + toPoint.y) / 2 + ny * bow;
  const c1x = fromPoint.x + (midX - fromPoint.x) * (2 / 3);
  const c1y = fromPoint.y + (midY - fromPoint.y) * (2 / 3);
  const c2x = toPoint.x + (midX - toPoint.x) * (2 / 3);
  const c2y = toPoint.y + (midY - toPoint.y) * (2 / 3);
  return `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${toPoint.x.toFixed(2)},${toPoint.y.toFixed(2)}`;
}

// Two-segment edge (see edgeBetween's doc comment): traces fromVertex -> edge.mid -> toVertex,
// choosing which cached half-bow belongs to which half based on which direction is actually being
// walked - `bow1` always belongs to the `edge.a` side and `bow2` to the `edge.b` side, so reversing
// the walk direction reverses which bow comes first, exactly mirroring the two-segment curve back
// on itself rather than drawing a different shape.
function bezierSegment(fromVertex, edge, toVertex) {
  const forward = fromVertex === edge.a;
  // bowSegment(X, Y, +b) and bowSegment(Y, X, -b) trace the identical absolute curve (bowSegment's
  // perpendicular flips sign when the direction flips, so negating `bow` cancels that flip) - so the
  // reversed walk isn't just "same two bows in the other order", each bow's sign must flip too, or
  // the two regions sharing this edge draw physically different curves for what's supposed to be
  // one shared border.
  const firstBow = forward ? edge.bow1 : -edge.bow2;
  const secondBow = forward ? edge.bow2 : -edge.bow1;
  return `${bowSegment(fromVertex, edge.mid, firstBow)} ${bowSegment(edge.mid, toVertex, secondBow)}`;
}

// True area-weighted polygon centroid (shoelace formula) of a closed vertex loop - more accurate
// than the plain vertex mean for placing labels/wax-seals visually centered on an irregular blob.
function polygonCentroid(poly) {
  let areaAcc = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % poly.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    areaAcc += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  const area = areaAcc / 2;
  if (Math.abs(area) < 1e-9) {
    // Degenerate polygon (shouldn't happen for a jittered quad) - fall back to the plain mean.
    const mean = poly.reduce((acc, p) => ({ x: acc.x + p.x / poly.length, y: acc.y + p.y / poly.length }), { x: 0, y: 0 });
    return mean;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

const round2 = (n) => Math.round(n * 100) / 100;
const regionId = (row, col) => `r${String(row * COLS + col + 1).padStart(2, '0')}`;
const valueForRow = (row) => (row === 1 ? 400 : 200); // middle row is 400, outer rows are 200
const radius = Math.round((minCell / 2) * RADIUS_FACTOR);

const mapRegions = [];
const geometryEntries = [];
let ordinal = 0;
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const tl = vertexIndex(row, col);
    const tr = vertexIndex(row, col + 1);
    const br = vertexIndex(row + 1, col + 1);
    const bl = vertexIndex(row + 1, col);
    const [vTl, vTr, vBr, vBl] = [vertices[tl], vertices[tr], vertices[br], vertices[bl]];

    const topEdge = edgeBetween(tl, tr);
    const rightEdge = edgeBetween(tr, br);
    const bottomEdge = edgeBetween(br, bl);
    const leftEdge = edgeBetween(bl, tl);

    const path = [
      `M${vTl.x.toFixed(2)},${vTl.y.toFixed(2)}`,
      bezierSegment(vTl, topEdge, vTr),
      bezierSegment(vTr, rightEdge, vBr),
      bezierSegment(vBr, bottomEdge, vBl),
      bezierSegment(vBl, leftEdge, vTl),
      'Z',
    ].join(' ');

    const adjacentTo = [];
    if (row > 0) adjacentTo.push(regionId(row - 1, col));
    if (col > 0) adjacentTo.push(regionId(row, col - 1));
    if (col < COLS - 1) adjacentTo.push(regionId(row, col + 1));
    if (row < ROWS - 1) adjacentTo.push(regionId(row + 1, col));

    const id = regionId(row, col);
    const centerX = round2((vTl.x + vTr.x + vBr.x + vBl.x) / 4);
    const centerY = round2((vTl.y + vTr.y + vBr.y + vBl.y) / 4);
    const centroid = polygonCentroid([vTl, vTr, vBr, vBl]);

    mapRegions.push({
      id,
      nameEn: NAMES_EN[ordinal],
      nameRu: NAMES_RU[ordinal],
      value: valueForRow(row),
      centerX,
      centerY,
      radius,
      labelX: centerX,
      labelY: centerY,
      adjacentTo,
    });

    geometryEntries.push({ id, path, centroidX: round2(centroid.x), centroidY: round2(centroid.y) });
    ordinal++;
  }
}

// ---------------------------------------------------------------------------------------------
// Decorative "terra incognita" ring: client-only flavour territories that touch the playable
// landmass's outer coastline but carry no game data (no id used by the server, no value, no
// adjacency) - they exist purely so the map reads as one continuous continent instead of an island
// of 18 territories floating in blank sea. Built from the exact same boundary vertices/edges as the
// playable regions' own outer edge, so the seam between "real" and "decorative" land is pixel-exact
// with no gap or overlap.
const perimeter = [];
for (let col = 0; col < vertexCols; col++) perimeter.push(vertexIndex(0, col));
for (let row = 1; row < vertexRows; row++) perimeter.push(vertexIndex(row, vertexCols - 1));
for (let col = vertexCols - 2; col >= 0; col--) perimeter.push(vertexIndex(vertexRows - 1, col));
for (let row = vertexRows - 2; row >= 1; row--) perimeter.push(vertexIndex(row, 0));
// Walking top (L->R), right (T->B), bottom (R->L), left (B->T) in that order traces the landmass
// clockwise - deliberately the same direction each boundary region already draws its own outer edge
// in (topEdge tl->tr, rightEdge tr->br, bottomEdge br->bl, leftEdge bl->tl), so reusing edgeBetween
// for a perimeter step below always matches direction with zero extra bookkeeping.

const landCentroid = vertices.reduce(
  (acc, v) => ({ x: acc.x + v.x / vertices.length, y: acc.y + v.y / vertices.length }),
  { x: 0, y: 0 },
);

// Kept deliberately modest (a coastal fringe, not a second continent) - GameMap.tsx renders these
// against a viewBox only padded by DECORATIVE_MARGIN beyond the playable grid's own 0..1200x0..640,
// so anything extruded much further than that would simply be clipped off-canvas.
const outerPoints = perimeter.map((vi) => {
  const v = vertices[vi];
  const dx = v.x - landCentroid.x;
  const dy = v.y - landCentroid.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const dist = minCell * (0.42 + rand() * 0.5);
  return { x: v.x + nx * dist + jitter(minCell * 0.12), y: v.y + ny * dist + jitter(minCell * 0.12) };
});

const n = perimeter.length;

// Radial seam (inner boundary vertex -> its outer coastline point): shared between two adjacent
// decorative territories whenever a group boundary falls here, so it's cached exactly once too.
const radialBowCache = new Map();
function radialBow(i) {
  if (!radialBowCache.has(i)) radialBowCache.set(i, jitter(minCell * 0.08));
  return radialBowCache.get(i);
}

// Outer coastline segment between outerPoints[i] and outerPoints[(i+1)%n] - a bigger, rougher bow
// than the playable landmass's own edges get, since this is meant to read as a wilder, unmapped
// fringe.
const outerBowCache = new Map();
function outerBow(i) {
  if (!outerBowCache.has(i)) outerBowCache.set(i, jitter(minCell * 0.15));
  return outerBowCache.get(i);
}

// Groups 1-3 consecutive boundary wedges into one decorative territory, so the ring reads as a
// handful of irregularly-sized landmasses rather than a uniform picket fence of identical wedges.
const groups = [];
for (let i = 0; i < n; ) {
  const size = Math.min(1 + Math.floor(rand() * 3), n - i);
  groups.push({ start: i, size });
  i += size;
}
// A trailing group of size 1 immediately before wrapping back to group 0 reads as an obviously
// leftover sliver - fold it into the previous group instead (still >= 1 group total since n=18).
if (groups.length > 2 && groups[groups.length - 1].size === 1) {
  const last = groups.pop();
  groups[groups.length - 1].size += last.size;
}

const TERRAIN_KINDS = ['forest', 'hill', 'marsh'];

const decorativeEntries = groups.map((g, groupIndex) => {
  const idxs = [];
  for (let k = 0; k <= g.size; k++) idxs.push((g.start + k) % n);

  const pathParts = [];
  const firstInner = vertices[perimeter[idxs[0]]];
  pathParts.push(`M${firstInner.x.toFixed(2)},${firstInner.y.toFixed(2)}`);

  // Inner boundary, forward: reuses the exact cached edge (and both its half-bows) that the
  // bordering playable region already drew for this stretch of coastline.
  for (let k = 0; k < idxs.length - 1; k++) {
    const fromV = vertices[perimeter[idxs[k]]];
    const toV = vertices[perimeter[idxs[k + 1]]];
    const edge = edgeBetween(perimeter[idxs[k]], perimeter[idxs[k + 1]]);
    pathParts.push(bezierSegment(fromV, edge, toV));
  }

  // Radial seam out to the coastline at the group's far end.
  const endIdx = idxs[idxs.length - 1];
  pathParts.push(bowSegment(vertices[perimeter[endIdx]], outerPoints[endIdx], radialBow(endIdx)));

  // Outer coastline, backward.
  for (let k = idxs.length - 1; k > 0; k--) {
    const from = idxs[k];
    const to = idxs[k - 1];
    pathParts.push(bowSegment(outerPoints[from], outerPoints[to], -outerBow(to)));
  }

  // Radial seam back in to the group's near end.
  const startIdx = idxs[0];
  pathParts.push(bowSegment(outerPoints[startIdx], vertices[perimeter[startIdx]], -radialBow(startIdx)));
  pathParts.push('Z');

  const ring = idxs.map((i) => vertices[perimeter[i]]).concat(idxs.slice().reverse().map((i) => outerPoints[i]));
  const centroid = polygonCentroid(ring);

  return {
    id: `d${String(groupIndex + 1).padStart(2, '0')}`,
    path: pathParts.join(' '),
    centroidX: round2(centroid.x),
    centroidY: round2(centroid.y),
    terrain: TERRAIN_KINDS[groupIndex % TERRAIN_KINDS.length],
  };
});

// How far the decorative ring's own outer coastline (plus its bow curves, which can bulge a little
// past the straight-line extent of outerPoints) reaches beyond the playable grid's 0..VIEW_W/
// 0..VIEW_H box - GameMap.tsx pads its rendered viewBox by this on every side so the ring is never
// clipped, without hand-guessing a margin that could go stale the next time amplitudes here change.
const outerReach = Math.max(
  0,
  ...outerPoints.map((p) => -p.x),
  ...outerPoints.map((p) => p.x - VIEW_W),
  ...outerPoints.map((p) => -p.y),
  ...outerPoints.map((p) => p.y - VIEW_H),
);
const decorativeMargin = Math.ceil((outerReach + minCell * 0.3) / 10) * 10;

const mapOutput = {
  id: 'abstract-18',
  viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
  regions: mapRegions,
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mapJsonPath = resolve(scriptDir, '../../src/UI/Triviador.Web/Data/map.json');
const geometryTsPath = resolve(scriptDir, '../../src/Triviador.Client/src/components/map/abstractGeography.ts');
const decorativeTsPath = resolve(scriptDir, '../../src/Triviador.Client/src/components/map/decorativeGeography.ts');

writeFileSync(mapJsonPath, JSON.stringify(mapOutput, null, 2) + '\n', 'utf8');

const geometryLines = geometryEntries
  .map((entry) => `  ${entry.id}: { path: "${entry.path}", centroidX: ${entry.centroidX}, centroidY: ${entry.centroidY} },`)
  .join('\n');

const geometryOutput = `// GENERATED FILE - do not hand-edit.
// Produced by tools/mapgen/generate-map.mjs (deterministic, seed ${SEED}, no npm dependencies).
// Re-run that script if src/UI/Triviador.Web/Data/map.json's region set changes.

export interface RegionGeometry {
  path: string
  centroidX: number
  centroidY: number
}

export const REGION_GEOMETRY: Record<string, RegionGeometry> = {
${geometryLines}
}
`;

writeFileSync(geometryTsPath, geometryOutput, 'utf8');

const decorativeLines = decorativeEntries
  .map(
    (entry) =>
      `  { id: "${entry.id}", path: "${entry.path}", centroidX: ${entry.centroidX}, centroidY: ${entry.centroidY}, terrain: "${entry.terrain}" },`,
  )
  .join('\n');

const decorativeOutput = `// GENERATED FILE - do not hand-edit.
// Produced by tools/mapgen/generate-map.mjs (deterministic, seed ${SEED}, no npm dependencies).
// Client-only flavour geometry - never sent by, or known to, the server. These "terra incognita"
// blobs ring the 18 playable regions so the board reads as one continuous continent rather than an
// island of territories floating in blank sea; they carry no adjacency/value and are never
// clickable. Re-run the generator if the playable grid's shape changes (its outer boundary is what
// this ring seams against).

export type DecorativeTerrain = 'forest' | 'hill' | 'marsh'

export interface DecorativeGeometry {
  id: string
  path: string
  centroidX: number
  centroidY: number
  terrain: DecorativeTerrain
}

// How far this ring's geometry reaches past the playable grid's own 0..1200/0..640 box - GameMap.tsx
// pads its rendered SVG viewBox by this amount on every side so the ring is never clipped.
export const DECORATIVE_MARGIN = ${decorativeMargin}

export const DECORATIVE_TERRITORIES: DecorativeGeometry[] = [
${decorativeLines}
]
`;

writeFileSync(decorativeTsPath, decorativeOutput, 'utf8');

console.log(`Wrote ${mapRegions.length} regions to ${mapJsonPath}`);
console.log(`Wrote ${geometryEntries.length} geometries to ${geometryTsPath}`);
console.log(`Wrote ${decorativeEntries.length} decorative territories to ${decorativeTsPath}`);
