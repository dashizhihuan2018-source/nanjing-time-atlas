import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(here, '../scripts/fetch-geography.mjs');

test('buildSnapshot converts recognized OSM ways and modern place candidates', async () => {
  assert.ok(existsSync(scriptPath), 'generator script must exist');
  const { buildSnapshot } = await import(pathToFileURL(scriptPath));

  const featureElements = [
    {
      type: 'way',
      id: 101,
      tags: { name: '测试湖', natural: 'water' },
      geometry: [
        { lon: 118.7, lat: 32.0 },
        { lon: 118.8, lat: 32.0 },
        { lon: 118.8, lat: 32.1 },
        { lon: 118.7, lat: 32.0 },
      ],
    },
    {
      type: 'way',
      id: 102,
      tags: { name: '测试河', waterway: 'river' },
      geometry: [
        { lon: 118.7, lat: 32.0 },
        { lon: 118.9, lat: 32.1 },
      ],
    },
    {
      type: 'way',
      id: 103,
      tags: { name: '测试路', highway: 'primary' },
      geometry: [
        { lon: 118.75, lat: 32.01 },
        { lon: 118.76, lat: 32.02 },
      ],
    },
    {
      type: 'way',
      id: 999,
      tags: { natural: 'water' },
      geometry: [{ lon: 118.7, lat: 32.0 }],
    },
  ];
  const placeElements = [
    {
      type: 'node',
      id: 201,
      lon: 118.781,
      lat: 32.03,
      tags: { name: '测试门' },
    },
    {
      type: 'way',
      id: 202,
      center: { lon: 118.79, lat: 32.04 },
      tags: { name: '测试寺' },
    },
  ];

  const result = buildSnapshot({ featureElements, placeElements }, {
    retrievedAt: '2026-11-05T00:00:00.000Z',
    endpoint: 'https://overpass-api.de/api/interpreter',
  });

  assert.equal(result.type, 'FeatureCollection');
  assert.equal(result.features.length, 3, 'unnamed or unusable elements are excluded');
  assert.deepEqual(result.features[0].geometry, {
    type: 'Polygon',
    coordinates: [[[118.7, 32], [118.8, 32], [118.8, 32.1], [118.7, 32]]],
  });
  assert.deepEqual(result.features.map(({ properties }) => properties.kind), ['water', 'river', 'road']);
  assert.equal(result.features[1].properties.source, 'https://www.openstreetmap.org/way/102');
  assert.equal(result.metadata.license, 'ODbL 1.0');
  assert.equal(result.places.length, 2);
  assert.equal(result.places[0].source, 'https://www.openstreetmap.org/node/201');
  assert.match(result.places[0].note, /现代/);
  assert.deepEqual([result.places[1].lon, result.places[1].lat], [118.79, 32.04]);

  const targetOnly = buildSnapshot({ featureElements, placeElements }, {
    retrievedAt: '2026-11-05T00:00:00.000Z',
    endpoint: 'fixture',
    includeOtherPlaces: false,
    sourceTimestamps: 'features=2026-11-05T00:00:00Z; places=2026-06-01T00:00:00Z',
  });
  assert.equal(targetOnly.places.length, 0, 'CLI mode can suppress non-target candidates');
  assert.match(targetOnly.metadata.notes, /places=2026-06-01/);
});

test('selectPlaces derives a documented reference point from a matching named geometry', async () => {
  assert.ok(existsSync(scriptPath), 'generator script must exist');
  const { selectPlaces } = await import(pathToFileURL(scriptPath));
  const places = selectPlaces([
    {
      type: 'way',
      id: 318052307,
      tags: { name: '中华门城堡', leisure: 'park' },
      geometry: [
        { lon: 118.77, lat: 32.00 },
        { lon: 118.79, lat: 32.00 },
        { lon: 118.79, lat: 32.02 },
        { lon: 118.77, lat: 32.00 },
      ],
    },
    {
      type: 'way',
      id: 100944615,
      tags: { name: '水西门大街', highway: 'primary' },
      geometry: [
        { lon: 118.76, lat: 32.02 },
        { lon: 118.77, lat: 32.03 },
      ],
    },
  ]);

  assert.equal(places.length, 1, 'a same-name road is not promoted to a historic-gate candidate');
  assert.equal(places[0].id, 'zhonghuamen');
  assert.deepEqual(places[0].aliases, ['中华门', '聚宝门']);
  assert.deepEqual([places[0].lon, places[0].lat], [118.78, 32.01]);
  assert.match(places[0].note, /几何包围框中心/);
});

test('default public mirrors use currently listed Overpass endpoints', async () => {
  const { DEFAULT_ENDPOINTS } = await import(pathToFileURL(scriptPath));
  assert.ok(DEFAULT_ENDPOINTS.includes('https://overpass.private.coffee/api/interpreter'));
});

test('generic named enclosure walls are not classified as city walls', async () => {
  const { classifyTags } = await import(pathToFileURL(scriptPath));
  assert.equal(classifyTags({ name: '某变电站', barrier: 'wall' }), null);
  assert.equal(classifyTags({ name: '南京城墙', barrier: 'city_wall' }), 'wall');
  assert.equal(classifyTags({ name: '历史城墙', historic: 'citywalls' }), 'wall');
});

test('an exact-name subway station may be retained as an explicitly modern route reference', async () => {
  const { selectPlaces } = await import(pathToFileURL(scriptPath));
  const places = selectPlaces([{
    type: 'node',
    id: 13059514811,
    lon: 118.7993248,
    lat: 32.0277296,
    tags: {
      name: '通济门',
      public_transport: 'station',
      railway: 'station',
      station: 'subway',
    },
  }], { includeOtherPlaces: false });

  assert.equal(places[0].id, 'tongjimen');
  assert.match(places[0].note, /railway=station/);
  assert.match(places[0].note, /现代/);
});

test('multipolygon relations stitch outer and inner member ways into a real polygon', async () => {
  const { osmElementToFeature } = await import(pathToFileURL(scriptPath));
  assert.equal(typeof osmElementToFeature, 'function');
  const feature = osmElementToFeature({
    type: 'relation',
    id: 3406529,
    tags: { name: '测试湖', natural: 'water', type: 'multipolygon' },
    members: [
      { type: 'way', role: 'outer', geometry: [
        { lon: 118.70, lat: 32.00 }, { lon: 118.72, lat: 32.00 }, { lon: 118.72, lat: 32.02 },
      ] },
      { type: 'way', role: 'outer', geometry: [
        { lon: 118.72, lat: 32.02 }, { lon: 118.70, lat: 32.02 }, { lon: 118.70, lat: 32.00 },
      ] },
      { type: 'way', role: 'inner', geometry: [
        { lon: 118.705, lat: 32.005 }, { lon: 118.715, lat: 32.005 }, { lon: 118.715, lat: 32.015 },
      ] },
      { type: 'way', role: 'inner', geometry: [
        { lon: 118.715, lat: 32.015 }, { lon: 118.705, lat: 32.015 }, { lon: 118.705, lat: 32.005 },
      ] },
    ],
  });

  assert.equal(feature.geometry.type, 'Polygon');
  assert.equal(feature.geometry.coordinates.length, 2);
  assert.deepEqual(feature.geometry.coordinates[0][0], feature.geometry.coordinates[0].at(-1));
  assert.deepEqual(feature.geometry.coordinates[1][0], feature.geometry.coordinates[1].at(-1));
  assert.equal(feature.properties.kind, 'water');
  assert.equal(feature.properties.source, 'https://www.openstreetmap.org/relation/3406529');
});
