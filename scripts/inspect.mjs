import {initialSources} from '../src/sources.js';
import {parseHTML} from 'linkedom';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('data/inspection',{recursive:true});
await Promise.all(initialSources.map(async s=>{try{
const r=await fetch(s.url,{signal:AbortSignal.timeout(15000)});const html=await r.text();await writeFile(`data/inspection/${s.id}.html`,html);
const {document}=parseHTML(html);const links=[...document.querySelectorAll('a[href]')].map(a=>({text:(a.textContent||a.getAttribute('title')||'').trim(),url:new URL(a.getAttribute('href'),r.url).href})).filter(a=>a.text&&a.url.startsWith('http'));
await writeFile(`data/inspection/${s.id}.json`,JSON.stringify(links,null,2));console.log(JSON.stringify({name:s.name,status:r.status,title:document.title,links:links.filter(x=>/政策|通知|动态|要闻|家政|政务|最新/.test(x.text)).slice(0,22)}));
}catch(e){console.log(s.name,e.message)}}));
