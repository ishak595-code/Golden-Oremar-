alter table private.payment_intents
  alter column payment_method_id drop not null;

alter table private.payment_intents
  add column if not exists payment_channel text not null default 'saved_card';

alter table private.payment_intents
  drop constraint if exists payment_intents_payment_channel_check;

alter table private.payment_intents
  add constraint payment_intents_payment_channel_check
  check (payment_channel in ('saved_card','iyzico_checkout_form'));

create index if not exists payment_intents_subject_channel_idx
  on private.payment_intents(subject_type, subject_id, payment_channel, created_at desc);

comment on column private.payment_intents.payment_method_id is 'Optional for provider-hosted checkout. Required only for saved_card channel.';
comment on column private.payment_intents.payment_channel is 'Golden Oremar payment UX channel. Current production scope: saved_card or iyzico_checkout_form.';
