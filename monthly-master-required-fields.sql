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
 select data into d from monthly_v2.reports where account_id=school_id and month=payload->>'month' and revision=(payload->>'revision')::int;if d is not null then perform monthly_v2.require_teacher_progress(d,null);end if;
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
 if jsonb_array_length(coalesce(d->'teachers','[]'))=0 then raise exception 'Select at least one teacher before saving a report. Use Delete Report to remove the whole month.';end if;
 if action='admin_report_save' then perform monthly_v2.require_teacher_progress(d,null);end if;
 update monthly_v2.reports set data=d,status=case when action='admin_report_save' then 'Saved' else 'Draft' end,revision=revision+1,updated=now() where account_id=school_id and month=payload->>'month';
 return jsonb_build_object('ok',true);end if;
raise exception 'Unknown management action';
end$function$;
