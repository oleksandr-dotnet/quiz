#!/usr/bin/env node
// Deterministic, dependency-free generator for Triviador's abstract map. Produces two outputs from
// one shared seeded vertex lattice, so they can never drift apart:
//   1. src/UI/Triviador.Web/Data/map.json - the server content MapRepository.cs parses.
//   2. src/Triviador.Client/src/components/map/abstractGeography.ts - the client's baked SVG path +
//      centroid per region, consumed by RegionShape.tsx/GameMap.tsx.
//
// Topology: 18 regions in a 6x3 grid, 4-neighbour (rook) adjacency - trivially fully connected.
// Middle row worth 400, outer rows worth 200. Region names are invented (English + Russian),
// deliberately not real-world places - this is an abstract territory board, not a map of anywhere.
// Re-running this script against an unmodified tree must reproduce both committed outputs
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
// small nudge so the landmass doesn't degenerate near the viewBox edges.
const vertices = new Array(vertexCols * vertexRows);
for (let row = 0; row < vertexRows; row++) {
  for (let col = 0; col < vertexCols; col++) {
    const baseX = PAD + col * cellW;
    const baseY = PAD + row * cellH;
    const isCorner = (row === 0 || row === vertexRows - 1) && (col === 0 || col === vertexCols - 1);
    const isBoundary = row === 0 || row === vertexRows - 1 || col === 0 || col === vertexCols - 1;
    const amp = isCorner ? minCell * 0.08 : isBoundary ? minCell * 0.3 : minCell * 0.16;
    vertices[vertexIndex(row, col)] = {
      x: baseX + jitter(amp),
      y: baseY + jitter(amp),
    };
  }
}

// Each lattice edge is computed exactly once and shared by both adjoining regions (traversed in
// opposite directions), so territories meet with identical geometry - no seams or gutters.
const edgeCache = new Map();
function edgeBetween(iA, iB) {
  const key = iA < iB ? `${iA}:${iB}` : `${iB}:${iA}`;
  let edge = edgeCache.get(key);
  if (edge) {
    return edge;
  }

  const a = vertices[iA];
  const b = vertices[iB];
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // A perpendicular bow gives every border a gentle natural curve instead of a straight line.
  const nx = -dy / len;
  const ny = dx / len;
  const bow = jitter(minCell * 0.12);

  edge = { controlX: midX + nx * bow, controlY: midY + ny * bow };
  edgeCache.set(key, edge);
  return edge;
}

// Renders one edge as a cubic Bezier from fromVertex to toVertex, in whichever direction the
// calling region is currently traversing its own quad. Each edge caches a single symmetric control
// point (not a direction-dependent pair), so a neighbouring region traversing the same edge the
// other way round computes c1/c2 with fromVertex and toVertex simply swapped - which is exactly
// what reversing a cubic Bezier requires. The two regions therefore always draw the identical
// curve with no seam, without needing to track which region "owns" an edge's direction.
function bezierSegment(fromVertex, edge, toVertex) {
  const c1x = fromVertex.x + (edge.controlX - fromVertex.x) * (2 / 3);
  const c1y = fromVertex.y + (edge.controlY - fromVertex.y) * (2 / 3);
  const c2x = toVertex.x + (edge.controlX - toVertex.x) * (2 / 3);
  const c2y = toVertex.y + (edge.controlY - toVertex.y) * (2 / 3);
  return `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${toVertex.x.toFixed(2)},${toVertex.y.toFixed(2)}`;
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

const mapOutput = {
  id: 'abstract-18',
  viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
  regions: mapRegions,
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mapJsonPath = resolve(scriptDir, '../../src/UI/Triviador.Web/Data/map.json');
const geometryTsPath = resolve(scriptDir, '../../src/Triviador.Client/src/components/map/abstractGeography.ts');

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

console.log(`Wrote ${mapRegions.length} regions to ${mapJsonPath}`);
console.log(`Wrote ${geometryEntries.length} geometries to ${geometryTsPath}`);
