-- Run Base v2 — aplicado em 30/09/2026 (registro das mudanças no banco)

-- 1) Quem é o coach
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = '0eaff6f3-e538-4b79-8b94-922b57b3bb42'::uuid
$$;
revoke execute on function public.is_coach() from anon, public;
grant execute on function public.is_coach() to authenticated;

-- 2) Conversa em cada feedback
create table public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id integer not null references public.feedbacks(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index on public.feedback_replies(feedback_id);
alter table public.feedback_replies enable row level security;
create policy replies_select on public.feedback_replies for select to authenticated
  using (public.is_coach() or exists (select 1 from public.feedbacks f where f.id = feedback_id and f.athlete_id = auth.uid()));
create policy replies_insert on public.feedback_replies for insert to authenticated
  with check (author_id = auth.uid() and (public.is_coach() or exists (select 1 from public.feedbacks f where f.id = feedback_id and f.athlete_id = auth.uid())));

-- 3) Plano do aluno (bloco atual, organização da semana, programa de força) — antes ficava fixo no código
create table public.athlete_plans (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  block jsonb, week_layout jsonb, strength jsonb,
  updated_at timestamptz not null default now()
);
alter table public.athlete_plans enable row level security;
create policy plans_select on public.athlete_plans for select to authenticated using (public.is_coach() or athlete_id = auth.uid());
create policy plans_coach_write on public.athlete_plans for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- 4) Relatórios mensais
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  period date not null, title text not null, objective text,
  badges jsonb not null default '[]', stats jsonb not null default '[]', auto_stats jsonb,
  summary text, progress jsonb not null default '[]', highlights jsonb not null default '[]', coach_note text,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz, seen_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.reports(athlete_id, period desc);
alter table public.reports enable row level security;
create policy reports_coach_all on public.reports for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy reports_athlete_select on public.reports for select to authenticated using (athlete_id = auth.uid() and status = 'published');

-- 5) "Lido" sem permitir que o aluno edite o conteúdo
create or replace function public.mark_replies_seen(p_feedback_ids integer[]) returns void
language sql security definer set search_path = public as $$
  update feedback_replies r set seen_at = now()
  where r.feedback_id = any(p_feedback_ids) and r.seen_at is null and r.author_id <> auth.uid()
    and (is_coach() or exists (select 1 from feedbacks f where f.id = r.feedback_id and f.athlete_id = auth.uid()));
$$;
create or replace function public.mark_report_seen(p_report uuid) returns void
language sql security definer set search_path = public as $$
  update reports set seen_at = now() where id = p_report and athlete_id = auth.uid() and status = 'published' and seen_at is null;
$$;
revoke execute on function public.mark_replies_seen(integer[]) from anon, public;
revoke execute on function public.mark_report_seen(uuid) from anon, public;
grant execute on function public.mark_replies_seen(integer[]) to authenticated;
grant execute on function public.mark_report_seen(uuid) to authenticated;

-- 6) Segurança: antes qualquer pessoa (sem login) lia atletas, feedbacks, semanas, treinos e zonas.
drop policy if exists select_athletes on public.athletes;
create policy athletes_select on public.athletes for select to authenticated using (id = auth.uid() or public.is_coach());
drop policy if exists select_feedbacks on public.feedbacks;
create policy feedbacks_select on public.feedbacks for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
drop policy if exists select_weeks on public.weeks;
create policy weeks_select on public.weeks for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
drop policy if exists select_workouts on public.workouts;
create policy workouts_select on public.workouts for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
drop policy if exists select_zones on public.zones;
drop policy if exists "Athletes can view own zones" on public.zones;
create policy zones_select on public.zones for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy gym_logs_coach_select on public.gym_logs for select to authenticated using (public.is_coach());
alter view public.coach_feedbacks set (security_invoker = true);
revoke all on public.coach_feedbacks from anon;
revoke insert, update, delete, truncate, references, trigger on public.coach_feedbacks from authenticated;
revoke execute on function public.advance_week_if_complete() from anon, authenticated, public;

-- 7) Dados que estavam fixos no index.html (REL/BRIEFING) foram copiados para athlete_plans e reports.

-- 8) Feedback de treino de força
alter table public.feedbacks
  add column kind text not null default 'run' check (kind in ('run','strength')),
  add column strength_day text,
  add column completion text check (completion in ('sim','parcial','não')),
  add column load_trend text check (load_trend in ('subiu','manteve','baixou')),
  add column pain_exercises jsonb not null default '[]';

-- 9) Avisos de marcos (4 semanas de planilha / 4 semanas no mesmo treino de força)
create table public.acks (
  user_id uuid not null default auth.uid(), key text not null,
  created_at timestamptz not null default now(), primary key (user_id, key)
);
alter table public.acks enable row level security;
create policy acks_own on public.acks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.athlete_plans add column strength_started_at timestamptz;
-- preenchido com a data do primeiro registro de carga (ou hoje, se não havia registros)
create or replace function public.touch_strength_start() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.strength is not null and new.strength_started_at is null then new.strength_started_at := now(); end if;
  elsif new.strength is distinct from old.strength then
    new.strength_started_at := now();
  end if;
  return new;
end $$;
create trigger trg_strength_start before insert or update on public.athlete_plans for each row execute function public.touch_strength_start();
