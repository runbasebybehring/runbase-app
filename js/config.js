// Run Base — configuração
// A chave abaixo é a chave pública (anon) do Supabase. Ela é feita para ficar no app:
// o que protege os dados são as regras de acesso (RLS) no banco.
window.RB = window.RB || {};
RB.cfg = {
  url: 'https://qjoftlswytvdnznbuvbz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb2Z0bHN3eXR2ZG56bmJ1dmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzE1NTYsImV4cCI6MjA5MDI0NzU1Nn0.zk493jyhjFp_WPoEamakCmifUMhItjA_LAb6Bio6PHM',
  coachId: '0eaff6f3-e538-4b79-8b94-922b57b3bb42',
  coachName: 'Vic',
  gymSwapWeeks: 4
};
RB.sb = supabase.createClient(RB.cfg.url, RB.cfg.anonKey);
