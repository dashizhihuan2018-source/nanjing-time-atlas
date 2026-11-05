import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gisFiles} from './gis-assets.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const publicFiles=['index.html','sources.html','public/style.css','public/favicon.svg','public/data/geography.json',...gisFiles,...['app','map','state','history','reader','exhibition'].map(n=>`src/${n}.mjs`)];
export async function buildPublic(out=path.join(root,'dist/site')){
  await mkdir(out,{recursive:true});
  const allowed=new Set([...publicFiles,'release.json','.nojekyll']);
  for(const entry of await readdir(out,{recursive:true,withFileTypes:true})){
    if(entry.isFile()){
      const relative=path.relative(out,path.join(entry.parentPath,entry.name));
      if(!allowed.has(relative))throw new Error(`Unknown output file; refusing to publish: ${relative}`);
    }
  }
  for(const name of publicFiles){
    const dest=path.join(out,name);await mkdir(path.dirname(dest),{recursive:true});
    if(name==='index.html'){
      let html=await readFile(path.join(root,name),'utf8');
      html=html.replace('name="atlas-mode" content="local"','name="atlas-mode" content="public"').replaceAll('沉浸式图志','公开研究版').replaceAll('本地研究版','公开研究版').replace('本地首版：','公开首版：').replace('原文件只在本机读取。','公开版不提供论文全文。').replace('./paper.pdf#page=25','./sources.html#method').replace('阅读论文复原方法','查看论文复原方法出处');
      html=html.replace('href="/paper.pdf"','href="./sources.html"').replace('打开论文对应页','查看论文出处').replace('仅访问本机原文件 · 印刷页码与PDF物理页码不同','公开版仅展示书目信息与页码，不提供论文全文。');
      await writeFile(dest,html);
    }else await copyFile(path.join(root,name),dest);
  }
  await writeFile(path.join(out,'release.json'),JSON.stringify({version:'2.0.0',name:'金陵时序',mode:'public',engine:'MapLibre GL JS 6.16.0 + deck.gl 9.4.1',source:'https://github.com/dashizhihuan2018-source/nanjing-time-atlas',paperIncluded:false},null,2)+'\n');
  await writeFile(path.join(out,'.nojekyll'),'');
  return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildPublic());
