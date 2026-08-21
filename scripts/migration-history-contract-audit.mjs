import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'supabase','migrations');
const failures=[];
if(!fs.existsSync(dir)){failures.push('Supabase migrations directory is missing.');}
else{
  const files=fs.readdirSync(dir).filter(name=>name.endsWith('.sql')).sort();
  const byVersion=new Map();
  for(const file of files){
    const match=file.match(/^(\d{14})_(.+)\.sql$/);
    if(!match){failures.push(`Migration filename is not canonical: ${file}`);continue;}
    const version=match[1];
    const existing=byVersion.get(version)||[];
    existing.push(file);
    byVersion.set(version,existing);
  }
  for(const [version,names] of byVersion){if(names.length>1)failures.push(`Duplicate migration timestamp ${version}: ${names.join(', ')}`);}

  const required=[
    '20260820205756_strengthen_golden_oremar_legal_disclosures_2026.sql',
    '20260820211030_invalidate_legal_finalization_on_identity_or_document_change.sql',
    '20260821075933_retire_legacy_producer_account_public_contracts_v1.sql',
    '20260821083330_flatten_producer_read_contracts_and_remove_orphan_storefronts.sql',
    '20260821083551_flatten_producer_onboarding_write_contracts.sql',
    '20260821084346_seal_canonical_producer_entrypoints_v1.sql',
    '20260821084442_restore_linter_safe_producer_wrappers_v1.sql',
    '20260821085226_canonicalize_public_rpc_versions_and_retire_duplicate_aliases.sql',
    '20260821091027_seed_estimated_packaged_shipping_weights_and_track_provenance_v2.sql',
    '20260821094110_seed_provisional_business_identity_and_admin_verification_v1.sql',
    '20260821094518_seed_multilingual_legal_document_drafts_v1.sql',
    '20260821094807_add_super_admin_release_setup_management_v1.sql',
    '20260821095157_preserve_payment_config_when_release_return_url_is_empty_v1.sql',
  ];
  for(const file of required){if(!files.includes(file))failures.push(`Required canonical migration is missing: ${file}`);}
  if(files.includes('20260820211030_strengthen_golden_oremar_legal_disclosures_2026.sql'))failures.push('Mis-timestamped legal disclosure migration must stay retired.');
}

if(failures.length){console.error('Golden Oremar migration history contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar migration history contract audit passed: migration filenames are canonical, timestamps are unique, and critical live-aligned migrations are present.');
