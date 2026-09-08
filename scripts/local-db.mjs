import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
export function openDb(filename='data/policy.sqlite'){
 mkdirSync('data',{recursive:true});const sql=new DatabaseSync(filename);sql.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');sql.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
 for(const file of readdirSync('.openai/drizzle').filter(x=>x.endsWith('.sql')).sort()){if(!sql.prepare('SELECT name FROM _local_migrations WHERE name=?').get(file)){sql.exec('BEGIN');try{sql.exec(readFileSync('.openai/drizzle/'+file,'utf8'));sql.prepare('INSERT INTO _local_migrations VALUES (?)').run(file);sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}}
 const prepare=query=>{let values=[];return{bind(...v){values=v;return this},async all(){return{results:sql.prepare(query).all(...values)}},async first(){return sql.prepare(query).get(...values)||null},async run(){const r=sql.prepare(query).run(...values);return{meta:{changes:Number(r.changes)}}}}};
 return{prepare,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}},close:()=>sql.close()};
}
