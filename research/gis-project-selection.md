# 成熟GIS代码选型与实际复用

核对日期：2026-11-05。用户要求查找Git上的GIS项目并复用成熟代码，最终不是继续自写GPU投影或只做样式复刻。

| 项目 | 本次判断 | 结果 |
| --- | --- | --- |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 成熟WebGL地图镜头、交互和分层；官方BSD-3-Clause及附加第三方条款 | 直接复用6.16.0，标签提交538a7680ab16d5cf5a6564ee0ce72a11be14d142 |
| [deck.gl](https://github.com/visgl/deck.gl) | 大规模GPU路径、光迹、点与交错渲染；MIT | 直接复用9.4.1，npm gitHead7de3aa41176da9d6dcc11562fb5fa8b9d0cb11a4；MapLibreOverlay、PathLayer、TripsLayer、ScatterplotLayer |
| [Leaflet](https://github.com/Leaflet/Leaflet) | 轻量二维地图优秀，但本轮倾斜镜头及GPU路线需要额外机制 | 未引入，避免同时装多个底图引擎 |
| [OpenLayers](https://github.com/openlayers/openlayers) | 数据与二维GIS能力成熟；本轮表达重点不需再装一套GIS栈 | 未引入 |
| [CesiumJS](https://github.com/CesiumGS/cesium) | 地球尺度三维地理引擎；本论文尚无可发布精确清代地形建筑，不能为炫技伪造写实城池 | 本轮不引入，保留二维/2.5D展陈 |
| [江山时序](https://github.com/DeanChensj/jiangshan-map) | 历史时间交互参考；代码与历史行政数据库许可需分开看 | 本轮不复制其代码或CHGIS/Hartwell受限数据 |

采用官方[MapLibre集成模式](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)与[TripsLayer](https://deck.gl/docs/api-reference/geo-layers/trips-layer)接口。运行时引擎、worker与CSS本地打包，不从CDN执行未知脚本；npm版本固定、lock保留，安装使用ignore-scripts。构建按实际bundle输入收集第三方许可证，包括嵌套的多版本依赖；许可清单不是单看顶层package.json。

现代OSM几何只为地理参照；历史节点独立存放证据，未知站断线。OpenFreeMap在线样式本机探测超时，所以本版只报告local-vector，未用网络就绪假标识替代实际瓦片。
