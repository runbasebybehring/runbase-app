-- aba Ciclo (só para quem ativa): configuração + registros diários. A treinadora lê; só a aluna escreve. Ver js/ciclo.js
create table if not exists public.period_settings (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  enabled boolean not null default true,
  hormonal text not null default 'nao' check (hormonal in ('nao','pilula','diu_h','implante','outro')),
  cycle_len int not null default 28 check (cycle_len between 18 and 60),
  period_len int not null default 5 check (period_len between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.period_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  day date not null,
  flow text check (flow in ('leve','medio','forte')),
  symptoms text[] not null default '{}',
  energia int check (energia between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (athlete_id, day)
);
create index if not exists period_logs_athlete_day on public.period_logs (athlete_id, day desc);
alter table public.period_settings enable row level security;
alter table public.period_logs enable row level security;
create policy period_settings_read on public.period_settings for select to authenticated using (athlete_id = (select auth.uid()) or public.is_coach());
create policy period_settings_ins on public.period_settings for insert to authenticated with check (athlete_id = (select auth.uid()));
create policy period_settings_upd on public.period_settings for update to authenticated using (athlete_id = (select auth.uid()));
create policy period_logs_read on public.period_logs for select to authenticated using (athlete_id = (select auth.uid()) or public.is_coach());
create policy period_logs_ins on public.period_logs for insert to authenticated with check (athlete_id = (select auth.uid()));
create policy period_logs_upd on public.period_logs for update to authenticated using (athlete_id = (select auth.uid()));
create policy period_logs_del on public.period_logs for delete to authenticated using (athlete_id = (select auth.uid()));
