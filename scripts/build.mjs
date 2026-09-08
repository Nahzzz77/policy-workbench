import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {mkdir,cp,readFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['src/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text','.css':'text'},plugins:[{name:'raw-js',setup(b){b.onResolve({filter:/\?raw$/},args=>({path:fileURLToPath(new URL('../public/app.js',import.meta.url)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}))}}],minify:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('.openai/drizzle','dist/.openai/drizzle',{recursive:true});console.log('Worker 构建完成');
