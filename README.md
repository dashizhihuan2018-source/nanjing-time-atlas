# 金陵时序 · Nanjing Through Time

公开网站：**https://dashizhihuan2018-source.github.io/nanjing-time-atlas/**

基于杨金杰2022年东南大学硕士论文《清前中期南京城市空间复原与研究——以清初战争与康乾南巡为中心》线索制作的南京历史空间二维交互图志。

## 可以做什么

- 拖动、缩放南京地图；切换现代水系、山林、路网、城墙参照与历史地点图层。
- 在1644—1784年份滑杆与七个史事节点间阅读，检索历史地名。
- 查看1645弘光之战、1659郑成功北伐、1684康熙初巡、1751龙潭御路、以1757代表的栖霞御路体系五个专题；逐站播放或手动切换。
- 查看每条路线、地点与时间节点的论文印刷页码、图表出处、现代对象来源和定位说明。

## 首版边界

这是可查证的**研究示意**，不是完整的清代测绘复原或导航服务。

- 现代地理参照不等于历史岸线、道路或建筑范围。城市中心、区域中心、重建城门及现代地铁等不同参照会分别说明。
- 未定位站点不猜坐标；路线遇未知点断开，不跨缺点补线。1757专题代表论文归纳的御路体系，不是该次每日完整行踪。
- 玄武湖与莫愁湖完整水面几何下载受阻，现有绿色区域为现代公园，不是湖岸；宁镇扬州只有地点锚点，缺少完整区域底图。
- 公开版不含论文全文、原图、扫描件，也不收集用户文档、账号或定位。出处见网站“资料出处”及 `sources.html`。

## 本地构建

Node.js 20或更新版本，零前端运行依赖，不需要 `npm install`：

```bash
npm test
npm run build
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
```

访问 `http://127.0.0.1:4174/site/`。`dist/site`为只含允许资源的公开成品，资源采用相对路径，支持GitHub Pages项目子路径。

`npm start`为仅绑定回环地址的可选研究服务器；若需要阅读自有论文，可在**不提交**的 `.env.local` 中配置 `NANJING_THESIS_PATH=/absolute/path/to/your-paper.pdf`。论文不会被打包进公开网站。

浏览器回归需安装或提供Playwright及Chrome：`PLAYWRIGHT_PATH`可指定Playwright模块；对公开静态版设置 `BASE_URL=http://127.0.0.1:4174/site/ PUBLIC_MODE=1 npm run test:browser`。

`docs/`是已生成的GitHub Pages站点，发布源为`main /docs`，与PDFMaster项目的发布方式一致。更新时重新构建并同步已审核的`dist/site`到`docs`，不要上传整个工作目录。

## 来源与权利

- 论文：杨金杰，东南大学建筑学院，2022年；网页采用独立概述，页码按印刷版记录。本站与作者、学校、知网无官方隶属关系。
- 地理数据：© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)。每项数据保留OSM对象链接。几何基准2026-11-05，地点镜像基准2026-06-01。完整说明见 `research/geography-sources.md`。
- 交互方法参考 [江山时序](https://github.com/DeanChensj/jiangshan-map)，未复制其源代码或受限府级边界数据。
- 本次为源码公开展示，未另行授予软件代码开源许可；第三方数据按其原许可使用。没有将论文或参考项目的权利转授给本仓库。

版本：`1.0.0`，研究首版；浏览器模拟手机视口不等于真机或历史学术验收。
