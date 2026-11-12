do $$
declare p uuid; p2 uuid; imp uuid; i uuid; i2 uuid; i3 uuid;
begin
 if exists(select 1 from projects where code='HARBOUR') then return; end if;
 perform set_config('app.actor','Fictional demo seed',true);
 insert into projects(code,name,owner,purpose,retention_days,access_review_due,privacy_review_due)
 values('HARBOUR','Harbour Orders','Mere Lane','Investigate application faults',30,current_date+30,current_date-3) returning id into p;
 insert into projects(code,name,owner) values('HARBOUR_TEST','Harbour Sandbox','Alex Reed') returning id into p2;
 insert into imports(project_id,source,file_name,file_hash,rows_received,rows_inserted,actor)
 values(p,'demo','fictional-seed','demo-seed-v1',7,7,'Fictional demo seed') returning id into imp;
 insert into issues(project_id,environment,fingerprint,title,level,owner,due)
 values(p,'production','timeout','Order confirmation timeout','critical','Mere Lane',current_date-2) returning id into i;
 insert into issues(project_id,environment,fingerprint,title,level,status,resolved_at,resolution,fix_release,owner,due)
 values(p,'production','invoice','Invoice attachment missing','error','resolved',now()-interval '2 days','Added missing attachment check','2.4.1','Alex Reed',current_date+2) returning id into i2;
 insert into issues(project_id,environment,fingerprint,title,level)
 values(p,'production','search','Search term validation failed','warning') returning id into i3;
 insert into releases(project_id,environment,version,deployed_at,actor,evidence) values(p,'production','2.4.1',now()-interval '3 days','Demo release manager','Fictional release log');
 insert into occurrences(project_id,issue_id,import_id,event_key,occurred_at,release,level,payload,payload_hash) values
 (p,i,imp,'seed-1',now()-interval '40 days','2.3.0','critical','{}','demo1'),
 (p,i,imp,'seed-2',now()-interval '3 hours','2.4.1','critical','{}','demo2'),
 (p,i,imp,'seed-3',now()-interval '2 hours','2.4.1','critical','{}','demo3'),
 (p,i,imp,'seed-4',now()-interval '1 hour','2.4.1','critical','{}','demo4'),
 (p,i2,imp,'seed-5',now()-interval '5 days','2.4.0','error','{}','demo5'),
 (p,i2,imp,'seed-6',now()-interval '4 hours','2.4.1','error','{}','demo6'),
 (p,i3,imp,'seed-7',now()-interval '2 days','2.4.0','warning','{}','demo7');
 insert into notes(issue_id,actor,body) values(i,'Mere Lane','Fictional support report: order confirmations delayed. Check the retry path.'),(i2,'Alex Reed','Recurred after the recorded fix. Reopen the investigation.');
end $$;
