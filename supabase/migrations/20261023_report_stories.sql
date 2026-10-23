-- Run Base — relatório mensal em stories (23/10/2026)
-- Escolhas da treinadora para a versão em stories: palavra da capa, frase do mês, próximos passos e slides escondidos.
-- Os números ficam em auto_stats.story (calculados no app ao criar o relatório).
alter table public.reports add column if not exists story_opts jsonb not null default '{}'::jsonb;
