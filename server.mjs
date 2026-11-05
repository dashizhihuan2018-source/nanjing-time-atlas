import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile?.(path.join(root,'.env.local'));}catch(error){if(error.code!=='ENOENT')throw error;}
const paper=process.env.NANJING_THESIS_PATH||null;
const assets=new Map([
  ['/','index.html'],['/index.html','index.html'],['/public/style.css','public/style.css'],
  ['/public/favicon.svg','public/favicon.svg'],['/public/data/geography.json','public/data/geography.json'],['/sources.html','sources.html'],
  ...['app','map','state','history'].map(name=>[`/src/${name}.mjs`,`src/${name}.mjs`]),
]);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf'};
export function createServer() {
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const host=req.headers.host||'';
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)){res.writeHead(403);return res.end('Loopback only');}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
    let pathname;
    try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
    const filename=pathname==='/paper.pdf'?paper:assets.has(pathname)?path.join(root,assets.get(pathname)):null;
    if(!filename){res.writeHead(404);return res.end('Not found');}
    try{
      const info=await stat(filename);
      res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');
      res.setHeader('Cache-Control','no-cache');
      if(pathname==='/paper.pdf')res.setHeader('Accept-Ranges','bytes');
      let start=0,end=info.size-1,status=200;
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
        if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}
        else start=Math.max(0,info.size-Number(match[2]));
        if(start>=info.size||end<start){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
        status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader('Content-Length',end-start+1);res.writeHead(status);
      if(req.method==='HEAD')return res.end();
      const stream=createReadStream(filename,{start,end});
      stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(pathname==='/paper.pdf'?'Local thesis file is unavailable':'Asset unavailable');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||4173),server=createServer();
  server.on('error',error=>{console.error(`Cannot start local preview: ${error.message}`);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`金陵时序 http://127.0.0.1:${port}`));
}
