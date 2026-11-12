#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {page,table as htmlTable,writeOut} from './lib/render.mjs';

export const reads={
 projects:'select code,name,owner,retention_days,access_review_due,privacy_review_due from projects order by code',
 'morning-triage':'select project,title,level,owner,last_24h,overdue,regressions from triage_queue',
 issues:'select * from issue_summary order by project,title',
 unowned:'select project,title,level,last_24h from triage_queue where owner is null',
 overdue:'select project,title,owner,due,last_24h from triage_queue where overdue',
 regressions:'select project,title,owner,fix_release,regressions,last_seen from triage_queue where regressions>0',
 'quiet-issues':"select project,title,owner,last_seen from triage_queue where last_seen<now()-interval '7 days'",
 'release-review':'select project,environment,version,captured_occurrences,affected_issues,occurrences_on_active_issues from release_health order by deployed_at desc',
 'release-gaps':`select p.code project,i.environment,o.release,count(*)::int captured_occurrences from occurrences o join issues i on i.id=o.issue_id join projects p on p.id=o.project_id where not exists(select 1 from releases r where r.project_id=p.id and r.environment=i.environment and r.version=o.release) group by p.code,i.environment,o.release order by p.code,o.release`,
 workload:"select coalesce(owner,'Unassigned') owner,count(*)::int active_issues,count(*) filter(where overdue)::int overdue_issues,sum(last_24h)::int captured_24h from triage_queue group by owner order by active_issues desc,owner",
 'environment-review':'select project,environment,count(*)::int active_issues,sum(last_24h)::int captured_24h from triage_queue group by project,environment order by project,environment',
 'noise-review':'select project,title,level,occurrences,last_24h,status from issue_summary order by occurrences desc,title',
 'fix-evidence':"select p.code project,i.title,i.status,i.resolution,i.fix_release,i.resolved_at from issues i join projects p on p.id=i.project_id where i.resolved_at is not null order by i.resolved_at desc",
 compliance:'select * from record_checks order by rule,reference',
 retention:`select p.code project,p.retention_days,count(o.id)::int records_due_review,min(o.occurred_at) oldest_record from projects p join occurrences o on o.project_id=p.id and o.occurred_at<now()-make_interval(days=>p.retention_days) group by p.id order by p.code`,
 imports:'select p.code project,m.source,m.file_name,m.file_hash,m.rows_received,m.rows_inserted,m.actor,m.created_at from imports m join projects p on p.id=m.project_id order by m.created_at desc',
 audit:'select entity,entity_id,operation,actor,created_at from audit_log order by created_at desc,id'
};
const specs={
 help:[],issue:[],history:[],
 'add-project':['code','name','owner','actor'],
 import:['project','file','actor','dry-run'],
 ingest:['project','file','actor','dry-run'],
 assign:['issue','owner','due','actor'],
 resolve:['issue','evidence','release','actor'],
 reopen:['issue','reason','actor'],ignore:['issue','reason','actor'],
 log:['issue','body','actor'],
 'add-release':['project','environment','version','deployed','evidence','actor'],
 'review-privacy':['project','purpose','days','access-due','privacy-due','evidence','actor'],
 'weekly-review':[], 'draft-fix-brief':[],export:['out']
};
export const commands=[...Object.keys(reads),...Object.keys(specs)];
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const text=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(`Required ${label}`);if(v.length>4000)throw Error(`${label} exceeds 4000 characters`);return v.trim();};
export function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||new Date(v).toISOString().slice(0,10)!==v)throw Error('Expected a real YYYY-MM-DD date');return v;}
export function instant(v){
 let d;if(typeof v==='number'){if(!Number.isFinite(v)||v<0)throw Error('Invalid timestamp');d=new Date(v*1000);}
 else {if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v||''))throw Error('Timestamp needs ISO date, time and timezone');date(v.slice(0,10));d=new Date(v);}
 if(!Number.isFinite(d.getTime())||d.getTime()>Date.now()+300000)throw Error('Invalid or future timestamp');return d.toISOString();
}
const token=(v,label)=>{v=text(v,label);if(!/^[\w.:-]{1,150}$/.test(v))throw Error(`${label} must be a short identifier`);return v;};
export function scrub(v){return String(v).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').replace(/\bBearer\s+\S+/gi,'Bearer [redacted]').replace(/\b(password|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,'$1=[redacted]').replace(/https?:\/\/[^\s]+/g,m=>m.split(/[?#]/)[0]).slice(0,4000);}
function unwrap(v){
 if(v&&typeof v==='object'&&!Array.isArray(v)&&'err' in v){if(v.err!==0)throw Error('Rollbar response is an error');return unwrap(v.result);}
 if(Array.isArray(v))return v.flatMap(unwrap);
 if(v&&Array.isArray(v.instances))return v.instances.flatMap(unwrap);
 if(v&&Array.isArray(v.occurrences))return v.occurrences.flatMap(unwrap);
 return [v];
}
export function parseEvents(bytes){
 if(bytes.length>10*1024*1024)throw Error('Import exceeds 10 MB; split it into batches');
 let parsed;try{parsed=JSON.parse(bytes.toString('utf8'));}catch{throw Error('Expected saved occurrence JSON');}
 const list=unwrap(parsed);if(!list.length||list.length>10000)throw Error('Import must contain 1 to 10000 occurrences');
 return list.map((outer,index)=>{
  if(!outer||typeof outer!=='object')throw Error(`Row ${index+1}: occurrence object required`);
  const d=outer.data||outer;if(!d.body||typeof d.body!=='object')throw Error(`Row ${index+1}: full occurrence body required; item summaries cannot be imported`);
  const environment=token(d.environment,'environment').toLowerCase();const occurred_at=instant(d.timestamp??outer.timestamp);
  const level=d.level||'error';if(!['critical','error','warning','info','debug'].includes(level))throw Error('Invalid error level');
  const trace=d.body.trace;const message=d.body.message;
  if((!trace&&!message)||(trace&&message)||d.body.trace_chain||d.body.crash_report)throw Error('Supported body types: one trace or message; convert trace chains and crash reports explicitly');
  const title=scrub(text(trace?`${text(trace.exception?.class,'exception class')}: ${trace.exception?.message||''}`:message.body,'message'));
  const frames=(trace?.frames||[]).map(f=>({filename:scrub(text(f.filename,'frame filename')),method:scrub(String(f.method||'')),lineno:Number.isInteger(f.lineno)&&f.lineno>=0?f.lineno:null}));
  const release=token(String(d.code_version||'unknown'),'release');
  const explicit=d.fingerprint?token(String(d.fingerprint),'fingerprint'):null;
  const fingerprint=hash(explicit||[title,frames.map(f=>[f.filename,f.method])]);
  const payload={environment,occurred_at,level,title,release,frames,fingerprint};
  const payload_hash=hash(payload);const rawKey=d.uuid??outer.uuid??outer.id;
  if(typeof rawKey==='number'&&!Number.isSafeInteger(rawKey))throw Error('Occurrence id must be a safe integer or string');
  const event_key=rawKey==null?`content:${payload_hash}`:`source:${token(String(rawKey),'occurrence id')}`;
  return {...payload,event_key,payload,payload_hash};
 });
}
export async function resolveRecord(db,kind,query){
 query=text(query,kind);const config={projects:['code','name'],issues:['title']};if(!config[kind])throw Error('Invalid record type');
 const rows=await db.query(`select id,${config[kind].join(',')} from ${kind} order by id`);
 const exact=rows.filter(r=>r.id===query||config[kind].some(k=>String(r[k]).toLowerCase()===query.toLowerCase()));
 const matches=exact.length?exact:rows.filter(r=>r.id.startsWith(query.toLowerCase())||config[kind].some(k=>String(r[k]).toLowerCase().includes(query.toLowerCase())));
 if(matches.length!==1)throw Error(`${matches.length?'Ambiguous':'No matching'} ${kind}. Candidates: ${JSON.stringify(matches.length?matches:rows)}`);
 return matches[0].id;
}
function args(argv){const positional=[];const flags={};for(const x of argv){if(!x.startsWith('--'))positional.push(x);else{const i=x.indexOf('=');const k=x.slice(2,i<0?undefined:i);if(k in flags)throw Error(`Repeated flag --${k}`);flags[k]=i<0?true:x.slice(i+1);}}return {positional,flags};}
async function transaction(db,actor,fn,dry=false){await db.exec('BEGIN');try{await db.query("select set_config('app.actor',$1,true)",[text(actor,'actor')]);const result=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function details(db,q){const id=await resolveRecord(db,'issues',q);return [{...(await db.query('select * from issue_summary where id=$1',[id]))[0],notes:await db.query('select actor,body,created_at from notes where issue_id=$1 order by created_at',[id]),events:await db.query('select event_key,occurred_at,release,level,payload from occurrences where issue_id=$1 order by occurred_at desc',[id])}];}
export async function run(db,argv){
 const {positional:a,flags:f}=args(argv);const cmd=a.shift()||'help';
 if(!commands.includes(cmd))throw Error(`Unknown command ${cmd}`);
 for(const k of Object.keys(f))if(k!=='json'&&!(specs[cmd]||[]).includes(k))throw Error(`Unknown flag --${k} for ${cmd}`);
 if('dry-run' in f && f['dry-run']!==true && f['dry-run']!=='true')throw Error('Use --dry-run or omit it');
 if('json' in f && f.json!==true)throw Error('Use --json without a value');
 const nargs=cmd==='import'?1:['issue','history','draft-fix-brief'].includes(cmd)?1:0;
 if(a.length!==nargs)throw Error(`${cmd} expects ${nargs} positional argument(s)`);
 if(cmd in reads)return db.query(reads[cmd]);
 if(cmd==='help')return [{commands,syntax:'See docs/cli.md. Flags use --name=value. Writes require --actor=Name.'}];
 if(cmd==='issue')return details(db,a[0]);
 if(cmd==='history'){const id=await resolveRecord(db,'issues',a[0]);return db.query("select operation,actor,before_row,after_row,created_at from audit_log where entity='issues' and entity_id=$1 order by created_at,id",[id]);}
 if(cmd==='weekly-review'||cmd==='draft-fix-brief'){
  const sections=cmd==='weekly-review'?await Promise.all(['morning-triage','regressions','overdue','release-review','compliance'].map(async c=>({title:c,html:htmlTable(await db.query(reads[c]))}))):[{title:'Issue',html:htmlTable((await details(db,a[0])).map(({notes,events,...r})=>r))},{title:'Notes',html:htmlTable((await details(db,a[0]))[0].notes)}];
  const file=writeOut('drafts',`${cmd}-${randomUUID()}`,page({title:cmd==='weekly-review'?'Draft weekly error review':'Draft fix brief',subtitle:'Captured records only. Review before sharing.',sections}));return [{file}];
 }
 if(cmd==='export'){
  const dir=path.resolve(text(f.out,'out'));if(fs.existsSync(dir))throw Error('Export path already exists');
  const archive={format:'error-triage-v1',exported_at:new Date().toISOString(),collections:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const t of ['projects','imports','issues','occurrences','releases','notes','audit_log'])archive.collections[t]=await db.query(`select * from ${t} order by id`);}finally{await db.exec('ROLLBACK');}
  fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(dir,'archive.json'),JSON.stringify(archive,null,2),{mode:0o600,flag:'wx'});return [{directory:dir,collections:7}];
 }
 return transaction(db,f.actor,async()=>{
  if(cmd==='add-project'){
   const code=token(f.code,'code').toUpperCase();if(!/^[A-Z0-9_-]+$/.test(code))throw Error('Invalid project code');
   return db.query('insert into projects(code,name,owner) values($1,$2,$3) returning id,code,name',[code,text(f.name,'name'),text(f.owner,'owner')]);
  }
  if(cmd==='import'||cmd==='ingest'){
   if(cmd==='import'&&a[0]!=='rollbar')throw Error('Supported import: rollbar');
   const pid=await resolveRecord(db,'projects',f.project);const bytes=fs.readFileSync(text(f.file,'file'));const events=parseEvents(bytes);
   const imp=(await db.query('insert into imports(project_id,source,file_name,file_hash,rows_received,actor) values($1,$2,$3,$4,$5,$6) returning id',[pid,cmd==='import'?'rollbar':'local',path.basename(f.file),hash(bytes),events.length,f.actor]))[0].id;
   let inserted=0,skipped=0;
   for(const e of events){
    const seen=await db.query('select payload_hash from occurrences where project_id=$1 and event_key=$2',[pid,e.event_key]);
    if(seen.length){if(seen[0].payload_hash!==e.payload_hash)throw Error(`Occurrence ID reused with different data: ${e.event_key}`);skipped++;continue;}
    const issue=(await db.query(`insert into issues(project_id,environment,fingerprint,title,level) values($1,$2,$3,$4,$5) on conflict(project_id,environment,fingerprint) do update set level=case when array_position(array['debug','info','warning','error','critical'],excluded.level)>array_position(array['debug','info','warning','error','critical'],issues.level) then excluded.level else issues.level end returning id`,[pid,e.environment,e.fingerprint,e.title,e.level]))[0].id;
    await db.query('insert into occurrences(project_id,issue_id,import_id,event_key,occurred_at,release,level,payload,payload_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[pid,issue,imp,e.event_key,e.occurred_at,e.release,e.level,JSON.stringify(e.payload),e.payload_hash]);inserted++;
   }
   await db.query('update imports set rows_inserted=$1 where id=$2',[inserted,imp]);return [{received:events.length,inserted,skipped,dry_run:!!f['dry-run']}];
  }
  if(cmd==='add-release'){
   const pid=await resolveRecord(db,'projects',f.project);
   return db.query('insert into releases(project_id,environment,version,deployed_at,actor,evidence) values($1,$2,$3,$4,$5,$6) returning id,version',[pid,token(f.environment,'environment').toLowerCase(),token(f.version,'version'),instant(f.deployed),f.actor,text(f.evidence,'evidence')]);
  }
  if(cmd==='review-privacy'){
   const pid=await resolveRecord(db,'projects',f.project);const days=Number(f.days);if(!Number.isInteger(days)||days<1||days>3650)throw Error('days must be an integer from 1 to 3650');
   text(f.evidence,'evidence');const result=await db.query('update projects set purpose=$1,retention_days=$2,access_review_due=$3,privacy_review_due=$4 where id=$5 returning code,retention_days',[text(f.purpose,'purpose'),days,date(f['access-due']),date(f['privacy-due']),pid]);
   await db.query("insert into audit_log(entity,entity_id,operation,actor,after_row) values('privacy-review',$1,'REVIEW',$2,$3)",[pid,f.actor,JSON.stringify({evidence:f.evidence})]);return result;
  }
  const iid=await resolveRecord(db,'issues',f.issue);const issue=(await db.query('select * from issues where id=$1 for update',[iid]))[0];
  if(cmd==='assign')return db.query('update issues set owner=$1,due=$2 where id=$3 returning id,title,owner,due',[text(f.owner,'owner'),date(f.due),iid]);
  if(cmd==='log')return db.query('insert into notes(issue_id,actor,body) values($1,$2,$3) returning id,body',[iid,f.actor,scrub(text(f.body,'body'))]);
  if(cmd==='resolve'){
   if(issue.status!=='active')throw Error('Only an active issue can be resolved');
   const release=token(f.release,'release');const rows=await db.query('select id from releases where project_id=$1 and environment=$2 and version=$3',[issue.project_id,issue.environment,release]);if(!rows.length)throw Error('Record the fix release in this project and environment first');
   return db.query("update issues set status='resolved',resolved_at=now(),resolution=$1,fix_release=$2 where id=$3 returning id,title,status",[scrub(text(f.evidence,'evidence')),release,iid]);
  }
  if(cmd==='ignore'||cmd==='reopen'){
   const status=cmd==='ignore'?'ignored':'active';if(issue.status===status)throw Error(`Issue already ${status}`);
   await db.query('insert into notes(issue_id,actor,body) values($1,$2,$3)',[iid,f.actor,`${cmd}: ${scrub(text(f.reason,'reason'))}`]);
   return db.query('update issues set status=$1 where id=$2 returning id,title,status',[status,iid]);
  }
  throw Error('Unsupported write');
 },f['dry-run']===true||f['dry-run']==='true');
}
export function format(rows){
 if(!rows.length)return 'No matching records.';
 const keys=Object.keys(rows[0]);const str=v=>v==null?'':v instanceof Date?v.toISOString():typeof v==='object'?JSON.stringify(v):String(v).replace(/[\r\n\t]/g,' ');
 const values=rows.map(r=>keys.map(k=>str(r[k])));const widths=keys.map((k,i)=>Math.min(55,Math.max(k.length,...values.map(r=>r[i].length))));
 const line=r=>r.map((v,i)=>v.slice(0,widths[i]).padEnd(widths[i])).join('  ');
 return [line(keys),line(widths.map(n=>'-'.repeat(n))),...values.map(line)].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):format(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
