-- Admin account management. Passwords remain one-way bcrypt hashes.
create schema if not exists admin_security;
revoke all on schema admin_security from public,anon,authenticated;
alter table public.portal_officers add column if not exists recovery_mobile text;
alter table public.portal_officers add column if not exists password_change_required boolean not null default false;
alter table public.portal_officers add column if not exists password_changed_at timestamptz;
alter table public.portal_sessions add column if not exists reset_only boolean not null default false;
create unique index if not exists portal_officers_username_ci on public.portal_officers(lower(user_id));
alter table public.portal_sessions drop constraint portal_sessions_user_id_fkey;
alter table public.portal_sessions add constraint portal_sessions_user_id_fkey foreign key(user_id) references public.portal_officers(user_id) on update cascade on delete cascade;
create table if not exists admin_security.recovery_requests (
 id bigint generated always as identity primary key,
 target_user text not null references public.portal_officers(user_id) on update cascade on delete cascade,
 mobile text not null, status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
 created_at timestamptz not null default now(),decided_at timestamptz,decided_by text,note text
);
create unique index if not exists admin_recovery_one_pending on admin_security.recovery_requests(target_user) where status='PENDING';
create table if not exists admin_security.audit (
 id bigint generated always as identity primary key, actor text not null,target_user text not null,
 action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create table if not exists admin_security.attempts (
 key text primary key, count integer not null default 0, since timestamptz not null default now()
);
alter table admin_security.recovery_requests enable row level security;
alter table admin_security.audit enable row level security;
alter table admin_security.attempts enable row level security;
revoke all on all tables in schema admin_security from public,anon,authenticated;
revoke all on all sequences in schema admin_security from public,anon,authenticated;

create or replace function public.sv_who(p_token text)
returns public.portal_officers language sql stable security definer set search_path='' as $$
 select o.* from public.portal_sessions s join public.portal_officers o on o.user_id=s.user_id
 where s.token=p_token and s.expires_at>now() and o.is_active and not s.reset_only and not o.password_change_required limit 1
$$;

create or replace function public.sv_login(p_user text,p_pass text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.portal_officers;t text;k text;attempt admin_security.attempts;
begin
 if p_user is null or length(p_user)>100 or p_pass is null or octet_length(p_pass)>72 then return null;end if;
 k='login:'||encode(extensions.digest(lower(trim(p_user)),'sha256'),'hex');
 insert into admin_security.attempts(key) values(k) on conflict do nothing;
 select * into attempt from admin_security.attempts where key=k for update;
 if attempt.since<now()-interval '15 minutes' then update admin_security.attempts set count=0,since=now() where key=k;attempt.count=0;end if;
 if attempt.count>=10 then raise exception 'Too many sign-in attempts. Try again after 15 minutes.';end if;
 select * into o from public.portal_officers where lower(user_id)=lower(trim(p_user)) and is_active;
 if o.user_id is null or o.pass_hash<>extensions.crypt(p_pass,o.pass_hash) then
  update admin_security.attempts set count=count+1 where key=k;return null;
 end if;
 delete from admin_security.attempts where key=k;
 delete from public.portal_sessions where expires_at<now();
 t=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.portal_sessions(token,user_id,expires_at,reset_only) values(t,o.user_id,now()+case when o.password_change_required then interval '15 minutes' else interval '365 days' end,o.password_change_required);
 return jsonb_build_object('token',t,'username',o.user_id,'name',o.full_name,'role',o.role,'cell',o.cell_code,'title',o.title,'password_change_required',o.password_change_required);
end $$;

create or replace function public.qdc_admin_accounts(p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.portal_officers;
begin
 select * into o from public.sv_who(p_token);
 if o.user_id is null or o.role<>'MASTER' then raise exception 'Master Admin access required' using errcode='42501';end if;
 return jsonb_build_object('current_user',o.user_id,
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('username',a.user_id,'name',a.full_name,'role',a.role,'cell',a.cell_code,'title',a.title,'active',a.is_active,'mobile',a.recovery_mobile,'change_required',a.password_change_required,'password_changed_at',a.password_changed_at) order by case a.role when 'MASTER' then 1 when 'HUBHM' then 2 else 3 end,a.cell_code) from public.portal_officers a),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select id,target_user,mobile,status,created_at,decided_at,decided_by,note from admin_security.recovery_requests order by created_at desc limit 100) r),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select actor,target_user,action,details,created_at from admin_security.audit order by created_at desc limit 100) h),'[]'::jsonb));
end $$;

create or replace function public.qdc_admin_accounts_save(p_token text,p_user text,p_username text,p_mobile text,p_new_password text default null,p_request_id bigint default null,p_current_password text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.portal_officers;target public.portal_officers;uname text;phone text;changing boolean;req admin_security.recovery_requests;
begin
 select * into actor from public.sv_who(p_token);
 if actor.user_id is null or actor.role<>'MASTER' then raise exception 'Master Admin access required' using errcode='42501';end if;
 select * into target from public.portal_officers where user_id=p_user for update;
 if target.user_id is null then raise exception 'Admin account not found';end if;
 uname=trim(p_username);phone=regexp_replace(coalesce(p_mobile,''),'[^0-9]','','g');
 if length(phone)=12 and left(phone,2)='92' then phone='0'||substr(phone,3);end if;
 if uname is null or uname !~ '^[A-Za-z0-9@._-]{3,60}$' then raise exception 'Username must be 3–60 letters, numbers, @, dot, underscore or hyphen';end if;
 if phone<>'' and phone !~ '^03[0-9]{9}$' then raise exception 'Enter a valid mobile number such as 03001234567';end if;
 if exists(select 1 from public.portal_officers where lower(user_id)=lower(uname) and user_id<>target.user_id) then raise exception 'That username is already in use';end if;
 changing=p_new_password is not null and p_new_password<>'';
 if changing then
  if length(p_new_password)<10 or octet_length(p_new_password)>72 or p_new_password !~ '[A-Za-z]' or p_new_password !~ '[0-9]' then raise exception 'Use at least 10 characters including a letter and a number (maximum 72 bytes)';end if;
  if extensions.crypt(p_new_password,target.pass_hash)=target.pass_hash then raise exception 'Choose a different password';end if;
  if target.role='MASTER' and (target.user_id<>actor.user_id or p_current_password is null or extensions.crypt(p_current_password,target.pass_hash)<>target.pass_hash) then raise exception 'Enter your current Master Admin password to change it';end if;
 end if;
 if p_request_id is not null then
  select * into req from admin_security.recovery_requests where id=p_request_id and target_user=target.user_id and status='PENDING' for update;
  if req.id is null then raise exception 'This request is no longer pending';end if;
  if not changing then raise exception 'Set a temporary password to approve this request';end if;
 end if;
 update public.portal_officers set user_id=uname,recovery_mobile=nullif(phone,''),
 pass_hash=case when changing then extensions.crypt(p_new_password,extensions.gen_salt('bf',10)) else pass_hash end,
 password_change_required=case when changing then role<>'MASTER' else password_change_required end,
 password_changed_at=case when changing then now() else password_changed_at end
 where user_id=target.user_id;
 if changing then
  delete from public.portal_sessions where user_id=uname and not(target.role='MASTER' and token=p_token);
  update admin_security.recovery_requests set status='APPROVED',decided_at=now(),decided_by=actor.user_id,note='Temporary password set by Master Admin' where target_user=uname and status='PENDING';
 end if;
 insert into admin_security.audit(actor,target_user,action,details) values(actor.user_id,uname,case when changing then 'PASSWORD_RESET' else 'ACCOUNT_UPDATED' end,jsonb_build_object('previous_username',target.user_id,'username_changed',target.user_id<>uname,'temporary',changing and target.role<>'MASTER'));
 return jsonb_build_object('ok',true,'username',uname,'password_changed',changing,'temporary',changing and target.role<>'MASTER');
end $$;

create or replace function public.qdc_admin_request_recovery(p_username text,p_mobile text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.portal_officers;phone text;k text;attempt admin_security.attempts;
begin
 if p_username is null or length(p_username)>100 or p_mobile is null or length(p_mobile)>30 then return jsonb_build_object('ok',true);end if;
 phone=regexp_replace(p_mobile,'[^0-9]','','g');if length(phone)=12 and left(phone,2)='92' then phone='0'||substr(phone,3);end if;
 k='recovery:'||encode(extensions.digest(lower(trim(p_username)),'sha256'),'hex');
 insert into admin_security.attempts(key) values(k) on conflict do nothing;
 select * into attempt from admin_security.attempts where key=k for update;
 if attempt.since<now()-interval '30 minutes' then update admin_security.attempts set count=0,since=now() where key=k;attempt.count=0;end if;
 if attempt.count>=5 then return jsonb_build_object('ok',true);end if;
 update admin_security.attempts set count=count+1 where key=k;
 select * into target from public.portal_officers where lower(user_id)=lower(trim(p_username)) and is_active and role<>'MASTER' and recovery_mobile=phone and phone ~ '^03[0-9]{9}$';
 if target.user_id is not null then insert into admin_security.recovery_requests(target_user,mobile) values(target.user_id,phone) on conflict(target_user) where status='PENDING' do nothing;end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.qdc_admin_recovery_reject(p_token text,p_id bigint,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.portal_officers;target text;
begin
 select * into actor from public.sv_who(p_token);
 if actor.user_id is null or actor.role<>'MASTER' then raise exception 'Master Admin access required' using errcode='42501';end if;
 update admin_security.recovery_requests set status='REJECTED',decided_at=now(),decided_by=actor.user_id,note=left(coalesce(p_reason,'Request declined'),250) where id=p_id and status='PENDING' returning target_user into target;
 if target is null then raise exception 'This request is no longer pending';end if;
 insert into admin_security.audit(actor,target_user,action) values(actor.user_id,target,'REQUEST_REJECTED');
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.qdc_admin_complete_password_change(p_token text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.portal_officers;
begin
 select o.* into target from public.portal_sessions s join public.portal_officers o on o.user_id=s.user_id where s.token=p_token and s.expires_at>now() and s.reset_only and o.is_active and o.password_change_required for update of o;
 if target.user_id is null then raise exception 'Temporary session expired. Sign in again.' using errcode='42501';end if;
 if length(coalesce(p_password,''))<10 or octet_length(p_password)>72 or p_password !~ '[A-Za-z]' or p_password !~ '[0-9]' then raise exception 'Use at least 10 characters including a letter and a number (maximum 72 bytes)';end if;
 if extensions.crypt(p_password,target.pass_hash)=target.pass_hash then raise exception 'Choose your own password, different from the temporary password';end if;
 update public.portal_officers set pass_hash=extensions.crypt(p_password,extensions.gen_salt('bf',10)),password_change_required=false,password_changed_at=now() where user_id=target.user_id;
 delete from public.portal_sessions where user_id=target.user_id and token<>p_token;
 update public.portal_sessions set reset_only=false,expires_at=now()+interval '365 days' where token=p_token;
 insert into admin_security.audit(actor,target_user,action) values(target.user_id,target.user_id,'PASSWORD_CHANGED');
 return jsonb_build_object('ok',true,'token',p_token,'username',target.user_id,'name',target.full_name,'role',target.role,'cell',target.cell_code,'title',target.title,'password_change_required',false);
end $$;

revoke all on function public.sv_login(text,text) from public;
revoke all on function public.sv_who(text) from public,anon,authenticated;
revoke all on function public.qdc_admin_accounts(text) from public;
revoke all on function public.qdc_admin_accounts_save(text,text,text,text,text,bigint,text) from public;
revoke all on function public.qdc_admin_request_recovery(text,text) from public;
revoke all on function public.qdc_admin_recovery_reject(text,bigint,text) from public;
revoke all on function public.qdc_admin_complete_password_change(text,text) from public;
grant execute on function public.sv_login(text,text),public.qdc_admin_accounts(text),public.qdc_admin_accounts_save(text,text,text,text,text,bigint,text),public.qdc_admin_request_recovery(text,text),public.qdc_admin_recovery_reject(text,bigint,text),public.qdc_admin_complete_password_change(text,text) to anon,authenticated;
