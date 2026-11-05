# 来源与公开范围

本项目为独立实现的历史空间交互阅读网站，不是论文、东南大学、知网或江山时序项目的官方产品。

历史内容依据杨金杰2022年东南大学硕士论文形成独立概述，并保留印刷页及图表指引；不含论文全文、原图、扫描件或参考文章全文。

`public/data/geography.json`及部署副本属于OpenStreetMap派生地理数据，© OpenStreetMap contributors，按ODbL 1.0提供：

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/

数据中每个几何和地点保留原始对象来源链接及现代定位说明。历史路线、历史地点说明和现代地理数据不应混同。

本次公开源码未新增软件开源许可；不能因仓库可见而推断论文、第三方数据或参考项目的版权范围已经改变。

## 成熟GIS代码

- MapLibre GL JS 6.16.0，https://github.com/maplibre/maplibre-gl-js ，BSD-3-Clause（原LICENSE另含第三方条款）。
- deck.gl 9.4.1，https://github.com/visgl/deck.gl ，MIT。
- npm安装使用固定版本与lockfile；GIS bundle、worker、CSS自托管。构建实际输入的84个依赖安装目录（含嵌套多版本）的完整许可文本见 `public/gis/THIRD_PARTY_LICENSES.txt`。
- `@nodable/entities@3.1.0` npm包未附LICENSE文件，保留其上游仓库原MIT许可于 `licenses/@nodable__entities.txt`，并合并入bundle许可清单。

路线流光、镜头姿态、线宽和动画速度为展陈表达，不是历史道路、行军速度、炮火效果或清代建筑实测。没有复制参考项目受限历史行政边界；没有发布论文扫描或图版。全文主题阅读采用原创归纳、逐节页码，区分史料、复原与作者解释。
