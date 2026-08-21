do $$
declare
  cfg private.super_admin_company_configuration_v1%rowtype;
  current_config jsonb;
  release_config jsonb;
begin
  select * into cfg from private.super_admin_company_configuration_v1 where singleton=true;
  if cfg.singleton is null then raise exception 'release_configuration_missing'; end if;
  select coalesce(public_config,'{}'::jsonb) into current_config from public.brand_settings where slug='golden-oremar' for update;
  release_config:=coalesce(current_config->'releaseSetup','{}'::jsonb);
  release_config:=jsonb_set(release_config,'{productionEnabled}',to_jsonb(cfg.production_enabled),true);
  current_config:=jsonb_set(current_config,'{releaseSetup}',release_config,true);
  update public.brand_settings set public_config=current_config,updated_at=timezone('utc',now()) where slug='golden-oremar';
end;
$$;
