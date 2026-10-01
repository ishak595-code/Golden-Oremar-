-- pg_cron keeps a row per run in cron.job_run_details. With a job every 30
-- seconds and another every minute that is over 4,000 rows a day, forever
-- (69,000 rows had already piled up). Keep a week of history.
do $do$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if exists (select 1 from cron.job where jobname='golden-oremar-cron-history-purge') then
      perform cron.unschedule('golden-oremar-cron-history-purge');
    end if;
    perform cron.schedule('golden-oremar-cron-history-purge','17 3 * * *',$job$delete from cron.job_run_details where end_time < now() - interval '7 days'$job$);
  end if;
end;
$do$;
