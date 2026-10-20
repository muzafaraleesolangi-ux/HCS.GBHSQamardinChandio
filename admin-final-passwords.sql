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
  if target.role='MASTER' and target.user_id<>actor.user_id then raise exception 'Only the signed-in Master Admin can update this Master account';end if;
 end if;
 if p_request_id is not null then
  select * into req from admin_security.recovery_requests where id=p_request_id and target_user=target.user_id and status='PENDING' for update;
  if req.id is null then raise exception 'This request is no longer pending';end if;
  if not changing then raise exception 'Set a password to approve this request';end if;
 end if;
 update public.portal_officers set user_id=uname,recovery_mobile=nullif(phone,''),
 pass_hash=case when changing then extensions.crypt(encode(extensions.digest(p_new_password,'sha256'),'hex'),extensions.gen_salt('bf',10)) else pass_hash end,
 password_prehash=case when changing then true else password_prehash end,
 password_change_required=case when changing then false else password_change_required end,
 password_changed_at=case when changing then now() else password_changed_at end
 where user_id=target.user_id;
 if changing then
  delete from public.portal_sessions where user_id=uname and not(target.role='MASTER' and token=p_token);
  update admin_security.recovery_requests set status='APPROVED',decided_at=now(),decided_by=actor.user_id,note='Login password set by Master Admin' where target_user=uname and status='PENDING';
 end if;
 insert into admin_security.audit(actor,target_user,action,details) values(actor.user_id,uname,case when changing then 'PASSWORD_RESET' else 'ACCOUNT_UPDATED' end,jsonb_build_object('previous_username',target.user_id,'username_changed',target.user_id<>uname,'temporary',false));
 return jsonb_build_object('ok',true,'username',uname,'password_changed',changing,'temporary',false);
end $$;


-- Existing Master-set passwords remain valid; discard only old reset-only sessions.
delete from public.portal_sessions where reset_only;
update public.portal_officers set password_change_required=false where password_change_required;
