-- =====================================================================
-- Sistema di Gestione Ingressi e Code Virtuali — Schema iniziale
-- Eseguire nel SQL Editor di Supabase (o via `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";

-- Sequenza per il numero pass progressivo visualizzabile (parte da 101).
create sequence if not exists pass_number_seq start 101;

-- ---------------------------------------------------------------------
-- Tabella: slots
-- ---------------------------------------------------------------------
create table if not exists public.slots (
  id             uuid primary key default gen_random_uuid(),
  slot_time      time not null unique,
  max_capacity   int  not null default 15,
  current_booked int  not null default 0 check (current_booked >= 0),
  status         text not null default 'active'
                 check (status in ('active', 'suspended', 'full')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabella: reservations
-- ---------------------------------------------------------------------
create table if not exists public.reservations (
  id             uuid primary key default gen_random_uuid(),
  pass_number    int  not null default nextval('pass_number_seq'),
  slot_id        uuid not null references public.slots(id) on delete cascade,
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

create index if not exists reservations_slot_id_idx on public.reservations (slot_id);
create index if not exists reservations_status_idx on public.reservations (status);
create index if not exists reservations_checked_in_at_idx on public.reservations (checked_in_at desc);

-- ---------------------------------------------------------------------
-- Tabella: system_state (riga singola) — pausa globale / "Tasto Imprevisti"
-- ---------------------------------------------------------------------
create table if not exists public.system_state (
  id               boolean primary key default true,
  intake_suspended boolean not null default false,
  message          text,
  updated_at       timestamptz not null default now(),
  constraint single_row check (id)
);

insert into public.system_state (id) values (true)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Seed: slot da 10:00 a 16:45 ogni 15 minuti (ultimo ingresso 16:45).
-- ---------------------------------------------------------------------
insert into public.slots (slot_time)
select g::time
from generate_series(
  timestamp '2000-01-01 10:00',
  timestamp '2000-01-01 16:45',
  interval '15 minutes'
) as g
on conflict (slot_time) do nothing;

-- ---------------------------------------------------------------------
-- Funzione atomica di prenotazione.
-- Garantisce che current_booked non superi mai max_capacity anche con
-- richieste simultanee, grazie al lock di riga (SELECT ... FOR UPDATE).
-- ---------------------------------------------------------------------
create or replace function public.book_reservation(
  p_slot_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_adults     int,
  p_children   int,
  p_status     text default 'booked'
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot        public.slots;
  v_total       int;
  v_reservation public.reservations;
  v_suspended   boolean;
begin
  if coalesce(p_adults, 0) < 1 then
    raise exception 'INVALID_ADULTS';
  end if;
  if coalesce(p_children, 0) < 0 then
    raise exception 'INVALID_CHILDREN';
  end if;

  v_total := p_adults + p_children;

  -- Pausa globale (vale solo per le prenotazioni self-service degli utenti).
  select intake_suspended into v_suspended from public.system_state where id = true;
  if coalesce(v_suspended, false) and p_status = 'booked' then
    raise exception 'INTAKE_SUSPENDED';
  end if;

  -- Blocca la riga dello slot: serializza le richieste concorrenti.
  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_slot.status = 'suspended' and p_status = 'booked' then
    raise exception 'SLOT_SUSPENDED';
  end if;

  if v_slot.current_booked + v_total > v_slot.max_capacity then
    raise exception 'SLOT_FULL';
  end if;

  insert into public.reservations
    (slot_id, first_name, last_name, adults_count, children_count,
     total_people, status, checked_in_at)
  values
    (p_slot_id, trim(p_first_name), trim(p_last_name), p_adults, p_children,
     v_total, p_status,
     case when p_status in ('manual_entry', 'checked_in') then now() else null end)
  returning * into v_reservation;

  update public.slots
     set current_booked = current_booked + v_total,
         status = case
                    when current_booked + v_total >= max_capacity then 'full'
                    else status
                  end
   where id = p_slot_id;

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------
-- Ingresso rapido senza prenotazione (walk-in) nello slot indicato.
-- Di default consente di superare la capienza a discrezione dell'operatore.
-- ---------------------------------------------------------------------
create or replace function public.quick_entry(
  p_slot_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_adults     int,
  p_children   int,
  p_force      boolean default true
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot        public.slots;
  v_total       int;
  v_reservation public.reservations;
begin
  v_total := greatest(coalesce(p_adults, 1), 1) + greatest(coalesce(p_children, 0), 0);

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if not p_force and (v_slot.current_booked + v_total > v_slot.max_capacity) then
    raise exception 'SLOT_FULL';
  end if;

  insert into public.reservations
    (slot_id, first_name, last_name, adults_count, children_count,
     total_people, status, checked_in_at)
  values
    (p_slot_id, trim(p_first_name), trim(p_last_name),
     greatest(coalesce(p_adults, 1), 1), greatest(coalesce(p_children, 0), 0),
     v_total, 'manual_entry', now())
  returning * into v_reservation;

  update public.slots
     set current_booked = current_booked + v_total,
         status = case
                    when current_booked + v_total >= max_capacity then 'full'
                    else status
                  end
   where id = p_slot_id;

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security.
-- NOTA: app pubblica senza autenticazione. Le policy sono volutamente
-- permissive per funzionare con la anon key. In PRODUZIONE le operazioni
-- dell'operatore (check-in, sospensione, update slot) dovrebbero essere
-- protette da un ruolo/autenticazione dedicato.
-- ---------------------------------------------------------------------
alter table public.slots         enable row level security;
alter table public.reservations  enable row level security;
alter table public.system_state  enable row level security;

drop policy if exists slots_read   on public.slots;
drop policy if exists slots_update on public.slots;
drop policy if exists res_read     on public.reservations;
drop policy if exists res_update   on public.reservations;
drop policy if exists state_read   on public.system_state;
drop policy if exists state_update on public.system_state;

create policy slots_read   on public.slots        for select using (true);
create policy slots_update on public.slots        for update using (true) with check (true);

create policy res_read     on public.reservations for select using (true);
create policy res_update   on public.reservations for update using (true) with check (true);
-- Gli INSERT su reservations passano dalle funzioni security definer.

create policy state_read   on public.system_state for select using (true);
create policy state_update on public.system_state for update using (true) with check (true);

grant select, update on public.slots        to anon, authenticated;
grant select, update on public.reservations to anon, authenticated;
grant select, update on public.system_state to anon, authenticated;
grant usage on sequence pass_number_seq     to anon, authenticated;

grant execute on function public.book_reservation(uuid, text, text, int, int, text)
  to anon, authenticated;
grant execute on function public.quick_entry(uuid, text, text, int, int, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: pubblica le tabelle per le subscription live.
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.slots;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.reservations;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.system_state;
  exception when others then null;
  end;
end $$;
