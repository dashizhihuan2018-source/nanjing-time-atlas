import { test, after } from 'node:test';
import assert from 'node:assert/strict';
let createServer;
try {({createServer}=await import('../server.mjs'));}catch{}
let server;
after(()=>server?.close());
test('loopback server provides only approved assets and PDF ranges',async()=>{
  assert.equal(typeof createServer,'function');
  server=createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status,200);
  for(const path of ['/.git/config','/docs/research/2026-11-05-source-assessment.md','/server.mjs','/package.json','/paper.pdf/../.git/config'])
    assert.equal((await fetch(base+path)).status,404,path);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  const pdf=await fetch(base+'/paper.pdf',{headers:{Range:'bytes=0-4'}});
  if(process.env.NANJING_THESIS_PATH){
    assert.equal(pdf.status,206); assert.equal(await pdf.text(),'%PDF-');
    assert.equal((await fetch(base+'/paper.pdf',{headers:{Range:'bytes=99999999999-'}})).status,416);
  }else assert.equal(pdf.status,404,'no thesis file is bundled or required');
});
