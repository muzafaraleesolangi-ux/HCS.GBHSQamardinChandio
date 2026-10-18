create or replace function monthly_v2.merge_report_value(b jsonb,l jsonb,r jsonb,p text default '') returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; key text; v jsonb; bm jsonb; lm jsonb; rm jsonb;
begin
 if l is not distinct from b then return r; end if;
 if r is not distinct from b or l is not distinct from r then return l; end if;
 if jsonb_typeof(l)='object' and jsonb_typeof(r)='object' and (b is null or jsonb_typeof(b)='object') then
  result:='{}';for key in select distinct k from (select jsonb_object_keys(coalesce(b,'{}')) k union all select jsonb_object_keys(l) union all select jsonb_object_keys(r)) q loop
   v:=monthly_v2.merge_report_value(b->key,l->key,r->key,p||'.'||key);if v is not null then result:=result||jsonb_build_object(key,v);end if;
  end loop;return result;
 end if;
 if jsonb_typeof(l)='array' and jsonb_typeof(r)='array' and (p in ('.teachers','.assignments')) then
  select coalesce(jsonb_object_agg(x->>'id',x),'{}') into bm from jsonb_array_elements(coalesce(b,'[]')) x;
  select coalesce(jsonb_object_agg(x->>'id',x),'{}') into lm from jsonb_array_elements(l) x;
  select coalesce(jsonb_object_agg(x->>'id',x),'{}') into rm from jsonb_array_elements(r) x;
  v:=monthly_v2.merge_report_value(bm,lm,rm,p||'.items');
  select coalesce(jsonb_agg(v->id order by seq),'[]') into result from (select id,min(seq) seq from (select x->>'id' id,ord seq from jsonb_array_elements(r) with ordinality t(x,ord) union all select x->>'id',100000+ord from jsonb_array_elements(l) with ordinality t(x,ord)) q group by id) q where v ? id;
  return result;
 end if;
 if p='.classes' and jsonb_typeof(l)='array' and jsonb_typeof(r)='array' then
  select coalesce(jsonb_agg(x order by x),'[]') into result from (select distinct x from (select x from jsonb_array_elements(l) x union all select x from jsonb_array_elements(r) x) q where not (coalesce(b,'[]') @> jsonb_build_array(x)) or (l @> jsonb_build_array(x) and r @> jsonb_build_array(x))) q;return result;
 end if;
 raise exception 'The same field was changed on another device (%). Your edits are retained. Reopen the month to compare before saving.',p using errcode='40001';
end $$;
revoke all on function monthly_v2.merge_report_value(jsonb,jsonb,jsonb,text) from public,anon,authenticated;

create or replace function monthly_v2.collaborative_save(payload jsonb,token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; old monthly_v2.reports; merged jsonb; result jsonb; item jsonb; teacher jsonb; seen text[]:='{}'; k text; final boolean:=coalesce((payload->>'final')::boolean,false); target_status text;
begin
 select account_id into aid from monthly_v2.sessions s where s.token=collaborative_save.token and expires>now();
 if aid is null then raise exception 'Please sign in again' using errcode='42501';end if;
 if octet_length(payload::text)>2000000 or jsonb_typeof(payload->'data') is distinct from 'object' or jsonb_typeof(payload->'base') is distinct from 'object' then raise exception 'Invalid report';end if;
 if coalesce(payload->>'month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Select a valid month';end if;
 perform pg_advisory_xact_lock(hashtext(aid::text||(payload->>'month')));
 select * into old from monthly_v2.reports where account_id=aid and month=payload->>'month' for update;
 merged:=monthly_v2.merge_report_value(payload->'base',payload->'data',coalesce(old.data,payload->'base'));
 if jsonb_typeof(merged->'classes') is distinct from 'array' or jsonb_typeof(merged->'teachers') is distinct from 'array' or jsonb_typeof(merged->'assignments') is distinct from 'array' then raise exception 'Invalid teacher records';end if;
 for item in select * from jsonb_array_elements(merged->'assignments') loop
  if not (merged->'classes' @> jsonb_build_array((item->>'grade')::int)) then raise exception 'A selected subject belongs to a class removed on another device. Reopen the month before saving.';end if;
  k:=(item->>'grade')||':'||lower(trim(item->>'name'));if k=any(seen) then raise exception 'This subject for this class is already assigned. Refresh the subject choices.';end if;seen:=array_append(seen,k);
 end loop;
 if final then
  if length(trim(coalesce(merged->'profile'->>'school','')))=0 or length(trim(coalesce(merged->'profile'->>'hm','')))=0 or coalesce(merged->>'date','')='' or coalesce(merged->'profile'->>'bps','')='' or jsonb_array_length(merged->'teachers')=0 or jsonb_array_length(merged->'assignments')=0 then raise exception 'Complete school details, teachers and subject progress before final save';end if;
  for teacher in select * from jsonb_array_elements(merged->'teachers') loop
   if length(trim(coalesce(teacher->>'name','')))=0 or coalesce(teacher->>'pid','') !~ '^[0-9]+$' or not exists(select 1 from jsonb_array_elements(merged->'assignments') a where a->>'teacher'=teacher->>'id') then raise exception 'Complete each teacher name, PID and at least one subject';end if;
  end loop;
  for item in select * from jsonb_array_elements(merged->'assignments') loop
   foreach k in array array['previous','current','notebooks','cleanliness','feedback','suggestions'] loop if coalesce(trim(item->>k),'')='' then raise exception 'Complete all teacher progress and inspection fields before final save';end if;end loop;
   if (item->>'notebooks')::numeric not between 0 and 100 then raise exception 'Notebook percentage must be between 0 and 100';end if;
  end loop;
 end if;
 target_status:=case when final then 'Saved' when merged is not distinct from old.data then coalesce(old.status,'Draft') else 'Draft' end;
 if merged is not distinct from old.data then
  update monthly_v2.reports set status=target_status where account_id=aid and month=payload->>'month';
  return jsonb_build_object('data',merged,'revision',old.revision,'status',target_status);
 end if;
 result:=monthly_v2.api('save',jsonb_build_object('month',payload->>'month','data',merged,'revision',coalesce(old.revision,0)),token);
 update monthly_v2.reports set status=target_status where account_id=aid and month=payload->>'month';
 if payload->'data'->'profile' is distinct from payload->'base'->'profile' then perform monthly_v2.api('profile',merged->'profile',token);end if;
 return jsonb_build_object('data',merged,'revision',result->'revision','status',target_status);
end $$;
revoke all on function monthly_v2.collaborative_save(jsonb,text) from public;
grant execute on function monthly_v2.collaborative_save(jsonb,text) to anon,authenticated;

do $$ declare c text;begin
 for c in select conname from pg_constraint where conrelid='monthly_v2.reports'::regclass and contype='c' and pg_get_constraintdef(oid) like '%status%' loop execute format('alter table monthly_v2.reports drop constraint %I',c);end loop;
 alter table monthly_v2.reports add constraint reports_status_check check(status in ('Draft','Saved','Exported'));
end $$;
create or replace function public.sv_monthly_v2(p_action text,p_payload jsonb default '{}'::jsonb,p_token text default null) returns jsonb language sql security invoker set search_path='' as $$select case when p_action='collaborative_save' then monthly_v2.collaborative_save(p_payload,p_token) else monthly_v2.api(p_action,p_payload,p_token) end;$$;
