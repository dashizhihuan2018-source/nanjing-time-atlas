import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {wallElementsFromMaps,wayToFeature} from './fetch-geography.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const requests={
  south:'118.76,32.012,118.81,32.023',east:'118.80,32.024,118.831,32.074',
  north:'118.755,32.086,118.785,32.099',west:'118.743,32.023,118.766,32.068',
  northwest:'118.735,32.075,118.765,32.10',southwest:'118.755,32.004,118.79,32.023',
  southeast:'118.785,32.007,118.823,32.029',northeast:'118.78,32.06,118.81,32.093',
  midwest:'118.735,32.05,118.758,32.08',
};
const packPath=path.join(root,'research/nanjing-walls-osm.json');
let pack;
if(process.argv[2]==='--from-maps'){
  const rawDir=path.resolve(process.argv[3]||'tmp/walls');
  const responses=[],sources=[];
  for(const [name,bbox]of Object.entries(requests)){
    const filename=path.join(rawDir,`${name}-map.json`);
    responses.push(JSON.parse(await readFile(filename,'utf8')));
    sources.push({url:`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`,
      retrievedAt:(await stat(filename)).mtime.toISOString()});
  }
  pack={license:'ODbL 1.0',attribution:'© OpenStreetMap contributors',sources,
    elements:wallElementsFromMaps(responses)};
  // Only wall objects and geometry; no unrelated map data or contributor accounts.
  await mkdir(path.dirname(packPath),{recursive:true});
  await writeFile(packPath,JSON.stringify(pack,null,2)+'\n');
}else if(process.argv.length>2)throw new Error('Usage: node scripts/update-walls.mjs [--from-maps RAW_DIR]');
else pack=JSON.parse(await readFile(packPath,'utf8'));

const geographyPath=path.join(root,'public/data/geography.json');
const geography=JSON.parse(await readFile(geographyPath,'utf8'));
const walls=new Map(geography.features.filter(f=>f.properties.kind==='wall').map(f=>[
  `${f.properties.osmType}/${f.properties.osmId}`,
  {...f,properties:{...f.properties,wallClass:f.properties.wallClass||'physical'}},
]));
for(const element of pack.elements){
  const feature=wayToFeature(element);
  if(!feature||feature.properties.kind!=='wall')throw new Error(`Invalid wall source ${element.id}`);
  feature.properties.osmVersion=element.version;
  feature.properties.osmModifiedAt=element.timestamp;
  feature.properties.wallNote=feature.properties.wallClass==='physical'
    ?'OSM标记为barrier=city_wall的墙体；现代记录，不等于清代测绘或现场验收。'
    :'OSM仅标记historic=citywalls或遗迹状态；存续与历史分期未核，不作为现存墙体。';
  walls.set(`way/${element.id}`,feature);
}
const wallFeatures=[...walls.values()].sort((a,b)=>a.properties.osmId-b.properties.osmId);
geography.features=[...geography.features.filter(f=>f.properties.kind!=='wall'),...wallFeatures];
geography.metadata.wallUpdate={
  sources:pack.sources,license:pack.license,
  physical:wallFeatures.filter(f=>f.properties.wallClass==='physical').length,
  historicReference:wallFeatures.filter(f=>f.properties.wallClass==='historic-reference').length,
  note:'墙体标记为实线；仅历史墙址记录为虚线（存续未核）。保留OSM原始独立几何，不补连、不用城门直线拼闭环；含双侧与瓮城，几何长度不代表城墙保有量。',
};
await writeFile(geographyPath,JSON.stringify(geography,null,2)+'\n');
console.log(JSON.stringify({wallFeatures:wallFeatures.length,...geography.metadata.wallUpdate,
  totalFeatures:geography.features.length},null,2));
