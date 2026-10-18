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


CREATE OR REPLACE FUNCTION monthly_v2.manage(action text, payload jsonb, token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare role_name text; school_id uuid;code text;d jsonb;t jsonb;rev int;
begin
select role into role_name from public.sv_who(token);if role_name is distinct from 'MASTER' then raise exception 'Master Admin only' using errcode='42501';end if;
if action='admin_schools' then return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'semis',a.semis,'profile',a.profile,'created',a.created_at,'reset_pending',a.reset_hash is not null,'reports',(select count(*) from monthly_v2.reports r where r.account_id=a.id),'updated',(select max(updated) from monthly_v2.reports r where r.account_id=a.id)) order by a.created_at desc) from monthly_v2.accounts a),'[]');end if;
if action='admin_reports' then return coalesce((select jsonb_agg(jsonb_build_object('school_id',a.id,'school',a.profile->>'school','hm',a.profile->>'hm','semis',a.semis,'month',r.month,'status',r.status,'revision',r.revision,'updated',r.updated) order by r.updated desc) from monthly_v2.reports r join monthly_v2.accounts a on a.id=r.account_id),'[]');end if;
school_id:=(payload->>'school_id')::uuid;
if not exists(select 1 from monthly_v2.accounts where id=school_id) then raise exception 'School not found';end if;
if action='admin_school' then return jsonb_build_object('id',school_id,'profile',(select profile from monthly_v2.accounts where id=school_id),'semis',(select semis from monthly_v2.accounts where id=school_id),'reports',coalesce((select jsonb_agg(jsonb_build_object('month',month,'data',data,'status',status,'revision',revision,'updated',updated) order by month desc) from monthly_v2.reports where account_id=school_id),'[]'));end if;
if action='admin_profile' then
 if length(trim(coalesce(payload->'profile'->>'school','')))=0 or length(trim(coalesce(payload->'profile'->>'hm','')))=0 then raise exception 'School and HM names required';end if;
 update monthly_v2.accounts set profile=payload->'profile' where id=school_id;return jsonb_build_object('ok',true);end if;
if action='admin_reset' then
 update monthly_v2.accounts set reset_hash='MASTER_RESET_PENDING',reset_until=now()+interval '24 hours' where id=school_id;
 delete from monthly_v2.sessions where account_id=school_id;
 return jsonb_build_object('ok',true,'message','Re-registration is open for 24 hours. The HM can use normal Sign Up with the same SEMIS and a new password. Existing school data, teachers and monthly reports are retained.');end if;
if action='admin_exported' then
 perform pg_advisory_xact_lock(hashtext(school_id::text||coalesce(payload->>'month','')));
 update monthly_v2.reports set status='Exported',updated=now() where account_id=school_id and month=payload->>'month' and revision=(payload->>'revision')::int;
 return jsonb_build_object('ok',found);end if;
if action='admin_delete_school' then
 if payload->>'confirmation' is distinct from (select semis from monthly_v2.accounts where id=school_id) then raise exception 'Type the school SEMIS to confirm deletion';end if;
 delete from monthly_v2.reports where account_id=school_id;delete from monthly_v2.sessions where account_id=school_id;delete from monthly_v2.accounts where id=school_id;
 return jsonb_build_object('ok',true);end if;
if action in ('admin_report_save','admin_teacher_remove') then
 perform pg_advisory_xact_lock(hashtext(school_id::text||coalesce(payload->>'month','')));
 select data,revision into d,rev from monthly_v2.reports where account_id=school_id and month=payload->>'month' for update;
 if d is null then raise exception 'Report not found';end if;
 if rev<>(payload->>'revision')::int then raise exception 'Report updated elsewhere. Reopen it before editing';end if;
 if action='admin_teacher_remove' then
 d:=jsonb_set(d,'{teachers}',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'teachers') x where x->>'id'<>payload->>'teacher_id'),'[]'));
 d:=jsonb_set(d,'{assignments}',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'assignments') x where x->>'teacher'<>payload->>'teacher_id'),'[]'));
 else
 d:=payload->'data';
 if jsonb_typeof(d->'teachers') is distinct from 'array' or jsonb_typeof(d->'assignments') is distinct from 'array' then raise exception 'Invalid report';end if;
 if exists(select 1 from jsonb_array_elements(d->'assignments') x where coalesce(nullif(x->>'previous',''),'0')::numeric+coalesce(nullif(x->>'current',''),'0')::numeric>(x->>'total')::numeric or coalesce(nullif(x->>'previous',''),'0')::numeric<0 or coalesce(nullif(x->>'current',''),'0')::numeric<0) then raise exception 'Invalid chapter counts';end if;
 if exists(select 1 from jsonb_array_elements(d->'assignments') x group by x->>'grade',x->>'subject_id' having count(*)>1) then raise exception 'Duplicate class subject';end if;
 end if;
 update monthly_v2.reports set data=d,status='Draft',revision=revision+1,updated=now() where account_id=school_id and month=payload->>'month';
 return jsonb_build_object('ok',true);end if;
raise exception 'Unknown management action';
end$function$;
