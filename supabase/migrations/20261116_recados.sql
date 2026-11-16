-- recados da treinadora: cartão na Home do aluno até ele fechar (ou até fazer a ação pedida). Ver js/recados.js
create table if not exists public.recados (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  title text not null,
  body text not null,
  action text check (action in ('ciclo')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);
create index if not exists recados_athlete on public.recados (athlete_id) where dismissed_at is null;
alter table public.recados enable row level security;
create policy recados_read on public.recados for select to authenticated using (athlete_id = (select auth.uid()) or public.is_coach());
create policy recados_coach_ins on public.recados for insert to authenticated with check (public.is_coach());
create policy recados_coach_del on public.recados for delete to authenticated using (public.is_coach());
create policy recados_upd on public.recados for update to authenticated using (athlete_id = (select auth.uid()) or public.is_coach());
