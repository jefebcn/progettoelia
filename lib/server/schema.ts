/**
 * Schema del database (Postgres, es. Neon). Viene applicato automaticamente
 * dall'app al primo accesso (vedi db.ts): non serve incollare SQL a mano.
 *
 * Tutto è idempotente (create if not exists / create or replace / on conflict),
 * quindi rieseguirlo non perde dati. Per cambiare lo schema: modifica l'SQL
 * qui sotto in modo idempotente e incrementa SCHEMA_VERSION.
 *
 * Il database è raggiungibile solo dal server dell'app: niente ruoli pubblici,
 * niente RLS. Il PIN operatore è la variabile d'ambiente STAFF_PIN.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = /* sql */ `
create table if not exists app_meta (
  key   text primary key,
  value text not null
);

-- Numero pass progressivo visualizzabile (parte da 101).
create sequence if not exists pass_number_seq start 101;

create table if not exists slots (
  id             uuid primary key default gen_random_uuid(),
  slot_time      time not null unique,
  max_capacity   int  not null default 15,
  current_booked int  not null default 0 check (current_booked >= 0),
  status         text not null default 'active'
                 check (status in ('active', 'suspended', 'full')),
  created_at     timestamptz not null default now()
);

create table if not exists reservations (
  id             uuid primary key default gen_random_uuid(),
  pass_number    int  not null default nextval('pass_number_seq'),
  slot_id        uuid not null references slots(id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  adults_count   int  not null default 1 check (adults_count >= 1),
  children_count int  not null default 0 check (children_count >= 0),
  total_people   int  not null check (total_people >= 1),
  status         text not null default 'booked'
                 check (status in ('booked', 'checked_in', 'no_show', 'manual_entry')),
  created_at     timestamptz not null default now(),
  checked_in_at  timestamptz
);

create index if not exists reservations_slot_id_idx on reservations (slot_id);
create index if not exists reservations_status_idx on reservations (status);
create index if not exists reservations_checked_in_at_idx on reservations (checked_in_at desc);

-- Riga singola: pausa globale / "Tasto Imprevisti".
create table if not exists system_state (
  id               boolean primary key default true check (id),
  intake_suspended boolean not null default false,
  message          text,
  updated_at       timestamptz not null default now()
);
insert into system_state (id) values (true) on conflict (id) do nothing;

-- Slot da 10:00 a 16:45 ogni 15 minuti (ultimo ingresso 16:45).
insert into slots (slot_time)
select g::time
  from generate_series(timestamp '2000-01-01 10:00',
                       timestamp '2000-01-01 16:45',
                       interval '15 minutes') as g
on conflict (slot_time) do nothing;

-- Tentativi di PIN errati (anti brute-force).
create table if not exists pin_failures (
  id        bigserial primary key,
  client_ip text not null,
  at        timestamptz not null default now()
);
create index if not exists pin_failures_ip_at_idx on pin_failures (client_ip, at desc);

-- Prenotazione con lock di riga sullo slot: current_booked non supera mai la
-- capienza anche con richieste simultanee.
create or replace function insert_reservation(
  p_slot_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_adults     int,
  p_children   int,
  p_status     text,      -- 'booked' | 'manual_entry'
  p_force      boolean    -- true = l'operatore può superare la capienza
) returns reservations
language plpgsql
set search_path = public
as $$
declare
  v_slot   slots;
  v_total  int;
  v_first  text := trim(coalesce(p_first_name, ''));
  v_last   text := trim(coalesce(p_last_name, ''));
  v_res    reservations;
  v_now    time := (now() at time zone 'Europe/Rome')::time;
begin
  if p_status not in ('booked', 'manual_entry') then
    raise exception 'INVALID_STATUS';
  end if;
  if length(v_first) not between 1 and 60 or length(v_last) not between 1 and 60 then
    raise exception 'INVALID_NAME';
  end if;
  if coalesce(p_adults, 0) < 1 or p_adults > 50 then
    raise exception 'INVALID_ADULTS';
  end if;
  if coalesce(p_children, 0) < 0 or p_children > 50 then
    raise exception 'INVALID_CHILDREN';
  end if;
  v_total := p_adults + p_children;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if p_status = 'booked' then
    if exists (select 1 from system_state where id = true and intake_suspended) then
      raise exception 'INTAKE_SUSPENDED';
    end if;
    if v_slot.status = 'suspended' then
      raise exception 'SLOT_SUSPENDED';
    end if;
    if v_total > v_slot.max_capacity then
      raise exception 'GROUP_TOO_LARGE';
    end if;
    -- Slot già concluso (ogni slot dura 15 minuti, ora di Roma).
    if extract(epoch from v_slot.slot_time) + 15 * 60 <= extract(epoch from v_now) then
      raise exception 'SLOT_PAST';
    end if;
  end if;

  if not p_force and v_slot.current_booked + v_total > v_slot.max_capacity then
    raise exception 'SLOT_FULL';
  end if;

  insert into reservations
    (slot_id, first_name, last_name, adults_count, children_count,
     total_people, status, checked_in_at)
  values
    (p_slot_id, v_first, v_last, p_adults, p_children, v_total, p_status,
     case when p_status = 'manual_entry' then now() else null end)
  returning * into v_res;

  update slots
     set current_booked = current_booked + v_total,
         status = case
                    when status = 'suspended' then 'suspended'
                    when current_booked + v_total >= max_capacity then 'full'
                    else 'active'
                  end
   where id = p_slot_id;

  return v_res;
end;
$$;

-- Ricalcola lo stato di uno slot dopo che sono cambiati i posti.
create or replace function refresh_slot_status(p_slot_id uuid)
returns void
language sql
set search_path = public
as $$
  update slots
     set status = case
                    when status = 'suspended' then 'suspended'
                    when current_booked >= max_capacity then 'full'
                    else 'active'
                  end
   where id = p_slot_id;
$$;

create or replace function staff_check_in(p_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_res reservations;
begin
  select * into v_res from reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_res.status in ('checked_in', 'manual_entry') then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_IN', 'data', to_jsonb(v_res));
  end if;

  -- Era stato segnato assente: rioccupa i posti che erano stati liberati.
  if v_res.status = 'no_show' then
    perform 1 from slots where id = v_res.slot_id for update;
    update slots set current_booked = current_booked + v_res.total_people
     where id = v_res.slot_id;
    perform refresh_slot_status(v_res.slot_id);
  end if;

  update reservations
     set status = 'checked_in', checked_in_at = now()
   where id = p_id
  returning * into v_res;

  return jsonb_build_object('ok', true, 'data', to_jsonb(v_res));
end;
$$;

create or replace function staff_mark_no_show(p_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_res reservations;
begin
  select * into v_res from reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_res.status <> 'booked' then
    return jsonb_build_object('ok', false, 'error', 'NOT_BOOKED');
  end if;

  update reservations set status = 'no_show' where id = p_id
  returning * into v_res;

  -- Libera i posti nello slot.
  perform 1 from slots where id = v_res.slot_id for update;
  update slots
     set current_booked = greatest(0, current_booked - v_res.total_people)
   where id = v_res.slot_id;
  perform refresh_slot_status(v_res.slot_id);

  return jsonb_build_object('ok', true, 'data', to_jsonb(v_res));
end;
$$;

create or replace function reset_day(p_reset_numbers boolean default true)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from reservations where true;
  update slots set current_booked = 0, status = 'active' where true;
  update system_state
     set intake_suspended = false, message = null, updated_at = now()
   where id = true;
  if p_reset_numbers then
    perform setval('pass_number_seq', 101, false);
  end if;
end;
$$;
`;
