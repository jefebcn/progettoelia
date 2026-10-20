-- =====================================================================
-- 0003 — Sicurezza operatore + correzioni logiche
--
-- Cosa cambia:
--   1. La anon key (pubblica nel bundle JS) NON può più:
--        - leggere nomi/cognomi di tutti i visitatori
--        - fare UPDATE diretti su slots / reservations / system_state
--        - chiamare reset_day / quick_entry / sospensione
--      Tutte le azioni operatore passano da funzioni staff_* protette da PIN.
--   2. book_reservation non accetta più p_status dal client (prima chiunque
--      poteva auto-registrarsi come "checked_in" scavalcando la sospensione).
--   3. "Assente" (no_show) restituisce i posti allo slot.
--   4. Validazioni lato DB: nome/cognome 1-60 caratteri, gruppo <= capienza,
--      niente prenotazioni su slot già terminati (ora di Roma).
--   5. Funzioni pubbliche minime: get_pass(id) e recent_entries() per pass e display.
--   6. Anti brute-force del PIN: max 10 tentativi errati ogni 15 minuti per IP.
--
-- DOPO aver eseguito questo file, imposta il PIN operatore dal SQL Editor:
--     select private.set_staff_pin('il-tuo-pin-di-almeno-6-caratteri');
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Configurazione staff (non esposta da PostgREST: schema private)
-- ---------------------------------------------------------------------
create table if not exists private.staff_config (
  id         boolean primary key default true check (id),
  pin_hash   text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.pin_failures (
  id        bigserial primary key,
  client_ip text not null,
  at        timestamptz not null default now()
);
create index if not exists pin_failures_ip_at_idx on private.pin_failures (client_ip, at desc);

create or replace function private.set_staff_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
begin
  if p_pin is null or length(p_pin) < 6 then
    raise exception 'Il PIN deve avere almeno 6 caratteri';
  end if;
  insert into private.staff_config (id, pin_hash, updated_at)
  values (true, crypt(p_pin, gen_salt('bf')), now())
  on conflict (id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
  delete from private.pin_failures;
end;
$$;

create or replace function private.client_ip()
returns text
language sql
stable
as $$
  select coalesce(
    split_part(
      nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for',
      ',', 1),
    'unknown');
$$;

-- Ritorna NULL se il PIN è valido, altrimenti il codice d'errore.
-- NON solleva eccezioni: così il tentativo fallito resta registrato.
create or replace function private.pin_error(p_pin text)
returns text
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_hash text;
  v_ip   text := private.client_ip();
  v_fail int;
begin
  delete from private.pin_failures where at < now() - interval '1 day';

  select count(*) into v_fail
    from private.pin_failures
   where client_ip = v_ip and at > now() - interval '15 minutes';
  if v_fail >= 10 then
    return 'TOO_MANY_ATTEMPTS';
  end if;

  select pin_hash into v_hash from private.staff_config where id = true;
  if v_hash is null then
    return 'PIN_NOT_SET';
  end if;

  if p_pin is null or crypt(p_pin, v_hash) <> v_hash then
    insert into private.pin_failures (client_ip) values (v_ip);
    perform pg_sleep(0.7);
    return 'BAD_PIN';
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Chiudi i permessi troppo larghi della 0001/0002
-- ---------------------------------------------------------------------
drop policy if exists slots_update on public.slots;
drop policy if exists res_read     on public.reservations;
drop policy if exists res_update   on public.reservations;
drop policy if exists state_update on public.system_state;

revoke all on public.slots        from anon, authenticated;
revoke all on public.reservations from anon, authenticated;
revoke all on public.system_state from anon, authenticated;
-- Lettura pubblica solo di slot e stato globale (servono a form e display).
grant select on public.slots        to anon, authenticated;
grant select on public.system_state to anon, authenticated;
revoke usage on sequence pass_number_seq from anon, authenticated;

-- Le vecchie funzioni non devono più essere chiamabili dal browser.
drop function if exists public.book_reservation(uuid, text, text, int, int, text);
drop function if exists public.quick_entry(uuid, text, text, int, int, boolean);
drop function if exists public.reset_day(boolean);

-- ---------------------------------------------------------------------
-- Logica interna condivisa (prenotazione con lock di riga)
-- ---------------------------------------------------------------------
create or replace function private.insert_reservation(
  p_slot_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_adults     int,
  p_children   int,
  p_status     text,      -- 'booked' | 'manual_entry'
  p_force      boolean    -- true = l'operatore può superare la capienza
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot   public.slots;
  v_total  int;
  v_first  text := trim(coalesce(p_first_name, ''));
  v_last   text := trim(coalesce(p_last_name, ''));
  v_res    public.reservations;
  v_now    time := (now() at time zone 'Europe/Rome')::time;
begin
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

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if p_status = 'booked' then
    if exists (select 1 from public.system_state where id = true and intake_suspended) then
      raise exception 'INTAKE_SUSPENDED';
    end if;
    if v_slot.status = 'suspended' then
      raise exception 'SLOT_SUSPENDED';
    end if;
    if v_total > v_slot.max_capacity then
      raise exception 'GROUP_TOO_LARGE';
    end if;
    -- Slot già concluso (ogni slot dura 15 minuti).
    if extract(epoch from v_slot.slot_time) + 15 * 60 <= extract(epoch from v_now) then
      raise exception 'SLOT_PAST';
    end if;
  end if;

  if not p_force and v_slot.current_booked + v_total > v_slot.max_capacity then
    raise exception 'SLOT_FULL';
  end if;

  insert into public.reservations
    (slot_id, first_name, last_name, adults_count, children_count,
     total_people, status, checked_in_at)
  values
    (p_slot_id, v_first, v_last, p_adults, p_children, v_total, p_status,
     case when p_status = 'manual_entry' then now() else null end)
  returning * into v_res;

  update public.slots
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

-- Ricalcola lo stato di uno slot dopo che sono stati liberati posti.
create or replace function private.refresh_slot_status(p_slot_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.slots
     set status = case
                    when status = 'suspended' then 'suspended'
                    when current_booked >= max_capacity then 'full'
                    else 'active'
                  end
   where id = p_slot_id;
$$;

-- ---------------------------------------------------------------------
-- FUNZIONI PUBBLICHE (anon)
-- ---------------------------------------------------------------------
create or replace function public.book_reservation(
  p_slot_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_adults     int,
  p_children   int
) returns public.reservations
language sql
security definer
set search_path = public
as $$
  select * from private.insert_reservation(
    p_slot_id, p_first_name, p_last_name, p_adults, p_children, 'booked', false);
$$;

-- Il pass si legge solo conoscendo l'UUID (non indovinabile).
create or replace function public.get_pass(p_id uuid)
returns setof public.reservations
language sql
stable
security definer
set search_path = public
as $$
  select * from public.reservations where id = p_id;
$$;

-- Display pubblico: solo numero pass, nome e iniziale del cognome.
create or replace function public.recent_entries(
  p_minutes int default 10,
  p_limit   int default 8
) returns table (
  pass_number   int,
  first_name    text,
  last_initial  text,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.pass_number, r.first_name, left(r.last_name, 1), r.checked_in_at
    from public.reservations r
   where r.status in ('checked_in', 'manual_entry')
     and r.checked_in_at > now() - make_interval(mins => least(greatest(p_minutes, 1), 120))
   order by r.checked_in_at desc
   limit least(greatest(p_limit, 1), 30);
$$;

-- ---------------------------------------------------------------------
-- FUNZIONI OPERATORE (richiedono PIN). Ritornano sempre jsonb:
--   { "ok": true, "data": ... }  oppure  { "ok": false, "error": "CODICE" }
-- ---------------------------------------------------------------------
create or replace function public.staff_login(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_err text := private.pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_list_reservations(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_err text := private.pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (select * from public.reservations order by created_at desc limit 500) r
  ), '[]'::jsonb));
end;
$$;

create or replace function public.staff_get_reservation(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_err text := private.pin_error(p_pin);
  v_res public.reservations;
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  select * into v_res from public.reservations where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(v_res));
end;
$$;

create or replace function public.staff_check_in(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_err text := private.pin_error(p_pin);
  v_res public.reservations;
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;

  select * into v_res from public.reservations where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if v_res.status in ('checked_in', 'manual_entry') then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_IN', 'data', to_jsonb(v_res));
  end if;

  -- Era stato segnato assente: rioccupa i posti che erano stati liberati.
  if v_res.status = 'no_show' then
    perform 1 from public.slots where id = v_res.slot_id for update;
    update public.slots set current_booked = current_booked + v_res.total_people
     where id = v_res.slot_id;
    perform private.refresh_slot_status(v_res.slot_id);
  end if;

  update public.reservations
     set status = 'checked_in', checked_in_at = now()
   where id = p_id
  returning * into v_res;

  return jsonb_build_object('ok', true, 'data', to_jsonb(v_res));
end;
$$;

create or replace function public.staff_mark_no_show(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_err text := private.pin_error(p_pin);
  v_res public.reservations;
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;

  select * into v_res from public.reservations where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if v_res.status <> 'booked' then
    return jsonb_build_object('ok', false, 'error', 'NOT_BOOKED');
  end if;

  update public.reservations set status = 'no_show' where id = p_id
  returning * into v_res;

  -- Libera i posti nello slot.
  perform 1 from public.slots where id = v_res.slot_id for update;
  update public.slots
     set current_booked = greatest(0, current_booked - v_res.total_people)
   where id = v_res.slot_id;
  perform private.refresh_slot_status(v_res.slot_id);

  return jsonb_build_object('ok', true, 'data', to_jsonb(v_res));
end;
$$;

create or replace function public.staff_set_intake(
  p_pin       text,
  p_suspended boolean,
  p_message   text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_err text := private.pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  update public.system_state
     set intake_suspended = p_suspended,
         message = nullif(trim(left(coalesce(p_message, ''), 200)), ''),
         updated_at = now()
   where id = true;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_set_slot_suspended(
  p_pin       text,
  p_slot_id   uuid,
  p_suspended boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_err text := private.pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  update public.slots
     set status = case
                    when p_suspended then 'suspended'
                    when current_booked >= max_capacity then 'full'
                    else 'active'
                  end
   where id = p_slot_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'SLOT_NOT_FOUND'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_quick_entry(
  p_pin        text,
  p_slot_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_adults     int,
  p_children   int,
  p_force      boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_err text := private.pin_error(p_pin);
  v_res public.reservations;
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  begin
    v_res := private.insert_reservation(
      p_slot_id, p_first_name, p_last_name, p_adults, p_children, 'manual_entry', p_force);
  exception when raise_exception then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'data', to_jsonb(v_res));
end;
$$;

create or replace function public.staff_reset_day(
  p_pin           text,
  p_reset_numbers boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_err text := private.pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;

  delete from public.reservations where true;
  update public.slots set current_booked = 0, status = 'active' where true;
  update public.system_state
     set intake_suspended = false, message = null, updated_at = now()
   where id = true;
  if p_reset_numbers then
    perform setval('pass_number_seq', 101, false);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Permessi sulle funzioni: in Supabase le nuove funzioni sono eseguibili
-- da anon per default, quindi chiudiamo tutto e riapriamo solo il necessario.
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;

revoke all on function public.book_reservation(uuid, text, text, int, int) from public;
revoke all on function public.get_pass(uuid) from public;
revoke all on function public.recent_entries(int, int) from public;
revoke all on function public.staff_login(text) from public;
revoke all on function public.staff_list_reservations(text) from public;
revoke all on function public.staff_get_reservation(text, uuid) from public;
revoke all on function public.staff_check_in(text, uuid) from public;
revoke all on function public.staff_mark_no_show(text, uuid) from public;
revoke all on function public.staff_set_intake(text, boolean, text) from public;
revoke all on function public.staff_set_slot_suspended(text, uuid, boolean) from public;
revoke all on function public.staff_quick_entry(text, uuid, text, text, int, int, boolean) from public;
revoke all on function public.staff_reset_day(text, boolean) from public;

grant execute on function public.book_reservation(uuid, text, text, int, int) to anon, authenticated;
grant execute on function public.get_pass(uuid) to anon, authenticated;
grant execute on function public.recent_entries(int, int) to anon, authenticated;
grant execute on function public.staff_login(text) to anon, authenticated;
grant execute on function public.staff_list_reservations(text) to anon, authenticated;
grant execute on function public.staff_get_reservation(text, uuid) to anon, authenticated;
grant execute on function public.staff_check_in(text, uuid) to anon, authenticated;
grant execute on function public.staff_mark_no_show(text, uuid) to anon, authenticated;
grant execute on function public.staff_set_intake(text, boolean, text) to anon, authenticated;
grant execute on function public.staff_set_slot_suspended(text, uuid, boolean) to anon, authenticated;
grant execute on function public.staff_quick_entry(text, uuid, text, text, int, int, boolean) to anon, authenticated;
grant execute on function public.staff_reset_day(text, boolean) to anon, authenticated;
