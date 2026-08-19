create index if not exists product_editorial_drafts_producer_idx on private.product_editorial_drafts(producer_id);
create index if not exists product_editorial_drafts_submitted_by_idx on private.product_editorial_drafts(submitted_by);
create index if not exists product_editorial_drafts_reviewed_by_idx on private.product_editorial_drafts(reviewed_by) where reviewed_by is not null;
create index if not exists product_provenance_source_producer_idx on public.product_provenance(source_producer_id) where source_producer_id is not null;
