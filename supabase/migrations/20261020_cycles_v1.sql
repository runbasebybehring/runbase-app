-- Run Base — ciclos de treino (20/10/2026)
-- Cada aluno tem um ciclo ativo (a numeração das semanas recomeça em 1 a cada ciclo).
-- Os ciclos anteriores ficam guardados e aparecem na aba "Ciclo anterior" da planilha.

alter table public.weeks add column if not exists cycle int not null default 1;
alter table public.athletes add column if not exists active_cycle int not null default 1;
alter table public.athletes add column if not exists cycle_titles jsonb not null default '{}'::jsonb;
create index if not exists weeks_athlete_cycle_idx on public.weeks (athlete_id, cycle, week_number);

-- avanço automático: só dentro do ciclo da semana atual
create or replace function public.advance_week_if_complete() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_week_id int; v_athlete_id uuid; v_week_number int; v_cycle int; v_total int; v_with_feedback int; v_next_week_id int;
begin
  select w.id, w.athlete_id, w.week_number, w.cycle into v_week_id, v_athlete_id, v_week_number, v_cycle
  from workouts wo join weeks w on w.id = wo.week_id where wo.id = new.workout_id;
  if v_week_id is null then return new; end if;
  if exists (select 1 from athletes where id = v_athlete_id and plan_start is not null) then return new; end if;
  if not exists (select 1 from weeks where id = v_week_id and is_current = true) then return new; end if;
  select count(*) into v_total from workouts where week_id = v_week_id;
  select count(*) into v_with_feedback from workouts wo join feedbacks f on f.workout_id = wo.id where wo.week_id = v_week_id;
  if v_with_feedback < v_total then return new; end if;
  select id into v_next_week_id from weeks where athlete_id = v_athlete_id and cycle = v_cycle and week_number > v_week_number order by week_number asc limit 1;
  if v_next_week_id is null then return new; end if;
  update weeks set is_current = false where id = v_week_id;
  update weeks set is_current = true where id = v_next_week_id;
  return new;
end; $function$;

-- semana atual pela data de início do plano: só semanas do ciclo ativo
create or replace function public.sync_athlete_week(p_athlete uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare v_start date; v_n int; v_target int; v_cycle int;
begin
  select plan_start, active_cycle into v_start, v_cycle from athletes where id = p_athlete;
  if v_start is null then return; end if;
  v_n := floor((sp_today() - v_start) / 7.0)::int + 1;
  select id into v_target from weeks where athlete_id = p_athlete and cycle = v_cycle and week_number <= greatest(v_n, 1)
    order by week_number desc limit 1;
  if v_target is null then
    select id into v_target from weeks where athlete_id = p_athlete and cycle = v_cycle order by week_number limit 1;
  end if;
  if v_target is null then return; end if;
  if exists (select 1 from weeks where id = v_target and is_current) then return; end if;
  update weeks set is_current = false where athlete_id = p_athlete and is_current;
  update weeks set is_current = true where id = v_target;
end $function$;
