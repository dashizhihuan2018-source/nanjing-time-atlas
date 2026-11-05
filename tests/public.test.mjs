import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {buildPublic,publicFiles} from '../scripts/build-public.mjs';
import {buildGIS} from '../scripts/build-gis.mjs';
test('public artifact is allowlisted, project-path portable, and excludes local thesis access',async()=>{
  await buildGIS();
  const out=await buildPublic(await mkdtemp(path.join(os.tmpdir(),'nanjing-public-test-')));
  const html=await readFile(path.join(out,'index.html'),'utf8');
  assert.match(html,/atlas-mode" content="public/);assert.match(html,/公开研究版/);
  assert.doesNotMatch(html,/href="\/(?!\/)|src="\/(?!\/)|paper\.pdf/);
  for(const name of publicFiles){const text=await readFile(path.join(out,name),'utf8');assert.doesNotMatch(text,/\/Users\/|ghp_[A-Za-z0-9]+|BEGIN.*PRIVATE KEY/);}
  assert.equal(JSON.parse(await readFile(path.join(out,'release.json'))).paperIncluded,false);
});
