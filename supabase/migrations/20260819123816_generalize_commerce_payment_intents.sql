alter table private.payment_intents add column if not exists subject_type text not null default 'order';
alter table private.payment_intents add column if not exists subject_id uuid;
alter table private.payment_intents alter column order_id drop not null;

create or replace function private.normalize_payment_intent_subject_v1()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.subject_type:=lower(btrim(coalesce(new.subject_type,'order')));
  if new.subject_type='order' then
    if new.order_id is null then raise exception 'payment_order_subject_required' using errcode='22023'; end if;
    if new.subject_id is null then new.subject_id:=new.order_id; end if;
    if new.subject_id<>new.order_id then raise exception 'payment_subject_mismatch' using errcode='22023'; end if;
  elsif new.subject_type='event_reservation' then
    if new.subject_id is null then raise exception 'payment_event_reservation_subject_required' using errcode='22023'; end if;
    if new.order_id is not null then raise exception 'payment_event_subject_cannot_have_order' using errcode='22023'; end if;
  else
    raise exception 'unsupported_payment_subject_type' using errcode='22023';
  end if;
  return new;
end;
$$;

update private.payment_intents set subject_type='order',subject_id=order_id where subject_id is null and order_id is not null;

alter table private.payment_intents alter column subject_id set not null;

alter table private.payment_intents drop constraint if exists payment_intents_subject_type_check;
alter table private.payment_intents add constraint payment_intents_subject_type_check check (subject_type in ('order','event_reservation'));
alter table private.payment_intents drop constraint if exists payment_intents_subject_consistency_check;
alter table private.payment_intents add constraint payment_intents_subject_consistency_check check (
  (subject_type='order' and order_id is not null and subject_id=order_id)
  or (subject_type='event_reservation' and order_id is null)
);

create index if not exists payment_intents_subject_created_idx on private.payment_intents(subject_type,subject_id,created_at desc);

drop trigger if exists payment_intents_normalize_subject_trg on private.payment_intents;
create trigger payment_intents_normalize_subject_trg
before insert or update of subject_type,subject_id,order_id on private.payment_intents
for each row execute function private.normalize_payment_intent_subject_v1();
