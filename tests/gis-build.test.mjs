import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageDirectoryForInput,collectGISLicenses} from '../scripts/build-gis.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('package roots follow the last nested node_modules boundary',()=>{
  assert.equal(packageDirectoryForInput('node_modules/@luma.gl/gltf/node_modules/@loaders.gl/images/dist/index.js'),
    'node_modules/@luma.gl/gltf/node_modules/@loaders.gl/images');
  assert.equal(packageDirectoryForInput('node_modules/@loaders.gl/3d-tiles/node_modules/long/index.js'),
    'node_modules/@loaders.gl/3d-tiles/node_modules/long');
});
test('scoped and multiple installed versions remain distinct',()=>{
  assert.equal(packageDirectoryForInput('node_modules/@loaders.gl/images/dist/index.js'),'node_modules/@loaders.gl/images');
  assert.notEqual(packageDirectoryForInput('node_modules/@loaders.gl/images/dist/index.js'),
    packageDirectoryForInput('node_modules/@luma.gl/gltf/node_modules/@loaders.gl/images/dist/index.js'));
  assert.equal(packageDirectoryForInput('src/gis-map.mjs'),null);
});
test('every actual GIS bundle package directory retains complete source license text',async()=>{
  const common={bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,metafile:true,write:false,logLevel:'silent',absWorkingDir:root};
  const bundles=await Promise.all([
    build({...common,entryPoints:['src/gis-map.mjs'],outfile:'public/gis/gis-map.mjs'}),
    build({...common,entryPoints:['node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'],outfile:'public/gis/maplibre-worker.mjs'})
  ]);
  const dirs=new Set(['node_modules/maplibre-gl']);
  for(const result of bundles)for(const input of Object.keys(result.metafile.inputs)){
    const directory=packageDirectoryForInput(input);if(directory)dirs.add(directory);
  }
  for(const name of ['images','loader-utils','worker-utils','gltf','textures','draco','schema-utils'])
    assert.ok(dirs.has(`node_modules/@luma.gl/gltf/node_modules/@loaders.gl/${name}`),`missing nested @loaders.gl/${name}`);
  assert.ok(dirs.has('node_modules/@loaders.gl/3d-tiles/node_modules/long'),'missing nested long');
  const {packages,noticeText:notices}=await collectGISLicenses(bundles.map(result=>result.metafile));
  assert.deepEqual(packages,dirs);
  let count=0;
  for(const directory of dirs){
    const base=path.join(root,directory),pkg=JSON.parse(await readFile(path.join(base,'package.json'),'utf8'));
    if(directory.startsWith('node_modules/@luma.gl/gltf/node_modules/@loaders.gl/'))assert.equal(pkg.version,'4.4.5');
    if(directory==='node_modules/@loaders.gl/3d-tiles/node_modules/long')assert.equal(pkg.version,'5.3.2');
    const files=(await readdir(base)).filter(n=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(n));
    const section=`## ${pkg.name}@${pkg.version} — ${pkg.license||'see original license'}\n`;
    const start=notices.indexOf(section);
    assert.ok(start>=0,`${directory} ${pkg.version} is missing its own license notice`);
    const end=notices.indexOf('\n## ',start+section.length);
    const body=notices.slice(start,end<0?undefined:end);
    if(!files.length){
      const fallback=path.join(root,'licenses',pkg.name.replaceAll('/','__')+'.txt');
      const verified=await readFile(fallback,'utf8');
      assert.match(verified,/^Upstream license for /);
      assert.ok(body.includes(verified),`${directory} must retain the complete verified upstream license`);
    }
    for(const filename of files){
      const original=await readFile(path.join(base,filename),'utf8');
      assert.ok(body.includes(original),`${directory}/${filename} must remain complete`);
    }
    count++;
  }
  assert.ok(count>76,`expected nested copies in actual bundle, observed ${count}`);
});
