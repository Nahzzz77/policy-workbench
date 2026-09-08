import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {openDb} from './local-db.mjs';
import {seed} from '../src/storage.js';
import {api} from '../src/service.js';
const db=openDb();await seed(db);const port=Number(process.env.PORT)||4174;
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,`http://127.0.0.1:${port}`);let response;
if(url.pathname.startsWith('/api/')){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>100000){res.writeHead(413);res.end();return}chunks.push(c)}const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});response=await api(request,{DB:db,RUNTIME:'local',SCHEDULE_MODE:process.env.SCHEDULE_MODE||'pending'})}
else{const assets={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/style.css':['style.css','text/css'],'/app.js':['app.js','text/javascript']};const a=assets[url.pathname];response=a?new Response(await readFile('public/'+a[0]),{headers:{'Content-Type':a[1]+'; charset=utf-8'}}):new Response('Not found',{status:404})}
res.writeHead(response.status,{...Object.fromEntries(response.headers),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(Buffer.from(await response.arrayBuffer()));
}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}});server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit()}));
