import test from 'node:test';
import assert from 'node:assert/strict';
import {safeUrl,robotAllowed,extractArticle,parseDocument,decodeHtml,pageLinks,isArticle} from '../src/crawler.js';
import {seed,saveArticle,all,statement,chinaDayStart} from '../src/storage.js';
import {api,syncSource} from '../src/service.js';
import {openDb} from '../scripts/local-db.mjs';

test('拒绝内网、非政府域名、凭据和不安全协议；规范重复斜线',()=>{
 for(const u of ['http://127.0.0.1/','http://localhost/','file:///etc/passwd','https://example.com/','https://www.beijing.gov.cn.evil.com/','https://u:p@www.beijing.gov.cn/','https://www.beijing.gov.cn:8080/'])assert.throws(()=>safeUrl(u));
 assert.equal(safeUrl('http://www.bjchy.gov.cn//affair/file/a.html#x'),'http://www.bjchy.gov.cn/affair/file/a.html');
});
test('robots 最长路径优先、Allow 平局优先、指定机器人优先',()=>{
 const robots='User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$';assert.equal(robotAllowed(robots,'/private/a'),false);assert.equal(robotAllowed(robots,'/private/public/a'),true);assert.equal(robotAllowed(robots,'/a.pdf'),false);assert.equal(robotAllowed('User-agent: other\nDisallow: /\nUser-agent: *\nAllow: /','/x'),true);
});
test('朝阳 GB 编码及十六进制文章链接可以识别',()=>{
 assert.equal(decodeHtml(Uint8Array.from([0xd5,0xfe,0xb2,0xdf]),'text/html; charset=gb2312'),'政策');
 const d=parseDocument('<html><meta charset="gb2312"><head><title>x</title></head><body><a href="/affair/file/4028805a9dfdb457019e1f60d6b71b89.html">一个真实格式的政策标题</a></body></html>');assert.ok(isArticle(pageLinks(d,'http://www.bjchy.gov.cn/',{url:'http://www.bjchy.gov.cn/'})[0]));
});
test('正文提取不会误选第一个短元数据区，保留官方日期和附件',async()=>{
 const body='这是家政政策的正式正文，涉及技能培训和就业服务。'.repeat(10);
 const html=`<meta name="ArticleTitle" content="家政政策测试"><meta name="PubDate" content="2026-09-04 08:30"><div class="art-con">发布文号</div><div class="art-con">${body}<a href="./a.pdf">附件</a><script>不要收录</script></div>`;
 const a=await extractArticle(html,'https://www.mofcom.gov.cn/test/a.html','mofcom');assert.equal(a.title,'家政政策测试');assert.equal(a.published_at,'2026-09-04');assert.ok(a.body.includes(body));assert.ok(!a.body.includes('不要收录'));assert.equal(JSON.parse(a.attachments)[0].url,'https://www.mofcom.gov.cn/test/a.pdf');
});
test('北京时间跨日计算',()=>{assert.equal(chinaDayStart(new Date('2026-09-05T17:00:00Z')),'2026-09-05T16:00:00.000Z');assert.equal(chinaDayStart(new Date('2026-09-05T10:00:00Z')),'2026-09-04T16:00:00.000Z')});
test('数据库去重、保留首次时间、正文搜索、暂停、来源新增与失败运行均持久化',async()=>{
 const db=openDb(':memory:');try{await seed(db);const a=await extractArticle('<h1>服务业工作方案</h1><div class="TRS_Editor">'+('家政服务人员培训与补贴相关要求。'.repeat(20))+'</div>','https://www.mofcom.gov.cn/a.html','mofcom');a.collected_at='2025-01-01T00:00:00.000Z';assert.equal(await saveArticle(db,a),'added');assert.equal(await saveArticle(db,a),'same');assert.equal(await saveArticle(db,{...a,body:a.body+'更新',content_hash:'changed',collected_at:'2026-01-01T00:00:00.000Z'}),'updated');assert.equal((await statement(db,'SELECT collected_at FROM articles').first()).collected_at,a.collected_at);
 let r=await api(new Request('http://local/api/articles?q='+encodeURIComponent('家政 补贴')),{DB:db});let result=await r.json();assert.equal(result.total,1);assert.ok(result.items[0].excerpt.includes('家政'));
 r=await api(new Request('http://local/api/articles?q=%25'),{DB:db});assert.equal((await r.json()).total,0);
 r=await api(new Request('http://local/api/sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'测试来源',url:'https://test.gov.cn/'})}),{DB:db});assert.equal(r.status,201);const{id}=await r.json();assert.ok(await statement(db,'SELECT id FROM sources WHERE id=?',[id]).first());
 await api(new Request('http://local/api/sources/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"enabled":false}'}),{DB:db});await assert.rejects(syncSource(db,id),/暂停/);
 await assert.rejects(syncSource(db,'mofcom',{crawl:async()=>{throw Error('网络超时')}}),/网络超时/);assert.equal((await statement(db,'SELECT status FROM sources WHERE id=?',['mofcom']).first()).status,'error');assert.equal((await all(db,'SELECT * FROM runs')).length,1);
 const csrf=await api(new Request('http://local/api/sources',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'}),{DB:db});assert.equal(csrf.status,403);
 }finally{db.close()}
});
