#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const CORE_BBOX = '31.97,118.68,32.21,119.06';
const PLACE_BBOX = '31.80,118.20,32.60,119.70';
export const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export const PLACE_TARGETS = [
  ['zhonghuamen', '中华门（聚宝门）', ['中华门', '聚宝门']],
  ['shuiximen', '水西门（三山门）', ['水西门', '三山门']],
  ['hanximen', '汉西门（石城门）', ['汉西门', '石城门']],
  ['yifengmen', '仪凤门', ['仪凤门']],
  ['shencemen', '神策门', ['神策门']],
  ['taipingmen', '太平门', ['太平门']],
  ['zhongshanmen', '中山门（朝阳门）', ['中山门', '朝阳门']],
  ['tongjimen', '通济门', ['通济门']],
  ['shizishan', '狮子山', ['狮子山']],
  ['mufushan', '幕府山', ['幕府山']],
  ['yanziji', '燕子矶', ['燕子矶']],
  ['xuanwuhu', '玄武湖（后湖）', ['玄武湖', '后湖']],
  ['mingxiaoling', '明孝陵', ['明孝陵']],
  ['presidential-palace', '总统府（两江总督署现代参照）', ['南京总统府', '总统府']],
  ['jiangning-weaving', '江宁织造博物馆（江宁行宫周边现代参照）', ['江宁织造博物馆']],
  ['jimingsi', '鸡鸣寺', ['鸡鸣寺']],
  ['qingliangsi', '清凉寺', ['清凉寺']],
  ['qixiasi', '栖霞寺', ['栖霞寺']],
  ['qixiashan', '栖霞山（行宫周边现代参照）', ['栖霞山']],
  ['longtan', '龙潭（区域参照）', ['龙潭街道', '龙潭']],
  ['baohuashan', '宝华山', ['宝华山']],
  ['jurong', '句容市', ['句容市', '句容']],
  ['zhenjiang', '镇江', ['镇江市', '镇江']],
  ['jinshansi', '金山寺', ['金山寺']],
  ['guazhou', '瓜洲', ['瓜洲镇', '瓜洲']],
  ['yangzhou', '扬州', ['扬州市', '扬州']],
].map(([id, name, aliases]) => ({ id, name, aliases }));

export function featureQuery() {
  return `[out:json][timeout:180];
(
  way["name"]["natural"="water"](${CORE_BBOX});
  way["name"]["water"](${CORE_BBOX});
  way["name"]["landuse"="reservoir"](${CORE_BBOX});
  way["name"]["waterway"~"^(river|canal|stream)$"](${CORE_BBOX});
  way["name"]["leisure"~"^(park|nature_reserve|garden)$"](${CORE_BBOX});
  way["name"]["landuse"="forest"](${CORE_BBOX});
  way["name"]["natural"="wood"](${CORE_BBOX});
  way["name"]["barrier"~"^(city_wall|wall)$"](${CORE_BBOX});
  way["name"]["historic"~"^(citywalls|city_wall)$"](${CORE_BBOX});
  way["name"]["highway"~"^(trunk|primary|secondary)$"](${CORE_BBOX});
);
out tags geom;`;
}

export function placeQuery() {
  const names = [...new Set(PLACE_TARGETS.flatMap(({ aliases }) => aliases))]
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return `[out:json][timeout:180];
nwr["name"~"^(${names})$"](${PLACE_BBOX});
out tags center;`;
}

export function classifyTags(tags = {}) {
  if (tags.waterway && /^(river|canal|stream)$/.test(tags.waterway)) return 'river';
  if (tags.natural === 'water' || tags.water || tags.landuse === 'reservoir') return 'water';
  if (
    /^(park|nature_reserve|garden)$/.test(tags.leisure ?? '')
    || tags.landuse === 'forest'
    || tags.natural === 'wood'
  ) return 'park';
  if (tags.barrier === 'city_wall' || /^(citywalls|city_wall)$/.test(tags.historic ?? '')) return 'wall';
  if (/^(trunk|primary|secondary)$/.test(tags.highway ?? '')) return 'road';
  return null;
}

function coordinatesOf(geometry) {
  return geometry
    ?.filter(({ lon, lat }) => Number.isFinite(lon) && Number.isFinite(lat))
    .map(({ lon, lat }) => [lon, lat]) ?? [];
}

function samePosition(a, b) {
  return a?.[0] === b?.[0] && a?.[1] === b?.[1];
}

export function wayToFeature(element) {
  if (element?.type !== 'way' || !element.tags?.name) return null;
  const kind = classifyTags(element.tags);
  const coordinates = coordinatesOf(element.geometry);
  if (!kind || coordinates.length < 2) return null;
  const polygon = (kind === 'water' || kind === 'park')
    && coordinates.length >= 4
    && samePosition(coordinates[0], coordinates.at(-1));
  return {
    type: 'Feature',
    properties: {
      kind,
      name: element.tags.name,
      osmType: element.type,
      osmId: element.id,
      source: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    },
    geometry: polygon
      ? { type: 'Polygon', coordinates: [coordinates] }
      : { type: 'LineString', coordinates },
  };
}

function stitchRings(memberWays) {
  const pending = memberWays
    .map(({ geometry }) => coordinatesOf(geometry))
    .filter((coordinates) => coordinates.length >= 2);
  const rings = [];
  while (pending.length) {
    let ring = pending.shift();
    let joined = true;
    while (!samePosition(ring[0], ring.at(-1)) && joined) {
      joined = false;
      for (let index = 0; index < pending.length; index += 1) {
        const segment = pending[index];
        if (samePosition(ring.at(-1), segment[0])) {
          ring = [...ring, ...segment.slice(1)];
        } else if (samePosition(ring.at(-1), segment.at(-1))) {
          ring = [...ring, ...segment.toReversed().slice(1)];
        } else if (samePosition(ring[0], segment.at(-1))) {
          ring = [...segment.slice(0, -1), ...ring];
        } else if (samePosition(ring[0], segment[0])) {
          ring = [...segment.toReversed().slice(0, -1), ...ring];
        } else {
          continue;
        }
        pending.splice(index, 1);
        joined = true;
        break;
      }
    }
    if (ring.length >= 4 && samePosition(ring[0], ring.at(-1))) rings.push(ring);
  }
  return rings;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function relationToFeature(element) {
  if (element?.type !== 'relation' || element.tags?.type !== 'multipolygon' || !element.tags?.name) return null;
  const kind = classifyTags(element.tags);
  if (!kind || (kind !== 'water' && kind !== 'park')) return null;
  const outerRings = stitchRings(element.members?.filter(({ type, role }) => type === 'way' && (role === 'outer' || role === '')) ?? []);
  if (!outerRings.length) return null;
  const innerRings = stitchRings(element.members?.filter(({ type, role }) => type === 'way' && role === 'inner') ?? []);
  const polygons = outerRings.map((outer) => [
    outer,
    ...innerRings.filter((inner) => pointInRing(inner[0], outer)),
  ]);
  return {
    type: 'Feature',
    properties: {
      kind,
      name: element.tags.name,
      osmType: element.type,
      osmId: element.id,
      source: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    },
    geometry: polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons },
  };
}

export function osmElementToFeature(element) {
  if (element?.type === 'way') return wayToFeature(element);
  if (element?.type === 'relation') return relationToFeature(element);
  return null;
}

function locationOf(element) {
  const location = element?.type === 'node' ? element : element?.center;
  if (Number.isFinite(location?.lon) && Number.isFinite(location?.lat)) {
    return { lon: location.lon, lat: location.lat, derivedFromGeometry: false };
  }
  const coordinates = coordinatesOf(element?.geometry);
  if (!coordinates.length) return null;
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  const round = (value) => Number(value.toFixed(7));
  return {
    lon: round((Math.min(...lons) + Math.max(...lons)) / 2),
    lat: round((Math.min(...lats) + Math.max(...lats)) / 2),
    derivedFromGeometry: true,
  };
}

function candidateScore(element) {
  const tags = element.tags ?? {};
  let score = element.type === 'node' ? 20 : 0;
  if (tags.place || tags.historic || tags.tourism || tags.amenity || tags.natural) score += 100;
  if (tags.boundary === 'administrative') score += 40;
  if (tags.highway || tags.railway || tags.public_transport) score -= 80;
  if (tags.railway === 'station' || tags.public_transport === 'station') score += 100;
  return score;
}

function placeNote(element, location = locationOf(element)) {
  const tagSummary = ['place', 'historic', 'tourism', 'amenity', 'natural', 'boundary', 'railway', 'public_transport', 'station']
    .filter((key) => element.tags?.[key])
    .map((key) => `${key}=${element.tags[key]}`)
    .join('，');
  const suffix = tagSummary ? `OSM 标签：${tagSummary}。` : '';
  const positionNote = location?.derivedFromGeometry
    ? '坐标由该 OSM 对象几何包围框中心机械计算。'
    : '坐标为 OSM 节点或 Overpass center。';
  return `OSM 现代同名对象或区域中心，仅作现代定位参照，不据此认定历史遗址精确坐标。${positionNote}${suffix}`;
}

export function selectPlaces(elements, { includeOtherPlaces = true } = {}) {
  const used = new Set();
  const suffixes = ['', '公园', '城堡', '遗迹'];
  const matchesTarget = (element, target) => {
    if (element.tags?.highway) return false;
    return target.aliases.some((alias) => suffixes.some((suffix) => element.tags?.name === `${alias}${suffix}`));
  };
  const targetPlaces = PLACE_TARGETS.flatMap((target) => {
    const candidates = elements
      .filter((element) => matchesTarget(element, target) && locationOf(element))
      .sort((a, b) => candidateScore(b) - candidateScore(a) || a.id - b.id);
    const selected = candidates[0];
    if (!selected) return [];
    used.add(`${selected.type}/${selected.id}`);
    const location = locationOf(selected);
    const { lon, lat } = location;
    return [{
      id: target.id,
      name: target.name,
      aliases: target.aliases,
      lon,
      lat,
      source: `https://www.openstreetmap.org/${selected.type}/${selected.id}`,
      note: placeNote(selected, location),
    }];
  });
  const knownAliases = new Set(PLACE_TARGETS.flatMap(({ aliases }) => aliases));
  const otherPlaces = elements.flatMap((element) => {
    const infrastructure = element.tags?.highway || element.tags?.railway || element.tags?.public_transport;
    if (infrastructure || !element.tags?.name || knownAliases.has(element.tags.name) || used.has(`${element.type}/${element.id}`)) return [];
    const location = locationOf(element);
    if (!location) return [];
    const { lon, lat } = location;
    return [{
      id: `osm-${element.type}-${element.id}`,
      name: element.tags.name,
      aliases: [element.tags.name],
      lon,
      lat,
      source: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      note: placeNote(element, location),
    }];
  });
  return includeOtherPlaces ? [...targetPlaces, ...otherPlaces] : targetPlaces;
}

export function buildSnapshot({ featureElements = [], placeElements = [] }, options = {}) {
  const seen = new Set();
  const features = featureElements.flatMap((element) => {
    const key = `${element.type}/${element.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const feature = osmElementToFeature(element);
    return feature ? [feature] : [];
  });
  return {
    type: 'FeatureCollection',
    metadata: {
      retrievedAt: options.retrievedAt ?? new Date().toISOString(),
      source: `OpenStreetMap via Overpass API (${options.endpoint ?? 'endpoint recorded at retrieval'})`,
      license: 'ODbL 1.0',
      notes: `现代 OSM 地理参照，不是明清地形或历史遗址的精准复原；要素经筛选但未做坐标推测。${options.sourceTimestamps ? ` OSM 数据基准：${options.sourceTimestamps}。` : ''}`,
    },
    places: selectPlaces(placeElements, { includeOtherPlaces: options.includeOtherPlaces ?? true }),
    features,
  };
}

async function fetchOverpass(query, endpoints) {
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'NanjingHistoricalAtlas/1.0 (local offline research snapshot)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { endpoint, data: await response.json() };
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(`All Overpass endpoints failed:\n${errors.join('\n')}`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--output') options.output = argv[++index];
    else if (key === '--raw-dir') options.rawDir = argv[++index];
    else if (key === '--endpoint') options.endpoint = argv[++index];
    else if (key === '--from-raw') options.fromRaw = true;
    else throw new Error(`Unknown argument: ${key}`);
  }
  return options;
}

async function main() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = parseArgs(process.argv.slice(2));
  const rawDir = resolve(projectRoot, args.rawDir ?? 'tmp/geography');
  const output = resolve(projectRoot, args.output ?? 'public/data/geography.json');
  await mkdir(rawDir, { recursive: true });
  await mkdir(dirname(output), { recursive: true });

  let featureData;
  let placeData;
  let endpoint = args.endpoint;
  if (args.fromRaw) {
    featureData = JSON.parse(await readFile(resolve(rawDir, 'features-overpass.json'), 'utf8'));
    placeData = JSON.parse(await readFile(resolve(rawDir, 'places-overpass.json'), 'utf8'));
    endpoint ??= 'recorded in raw retrieval; replayed locally';
  } else {
    const endpoints = args.endpoint ? [args.endpoint] : DEFAULT_ENDPOINTS;
    const featuresResult = await fetchOverpass(featureQuery(), endpoints);
    const placesResult = await fetchOverpass(placeQuery(), [featuresResult.endpoint, ...endpoints.filter((item) => item !== featuresResult.endpoint)]);
    endpoint = `${featuresResult.endpoint}; ${placesResult.endpoint}`;
    featureData = featuresResult.data;
    placeData = placesResult.data;
    await writeFile(resolve(rawDir, 'features-overpass.json'), `${JSON.stringify(featureData)}\n`);
    await writeFile(resolve(rawDir, 'places-overpass.json'), `${JSON.stringify(placeData)}\n`);
    await writeFile(resolve(rawDir, 'queries.overpassql'), `${featureQuery()}\n\n${placeQuery()}\n`);
  }

  const snapshot = buildSnapshot({
    featureElements: featureData.elements,
    placeElements: [...placeData.elements, ...featureData.elements],
  }, {
    retrievedAt: new Date().toISOString(),
    endpoint,
    includeOtherPlaces: false,
    sourceTimestamps: `features=${featureData.osm3s?.timestamp_osm_base ?? 'unknown'}; places=${placeData.osm3s?.timestamp_osm_base ?? 'unknown'}`,
  });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(`Wrote ${snapshot.features.length} features and ${snapshot.places.length} places to ${output}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
