do $$
declare
  v_jobid bigint;
begin
  select jobid
    into v_jobid
  from cron.job
  where jobname = 'golden-oremar-transactional-email-worker'
  limit 1;

  if v_jobid is null then
    raise notice 'golden-oremar-transactional-email-worker cron job not found; skipping';
    return;
  end if;

  perform cron.alter_job(
    v_jobid,
    command := $cron$
      select case
        when exists (
          select 1
          from private.transactional_email_jobs
          where (status = 'pending' and available_at <= now())
             or (status = 'processing' and locked_at < now() - interval '10 minutes')
        ) then net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'golden_oremar_project_url') || '/functions/v1/transactional-email-worker',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-golden-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'golden_oremar_transactional_email_worker')
          ),
          body := jsonb_build_object('source', 'cron'),
          timeout_milliseconds := 10000
        )
        else null::bigint
      end as request_id;
    $cron$
  );
end
$$;
