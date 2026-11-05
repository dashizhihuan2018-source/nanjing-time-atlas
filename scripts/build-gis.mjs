import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export {gisFiles} from './gis-assets.mjs';
export function packageDirectoryForInput(name){
  const parts=name.split('/'),boundary=parts.lastIndexOf('node_modules');
  if(boundary<0||boundary+1>=parts.length)return null;
  const end=boundary+(parts[boundary+1].startsWith('@')?3:2);
  return end<=parts.length?parts.slice(0,end).join('/'):null;
}
export async function collectGISLicenses(metafiles){
  const packages=new Set(['node_modules/maplibre-gl']);
  for(const metafile of metafiles)for(const name of Object.keys(metafile.inputs)){
    const directory=packageDirectoryForInput(name);if(directory)packages.add(directory);
  }
  const notices=['# Third-party licenses for the self-hosted GIS bundles\n'];
  for(const directory of [...packages].sort()){
    const base=path.join(root,directory);const pkg=JSON.parse(await readFile(path.join(base,'package.json'),'utf8'));
    notices.push(`\n## ${pkg.name}@${pkg.version} — ${pkg.license||'see original license'}\n`);
    const files=(await readdir(base)).filter(n=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(n));
    if(!files.length){
      const fallback=path.join(root,'licenses',pkg.name.replaceAll('/','__')+'.txt');
      try{notices.push(await readFile(fallback,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;throw new Error(`Missing license text for bundled package ${pkg.name}@${pkg.version} in ${directory}`);}
    }
    for(const file of files)notices.push(await readFile(path.join(base,file),'utf8'));
  }
  return {packages,noticeText:notices.join('\n')};
}
export async function buildGIS(){
  const out=path.join(root,'public/gis');await mkdir(out,{recursive:true});
  const common={bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,sourcemap:false,metafile:true,legalComments:'inline',logLevel:'warning',absWorkingDir:root};
  const app=await build({...common,entryPoints:['src/gis-map.mjs'],outfile:'public/gis/gis-map.mjs'});
  const worker=await build({...common,entryPoints:['node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'],outfile:'public/gis/maplibre-worker.mjs'});
  await copyFile(path.join(root,'node_modules/maplibre-gl/dist/maplibre-gl.css'),path.join(out,'engine.css'));
  const {packages,noticeText}=await collectGISLicenses([app.metafile,worker.metafile]);
  await writeFile(path.join(out,'THIRD_PARTY_LICENSES.txt'),noticeText);
  console.log(`GIS bundles built; ${packages.size} dependency license notices retained`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildGIS();
