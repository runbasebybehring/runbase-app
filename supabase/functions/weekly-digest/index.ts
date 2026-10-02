// Run Base — resumo semanal para o coach, escrito pela IA.
// Roda toda segunda de manhã (agendamento do banco, com x-cron-secret) ou quando o coach toca em "Gerar agora".
import { createClient } from "npm:@supabase/supabase-js@2";

const COACH_ID = "0eaff6f3-e538-4b79-8b94-922b57b3bb42";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// data da prova a partir de "Amsterdam 21K — 18/10/2026" ou "21K · 18/10"
function raceDate(txt: string, today: Date): Date | null {
  const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(txt);
  if (!m) return null;
  let y = m[3] ? +m[3] : today.getUTCFullYear();
  if (y < 100) y += 2000;
  const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
  if (!m[3] && d < today) d.setUTCFullYear(y + 1);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    // quem pode chamar: o agendamento (segredo) ou o coach logado
    const sec = (await db.from("app_secrets").select("value").eq("key", "cron_secret").maybeSingle()).data?.value;
    const cron = !!sec && req.headers.get("x-cron-secret") === sec;
    if (!cron) {
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const me = (await anon.auth.getUser()).data.user;
      if (!me || me.id !== COACH_ID) return json({ error: "forbidden" }, 403);
    }
    if (!apiKey) return json({ error: "not_configured" });

    // semana: segunda a domingo, horário de São Paulo
    const sp = new Date(Date.now() - 3 * 3600 * 1000);
    const today = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate()));
    const dow = (today.getUTCDay() + 6) % 7;
    const weekStart = new Date(today.getTime() - dow * 864e5); // segunda desta semana
    const from = new Date(today.getTime() - 7 * 864e5).toISOString().slice(0, 10);
    const from14 = new Date(today.getTime() - 14 * 864e5).toISOString().slice(0, 10);

    const [aths, fbs, gym, lastAll, cks] = await Promise.all([
      db.from("athletes").select("id,name,goal,race,pace,vol").eq("active", true),
      db.from("feedbacks").select("athlete_id,kind,strength_day,rpe,dor,pain_exercises,comment,distance_km,duration_sec,completion,performed_at,workouts(type)").gte("performed_at", from14),
      db.from("gym_logs").select("athlete_id,exercise_name,carga,created_at").gte("created_at", from),
      db.from("feedbacks").select("athlete_id,performed_at").order("performed_at", { ascending: false }).limit(2000),
      db.from("checkins").select("athlete_id,week_start,sono,estresse,dor,dor_onde,note").gte("week_start", from14).order("week_start", { ascending: false }),
    ]);
    const last: Record<string, string> = {};
    for (const f of lastAll.data ?? []) if (!last[f.athlete_id] && f.performed_at) last[f.athlete_id] = f.performed_at;

    const alunos = (aths.data ?? []).map((a) => {
      const mine = (fbs.data ?? []).filter((f) => f.athlete_id === a.id);
      const week = mine.filter((f) => f.performed_at >= from);
      const prev = mine.filter((f) => f.performed_at < from);
      const rd = raceDate(`${a.race} ${a.goal}`, today);
      const days = rd ? Math.round((rd.getTime() - today.getTime()) / 864e5) : null;
      return {
        nome: a.name, objetivo: a.goal, prova: a.race,
        dias_para_prova: days != null && days >= 0 && days <= 60 ? days : null,
        dias_sem_registro: last[a.id] ? Math.round((today.getTime() - new Date(last[a.id] + "T00:00:00Z").getTime()) / 864e5) : null,
        treinos_semana: week.length, treinos_semana_anterior: prev.length,
        km_semana: Math.round(week.reduce((s, f) => s + (+f.distance_km || 0), 0) * 10) / 10,
        feedbacks_semana: week.map((f) => ({
          data: f.performed_at, tipo: f.kind === "strength" ? "força" : ((f.workouts as unknown as { type: string })?.type ?? "corrida"),
          rpe: f.rpe, dor: f.dor, exercicios_com_dor: f.pain_exercises, completou: f.completion, km: f.distance_km, comentario: f.comment,
        })),
        registros_de_carga_semana: (gym.data ?? []).filter((g) => g.athlete_id === a.id).length,
        checkin_mais_recente: (cks.data ?? []).find((c) => c.athlete_id === a.id) ?? null,
      };
    });

    const system = `Você escreve o resumo semanal da Vic Behring, head coach da RUNBASE (corrida + força, São Paulo), sobre os alunos dela.
Seja direto e útil para a coach agir: quem precisa de atenção (dor, sumiço, esforço alto seguido, queda de treinos), quem evoluiu, quem tem prova chegando.
Português do Brasil, frases curtas, sem enrolação, sem diagnóstico médico. Use só o que está nos dados; não invente números.
Check-in: sono e estresse vão de 1 a 5 (sono 1 = péssimo, estresse 5 = muito alto); dor no check-in é ponto de atenção.
Use o primeiro nome do aluno. Se houver dois alunos com o mesmo primeiro nome, use também a inicial do sobrenome.`;
    const tool = {
      name: "resumo",
      description: "Resumo semanal para a coach.",
      input_schema: {
        type: "object",
        properties: {
          headline: { type: "string", description: "1 frase sobre a semana do grupo" },
          atencao: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, texto: { type: "string" } }, required: ["nome", "texto"] }, description: "alunos que pedem atenção, mais urgentes primeiro (máx. 6)" },
          evolucao: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, texto: { type: "string" } }, required: ["nome", "texto"] }, description: "alunos que evoluíram ou mandaram bem (máx. 4)" },
          provas: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, texto: { type: "string" } }, required: ["nome", "texto"] }, description: "provas nos próximos 30 dias, com o que ajustar" },
          acoes: { type: "array", items: { type: "string" }, description: "2 a 4 ações práticas para a coach nesta semana" },
        },
        required: ["headline", "atencao", "evolucao", "provas", "acoes"],
      },
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 8000, system, tools: [tool], tool_choice: { type: "auto" },
        messages: [{ role: "user", content: `Hoje: ${today.toISOString().slice(0, 10)}. Semana analisada: últimos 7 dias (com a semana anterior para comparar).\nDados (JSON):\n${JSON.stringify(alunos)}\n\nResponda chamando a ferramenta "resumo" (obrigatório).` }],
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 500);
      console.error("anthropic error", r.status, detail);
      return json({ error: "ai_failed", status: r.status }, 502);
    }
    const out = await r.json();
    let content = (out.content ?? []).find((c: { type?: string }) => c.type === "tool_use")?.input;
    if (!content) {
      const text: string = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").replace(/```(?:json)?/g, "");
      const m = text.match(/\{[\s\S]*\}/);
      try { content = m ? JSON.parse(m[0]) : null; } catch (_) { content = null; }
    }
    if (!content) { console.error("sem resumo", JSON.stringify(out).slice(0, 800)); return json({ error: "ai_bad_output" }, 502); }
    content.generated_at = new Date().toISOString();
    const week_start = weekStart.toISOString().slice(0, 10);
    const up = await db.from("digests").upsert({ week_start, content, created_at: new Date().toISOString() }).select().single();
    if (up.error) return json({ error: up.error.message }, 500);
    return json(up.data);
  } catch (e) {
    console.error("weekly-digest falhou", String(e));
    return json({ error: String(e) }, 500);
  }
});
