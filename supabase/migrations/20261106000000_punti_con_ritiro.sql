-- Correzione: con una vittoria per ritiro il calcolo dei punti leggeva un record mai assegnato
-- (errore 'record "s" is not assigned yet' su Postgres 17). Ora i set del perdente stanno in una variabile.

create or replace function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  set_perdente_reali int; -- set vinti da chi perde (null con il ritiro)
  tot int;
  voti_totali bigint;
  voti_giusti bigint;
  base int;
begin
  select * into p from partite where id = p_partita;
  if p is null then return; end if;
  if p.stato <> 'conclusa' then
    update pronostici_partita set punti = null, mese = null where partita_id = p_partita and punti is not null;
    return;
  end if;
  if not p.ritiro then
    select least(v.vinti_a, v.vinti_b) into set_perdente_reali from set_vinti(p.game_a, p.game_b) v;
    tot := totale_game(p.game_a, p.game_b, p.set_per_vincere);
  end if;
  select count(*), count(*) filter (where vincitore_id = p.vincitore_id) into voti_totali, voti_giusti
  from pronostici_partita where partita_id = p_partita;
  base := punti_rarita(3, voti_giusti, voti_totali, 2);
  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti = case when pr.vincitore_id <> p.vincitore_id then 0 else
      base
      + case when not p.ritiro and p.set_per_vincere = 2 and pr.set_vincitore is not null
                  and pr.set_perdente = set_perdente_reali then 2 else 0 end
      + case when p.ritiro or pr.totale_game is null then 0
             when pr.totale_game = tot then 3
             when abs(pr.totale_game - tot) <= 2 then 1
             else 0 end
    end
  where pr.partita_id = p_partita;
end $$;
