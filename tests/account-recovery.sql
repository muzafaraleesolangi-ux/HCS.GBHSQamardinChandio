-- Run in a transaction and always roll back; no production school is reset.
begin;
do $test$
declare r jsonb; aid uuid; before_data jsonb; master_token text:='test-'||gen_random_uuid()::text; old_token text; new_token text; original_profile jsonb; longpass text:=repeat('Long-password-',20); v_count integer;
begin
 if exists(select 1 from monthly_v2.accounts where semis='999999997') then raise exception 'Test SEMIS already exists';end if;
 select public.sv_monthly_v2('signup',jsonb_build_object('semis','999999997','password','Temporary-Only-19','confirm_password','Temporary-Only-19','profile',jsonb_build_object('school','Recovery Test','hm','Test HM')),null) into r;
 old_token:=r->>'token';
 select id,profile into aid,original_profile from monthly_v2.accounts where semis='999999997';
 before_data:='{"profile":{"school":"Recovery Test","hm":"Test HM"},"teachers":[{"id":"teacher-test","name":"Test Teacher"}],"classes":[1],"assignments":[{"teacher":"teacher-test","name":"Test Subject"}]}'::jsonb;
 insert into monthly_v2.reports(account_id,month,data) values(aid,'2099-01',before_data);
 perform public.sv_monthly_v2('request_password_reset','{"semis":"999999997"}',null);
 perform public.sv_monthly_v2('request_password_reset','{"semis":"999999997"}',null);
 if (select count(*) from monthly_v2.password_reset_requests where account_id=aid and resolved_at is null)<>1 then raise exception 'Requests not deduplicated';end if;
 begin
  perform public.sv_monthly_v2('admin_reset',jsonb_build_object('school_id',aid),old_token);
  raise exception 'Unauthorized reset allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.sv_monthly_v2('admin_reset_requests','{}',null);
  raise exception 'Unauthorized requests read allowed';
 exception when insufficient_privilege then null;end;
 insert into public.portal_sessions(token,user_id,expires_at)
 select master_token,user_id,now()+interval '5 minutes' from public.portal_officers where role='MASTER' and is_active and not password_change_required limit 1;
 if not found then raise exception 'No active master for rollback-only permission test';end if;
 r:=public.sv_monthly_v2('admin_reset_requests','{}',master_token);
 if not exists(select 1 from jsonb_array_elements(r) x where x->>'school_id'=aid::text) then raise exception 'Missing pending request';end if;
 perform public.sv_monthly_v2('admin_reset',jsonb_build_object('school_id',aid),master_token);
 if exists(select 1 from monthly_v2.sessions where token=old_token) then raise exception 'Old session retained';end if;
 if exists(select 1 from monthly_v2.password_reset_requests where account_id=aid and resolved_at is null) then raise exception 'Request not resolved';end if;
 r:=public.sv_monthly_v2('signup',jsonb_build_object('semis','999999997','password','New-Temporary-Only-20','confirm_password','New-Temporary-Only-20','profile',jsonb_build_object('school','Must not overwrite','hm','Must not overwrite')),null);
 new_token:=r->>'token';
 if (select id from monthly_v2.accounts where semis='999999997') is distinct from aid then raise exception 'Account identity changed';end if;
 if (select profile from monthly_v2.accounts where id=aid) is distinct from original_profile then raise exception 'School profile changed';end if;
 if (select data from monthly_v2.reports where account_id=aid and month='2099-01') is distinct from before_data then raise exception 'Saved work changed';end if;
 r:=public.sv_monthly_v2('load','{"month":"2099-01"}',new_token);
 if r->'data' is distinct from before_data then raise exception 'Saved work not accessible after reset';end if;

 -- Exercise long employee passwords and backward compatibility, all rolled back.
 insert into public.employees(id,employee_name,personal_no,cnic,dob,mobile,is_active) overriding system value
 values(-900000001,'Rollback Password Test','999999998','9999999999998','01-01-1990','0300-0000000',true);
 r:=public.sv_employee_signup('999999998','9999999999998','01-01-1990',longpass,'03000000000');
 if r->>'ok' is distinct from 'true' then raise exception 'Long password signup failed: %',r;end if;
 r:=public.sv_employee_login('999999998',longpass);
 if r->>'ok' is distinct from 'true' then raise exception 'Long password login failed';end if;
 r:=public.sv_employee_login('999999998',longpass||'different-tail');
 if r->>'ok'='true' then raise exception 'Long password suffix ignored';end if;
 update public.employee_auth_accounts set password_hash=extensions.crypt('Legacy8',extensions.gen_salt('bf',8)) where employee_id=-900000001;
 r:=public.sv_employee_login('999999998','Legacy8');
 if r->>'ok' is distinct from 'true' then raise exception 'Legacy login broken';end if;
end;
$test$;
select 'PASS: reset permissions, request deduplication, session invalidation, same-SEMIS re-registration and saved work preservation; long and legacy employee passwords' as result;

rollback;
