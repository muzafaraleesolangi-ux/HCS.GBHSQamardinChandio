create or replace function monthly_v2.teacher_controls(action text,payload jsonb,token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; target text:=payload->>'month'; previous_month text; rec monthly_v2.reports; result jsonb; role_name text;
begin
 if action in ('admin_prepare_report_delete','admin_delete_report') then
  select role into role_name from public.sv_who(token);if role_name is distinct from 'MASTER' then raise exception 'Master Admin only' using errcode='42501';end if;
  aid:=(payload->>'school_id')::uuid;if not exists(select 1 from monthly_v2.accounts where id=aid) then raise exception 'School not found';end if;
  action:=case when action='admin_prepare_report_delete' then 'prepare_report_delete' else 'delete_report' end;
 else
  select account_id into aid from monthly_v2.sessions s where s.token=teacher_controls.token and expires>now();
 end if;
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

create or replace function public.sv_monthly_v2(p_action text,p_payload jsonb default '{}'::jsonb,p_token text default null) returns jsonb language sql security invoker set search_path='' as $$select case when p_action='collaborative_save' then monthly_v2.collaborative_save(p_payload,p_token) when p_action in ('teacher_candidates','prepare_report_delete','delete_report','admin_prepare_report_delete','admin_delete_report') then monthly_v2.teacher_controls(p_action,p_payload,p_token) else monthly_v2.api(p_action,p_payload,p_token) end;$$;
