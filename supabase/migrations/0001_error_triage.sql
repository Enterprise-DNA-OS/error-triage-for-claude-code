create table projects (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9_-]+$'), name text not null,
 owner text not null, retention_days integer not null default 30 check(retention_days between 1 and 3650),
 purpose text not null default '', access_review_due date, privacy_review_due date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), source text not null,
 file_name text not null, file_hash text not null, rows_received integer not null check(rows_received>0),
 rows_inserted integer not null default 0, actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table issues (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), environment text not null,
 fingerprint text not null, title text not null, level text not null check(level in ('critical','error','warning','info','debug')),
 status text not null default 'active' check(status in ('active','resolved','ignored')), owner text, due date,
 resolved_at timestamptz, resolution text, fix_release text, regressions integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(project_id,environment,fingerprint), check(status<>'resolved' or (resolved_at is not null and length(resolution)>0))
);
create table occurrences (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), issue_id uuid not null references issues(id),
 import_id uuid not null references imports(id), event_key text not null, occurred_at timestamptz not null,
 release text not null default 'unknown', level text not null, payload jsonb not null, payload_hash text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,event_key)
);
create index occurrence_issue_time on occurrences(issue_id,occurred_at desc);
create index occurrence_time on occurrences(occurred_at);
create table releases (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), environment text not null,
 version text not null, deployed_at timestamptz not null, actor text not null, evidence text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,environment,version)
);
create table notes (
 id uuid primary key default gen_random_uuid(), issue_id uuid not null references issues(id), actor text not null, body text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table audit_log (
 id uuid primary key default gen_random_uuid(), entity text not null, entity_id uuid not null, operation text not null,
 actor text not null, before_row jsonb, after_row jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_record() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function audit_record() returns trigger language plpgsql as $$ begin
 insert into audit_log(entity,entity_id,operation,actor,before_row,after_row)
 values(TG_TABLE_NAME,new.id,TG_OP,coalesce(nullif(current_setting('app.actor',true),''),'database operator'),
 case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new)); return new;
end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'append-only record'; end $$;
create function reopen_issue() returns trigger language plpgsql as $$ begin
 if not exists(select 1 from issues where id=new.issue_id and project_id=new.project_id) then raise exception 'Issue/project mismatch'; end if;
 update issues set status='active',regressions=regressions+1 where id=new.issue_id and status='resolved' and new.occurred_at>resolved_at;
 return new;
end $$;
create trigger reopen_after_occurrence after insert on occurrences for each row execute function reopen_issue();
do $$ declare t text; begin
 foreach t in array array['projects','imports','issues','occurrences','releases','notes','audit_log'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 execute format('create trigger touch before update on %I for each row execute function touch_record()',t);
 end loop;
 foreach t in array array['projects','issues','releases','notes'] loop
 execute format('create trigger audit after insert or update on %I for each row execute function audit_record()',t);
 end loop;
 foreach t in array array['occurrences','notes','releases','audit_log'] loop
 execute format('create trigger immutable before update or delete on %I for each row execute function immutable_record()',t);
 end loop;
end $$;
create view issue_summary as
select i.id,p.code project,i.environment,i.title,i.level,i.status,i.owner,i.due,i.regressions,i.fix_release,
 count(o.id)::int occurrences, count(o.id) filter(where o.occurred_at>=now()-interval '24 hours')::int last_24h,
 min(o.occurred_at) first_seen,max(o.occurred_at) last_seen,
 count(distinct o.release)::int release_count,
 case when i.status='active' and i.due<current_date then true else false end overdue
from issues i join projects p on p.id=i.project_id left join occurrences o on o.issue_id=i.id
group by i.id,p.code;
create view triage_queue as select * from issue_summary where status='active' order by
 case level when 'critical' then 0 when 'error' then 1 when 'warning' then 2 else 3 end, last_24h desc,title;
create view release_health as
select r.id,p.code project,r.environment,r.version,r.deployed_at,
 count(o.id)::int captured_occurrences,count(distinct o.issue_id)::int affected_issues,
 count(o.id) filter(where i.status='active')::int occurrences_on_active_issues
from releases r join projects p on p.id=r.project_id
left join issues i on i.project_id=r.project_id and i.environment=r.environment
left join occurrences o on o.issue_id=i.id and o.release=r.version
group by r.id,p.code;
create view record_checks as
select 'P05' rule,p.code reference,'Access review missing or overdue' problem from projects p where access_review_due is null or access_review_due<current_date
union all select 'P09',p.code,'Purpose or retention review missing or overdue' from projects p where purpose='' or privacy_review_due is null or privacy_review_due<current_date
union all select 'P09-RET',p.code,'Captured occurrences exceed the local retention period; review and arrange authorised disposal' from projects p where exists(select 1 from occurrences o where o.project_id=p.id and o.occurred_at<now()-make_interval(days=>p.retention_days))
union all select 'T01',project||' / '||title,'Active issue has no accountable owner' from triage_queue where owner is null
union all select 'T02',project||' / '||title,'Fix commitment overdue' from triage_queue where overdue
union all select 'T03',p.code,'No occurrences captured in the last 24 hours; collection status is unknown' from projects p where not exists(select 1 from occurrences o where o.project_id=p.id and o.occurred_at>=now()-interval '24 hours');
