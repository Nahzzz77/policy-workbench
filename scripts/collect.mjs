import {openDb} from './local-db.mjs';
import {seed,all} from '../src/storage.js';
import {syncSource} from '../src/service.js';
import {writeFile} from 'node:fs/promises';
const db=openDb();await seed(db);const sources=await all(db,'SELECT * FROM sources WHERE enabled=1');
for(const s of sources){try{const r=await syncSource(db,s.id,{limit:Number(process.env.CRAWL_LIMIT)||36});console.log(JSON.stringify({source:s.name,...r}));}catch(e){console.error(s.name,e.message)}}
const snapshot={sources:await all(db,'SELECT * FROM sources'),articles:await all(db,'SELECT * FROM articles'),runs:await all(db,'SELECT * FROM runs ORDER BY started_at DESC LIMIT 32')};await writeFile('data/bootstrap.json',JSON.stringify(snapshot));console.log('已归档',snapshot.articles.length,'篇');db.close();
