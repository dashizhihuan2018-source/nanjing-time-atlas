import test from 'node:test';
import assert from 'node:assert/strict';
import { chapters, conclusion, imperialTours, palaceCatalog, qixiaScenes } from '../src/exhibition.mjs';
import { places, routes } from '../src/history.mjs';

const placeIds = new Set(places.map(place => place.id));
const routeIds = new Set(routes.map(route => route.id));
const byId = Object.fromEntries(chapters.map(chapter => [chapter.id, chapter]));

// Independent printed-text baseline, pp. 54–55. Third tuple entry is the
// deliberately permitted location reference; null means no verified mapping.
const overnightBaseline = [
  ['kangxi-1',1684,[['句容县长巷村',1,'jurong'],['江宁将军署',3,'general'],['燕子矶',1,'yanziji'],['仪真',1,null],['江都县邵伯镇',1,null]]],
  ['kangxi-2',1689,[['句容县城',1,null],['江宁织造府',5,'palace'],['上元县朱家嘴',1,null],['金山',1,null]]],
  ['kangxi-3',1699,[['句容县城',1,null],['江宁织造府',6,'palace'],['燕子矶',1,'yanziji'],['龙潭',1,null],['金山',1,null]]],
  ['kangxi-4',1703,[['京口',1,'zhenjiang'],['江宁织造府',2,'palace'],['金山',1,null]]],
  ['kangxi-5',1705,[['丹阳',1,null],['龙潭',1,null],['江宁织造府',5,'palace'],['龙潭',1,null],['金山',3,null]]],
  ['kangxi-6',1707,[['金山',1,null],['镇江',1,'zhenjiang'],['龙潭',2,null],['江宁织造府',5,'palace'],['燕子矶',1,'yanziji'],['龙潭',1,null],['丹徒镇',1,null]]],
  ['qianlong-1',1751,[['金山行宫',1,'jinshan'],['龙潭行宫',1,'longtan'],['江宁府行宫',4,'palace'],['龙潭行宫',1,'longtan'],['金山行宫',1,'jinshan']]],
  ['qianlong-2',1757,[['金山行宫',1,'jinshan'],['龙潭行宫',1,'longtan'],['栖霞行宫',2,'qixia'],['江宁府行宫',3,'palace'],['栖霞行宫',1,'qixia'],['金山行宫',1,'jinshan']]],
  ['qianlong-3',1762,[['金山行宫',1,'jinshan'],['龙潭行宫',1,'longtan'],['栖霞行宫',2,'qixia'],['江宁府行宫',3,'palace'],['栖霞行宫',1,'qixia'],['金山行宫',1,'jinshan']]],
  ['qianlong-4',1765,[['焦山行宫',1,null],['金山行宫',1,'jinshan'],['龙潭行宫',1,'longtan'],['栖霞行宫',2,'qixia'],['江宁府行宫',4,'palace'],['栖霞行宫',1,'qixia'],['金山行宫',1,'jinshan']]],
  ['qianlong-5',1780,[['金山行宫',1,'jinshan'],['龙潭行宫',1,'longtan'],['栖霞行宫',3,'qixia'],['江宁府行宫',2,'palace'],['龙潭行宫',1,'longtan'],['金山行宫',1,'jinshan']]],
  ['qianlong-6',1784,[['钱家港行宫',1,null],['栖霞行宫',2,'qixia'],['江宁府行宫',4,'palace'],['栖霞行宫',1,'qixia'],['龙潭行宫',1,'longtan'],['金山行宫',1,'jinshan']]],
];

test('six original reading chapters have stable, nonempty evidence structure', () => {
  assert.deepEqual(chapters.map(chapter => chapter.id), ['method', 'city', 'wars', 'tours', 'defense', 'landscape']);
  const ids = new Set();
  for (const chapter of chapters) {
    for (const key of ['title', 'kicker', 'summary']) assert.ok(chapter[key]?.length > 5, `${chapter.id}.${key}`);
    assert.ok(chapter.sections.length >= 4, chapter.id);
    assert.ok(chapter.pages.length > 0);
    for (const section of chapter.sections) {
      assert.ok(!ids.has(section.id), `duplicate ${section.id}`);
      ids.add(section.id);
      assert.ok(section.title && section.body.length >= 2, section.id);
      assert.ok(section.body.every(paragraph => typeof paragraph === 'string' && paragraph.length >= 25), section.id);
      assert.ok(['evidence', 'reconstruction', 'interpretation'].includes(section.kind), section.id);
      assert.ok(section.pages.every(page => Number.isInteger(page) && page >= 1 && page <= 115), section.id);
      assert.ok(section.pages.length && section.pages.every(page => chapter.pages.includes(page)), section.id);
      assert.ok(section.placeIds.every(id => placeIds.has(id)), section.id);
      if (section.routeId) assert.ok(routeIds.has(section.routeId), section.id);
      for (const item of section.items ?? []) {
        assert.ok(item.title && item.text?.length > 15, section.id);
        if (item.placeId) assert.ok(placeIds.has(item.placeId), section.id);
      }
      if (section.comparison) {
        const { columns, rows } = section.comparison;
        assert.ok(columns.length >= 2 && rows.length >= 2, section.id);
        assert.ok(rows.every(row => row.length === columns.length), section.id);
      }
    }
  }
  assert.ok(conclusion.contributions.length >= 2);
  assert.ok(conclusion.limitations.length >= 2);
  assert.ok(conclusion.nextSteps.length >= 2);
});

test('coverage moves beyond five route lines without invented waypoints', () => {
  for (const chapter of chapters) assert.ok(chapter.sections.some(section => !section.routeId), chapter.id);
  for (const [chapter, markers] of Object.entries({
    method: ['史料', '配准', '分期'],
    city: ['山水', '城门', '官署', '学校', '寺', '祠'],
    wars: ['四镇', '泗州', '郑军', '仪凤门', '神策门', '火力'],
    defense: ['核心', '郊营伏场', '江防', '门户', '缓冲', '西方'],
    landscape: ['四十八景', '八景', '三山两涧一轴', '白鹿泉', '夕佳楼', '御诗'],
  })) {
    const prose = JSON.stringify(byId[chapter]);
    for (const marker of markers) assert.ok(prose.includes(marker), `${chapter}: ${marker}`);
  }
});

test('twelve tour rows retain overnight sequence, not unchecked day-by-day itinerary', () => {
  const section = byId.tours.sections.find(section => section.id === 'tour-twelve');
  assert.deepEqual(section.comparison.columns, ['巡次', '年份', '驻跸过夜序列（含前后站）', '辨识要点']);
  assert.deepEqual(section.placeIds, [], 'mixed tour stops must not link to the Longtan palace');
  assert.deepEqual(section.comparison.rows, overnightBaseline.map(([id,year,stops],i) => [
    imperialTours[i].title, String(year), stops.map(([name,nights]) => `${name}${nights}晚`).join(' → '), imperialTours[i].summary,
  ]));
  assert.match(section.comparison.rows[4][3], /舟上/);
  assert.ok(!JSON.stringify(section).includes('公历逐日'));
});

test('21 place-level palace and day-seat catalogue is explicitly 3 + 18', () => {
  const section = byId.tours.sections.find(section => section.id === 'tour-palace-catalogue');
  assert.equal(section.items.length, 21);
  assert.equal(section.items.filter(item => item.kind === 'palace').length, 3);
  assert.equal(section.items.filter(item => item.kind === 'day-seat').length, 18);
  assert.deepEqual(section.items.map(item => item.title), [
    '江宁行宫','栖霞行宫','龙潭行宫','朝天宫','鸡鸣寺','清凉寺','小教场','报恩寺','雨花台',
    '灵谷寺','后湖','嘉善寺','北极阁','牛首山宏觉寺','祖堂山幽栖寺','慈应寺','栖霞山栖霞寺',
    '永济寺','燕子矶','宝华山慧居寺','汉府',
  ]);
  for (const name of ['灵谷寺','永济寺']) {
    const item = section.items.find(item => item.title === name);
    assert.ok(!Object.hasOwn(item, 'placeId'), `${name} has no verified facility location`);
  }
});

test('eight additions and ten Qixia scenes remain individual, named records', () => {
  const additions = byId.landscape.sections.find(section => section.id === 'landscape-eight').items;
  const scenes = byId.landscape.sections.find(section => section.id === 'landscape-ten').items;
  assert.equal(additions.length, 8);
  assert.equal(scenes.length, 10);
  assert.deepEqual(additions.map(item => item.title), [
    '珍珠泉涌','化龙丽地','来燕名堂','甘露佳亭','楼怀孙楚','木末风高','台想昭明','商飙别馆',
  ]);
  assert.deepEqual(scenes.map(item => item.title), [
    '栖霞山','玲峰池','紫峰阁','万松山房','天开岩','幽居庵','叠浪崖','德云庵','珍珠泉','彩虹明镜',
  ]);
  assert.ok(additions.some(item => /珍珠泉涌/.test(item.title) && /浪涌/.test(item.text)));
  assert.strictEqual(qixiaScenes, scenes);
  assert.strictEqual(palaceCatalog, byId.tours.sections.find(section => section.id === 'tour-palace-catalogue').items);
});

test('twelve selectable imperial tours use only mapped known places and no invented dates', () => {
  assert.equal(imperialTours.length, 12);
  assert.equal(new Set(imperialTours.map(tour => tour.id)).size, 12);
  assert.deepEqual(imperialTours.map(tour => [tour.id,tour.year]), overnightBaseline.map(([id,year]) => [id,year]));
  for (const [index,tour] of imperialTours.entries()) {
    assert.ok(tour.title && tour.summary.length > 20 && tour.pages.includes(54) && tour.pages.includes(55));
    assert.ok(['康熙','乾隆'].includes(tour.emperor));
    assert.deepEqual(tour.stops.map(stop => [stop.name,stop.overnights,stop.placeId ?? null]), overnightBaseline[index][2], tour.id);
    for (const stop of tour.stops) {
      if (stop.placeId) assert.ok(placeIds.has(stop.placeId));
      else assert.ok(!Object.hasOwn(stop, 'placeId'), `${tour.id}: unmapped ${stop.name}`);
      assert.ok(!('date' in stop) && !('coordinates' in stop));
    }
  }
  assert.ok(imperialTours[4].stops.filter(stop => stop.name === '龙潭').every(stop => stop.note.includes('舟上') && stop.note.includes('未入住')));
  assert.equal(imperialTours[11].stops[0].name, '钱家港行宫');
  assert.equal(imperialTours[11].stops[0].placeId, undefined);
});
