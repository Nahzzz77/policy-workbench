import {api} from './service.js';
import {seed} from './storage.js';
import bootstrap from '../data/bootstrap.json';
import html from '../public/index.html';
import css from '../public/style.css';
import script from '../public/app.js?raw';
export default {async fetch(request,env,ctx){
 try{const path=new URL(request.url).pathname;let response;
 if(path.startsWith('/api/')){await seed(env.DB,bootstrap);response=await api(request,env)}
 else{const assets={'/':[html,'text/html; charset=utf-8'],'/index.html':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/app.js':[script,'text/javascript; charset=utf-8']};const asset=assets[path];response=asset?new Response(asset[0],{headers:{'Content-Type':asset[1]}}):new Response('Not found',{status:404})}
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('Cache-Control','no-store');return response;
 }catch(e){return Response.json({error:e.message||'服务异常，请重试'},{status:400})}
}};
