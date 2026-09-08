import {parseHTML} from 'linkedom';
export const agent='PolicyDeskBot/1.0';
export const normalizeText=s=>(s||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n\n').trim();
export function safeUrl(raw,base){
  const u=new URL(raw,base);const host=u.hostname.toLowerCase();
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!host.endsWith('.gov.cn'))throw new Error('仅支持公开的 gov.cn 政府网站网址，不支持账号、端口或内网地址');
  u.hash='';u.pathname=u.pathname.replace(/\/{2,}/g,'/');return u.href;
}
export function inSource(url,source){try{const host=new URL(url).hostname;const origin=new URL(source.url).hostname;const root=origin.replace(/^www\./,'');return host===origin||host.endsWith('.'+root)}catch{return false}}
export function parseDocument(html){return parseHTML('<html><head></head><body>'+html.replace(/<!doctype[^>]*>|<\/?(?:html|head|body)\b[^>]*>/gi,'')+'</body></html>').document;}
export function decodeHtml(bytes,contentType=''){
  const head=new TextDecoder().decode(bytes.slice(0,1500));const m=(contentType+' '+head).match(/charset\s*=\s*["']?([\w-]+)/i);let encoding=m?.[1]||'utf-8';if(/gb2312|gbk|gb18030/i.test(encoding))encoding='gb18030';
  try{return new TextDecoder(encoding).decode(bytes)}catch{return new TextDecoder().decode(bytes)}
}
export function robotAllowed(text,path){
  let agents=[],rules=[],groups=[];
  for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim();const m=line.match(/^([^:]+):\s*(.*)$/);if(!m)continue;const k=m[1].toLowerCase(),v=m[2].trim();if(k==='user-agent'){if(rules.length){groups.push({agents,rules});agents=[];rules=[]}agents.push(v.toLowerCase())}else if(['allow','disallow'].includes(k)&&agents.length&&v){rules.push({allow:k==='allow',path:v})}}
  groups.push({agents,rules});const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.toLowerCase().includes(a)));const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  const matches=selected.flatMap(g=>g.rules).filter(r=>{const end=r.path.endsWith('$');let p=(end?r.path.slice(0,-1):r.path).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');return new RegExp('^'+p+(end?'$':'')).test(path)}).sort((a,b)=>b.path.replace(/[*$]/g,'').length-a.path.replace(/[*$]/g,'').length||Number(b.allow)-Number(a.allow));
  return !matches.length||matches[0].allow;
}
async function readResponse(r,max=3000000){if(!r.ok)throw new Error('HTTP '+r.status);if(Number(r.headers.get('content-length'))>max)throw new Error('页面超过 3 MB 上限');const reader=r.body.getReader();let size=0,parts=[];while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('页面超过 3 MB 上限')}parts.push(value)}const bytes=new Uint8Array(size);let n=0;for(const p of parts){bytes.set(p,n);n+=p.length}return decodeHtml(bytes,r.headers.get('content-type')||'');}
export function createFetcher(fetchImpl=fetch){
 const robots=new Map();
 async function direct(url){return fetchImpl(url,{headers:{'User-Agent':agent,'Accept':'text/html,application/xhtml+xml,text/plain;q=0.9'},redirect:'manual',signal:AbortSignal.timeout(8000)});}
 async function rulesFor(url){const origin=new URL(url).origin;if(!robots.has(origin)){robots.set(origin,(async()=>{try{const r=await direct(origin+'/robots.txt');if(r.status>=400&&r.status<500&&r.status!==429)return '';if(!r.ok)throw new Error('robots.txt HTTP '+r.status);return await readResponse(r,300000)}catch(e){throw new Error('无法核验 robots.txt：'+e.message)}})())}return robots.get(origin)}
 return async function get(raw){let url=safeUrl(raw);for(let step=0;step<5;step++){const u=new URL(url);if(!robotAllowed(await rulesFor(url),u.pathname+u.search))throw new Error('robots.txt 禁止抓取该路径');const r=await direct(url);if([301,302,303,307,308].includes(r.status)){url=safeUrl(r.headers.get('location'),url);continue}const html=await readResponse(r);return {url,html,document:parseDocument(html)}}throw new Error('重定向次数超过上限')};
}
export function pageLinks(doc,base,source){const seen=new Set();return [...doc.querySelectorAll('a[href]')].flatMap(a=>{try{const url=safeUrl(a.getAttribute('href'),base);if(seen.has(url)||!inSource(url,source))return [];seen.add(url);const title=normalizeText(a.getAttribute('title')||a.textContent);return title?[{url,title}]:[]}catch{return []}})}
const articlePath=/\/(?:t\d{8}_\d+|art_[\w-]+|[a-f0-9]{20,}|\d{6,})\.(?:s?html?)$|\/art\/\d{4}\//i;
export const isArticle=x=>articlePath.test(new URL(x.url).pathname)&&x.title.length>=8;
const categoryFor=(title,url,column)=>/解读|图解/.test(column+title)||/zcjd/.test(url)?'政策解读':/政策|zcfb|zcwj|zhengce/.test(column+url)||/办法|措施|方案|意见|规划|条例/.test(title)?'政策文件':/通知|公告|公示/.test(title+column)?'通知公告':'新闻动态';
export async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function extractArticle(html,url,sourceId,fallbackTitle=''){
 const doc=parseDocument(html);const meta={};for(const el of doc.querySelectorAll('meta[name],meta[property]'))meta[(el.getAttribute('name')||el.getAttribute('property')).toLowerCase()]=el.getAttribute('content')||'';
 const title=normalizeText(meta.articletitle||meta['og:title']||doc.querySelector('h1')?.textContent||fallbackTitle||doc.querySelector('title')?.textContent);
 for(const el of doc.querySelectorAll('script,style,nav,header,footer,form,iframe,button'))el.remove();
 const selectors=['.TRS_Editor','.TRS_UEDITOR','.con_txt','.TRS_PreAppend','#zoom','.article-content','.art-con','.pages_content','#UCAP-CONTENT','.view.TRS_UEDITOR','.contentText','.article_con','.detail','article'];
 let bodyNode;for(const sel of selectors){const nodes=[...doc.querySelectorAll(sel)].filter(n=>normalizeText(n.textContent).length>70);if(nodes.length){bodyNode=nodes.sort((a,b)=>b.textContent.length-a.textContent.length)[0];break}}
 if(!bodyNode){const nodes=[...doc.querySelectorAll('[id],[class]')].filter(n=>/content|article|detail|正文|mainText|zoom/i.test(n.id+' '+n.className));bodyNode=nodes.filter(n=>normalizeText(n.textContent).length>100).sort((a,b)=>a.textContent.length-b.textContent.length)[0]}
 if(!bodyNode&&!meta.articletitle)throw new Error('未能识别正文区域或文章元数据，未入库');
 const body=bodyNode?normalizeText(bodyNode.innerText||bodyNode.textContent).slice(0,80000):'';if(title.length<5||/验证码|访问验证|安全验证/.test(title))throw new Error('正文过短或遇到访问验证，未入库');
 const rawDate=meta.pubdate||meta.publishdate||meta['article:published_time']||meta.publishtime||'';let date=rawDate.match(/(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})/);if(!date){date=normalizeText(doc.body.textContent).match(/(?:发布时间|发布日期|日期|时间)\s*[:：]?\s*(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})/)}const published=date?`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`:null;
 const attachments=[...(bodyNode||doc.body).querySelectorAll('a[href]')].flatMap(a=>{try{const u=safeUrl(a.getAttribute('href'),url);return /\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(u)?[{title:normalizeText(a.textContent)||'下载附件',url:u}]:[]}catch{return []}});
 const now=new Date().toISOString();return{id:(await digest(url)).slice(0,32),source_id:sourceId,url,title,body,summary:body?body.replace(/\s+/g,' ').slice(0,240):'【仅索引】正文未提取，请打开官网查看图片、视频或附件。',published_at:published,collected_at:now,checked_at:now,content_hash:await digest(body),category:categoryFor(title,url,meta.columnname||''),attachments:JSON.stringify(attachments)};
}
export async function crawlSource(source,{limit=24,known=new Map(),fetchPage=createFetcher(),onProgress=()=>{}}={}){
 const errors=[],candidates=new Map(),entries=[];let pages=0;
 async function visit(url){try{const page=await fetchPage(url);pages++;const links=pageLinks(page.document,page.url,source);for(const a of links)if(isArticle(a))candidates.set(a.url,a);return links}catch(e){errors.push(url+' — '+e.message);return []}}
 const home=await visit(source.url);
 // The supplied index_1 page is retained; also inspect its directory's first page.
 if(/index_\d+\.html?$/.test(source.url))entries.push(new URL('./',source.url).href);
 const columns=home.filter(x=>x.title.length<15&&/政策文件|政策发布|最新政策|通知公告|通知通告|工作通知|政策解读|最新消息|海淀动态/.test(x.title));
 entries.push(...columns.map(x=>x.url));
 for(const url of [...new Set(entries)].slice(0,5)){await visit(url)}
 // Prefer recent dated articles; keep undated URL formats in their source order.
 const ordered=[...candidates.values()].sort((a,b)=>{const da=a.url.match(/t(20\d{6})_/)?.[1]||'99999999',db=b.url.match(/t(20\d{6})_/)?.[1]||'99999999';return db.localeCompare(da)});
 const selected=ordered.filter(x=>!known.has(x.url)).slice(0,limit);
 for(const a of ordered.filter(x=>known.has(x.url)).slice(0,4)){if(selected.length<limit)selected.push(a)}
 const articles=[];
 // ponytail: two requests per source at once; tune only after measuring source load.
 for(let i=0;i<selected.length;i+=2){await Promise.all(selected.slice(i,i+2).map(async a=>{try{const p=await fetchPage(a.url);pages++;const article=await extractArticle(p.html,p.url,source.id,a.title);articles.push(article);onProgress(article)}catch(e){errors.push(a.url+' — '+e.message)}}));if(i+2<selected.length)await new Promise(r=>setTimeout(r,250))}
 if(!articles.length&&!ordered.length)errors.push('当前入口未发现可解析文章，需要适配栏目或检查网站响应');
 return {articles,errors,pages,discovered:candidates.size,remaining:Math.max(0,ordered.filter(x=>!known.has(x.url)).length-articles.filter(x=>!known.has(x.url)).length),entries:[source.url,...new Set(entries)]};
}
