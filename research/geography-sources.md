# 南京历史图志：现代地理参照来源与限制

## 初始快照（后续城墙增量见下文）

- 最终文件：`public/data/geography.json`
- 格式：GeoJSON `FeatureCollection`，含顶级 `metadata`、`places`、`features`
- 生成时间：2026-11-05 09:23（Asia/Shanghai；JSON 内为 `2026-11-05T01:23:07.521Z`）
- 文件大小：4,607,914 bytes
- SHA-256：`7776db53f1de0c773de74befae5a081cb08f92b065e596b01bdf082f75463a14`
- 几何：4,029 项、43,255 个坐标点；`water` 107、`river` 282、`park` 199、`wall` 11、`road` 3,430
- 几何类型：Polygon 306、LineString 3,723
- 地点锚点：22 条

这些数据是**现代 OpenStreetMap 参照**，不是明代、清代或战争时期地形的精确复原，也不能单凭现代同名对象确定古代遗址坐标。

## 数据来源与许可

1. 几何数据来自 [OpenStreetMap](https://www.openstreetmap.org/)，通过 [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) 主实例 `https://overpass-api.de/api/interpreter` 实际下载。
2. 地点候选来自 OSM，通过 Wiki 当前列出的 `https://overpass.private.coffee/api/interpreter` 精确名称查询取得。
3. 每个 feature 的 `properties.source`、每个 place 的 `source` 都直达 `https://www.openstreetmap.org/{type}/{id}`，可逐对象复核。
4. OpenStreetMap 数据依据 [ODbL 1.0](https://www.openstreetmap.org/copyright) 提供。展示或再分发时应标注 `© OpenStreetMap contributors`，并遵守 ODbL。
5. 几何响应的 OSM 数据基准为 `2026-11-05T00:56:28Z`；地点镜像响应的 OSM 数据基准为 `2026-06-01T08:52:28Z`。后者较旧，已同时写入 JSON 的 `metadata.notes`，不得称为 2026-11-05 同日最新地点库。

## 实际查询与范围

核心几何范围为 `S31.97, W118.68, N32.21, E119.06`。查询只取具名 way：

```overpass
[out:json][timeout:180];
(
  way["name"]["natural"="water"](31.97,118.68,32.21,119.06);
  way["name"]["water"](31.97,118.68,32.21,119.06);
  way["name"]["landuse"="reservoir"](31.97,118.68,32.21,119.06);
  way["name"]["waterway"~"^(river|canal|stream)$"](31.97,118.68,32.21,119.06);
  way["name"]["leisure"~"^(park|nature_reserve|garden)$"](31.97,118.68,32.21,119.06);
  way["name"]["landuse"="forest"](31.97,118.68,32.21,119.06);
  way["name"]["natural"="wood"](31.97,118.68,32.21,119.06);
  way["name"]["barrier"~"^(city_wall|wall)$"](31.97,118.68,32.21,119.06);
  way["name"]["historic"~"^(citywalls|city_wall)$"](31.97,118.68,32.21,119.06);
  way["name"]["highway"~"^(trunk|primary|secondary)$"](31.97,118.68,32.21,119.06);
);
out tags geom;
```

地点查询范围扩展至 `S31.80, W118.20, N32.60, E119.70`，对任务清单名称逐条使用 `nwr["name"="..."]` 等值查询并 `out tags center`，避免宽范围正则扫描。返回 68 个候选后按标签择优：历史门、陵墓、寺院、博物馆等 way 优先于普通同名 node；城市 `place=city/town` 优先；通济门仅命中现代地铁对象，保留 `railway=station` 节点并在 note 中明确它只是现代路线参照。

## 标准化规则

- 坐标顺序为 GeoJSON 标准 `[longitude, latitude]`。
- 闭合的水面和公园 way 输出 Polygon；河流、道路、城墙输出 LineString。
- `barrier=wall` 的变电站、厂区等一般围墙被排除；`wall` 仅保留 `barrier=city_wall` 或历史城墙标签。
- place 直接使用 OSM node 坐标或 Overpass `center`；若候选来自已有 way 几何，则机械计算几何包围框中心，并在 note 中逐条说明。
- 同名道路不会自动提升为历史城门候选；现代对象、重建门和区域中心均不被宣称为古址精确坐标。
- multipolygon 转换器已实现并测试 outer/inner 分段拼接、内环归属和 MultiPolygon；无法闭合的成员环会丢弃，不补画形状。

## 已覆盖地点

22 个现代锚点：中华门（聚宝门）、汉西门（石城门）、仪凤门、神策门、太平门、中山门（朝阳门）、通济门、幕府山、燕子矶、玄武湖（后湖）、明孝陵、总统府、江宁织造博物馆、栖霞寺、栖霞山、龙潭、宝华山、句容市、镇江、金山寺、瓜洲、扬州。

尚未取得足够 OSM 对象证据的任务清单地点没有猜坐标，包括水西门、清凉寺、鸡鸣寺、狮子山等。

## 水面关系核验与当前限制

- 已由轻量 relation 索引查询确认：玄武湖是 `relation/2138994`（`type=multipolygon, natural=water, water=lake`）；莫愁湖正确水面是 `relation/18231223`。同名 `relation/3406529` 是公交关系，已排除。
- 长江 `relation/9392345` 是跨流域 `type=waterway` 路线关系，不是可填充水面的 multipolygon，因此没有拿中心线伪装水面。
- 关系成员几何下载先后受阻：`api.openstreetmap.org` 与 `www.openstreetmap.org/api` 连接超时；NCHC 域名无法解析；公共 Overpass 镜像的宽查询出现 429、504 或 240 秒超时。为不虚构湖形，首版没有把玄武湖公园/莫愁湖公园边界改称湖泊水面，也没有把未完整下载的 relation 写入最终 JSON。
- 因此当前快照的 `water` 以具名 way 水体为主；玄武湖、莫愁湖的公园几何可提供现代区域轮廓，但湖泊主体仍是明确的待补项。宁镇扬州仅有地点锚点，没有完整区域底图；战争视图放大后出现空白是已知限制。
- 首版道路只覆盖南京核心 bbox；未下载宁镇扬州海量小路。后续应优先按已知 relation ID 获取两湖完整成员，并在南京 bbox 查询无名称限制的 `way/relation["water"="river"]`，然后运行现有拼接器。

## TDD 与验证

生成器严格按 RED → GREEN 开发，主要观察记录：

1. 生成器不存在时，测试以 `generator script must exist` 正确 RED；实现基础转换后 1/1 GREEN。
2. 几何派生地点与当前 Overpass 镜像测试先 2 项 RED；实现 aliases、包围框中心和镜像更新后 GREEN。
3. 非清单地点抑制开关先 RED，CLI 目标模式实现后 GREEN。
4. 普通 `barrier=wall` 被误归城墙的测试先 RED，收窄分类后 GREEN。
5. 通济门现代地铁精确名称参照先 RED，窄放行并增强 note 后 GREEN。
6. multipolygon outer/inner 拼接测试先 RED，实现关系转换后 GREEN。

最终测试：

```text
$ node --test tests/geography.test.mjs
tests 6; pass 6; fail 0
```

离线重建命令：

```bash
node scripts/fetch-geography.mjs --from-raw \
  --endpoint 'https://overpass-api.de/api/interpreter (feature response); https://overpass.private.coffee/api/interpreter (exact-name place response)'
```

最终契约校验结果：4,029 features；22 places；43,255 坐标点；所有 feature 都有 `kind/name/osmType/osmId/source`；JSON 可解析；宽范围合理性检查无越界坐标；测试 6/6 通过。

## V2.0.1 城墙补采（2026-11-05）

旧采集查询和转换器均要求`name`，遗漏无名真城墙。修复后普通`barrier=wall`仍不纳入城墙。Overpass本轮返回406/429/504或超时，改用OSM官方`/api/0.6/map.json?bbox=…`九个小范围请求；各请求URL与采集完成UTC时间保留于`research/nanjing-walls-osm.json`的`sources`。该文件只含82个城墙way及原始节点坐标，不含贡献者账号、uid或无关城区数据；ODbL 1.0，© OpenStreetMap contributors。

- 墙体标记：35个`barrier=city_wall`对象，以金色实线显示；这不是现场验收。
- 历史墙址记录：47个仅`historic=citywalls`等对象，以金色虚线显示，存续与历史分期未核；不把它们当作现存段或已完成考证的清代墙线。
- 东段way/89637542与223953633、南段way/91997603、西北way/30685577、西段way/437649421等原无名对象均已纳入。每对象保留OSM链接、版本、修改时间和原始独立几何；不跨缺口补连。含双侧墙线和瓮城，不相加冒称总长或覆盖率。
- 更新后：4,100 features、44,241坐标点、22个地点；water/river/park/road及places与V2.0.0逐项深比较不变。文件4,728,393 bytes，SHA256 `9a912132b276d08d7b3711d1c89976d5619cfdddcc0d00682a8acf75a716b887`。
- 重放：`node scripts/update-walls.mjs`；从已采集官方map响应重建来源包：`node scripts/update-walls.mjs --from-maps tmp/walls`。来源包固定，重放结果逐字节一致。初始Overpass离线重建后再运行本命令，才能恢复本次增量，不能只重放初始11段快照。

缺失name放行、标签语义分层、官方map节点解析、拒绝缺失节点、缺失墙体快照与真实MapLibre层、镜头全貌均已分别记录RED→GREEN。来源与界面说明不将现代数据冒称完整历史测绘；缺少的水面/区域数据仍是原独立限制。
