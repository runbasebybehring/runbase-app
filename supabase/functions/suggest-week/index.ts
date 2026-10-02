// Run Base — a IA sugere a próxima semana da planilha de um aluno (rascunho para a coach revisar).
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
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const me = (await anon.auth.getUser()).data.user;
    if (!me || me.id !== COACH_ID) return json({ error: "forbidden" }, 403);
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "not_configured" });
    const { athlete_id, hint } = await req.json();
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [ath, plan, zones, weeks, tests, ck, ana] = await Promise.all([
      db.from("athletes").select("name,goal,race,pace,vol,obs,plan_start").eq("id", athlete_id).single(),
      db.from("athlete_plans").select("block,week_layout,race_plan").eq("athlete_id", athlete_id).maybeSingle(),
      db.from("zones").select("zone,pace,description").eq("athlete_id", athlete_id).order("sort_order"),
      db.from("weeks").select("id,label,volume,week_number,is_current,workouts(id,day_label,type,description,sort_order)").eq("athlete_id", athlete_id).order("week_number", { ascending: false }).limit(5),
      db.from("tests").select("test_date,distance_km,duration_sec").eq("athlete_id", athlete_id).order("test_date", { ascending: false }).limit(2),
      db.from("checkins").select("week_start,sono,estresse,dor,dor_onde,note").eq("athlete_id", athlete_id).order("week_start", { ascending: false }).limit(2),
      db.from("anamnesis").select("data").eq("athlete_id", athlete_id).maybeSingle(),
    ]);
    if (!ath.data) return json({ error: "athlete_not_found" }, 404);
    const ws = (weeks.data ?? []).reverse();
    const ids = ws.flatMap((w) => (w.workouts ?? []).map((x) => x.id));
    const fbs = ids.length ? (await db.from("feedbacks").select("workout_id,rpe,dor,comment,distance_km,duration_sec,energia,fadiga").in("workout_id", ids)).data ?? [] : [];
    const fbBy: Record<number, unknown> = {}; for (const f of fbs) fbBy[f.workout_id] = f;
    const a = ana.data?.data as Record<string, unknown> | undefined;
    const data = {
      hoje: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10),
      aluno: ath.data, bloco: plan.data?.block ?? null, semana_tipo: plan.data?.week_layout ?? null, plano_de_prova: plan.data?.race_plan ?? null,
      zonas: zones.data ?? [], testes: tests.data ?? [], checkins: ck.data ?? [],
      ficha: a ? { dias: a.dias, horario: a.horario, lesoes_atuais: a.lesoes_atuais, lesoes_antes: a.lesoes_antes, objetivo: a.objetivo } : null,
      ultimas_semanas: ws.map((w) => ({
        semana: w.week_number, nome: w.label, volume: w.volume, atual: w.is_current,
        treinos: (w.workouts ?? []).sort((x, y) => x.sort_order - y.sort_order).map((x) => ({ dia: x.day_label, tipo: x.type, descricao: x.description, feedback: fbBy[x.id] ?? null })),
      })),
      pedido_da_coach: hint || null,
    };
    const next = (ws[ws.length - 1]?.week_number ?? 0) + 1;

    const system = `Você é assistente da Vic Behring, head coach da RUNBASE (corrida + força, São Paulo). Monte um RASCUNHO da próxima semana da planilha de corrida de um aluno, para a coach revisar.
Regras:
- Mantenha o estilo e a estrutura das últimas semanas (mesmos dias, tipos e jeito de escrever). Copie os dias de força/academia como estão.
- Escreva as descrições citando zonas (Z1, Z2, Z3, Z4, Z5) do jeito que a coach usa, ex.: "8km Z2", "aquece 2km Z1 + 6x800m Z4 com 2min trote + desaquece 1km Z1". O app mostra o pace de cada zona ao aluno.
- Progressão: aumente o volume no máximo ~10% em relação à semana anterior. A cada 3–4 semanas de aumento, faça uma semana regenerativa (−20 a −30%).
- Ajuste pelo feedback: RPE alto seguido, dor, sono ruim ou estresse alto no check-in = segurar ou reduzir. Dor relatada: reduza impacto e sinalize na justificativa, sem diagnosticar.
- Prova chegando: nas 1–2 semanas antes, polimento (menos volume, mantém um pouco de intensidade). Semana da prova: bem leve + prova.
- Respeite os dias disponíveis da ficha, se houver.
- Português do Brasil, conciso.`;
    const tool = {
      name: "semana",
      description: "Rascunho da próxima semana.",
      input_schema: {
        type: "object",
        properties: {
          label: { type: "string", description: `nome da semana, ex.: "Semana ${next} — Construção" ou "Semana ${next} — Regenerativa"` },
          volume: { type: "string", description: "volume total de corrida, ex.: \"34km\"" },
          justificativa: { type: "string", description: "2–3 frases explicando as escolhas para a coach" },
          treinos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day_label: { type: "string", enum: DAYS },
                type: { type: "string", description: "tipo em maiúsculas, ex.: RODAGEM, LONGÃO, INTERVALADO, TEMPO RUN, REGENERATIVO, FORÇA, PROVA" },
                description: { type: "string" },
              },
              required: ["day_label", "type", "description"],
            },
          },
        },
        required: ["label", "volume", "justificativa", "treinos"],
      },
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, tools: [tool], tool_choice: { type: "auto" },
        messages: [{ role: "user", content: `Monte a semana ${next}. Dados (JSON):\n${JSON.stringify(data)}\n\nResponda chamando a ferramenta "semana" (obrigatório).` }] }),
    });
    if (!r.ok) { const d = (await r.text()).slice(0, 500); console.error("anthropic error", r.status, d); return json({ error: "ai_failed" }, 502); }
    const out = await r.json();
    let s = (out.content ?? []).find((c: { type?: string }) => c.type === "tool_use")?.input;
    if (!s) {
      const text: string = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").replace(/```(?:json)?/g, "");
      const m = text.match(/\{[\s\S]*\}/);
      try { s = m ? JSON.parse(m[0]) : null; } catch (_) { s = null; }
    }
    if (!s) { console.error("sem semana", JSON.stringify(out).slice(0, 800)); return json({ error: "ai_bad_output" }, 502); }
    s.treinos = (s.treinos ?? []).filter((t: { day_label: string }) => DAYS.includes(t.day_label))
      .sort((x: { day_label: string }, y: { day_label: string }) => DAYS.indexOf(x.day_label) - DAYS.indexOf(y.day_label));
    s.week_number = next;
    return json(s);
  } catch (e) {
    console.error("suggest-week falhou", String(e));
    return json({ error: String(e) }, 500);
  }
});
