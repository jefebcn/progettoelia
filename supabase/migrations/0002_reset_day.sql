-- =====================================================================
-- Funzione di reset giornata (usata dal pulsante "Reset" in /checkin).
-- Cancella le prenotazioni, azzera i contatori/stato degli slot e
-- (opzionale) riporta la numerazione pass a #101.
-- =====================================================================

create or replace function public.reset_day(p_reset_numbers boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reservations;

  update public.slots
     set current_booked = 0,
         status = 'active';

  update public.system_state
     set intake_suspended = false,
         updated_at = now()
   where id = true;

  if p_reset_numbers then
    perform setval('pass_number_seq', 101, false);
  end if;
end;
$$;

grant execute on function public.reset_day(boolean) to anon, authenticated;
