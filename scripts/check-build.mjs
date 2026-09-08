import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {openDb} from './local-db.mjs';
import {all} from '../src/storage.js';
const db=openDb(':memory:');
try{for(const path of ['/','/app.js','/api/state','/api/articles?q=%E5%AE%B6%E6%94%BF']){const r=await worker.fetch(new Request('https://policy.test'+path),{DB:db,SCHEDULE_MODE:'codex'},{});assert.equal(r.status,200);if(path==='/api/state'){const d=await r.json();assert.equal(d.sources.length,8);assert.ok(d.stats.total>0);assert.ok(d.digest);console.log({sources:d.sources.length,total:d.stats.total,engine:d.digest.engine})}if(path.includes('?')){const d=await r.json();assert.ok(d.total>0);console.log({housekeeping:d.total})}}
console.log(await all(db,"SELECT count(*) total,sum(CASE WHEN body='' THEN 1 ELSE 0 END) index_only,sum(CASE WHEN published_at IS NULL THEN 1 ELSE 0 END) date_unknown FROM articles"));
}finally{db.close()}
