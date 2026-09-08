import {initialSources} from './sources.js';
export const statement=(db,sql,params=[])=>db.prepare(sql).bind(...params);
export async function all(db,sql,params=[]){return (await statement(db,sql,params).all()).results}
export const articleInsert=`INSERT INTO articles (id,source_id,url,title,body,summary,published_at,collected_at,checked_at,content_hash,category,attachments) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
export const articleValues=a=>[a.id,a.source_id,a.url,a.title,a.body,a.summary,a.published_at,a.collected_at,a.checked_at,a.content_hash,a.category,a.attachments];
export async function seed(db,bootstrap={sources:[],articles:[],runs:[]}){
 const now=new Date().toISOString();
 await statement(db,"INSERT OR IGNORE INTO company(id,name,industry,region,scale,qualifications,needs,updated_at) VALUES ('current','我的公司','','','','','',?)",[now]).run();
 if(await statement(db,"SELECT value FROM settings WHERE key='initialized'").first())return;
 for(const s of initialSources){const saved=bootstrap.sources.find(x=>x.id===s.id);await statement(db,'INSERT OR IGNORE INTO sources(id,name,url,created_at,status,last_attempt,last_success,error,detail) VALUES (?,?,?,?,?,?,?,?,?)',[s.id,s.name,s.url,now,saved?.status||'pending',saved?.last_attempt||null,saved?.last_success||null,saved?.error||null,saved?.detail||null]).run()}
 for(let i=0;i<bootstrap.articles.length;i+=40){await db.batch(bootstrap.articles.slice(i,i+40).map(a=>statement(db,articleInsert.replace('INSERT INTO','INSERT OR IGNORE INTO'),articleValues(a))))}
 for(const r of bootstrap.runs){await statement(db,'INSERT OR IGNORE INTO runs(id,source_id,started_at,finished_at,status,added,updated,errors,pages) VALUES (?,?,?,?,?,?,?,?,?)',[r.id,r.source_id,r.started_at,r.finished_at,r.status,r.added,r.updated,r.errors,r.pages]).run()}
 for(const d of bootstrap.digests||[]){await statement(db,'INSERT OR IGNORE INTO digests(id,created_at,body,engine) VALUES (?,?,?,?)',[d.id,d.created_at,d.body,d.engine]).run()}
 await statement(db,"INSERT OR IGNORE INTO settings(key,value) VALUES ('initialized',?)",[now]).run();
}
export async function saveArticle(db,a){const old=await statement(db,'SELECT content_hash FROM articles WHERE url=?',[a.url]).first();if(!old){await statement(db,articleInsert,articleValues(a)).run();return 'added'}
 if(old.content_hash===a.content_hash){await statement(db,'UPDATE articles SET checked_at=? WHERE url=?',[a.checked_at,a.url]).run();return 'same'}
 await statement(db,'UPDATE articles SET title=?,body=?,summary=?,published_at=?,checked_at=?,content_hash=?,category=?,attachments=? WHERE url=?',[a.title,a.body,a.summary,a.published_at,a.checked_at,a.content_hash,a.category,a.attachments,a.url]).run();return 'updated';
}
export function chinaDayStart(now=new Date()){return new Date(Date.parse(now.toISOString().slice(0,10)+'T00:00:00Z')+Math.floor((now.getUTCHours()+8)/24)*86400000-8*3600000).toISOString()}
