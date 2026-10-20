-- Run Base — destaques em formato de stories (20/10/2026)
-- Cada atleta tem os seus destaques. O conteúdo é editado só pela treinadora.
-- "Visto" fica na tabela acks (chave story:<id>:<versão>), então vale em todos os aparelhos do aluno.

create table if not exists public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  slug text not null,
  title text not null,
  cover text,
  position int not null default 0,
  slides jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, slug)
);
create index if not exists story_highlights_athlete_idx on public.story_highlights (athlete_id, position);

alter table public.story_highlights enable row level security;
create policy story_highlights_coach_all on public.story_highlights for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy story_highlights_athlete_select on public.story_highlights for select to authenticated
  using (athlete_id = (select auth.uid()) and published);

-- atualiza updated_at a cada edição (isso faz o aro voltar a ficar colorido para o aluno)
create or replace function public.touch_story_highlight() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_story_highlight on public.story_highlights;
create trigger trg_touch_story_highlight before update on public.story_highlights
  for each row execute function public.touch_story_highlight();
