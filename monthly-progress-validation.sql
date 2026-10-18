create or replace function monthly_v2.require_teacher_progress(d jsonb,tid text default null) returns void language plpgsql set search_path='' as $$
declare t jsonb;a jsonb;k text;label text;grade_label text;g jsonb;
begin
 if jsonb_array_length(coalesce(d->'teachers','[]'))=0 then raise exception 'Select at least one teacher before saving a report';end if;
 if tid is null then
  if coalesce(trim(d->'profile'->>'school'),'')='' or coalesce(trim(d->'profile'->>'hm'),'')='' or coalesce(d->'profile'->>'bps','')='' or coalesce(d->>'date','')='' then raise exception 'Complete School Name, HM Name, HM BPS and Report Date before final save';end if;
  if jsonb_array_length(coalesce(d->'classes','[]'))=0 then raise exception 'Select the school classes before final save';end if;
  for g in select * from jsonb_array_elements(d->'classes') loop
   if not exists(select 1 from jsonb_array_elements(d->'assignments') x where (x->>'grade')::int=g::text::int) then
    grade_label:=(array['I','II','III','IV','V'])[g::text::int];raise exception '%: Select at least one subject for this selected class.',grade_label;
   end if;
  end loop;
 elsif not exists(select 1 from jsonb_array_elements(d->'teachers') x where x->>'id'=tid) then raise exception 'Select a teacher workspace before saving';end if;
 for t in select * from jsonb_array_elements(d->'teachers') x where tid is null or x->>'id'=tid loop
  if coalesce(trim(t->>'name'),'')='' then raise exception 'Fill Teacher Name in Edit Teacher';end if;
  if coalesce(t->>'pid','') !~ '^[0-9]+$' then raise exception '%: Fill a numerical PID in Edit Teacher.',t->>'name';end if;
  if not exists(select 1 from jsonb_array_elements(d->'assignments') x where x->>'teacher'=t->>'id') then raise exception '%: Select at least one subject before saving.',t->>'name';end if;
  for a in select * from jsonb_array_elements(d->'assignments') x where x->>'teacher'=t->>'id' loop
   grade_label:=(array['I','II','III','IV','V'])[(a->>'grade')::int];
   foreach k in array array['previous','current','notebooks','cleanliness','feedback','suggestions'] loop
    label:=case k when 'previous' then 'Previous Month Covered' when 'current' then 'Current Month Covered' when 'notebooks' then 'Notebook / Textbook Maintenance (%)' when 'cleanliness' then 'Cleanliness & Classroom Management' when 'feedback' then 'Student Formative Test Feedback' else 'Suggestions for Improvement' end;
    if coalesce(trim(a->>k),'')='' then raise exception '% — % · %: Fill %.',t->>'name',grade_label,a->>'name',label;end if;
   end loop;
   if (a->>'previous')::numeric<0 or (a->>'current')::numeric<0 or (a->>'previous')::numeric+(a->>'current')::numeric>(a->>'total')::numeric then raise exception '% — % · %: Correct the covered chapter counts.',t->>'name',grade_label,a->>'name';end if;
   if (a->>'notebooks')::numeric not between 0 and 100 then raise exception '% — % · %: Notebook percentage must be between 0 and 100.',t->>'name',grade_label,a->>'name';end if;
  end loop;
 end loop;
end $$;
revoke all on function monthly_v2.require_teacher_progress(jsonb,text) from public,anon,authenticated;

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
 if exists(select 1 from jsonb_array_elements(merged->'teachers') t where coalesce(merged->'removed_teacher_ids','[]') @> jsonb_build_array(t->>'id')) then raise exception 'Teacher selection changed on another device. Reopen the month before saving.';end if;
 if final then perform monthly_v2.require_teacher_progress(merged,null);elsif payload->>'intent'='teacher' then perform monthly_v2.require_teacher_progress(merged,payload->>'teacher_id');end if;
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

