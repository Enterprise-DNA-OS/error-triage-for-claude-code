import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,reads,commands,parseEvents,resolveRecord,format,date,instant} from './triage.mjs';
import {captureError} from './lib/capture.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'error-triage-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;process.env.DATABASE_URL=process.env.TRIAGE_TEST_POSTGRES_URL||'';
let db,n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;};const ok=x=>{assert.ok(x);n++;};
const bad=async(fn,re)=>{await assert.rejects(fn,re);n++;};const throws=(fn,re)=>{assert.throws(fn,re);n++;};
const call=(...a)=>run(db,a);const write=(c,opts={})=>call(c,...Object.entries({actor:'Test operator',...opts}).map(([k,v])=>`--${k}=${v}`));
try{
 throws(()=>date('2026-02-30'),/real/);throws(()=>instant('2026-01-01'),/timezone/);throws(()=>instant('2999-01-01T00:00:00Z'),/future/);
 const fixture=fs.readFileSync(path.join(REPO_ROOT,'tests/fixtures/rollbar-occurrences.json'));
 const events=parseEvents(fixture);eq(events.length,3);eq(events[0].title,'TimeoutError: Supplier response late');ok(!JSON.stringify(events).includes('TEST-ONLY'));ok(!JSON.stringify(events).includes('fiction@example'));
 throws(()=>parseEvents(Buffer.from('{"err":1,"message":"bad"}')),/error/);
 throws(()=>parseEvents(Buffer.from('{"id":1,"title":"summary"}')),/full occurrence/);
 throws(()=>parseEvents(Buffer.from('[]')),/1 to 10000/);
 throws(()=>parseEvents(Buffer.from('[null]')),/object/);
 throws(()=>parseEvents(Buffer.from('bad')),/JSON/);
 const raw=JSON.parse(fixture);raw[0].result.data.level='urgent';throws(()=>parseEvents(Buffer.from(JSON.stringify(raw))),/level/);
 db=await getDb();eq((await migrate(db)).ran.length,1);eq((await migrate(db)).ran.length,0);await seed(db);
 const count=(t)=>db.query(`select count(*)::int n from ${t}`).then(r=>r[0].n);
 const auditCount=await count('audit_log');await seed(db);eq(await count('audit_log'),auditCount);
 for(const c of Object.keys(reads))ok(Array.isArray(await call(c)));
 eq((await call('morning-triage'))[0].last_24h,3);eq((await call('regressions'))[0].regressions,1);
 eq((await call('release-review'))[0].captured_occurrences,4);eq((await call('overdue')).length,1);
 eq((await call('retention'))[0].records_due_review,1);ok((await call('compliance')).some(r=>r.rule==='T03'));
 eq((await call('issue','invoice attachment'))[0].events.length,2);ok((await call('history','invoice attachment')).length>=2);
 await bad(()=>call('unknown'),/Unknown command/);await bad(()=>call('issues','--max=4'),/Unknown flag/);await bad(()=>call('issues','oops'),/positional/);
 await bad(()=>write('add-project',{code:'BAD',name:'bad'}),/owner/);await bad(()=>call('add-project','--code=X'),/actor/);
 await write('add-project',{code:'IMPORT',name:'Import project',owner:'Tester'});await write('add-project',{code:'IMPORT2',name:'Import duplicate',owner:'Tester'});
 await bad(()=>resolveRecord(db,'projects','Impor'),/Ambiguous/);eq(await resolveRecord(db,'projects','import2'),await resolveRecord(db,'projects','IMPORT2'));
 const file=path.join(tmp,'export.json');fs.writeFileSync(file,fixture);
 const imp=opts=>call('import','rollbar',...Object.entries({project:'IMPORT',file,actor:'Importer',...opts}).map(([k,v])=>`--${k}=${v}`));
 await bad(()=>imp({'dry-run':'false'}),/dry-run/);
 eq((await imp({'dry-run':true}))[0].inserted,3);eq(await count('occurrences'),7);eq(await count('imports'),1);
 eq((await imp())[0].inserted,3);eq((await imp())[0].skipped,3);eq(await count('occurrences'),10);
 const iid=await resolveRecord(db,'issues','TimeoutError: Supplier response late');
 eq((await call('issue',iid))[0].occurrences,3);
 const changed=JSON.parse(fixture);changed[0].result.data.body.trace.exception.message='Changed same ID';fs.writeFileSync(file,JSON.stringify(changed));await bad(()=>imp(),/reused/);eq(await count('occurrences'),10);
 fs.writeFileSync(file,fixture);
 // A late database failure rolls the whole import back, including its provenance record.
 const beforeImports=await count('imports');const rollback=JSON.parse(fixture);rollback.forEach((r,i)=>r.result.id=1000+i);fs.writeFileSync(file,JSON.stringify(rollback));
 await db.exec("create function reject_test() returns trigger language plpgsql as $$ begin if new.event_key='source:1001' then raise exception 'forced failure'; end if; return new; end $$; create trigger reject_test before insert on occurrences for each row execute function reject_test();");
 await bad(()=>imp(),/forced failure/);eq(await count('imports'),beforeImports);eq(await count('occurrences'),10);
 await db.exec('drop trigger reject_test on occurrences; drop function reject_test();');
 await write('assign',{issue:iid,owner:'Fix owner',due:'2026-01-15'});eq((await call('issue',iid))[0].owner,'Fix owner');
 await bad(()=>write('assign',{issue:iid,owner:'Tester',due:'2026-02-30'}),/real/);
 await bad(()=>write('resolve',{issue:iid,evidence:'Checked',release:'1.0'}),/release/);
 await write('add-release',{project:'IMPORT',environment:'production',version:'1.0',deployed:'2025-01-01T00:00:00Z',evidence:'Test release evidence'});
 await write('resolve',{issue:iid,evidence:'Regression test passed',release:'1.0'});eq((await call('issue',iid))[0].status,'resolved');
 await bad(()=>write('resolve',{issue:iid,evidence:'Again',release:'1.0'}),/active/);
 // Previously unseen old occurrences do not reopen a fix.
 eq((await imp())[0].inserted,3);eq((await call('issue',iid))[0].status,'resolved');
 // Simulate a fix recorded yesterday, then a freshly captured recurrence today.
 await db.query("update issues set resolved_at=now()-interval '1 day' where id=$1",[iid]);
 const recurrence=JSON.parse(fixture)[0];recurrence.result.id=2001;recurrence.result.data.timestamp=Date.now()/1000;
 fs.writeFileSync(file,JSON.stringify(recurrence));eq((await imp())[0].inserted,1);eq((await call('issue',iid))[0].regressions,1);eq((await call('issue',iid))[0].status,'active');
 await write('ignore',{issue:iid,reason:'Known synthetic fixture'});eq((await call('issue',iid))[0].status,'ignored');
 await write('reopen',{issue:iid,reason:'Resume investigation'});eq((await call('issue',iid))[0].status,'active');
 await write('log',{issue:iid,body:'Test <script>bad()</script> and token=TEST-ONLY'});ok(!(await call('issue',iid))[0].notes.some(r=>r.body.includes('TEST-ONLY')));
 await write('review-privacy',{project:'IMPORT',purpose:'Debugging with minimum fields',days:3650,'access-due':'2099-01-01','privacy-due':'2099-01-01',evidence:'Checked named roles and retention purpose'});
 ok(!(await call('compliance')).some(r=>r.reference==='IMPORT'&&['P05','P09'].includes(r.rule)));
 const event=(await db.query('select id from occurrences limit 1'))[0];await bad(()=>db.query('update occurrences set release=$1 where id=$2',['bad',event.id]),/append-only/);
 await bad(()=>db.exec('delete from audit_log'),/append-only/);
 const captured=captureError(new Error('Native test error'),{directory:path.join(tmp,'inbox'),environment:'test',release:'1.0',fingerprint:'native-test'});
 eq((await write('ingest',{project:'IMPORT',file:captured}))[0].inserted,1);
 eq((await write('ingest',{project:'IMPORT',file:captured}))[0].skipped,1);
 // Environment separation prevents grouping identical errors across production and test.
 recurrence.result.id=3000;recurrence.result.data.environment='test';fs.writeFileSync(file,JSON.stringify(recurrence));await imp();
 await bad(()=>resolveRecord(db,'issues','TimeoutError: Supplier response late'),/Ambiguous/);
 for(const c of ['weekly-review','draft-fix-brief']){const f=(await call(c,...(c==='draft-fix-brief'?[iid]:[])))[0].file;const html=fs.readFileSync(f,'utf8');ok(html.includes('Draft'));ok(!html.includes('<script>bad()'));
 if(c==='draft-fix-brief')ok(html.includes('&lt;script&gt;'));}
 const out=path.join(tmp,'archive');eq((await call('export',`--out=${out}`))[0].collections,7);ok(!fs.readFileSync(path.join(out,'archive.json'),'utf8').includes('TEST-ONLY'));await bad(()=>call('export',`--out=${out}`),/exists/);
 ok(format(await call('morning-triage')).includes('Harbour')===false); // Project codes are displayed, names are not.
 ok(format(await call('morning-triage')).includes('HARBOUR'));ok((await call('help'))[0].commands.includes('import'));
 await db.close();db=null;
 for(const script of ['view','docs']){const p=spawnSync(process.execPath,[`scripts/${script}.mjs`],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(p.status,0,p.stderr);n++;}
 const json=spawnSync(process.execPath,['scripts/triage.mjs','issues','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(json.status,0);ok(Array.isArray(JSON.parse(json.stdout)));
 const ambiguous=spawnSync(process.execPath,['scripts/triage.mjs','issue','TimeoutError: Supplier response late'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(ambiguous.status,1);ok(ambiguous.stderr.includes('Candidates:'));
 console.log(`PASS: ${n} assertions; all ${commands.length} CLI commands; isolated ${process.env.DATABASE_URL?'Postgres':'PGlite'} database.`);
}finally{if(db)await db.close();fs.rmSync(tmp,{recursive:true,force:true});}
