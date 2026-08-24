create or replace function private.cleanup_stale_ci_e2e_users_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  target record;
  candidate_count integer:=0;
  deleted_count integer:=0;
  skipped_count integer:=0;
  deleted_one integer:=0;
begin
  for target in
    select u.id
    from auth.users u
    where u.created_at < timezone('utc',now()) - interval '6 hours'
      and coalesce(u.raw_user_meta_data->>'source','')='github-actions-e2e'
      and coalesce(u.raw_user_meta_data->>'e2e_run_id','') ~ '^[0-9]{1,24}$'
      and lower(coalesce(u.email,'')) = lower('goldenoremar+ci-e2e-'||(u.raw_user_meta_data->>'e2e_run_id')||'@gmail.com')
    order by u.created_at
    limit 100
  loop
    candidate_count:=candidate_count+1;
    begin
      delete from auth.users where id=target.id;
      get diagnostics deleted_one = row_count;
      deleted_count:=deleted_count+deleted_one;
    exception when foreign_key_violation then
      skipped_count:=skipped_count+1;
    end;
  end loop;

  if candidate_count>0 then
    insert into private.admin_audit_logs(
      actor_user_id,action,target_type,target_id,details,correlation_id,before_state,after_state
    ) values (
      null,'ci.e2e_stale_user_gc','automation',null,
      jsonb_build_object('candidateCount',candidate_count,'deletedCount',deleted_count,'skippedForeignKeyCount',skipped_count,'minimumAgeHours',6,'batchLimit',100),
      gen_random_uuid(),null,
      jsonb_build_object('candidateCount',candidate_count,'deletedCount',deleted_count,'skippedForeignKeyCount',skipped_count)
    );
  end if;

  return jsonb_build_object('ok',true,'candidateCount',candidate_count,'deletedCount',deleted_count,'skippedForeignKeyCount',skipped_count);
end;
$$;

revoke all on function private.cleanup_stale_ci_e2e_users_v1() from public,anon,authenticated;
grant execute on function private.cleanup_stale_ci_e2e_users_v1() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='golden-oremar-ci-e2e-user-gc';

select cron.schedule(
  'golden-oremar-ci-e2e-user-gc',
  '17 * * * *',
  $cron$select private.cleanup_stale_ci_e2e_users_v1();$cron$
);