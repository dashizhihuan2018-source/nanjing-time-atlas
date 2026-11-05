import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('cinematic exhibit retains accessible motion and perspective controls',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="motion-toggle"[^>]*aria-pressed=/);
  assert.match(html,/id="perspective-toggle"[^>]*aria-pressed=/);
  assert.match(html,/id="exhibition-enter"/);
  assert.match(html,/public\/gis\/engine\.css/);
});
