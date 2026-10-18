CREATE OR REPLACE FUNCTION monthly_v2.api(action text, payload jsonb, token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare aid uuid; rec monthly_v2.accounts; result jsonb; sid text; role_name text; item jsonb; seen text[]:='{}'; k text; rev int; n int; v_semis text;
begin
if octet_length(payload::text)>1000000 then raise exception 'Report too large';end if;
if action in ('admin_schools','admin_school','admin_profile','admin_reset','admin_delete_school','admin_report_save','admin_teacher_remove','admin_reports','admin_exported') then return monthly_v2.manage(action,payload,token);end if;
if action='catalog' then return coalesce((select jsonb_agg(to_jsonb(c) order by grade,name) from monthly_v2.catalog c where active),'[]');end if;
if action like 'admin_%' then
 select role into role_name from public.sv_who(token);
 if role_name is distinct from 'MASTER' then raise exception 'Master Admin access required' using errcode='42501';end if;
 if action='admin_save' then
  if jsonb_typeof(payload->'chapters') is distinct from 'array' then raise exception 'Invalid chapter names';end if;
  
  insert into monthly_v2.catalog(id,grade,name,total,chapters) values(coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()),(payload->>'grade')::int,trim(payload->>'name'),(payload->>'total')::int,payload->'chapters') on conflict(id) do update set grade=excluded.grade,name=excluded.name,total=excluded.total,chapters=excluded.chapters,active=true;
 elsif action='admin_remove' then update monthly_v2.catalog set active=false where id=(payload->>'id')::uuid;
 else raise exception 'Unknown admin action';end if;
 return jsonb_build_object('ok',true);
end if;
if action in ('signup','login') then
 v_semis:=trim(payload->>'semis');
 if v_semis is null or v_semis !~ '^[0-9]{9}$' or length(coalesce(payload->>'password',''))<8 or length(payload->>'password')>72 then raise exception 'Use a 9-digit SEMIS and an 8–72 character password';end if;
 if action='signup' then
  if length(trim(coalesce(payload->'profile'->>'school','')))=0 or length(trim(coalesce(payload->'profile'->>'hm','')))=0 then raise exception 'School and HM names are required';end if;
  if payload->>'password' is distinct from payload->>'confirm_password' then raise exception 'Passwords do not match';end if;
  select * into rec from monthly_v2.accounts a where a.semis=v_semis for update;
  if rec.id is not null then
   if rec.reset_hash is null or rec.reset_until is null or rec.reset_until<now() then raise exception 'School already registered. Ask the Master Admin to reset it before registering again. Your saved work will be retained.';end if;
   update monthly_v2.accounts set pass=extensions.crypt(payload->>'password',extensions.gen_salt('bf',10)),reset_hash=null,reset_until=null where id=rec.id returning * into rec;
  else
  insert into monthly_v2.accounts(semis,profile,pass) values(v_semis,payload->'profile',extensions.crypt(payload->>'password',extensions.gen_salt('bf',10))) returning * into rec;
  end if;
 else
  insert into monthly_v2.login_limits(semis) values(v_semis) on conflict do nothing;
  select attempts into n from monthly_v2.login_limits where semis=v_semis and since>now()-interval '15 minutes' for update;
  if coalesce(n,0)>=10 then return jsonb_build_object('error','Too many attempts. Try again in 15 minutes.');end if;
  select * into rec from monthly_v2.accounts a where a.semis=v_semis and a.pass=extensions.crypt(payload->>'password',a.pass) and a.reset_hash is null;
  if rec.id is null then
   update monthly_v2.login_limits set attempts=case when since<now()-interval '15 minutes' then 1 else attempts+1 end,since=case when since<now()-interval '15 minutes' then now() else since end where semis=v_semis;
   return jsonb_build_object('error','SEMIS or password is incorrect');
  end if;
  delete from monthly_v2.login_limits where semis=v_semis;
 end if;
 sid:=encode(extensions.gen_random_bytes(32),'hex');insert into monthly_v2.sessions(token,account_id) values(sid,rec.id);
 return jsonb_build_object('token',sid,'profile',rec.profile,'semis',rec.semis);
end if;
select account_id into aid from monthly_v2.sessions s where s.token=api.token and expires>now();
if aid is null then raise exception 'Please sign in again' using errcode='42501';end if;
if action='logout' then delete from monthly_v2.sessions s where s.token=api.token;return jsonb_build_object('ok',true);end if;
if action='workspace' then return jsonb_build_object('profile',(select profile from monthly_v2.accounts where id=aid),'semis',(select semis from monthly_v2.accounts where id=aid),'reports',coalesce((select jsonb_agg(jsonb_build_object('month',month,'status',status,'updated',updated,'revision',revision) order by month desc) from monthly_v2.reports where account_id=aid),'[]'));end if;
if action='load' then return (select jsonb_build_object('data',data,'revision',revision,'status',status) from monthly_v2.reports where account_id=aid and month=payload->>'month');end if;
if action='profile' then
 if length(trim(coalesce(payload->>'school','')))=0 or length(trim(coalesce(payload->>'hm','')))=0 then raise exception 'School and HM names required';end if;
 update monthly_v2.accounts set profile=payload where id=aid;return jsonb_build_object('ok',true);end if;
if action='save' then
 if jsonb_typeof(payload->'data'->'teachers') is distinct from 'array' or jsonb_array_length(payload->'data'->'teachers')=0 then raise exception 'Select at least one teacher before saving a report';end if;
 if jsonb_typeof(payload->'data'->'assignments') is distinct from 'array' then raise exception 'Invalid report';end if;
 for item in select * from jsonb_array_elements(payload->'data'->'assignments') loop

  if jsonb_typeof(payload->'data'->'teachers') is distinct from 'array' or not exists(select 1 from jsonb_array_elements(payload->'data'->'teachers') t where t->>'id'=item->>'teacher') then raise exception 'Assignment teacher is missing';end if;
  if not exists(select 1 from monthly_v2.catalog c where c.id::text=item->>'subject_id' and c.grade=(item->>'grade')::int and c.total=(item->>'total')::int and c.name=item->>'name' and c.active)
  and not exists(select 1 from monthly_v2.reports r cross join lateral jsonb_array_elements(r.data->'assignments') a where r.account_id=aid and a->>'subject_id'=item->>'subject_id' and a->>'grade'=item->>'grade' and a->>'total'=item->>'total' and a->>'name'=item->>'name') then raise exception 'Use the curriculum published by the Master Admin';end if;
  k:=(item->>'grade')||':'||(item->>'subject_id');
  if k=any(seen) then raise exception 'A class subject can only be assigned once';end if;seen:=array_append(seen,k);
  if not (item->>'grade')::int between 1 and 5 then raise exception 'Classes 1–5 only';end if;
  if coalesce(nullif(item->>'previous',''),'0')::numeric<0 or coalesce(nullif(item->>'current',''),'0')::numeric<0 or (item->>'total')::numeric<0 or coalesce(nullif(item->>'previous',''),'0')::numeric+coalesce(nullif(item->>'current',''),'0')::numeric>(item->>'total')::numeric then raise exception 'Covered chapters cannot exceed total';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtext(aid::text||coalesce(payload->>'month','')));
 select revision into rev from monthly_v2.reports where account_id=aid and month=payload->>'month' for update;
 if coalesce(rev,0)<>coalesce((payload->>'revision')::int,0) then raise exception 'This report changed in another tab. Reopen it before saving.';end if;
 insert into monthly_v2.reports(account_id,month,data,revision) values(aid,payload->>'month',payload->'data',1) on conflict(account_id,month) do update set data=excluded.data,status='Draft',updated=now(),revision=monthly_v2.reports.revision+1 returning revision into rev;
 return jsonb_build_object('revision',rev);
end if;
if action='exported' then update monthly_v2.reports set status='Exported',updated=now() where account_id=aid and month=payload->>'month' and revision=(payload->>'revision')::int;return jsonb_build_object('ok',found);end if;
raise exception 'Unknown action';
end;$function$;

CREATE OR REPLACE FUNCTION monthly_v2.collaborative_save(payload jsonb, token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare aid uuid; old monthly_v2.reports; merged jsonb; result jsonb; item jsonb; teacher jsonb; seen text[]:='{}'; k text; final boolean:=coalesce((payload->>'final')::boolean,false); target_status text;
begin
 select account_id into aid from monthly_v2.sessions s where s.token=collaborative_save.token and expires>now();
 if aid is null then raise exception 'Please sign in again' using errcode='42501';end if;
 if octet_length(payload::text)>2000000 or jsonb_typeof(payload->'data') is distinct from 'object' or jsonb_typeof(payload->'base') is distinct from 'object' then raise exception 'Invalid report';end if;
 if coalesce(payload->>'month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Select a valid month';end if;
 perform pg_advisory_xact_lock(hashtext(aid::text||(payload->>'month')));
 select * into old from monthly_v2.reports where account_id=aid and month=payload->>'month' for update;
 if old.account_id is null and (coalesce((payload->>'base_revision')::int,0)>0 or (not(payload ? 'base_revision') and jsonb_array_length(coalesce(payload->'base'->'teachers','[]'))>0)) then raise exception 'This report was deleted. Your local edits are retained. Open a new month explicitly to start again.';end if;
 merged:=monthly_v2.merge_report_value(payload->'base',payload->'data',coalesce(old.data,payload->'base'));
 if jsonb_typeof(merged->'classes') is distinct from 'array' or jsonb_typeof(merged->'teachers') is distinct from 'array' or jsonb_typeof(merged->'assignments') is distinct from 'array' then raise exception 'Invalid teacher records';end if;
 if jsonb_array_length(merged->'teachers')=0 then raise exception 'Select at least one teacher before saving a report';end if;
 for item in select * from jsonb_array_elements(merged->'assignments') loop
  if not (merged->'classes' @> jsonb_build_array((item->>'grade')::int)) then raise exception 'A selected subject belongs to a class removed on another device. Reopen the month before saving.';end if;
  k:=(item->>'grade')||':'||lower(trim(item->>'name'));if k=any(seen) then raise exception 'This subject for this class is already assigned. Refresh the subject choices.';end if;seen:=array_append(seen,k);
 end loop;
 if final then
  if length(trim(coalesce(merged->'profile'->>'school','')))=0 or length(trim(coalesce(merged->'profile'->>'hm','')))=0 or coalesce(merged->>'date','')='' or coalesce(merged->'profile'->>'bps','')='' or jsonb_array_length(merged->'teachers')=0 or jsonb_array_length(merged->'assignments')=0 then raise exception 'Complete school details, teachers and subject progress before final save';end if;
  for teacher in select * from jsonb_array_elements(merged->'teachers') loop
   if length(trim(coalesce(teacher->>'name','')))=0 or coalesce(teacher->>'pid','') !~ '^[0-9]+$' or not exists(select 1 from jsonb_array_elements(merged->'assignments') a where a->>'teacher'=teacher->>'id') then raise exception 'Complete each teacher name, PID and at least one subject';end if;
  end loop;
  if jsonb_array_length(merged->'teachers')=0 then raise exception 'Select at least one teacher before saving a report';end if;
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
end $function$;

CREATE OR REPLACE FUNCTION monthly_v2.merge_report_value(b jsonb, l jsonb, r jsonb, p text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb; key text; v jsonb; bm jsonb; lm jsonb; rm jsonb;
begin
 if l is not distinct from b then return r; end if;
 if r is not distinct from b or l is not distinct from r then return l; end if;
 if jsonb_typeof(l)='object' and jsonb_typeof(r)='object' and (b is null or jsonb_typeof(b)='object') then
  result:='{}';for key in select distinct k from (select jsonb_object_keys(coalesce(b,'{}')) k union all select jsonb_object_keys(l) union all select jsonb_object_keys(r)) q loop
   v:=monthly_v2.merge_report_value(b->key,l->key,r->key,p||'.'||key);if v is not null then result:=result||jsonb_build_object(key,v);end if;
  end loop;return result;
 end if;
 if jsonb_typeof(l)='array' and jsonb_typeof(r)='array' and (p in ('.teachers','.assignments','.teacher_pool')) then
  select coalesce(jsonb_object_agg(x->>'id',x),'{}') into bm from jsonb_array_elements(coalesce(b,'[]')) x;
  select coalesce(jsonb_object_agg(x->>'id',x),'{}') into lm from jsonb_array_elements(l) x;
  select coalesce(jsonb_object_agg(x->>'id',x),'{}') into rm from jsonb_array_elements(r) x;
  v:=monthly_v2.merge_report_value(bm,lm,rm,p||'.items');
  select coalesce(jsonb_agg(v->id order by seq),'[]') into result from (select id,min(seq) seq from (select x->>'id' id,ord seq from jsonb_array_elements(r) with ordinality t(x,ord) union all select x->>'id',100000+ord from jsonb_array_elements(l) with ordinality t(x,ord)) q group by id) q where v ? id;
  return result;
 end if;
 if p in ('.classes','.removed_teacher_ids') and jsonb_typeof(l)='array' and jsonb_typeof(r)='array' then
  select coalesce(jsonb_agg(x order by x),'[]') into result from (select distinct x from (select x from jsonb_array_elements(l) x union all select x from jsonb_array_elements(r) x) q where not (coalesce(b,'[]') @> jsonb_build_array(x)) or (l @> jsonb_build_array(x) and r @> jsonb_build_array(x))) q;return result;
 end if;
 raise exception 'The same field was changed on another device (%). Your edits are retained. Reopen the month to compare before saving.',p using errcode='40001';
end $function$;

create or replace function monthly_v2.teacher_controls(action text,payload jsonb,token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; target text:=payload->>'month'; previous_month text; rec monthly_v2.reports; result jsonb;
begin
 select account_id into aid from monthly_v2.sessions s where s.token=teacher_controls.token and expires>now();
 if aid is null then raise exception 'Please sign in again' using errcode='42501';end if;
 if coalesce(target,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Select a valid month';end if;
 if action='teacher_candidates' then
  select max(month) into previous_month from monthly_v2.reports where account_id=aid and month<target;
  with entries as (
   select r.month,t,0 priority from monthly_v2.reports r cross join lateral jsonb_array_elements(coalesce(r.data->'teachers','[]')) t where r.account_id=aid and r.month<=target
   union all select r.month,t,1 priority from monthly_v2.reports r cross join lateral jsonb_array_elements(coalesce(r.data->'teacher_pool','[]')) t where r.account_id=aid and r.month<=target
  ), latest as (
   select distinct on(coalesce(nullif(t->>'pid',''),t->>'id')) t from entries where coalesce(t->>'id','')<>'' order by coalesce(nullif(t->>'pid',''),t->>'id'),month desc,priority
  ), marked as (
   select jsonb_build_object('id',t->>'id','name',t->>'name','pid',t->>'pid','designation',t->>'designation') teacher,
    exists(select 1 from monthly_v2.reports p cross join lateral jsonb_array_elements(coalesce(p.data->'teachers','[]')) pt where p.account_id=aid and p.month=previous_month and (pt->>'id'=t->>'id' or (coalesce(t->>'pid','')<>'' and pt->>'pid'=t->>'pid'))) last_report
   from latest
  ) select coalesce(jsonb_agg(teacher||jsonb_build_object('last_report',last_report) order by last_report desc,teacher->>'name'),'[]') into result from marked;
  return jsonb_build_object('teachers',result,'source_month',previous_month);
 end if;
 if action='prepare_report_delete' then
  select * into rec from monthly_v2.reports where account_id=aid and month=target;
  if rec.account_id is null then raise exception 'Report not found';end if;
  return jsonb_build_object('month',target,'revision',rec.revision,'teachers',jsonb_array_length(coalesce(rec.data->'teachers','[]')),'subjects',jsonb_array_length(coalesce(rec.data->'assignments','[]')),'status',rec.status);
 end if;
 if action='delete_report' then
  if payload->'first_confirmed' is distinct from 'true'::jsonb or payload->'acknowledged' is distinct from 'true'::jsonb or payload->>'typed_confirmation' is distinct from 'DELETE' or payload->>'confirm_month' is distinct from target then raise exception 'Complete both report deletion confirmations';end if;
  perform pg_advisory_xact_lock(hashtext(aid::text||target));
  select * into rec from monthly_v2.reports where account_id=aid and month=target for update;
  if rec.account_id is null then raise exception 'This report was already deleted';end if;
  if rec.revision is distinct from (payload->>'revision')::int then raise exception 'This report changed on another device. Review it and confirm deletion again.';end if;
  delete from monthly_v2.reports where account_id=aid and month=target;
  return jsonb_build_object('ok',true,'month',target);
 end if;
 raise exception 'Unknown teacher setup action';
end $$;
revoke all on function monthly_v2.teacher_controls(text,jsonb,text) from public;
grant execute on function monthly_v2.teacher_controls(text,jsonb,text) to anon,authenticated;

create or replace function public.sv_monthly_v2(p_action text,p_payload jsonb default '{}'::jsonb,p_token text default null) returns jsonb language sql security invoker set search_path='' as $$select case when p_action='collaborative_save' then monthly_v2.collaborative_save(p_payload,p_token) when p_action in ('teacher_candidates','prepare_report_delete','delete_report') then monthly_v2.teacher_controls(p_action,p_payload,p_token) else monthly_v2.api(p_action,p_payload,p_token) end;$$;
