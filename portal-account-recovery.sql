-- Employee passwords: remove the eight-character cap. Prehash new passwords so
-- bcrypt processes every character; existing bcrypt passwords keep working.
CREATE OR REPLACE FUNCTION public.sv_employee_signup(p_pid text, p_cnic text, p_dob text, p_pass text, p_mobile text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
 v_pid text := public.sv_clean(p_pid);
 v_cnic text := public.sv_clean(p_cnic);
 v_mobile_digits text := regexp_replace(coalesce(p_mobile,''),'[^0-9]','','g');
 v_mobile text;
 v_emp employees;
 v_existing boolean;
 v_match text;
begin
 if v_pid='' and v_cnic='' then return jsonb_build_object('ok',false,'message','Enter your PID or CNIC. One of these is required.'); end if;
 if p_dob !~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$' then return jsonb_build_object('ok',false,'message','Date of Birth must be DD-MM-YYYY.'); end if;
 if length(coalesce(p_pass,''))<1 then return jsonb_build_object('ok',false,'message','Enter a password.'); end if;
 if length(v_mobile_digits)<>11 or v_mobile_digits !~ '^03[0-9]{9}$' then return jsonb_build_object('ok',false,'message','Mobile number must be in 03xx-xxxxxxx format (11 digits).'); end if;
 v_mobile := substr(v_mobile_digits,1,4)||'-'||substr(v_mobile_digits,5,7);

 select * into v_emp from public.employees e
 where e.is_active
   and ((v_pid<>'' and public.sv_clean(coalesce(e.personal_no,''))=v_pid)
     or (v_cnic<>'' and public.sv_clean(coalesce(e.cnic,''))=v_cnic))
 order by case when v_pid<>'' and public.sv_clean(coalesce(e.personal_no,''))=v_pid then 0 else 1 end
 limit 1;
 if not found then return jsonb_build_object('ok',false,'message','PID/CNIC was not found in the active employee record. Kindly contact your Cluster Office.'); end if;

 -- If the record contains both identifiers, either one is enough. If an entered identifier
 -- has no corresponding database value, it is not treated as a mismatch.
 if v_pid<>'' and public.sv_clean(coalesce(v_emp.personal_no,''))<>'' and public.sv_clean(coalesce(v_emp.personal_no,''))=v_pid then v_match:='PID';
 elsif v_cnic<>'' and public.sv_clean(coalesce(v_emp.cnic,''))<>'' and public.sv_clean(coalesce(v_emp.cnic,''))=v_cnic then v_match:='CNIC';
 else return jsonb_build_object('ok',false,'message','Neither the entered PID nor CNIC matches the official employee record.'); end if;

 if public.sv_dob_norm(v_emp.dob) is not null and public.sv_dob_norm(v_emp.dob)<>'' and public.sv_dob_norm(v_emp.dob) is distinct from public.sv_dob_norm(p_dob) then
   return jsonb_build_object('ok',false,'message','Date of Birth does not match the official employee record.');
 end if;
 if regexp_replace(coalesce(v_emp.mobile,''),'[^0-9]','','g')<>'' and regexp_replace(coalesce(v_emp.mobile,''),'[^0-9]','','g')<>v_mobile_digits then
   return jsonb_build_object('ok',false,'message','Mobile Number does not match the official employee record.');
 end if;

 select exists(select 1 from public.employee_auth_accounts where employee_id=v_emp.id or (v_pid<>'' and pid=v_pid) or (v_cnic<>'' and cnic=v_cnic)) into v_existing;
 if v_existing then return jsonb_build_object('ok',false,'message','An account already exists for this employee. Please use Sign In.'); end if;

 insert into public.employee_auth_accounts(employee_id,pid,cnic,dob,password_hash)
   values(v_emp.id,nullif(public.sv_clean(coalesce(v_emp.personal_no,'')),''),nullif(public.sv_clean(coalesce(v_emp.cnic,'')),''),p_dob,'sha256$'||extensions.crypt(encode(extensions.digest(p_pass,'sha256'),'hex'),extensions.gen_salt('bf',8)));
 update public.employees set dob=case when coalesce(trim(dob),'')='' then p_dob else dob end,
   mobile=case when coalesce(trim(mobile),'')='' then v_mobile else mobile end,
   updated_at=now() where id=v_emp.id;
 return jsonb_build_object('ok',true,'message','Employee account created successfully.','matched_by',v_match,'employee_id',v_emp.id);
end; $function$
;
CREATE OR REPLACE FUNCTION public.sv_employee_login(p_login text, p_pass text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_login text:=public.sv_clean(p_login); v_auth employee_auth_accounts; v_emp employees; v_result jsonb; v_session text;
begin
 if v_login='' then return jsonb_build_object('ok',false,'message','PID or CNIC is required.'); end if;
 select * into v_auth from public.employee_auth_accounts a where a.pid=v_login or a.cnic=v_login limit 1;
 if not found then
   select * into v_emp from public.employees e where e.is_active and (public.sv_clean(coalesce(e.personal_no,''))=v_login or public.sv_clean(coalesce(e.cnic,''))=v_login) limit 1;
   if found then return jsonb_build_object('ok',false,'status','ACCOUNT_NOT_CREATED','message','Please create your Employee Account / Sign Up first.'); end if;
   return jsonb_build_object('ok',false,'message','Invalid PID/CNIC or password.');
 end if;
 if (case when left(v_auth.password_hash,7)='sha256$' then extensions.crypt(encode(extensions.digest(coalesce(p_pass,''),'sha256'),'hex'),substr(v_auth.password_hash,8))<>substr(v_auth.password_hash,8) else extensions.crypt(coalesce(p_pass,''),v_auth.password_hash)<>v_auth.password_hash end) then return jsonb_build_object('ok',false,'message','Invalid PID/CNIC or password.'); end if;
 update public.employee_auth_accounts set last_login_at=now() where id=v_auth.id;
 select * into v_emp from public.employees where id=v_auth.employee_id and is_active limit 1;
 if not found then
   select * into v_emp from public.employees e where e.is_active and (public.sv_clean(coalesce(e.personal_no,''))=v_auth.pid or public.sv_clean(coalesce(e.cnic,''))=v_auth.cnic) limit 1;
 end if;
 if not found then return jsonb_build_object('ok',false,'message','Employee record could not be opened.'); end if;
 UPDATE public.employee_auth_accounts SET employee_id=v_emp.id WHERE id=v_auth.id;
 v_session:='qdc_'||encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.qdc_employee_sessions(token_hash,employee_id) VALUES(encode(extensions.digest(v_session,'sha256'),'hex'),v_emp.id);
 v_result:=public.qdc_profile_for_id(v_emp.id);
 if v_result is null or v_result->'employee' is null then return jsonb_build_object('ok',false,'message','Employee record could not be opened.'); end if;
 return v_result||jsonb_build_object('ok',true,'session_key',v_session);
end; $function$
;
-- Recovery requests are private and never contain passwords.
create table if not exists monthly_v2.password_reset_requests(
 account_id uuid primary key references monthly_v2.accounts(id) on delete cascade,
 requested_at timestamptz not null default now(),
 resolved_at timestamptz
);
alter table monthly_v2.password_reset_requests enable row level security;
revoke all on monthly_v2.password_reset_requests from public,anon,authenticated;

create or replace function monthly_v2.password_recovery(action text,payload jsonb,token text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare school_id uuid; role_name text; result jsonb; code text;
begin
 if action='request_password_reset' then
  code:=trim(coalesce(payload->>'semis',''));
  if code !~ '^[0-9]{9}$' then raise exception 'Enter a 9-digit SEMIS code'; end if;
  select id into school_id from monthly_v2.accounts where semis=code;
  if school_id is not null then
   insert into monthly_v2.password_reset_requests(account_id) values(school_id)
   on conflict(account_id) do update set requested_at=now(),resolved_at=null
   where monthly_v2.password_reset_requests.resolved_at is not null;
  end if;
  -- Same response for every well-formed SEMIS; do not expose account existence.
  return jsonb_build_object('ok',true,'message','If this school is registered, a reset request is now pending with the Master Admin. After admin reset, use HM Sign Up with the same SEMIS and a new password. Your saved work will remain intact.');
 end if;
 select role into role_name from public.sv_who(token);
 if role_name is distinct from 'MASTER' then raise exception 'Master Admin access required' using errcode='42501'; end if;
 if action='admin_reset_requests' then
  return coalesce((select jsonb_agg(jsonb_build_object('school_id',a.id,'semis',a.semis,'school',a.profile->>'school','hm',a.profile->>'hm','requested_at',r.requested_at) order by r.requested_at)
   from monthly_v2.password_reset_requests r join monthly_v2.accounts a on a.id=r.account_id where r.resolved_at is null),'[]'::jsonb);
 end if;
 if action='admin_reset' then
  school_id:=(payload->>'school_id')::uuid;
  result:=monthly_v2.manage(action,payload,token);
  update monthly_v2.password_reset_requests set resolved_at=now() where account_id=school_id and resolved_at is null;
  -- Avoid an old failed-attempt counter blocking login after re-registration.
  delete from monthly_v2.login_limits where semis=(select semis from monthly_v2.accounts where id=school_id);
  return result;
 end if;
 raise exception 'Unknown recovery action';
end;
$function$;
revoke all on function monthly_v2.password_recovery(text,jsonb,text) from public;
grant execute on function monthly_v2.password_recovery(text,jsonb,text) to anon,authenticated;

create or replace function public.sv_monthly_v2(p_action text,p_payload jsonb default '{}'::jsonb,p_token text default null)
returns jsonb language sql set search_path='' as $function$
select case when p_action in ('request_password_reset','admin_reset_requests','admin_reset') then monthly_v2.password_recovery(p_action,p_payload,p_token)
 when p_action='collaborative_save' then monthly_v2.collaborative_save(p_payload,p_token)
 when p_action in ('teacher_candidates','prepare_report_delete','delete_report','admin_prepare_report_delete','admin_delete_report') then monthly_v2.teacher_controls(p_action,p_payload,p_token)
 else monthly_v2.api(p_action,p_payload,p_token) end
$function$;
notify pgrst,'reload schema';
