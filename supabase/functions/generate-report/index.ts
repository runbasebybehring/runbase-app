// Run Base — gera o texto do relatório mensal com IA (Claude).
// Só o coach pode chamar. Precisa do segredo ANTHROPIC_API_KEY nas configurações das Edge Functions do Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const COACH_ID = "0eaff6f3-e538-4b79-8b94-922b57b3bb42";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user || u.user.id !== COACH_ID) return json({ error: "forbidden" }, 403);
    if (!apiKey) return json({ error: "not_configured" });

    const { athlete_id, period } = await req.json();
    if (!athlete_id || !/^\d{4}-\d{2}-01$/.test(period ?? "")) return json({ error: "bad_request" }, 400);
    const start = new Date(period + "T00:00:00Z");
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const endStr = end.toISOString().slice(0, 10);

    const db = createClient(url, service);
    const [ath, plan, fbs, gym, prev] = await Promise.all([
      db.from("athletes").select("name,goal,race,pace,vol,obs").eq("id", athlete_id).single(),
      db.from("athlete_plans").select("block").eq("athlete_id", athlete_id).maybeSingle(),
      db.from("feedbacks").select("kind,strength_day,completion,load_trend,pain_exercises,rpe,energia,fadiga,sono,hidratacao,gel,frequencia_cardiaca,dor,comment,performed_at,workouts(day_label,type,description)")
        .eq("athlete_id", athlete_id).gte("performed_at", period).lt("performed_at", endStr).order("performed_at"),
      db.from("gym_logs").select("exercise_name,carga,created_at").eq("athlete_id", athlete_id).gte("created_at", period).lt("created_at", endStr).order("created_at"),
      db.from("reports").select("title,summary,coach_note").eq("athlete_id", athlete_id).eq("status", "published").lt("period", period).order("period", { ascending: false }).limit(1),
    ]);
    if (!ath.data) return json({ error: "athlete_not_found" }, 404);

    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const mes = `${meses[start.getUTCMonth()]} de ${start.getUTCFullYear()}`;
    const data = {
      aluno: ath.data,
      bloco_atual: plan.data?.block ?? null,
      feedbacks_do_mes: fbs.data ?? [],
      registros_de_forca_do_mes: gym.data ?? [],
      relatorio_anterior: prev.data?.[0] ?? null,
    };

    const system = `Você é o Vic Behring, head coach da Run Base (corrida + força, São Paulo). Escreve o relatório mensal de um aluno.
Tom: direto, humano, específico, sem frases genéricas de motivação, sem exageros. Português do Brasil. Frases curtas.
Use só o que está nos dados. Se houver pouca informação, diga isso com naturalidade e foque no próximo passo. Nunca invente paces, distâncias ou resultados.
Dor relatada deve aparecer como ponto de atenção, sem diagnóstico. Feedbacks com kind "strength" são treinos de força (completion = se completou, load_trend = carga, pain_exercises = exercícios com desconforto); comente corrida e força.
Use **negrito** em no máximo 2 trechos por texto.`;
    const user = `Mês do relatório: ${mes}.
Dados (JSON):
${JSON.stringify(data)}

Responda APENAS com um JSON válido neste formato:
{"summary":"2 parágrafos curtos separados por \\n\\n sobre como foi o mês","highlights":[{"cls":"highlight|alert|note|next","t":"título curto começando com ★, ⚠, ↗ ou →","x":"1-2 frases"}],"coach_note":"mensagem pessoal de 2-3 frases, chamando o aluno pelo primeiro nome","badges":["2 a 3 selos curtos"]}
Use 3 ou 4 destaques, e o último deve ser do tipo "next" (próximo passo).`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) return json({ error: "ai_failed", detail: (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const text: string = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "ai_bad_output" }, 502);
    return json(JSON.parse(m[0]));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
