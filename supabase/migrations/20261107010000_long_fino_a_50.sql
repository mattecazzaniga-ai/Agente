-- Il long tie-break si vince a 10 con 2 punti di scarto; oltre il 10 si continua fino a quando uno va
-- avanti di 2. Si accettano punteggi fino a 50 (prima il limite era 40).
create or replace function public.tiebreak_valido(a int, b int) returns boolean
language sql immutable as $$
  select a between 0 and 50 and b between 0 and 50
     and greatest(a, b) >= 10 and abs(a - b) >= 2
     and (greatest(a, b) = 10 or abs(a - b) = 2)
$$;
