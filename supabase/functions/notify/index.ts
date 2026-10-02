// Run Base — notificações no celular (web push).
// O app chama esta função depois de uma ação (resposta, feedback, relatório, evento).
// A função confere quem chamou, descobre quem deve receber e envia.
// Uma vez por dia, um agendamento no banco chama { type: "cron" } para o lembrete do treino do dia.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const COACH_ID = "0eaff6f3-e538-4b79-8b94-922b57b3bb42";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const first = (n?: string | null) => (n ?? "").split(" ")[0];
const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

type Msg = { title: string; body: string; tab?: string; tag?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sec = Object.fromEntries(((await db.from("app_secrets").select("key,value")).data ?? []).map((r) => [r.key, r.value]));
    webpush.setVapidDetails(sec.vapid_subject, sec.vapid_public, sec.vapid_private);
    const body = await req.json().catch(() => ({}));

    async function send(userIds: string[], msg: Msg) {
      if (!userIds.length) return 0;
      const subs = (await db.from("push_subscriptions").select("*").in("user_id", userIds)).data ?? [];
      let sent = 0;
      await Promise.all(subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(msg), { TTL: 60 * 60 * 24 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }));
      return sent;
    }

    // ---- lembrete diário (chamado pelo agendamento do banco) ----
    if (body.type === "cron") {
      if (req.headers.get("x-cron-secret") !== sec.cron_secret) return json({ error: "forbidden" }, 403);
      const now = new Date(Date.now() - 3 * 3600 * 1000); // horário de São Paulo
      const today = DAYS[now.getUTCDay()];
      const dayStart = now.toISOString().slice(0, 10);
      const { data: wos } = await db.from("workouts").select("id,athlete_id,type,day_label,weeks!inner(is_current),athletes!inner(active)")
        .eq("weeks.is_current", true).eq("athletes.active", true);
      const todays = (wos ?? []).filter((w) => (w.day_label ?? "").toUpperCase().trim() === today && !/DESCANSO|OFF/i.test(w.type ?? ""));
      if (!todays.length) return json({ ok: true, sent: 0 });
      const { data: fbs } = await db.from("feedbacks").select("workout_id,athlete_id,created_at")
        .in("workout_id", todays.map((w) => w.id));
      const doneW = new Set((fbs ?? []).map((f) => f.workout_id));
      const { data: todayFbs } = await db.from("feedbacks").select("athlete_id").gte("performed_at", dayStart);
      const doneToday = new Set((todayFbs ?? []).map((f) => f.athlete_id));
      const who = [...new Set(todays.filter((w) => !doneW.has(w.id) && !doneToday.has(w.athlete_id)).map((w) => w.athlete_id))];
      let sent = 0;
      for (const id of who) {
        const w = todays.find((x) => x.athlete_id === id)!;
        sent += await send([id], { title: "Como foi o treino de hoje?", body: `${w.type} — conta pra treinadora em 30 segundos.`, tab: "feedback", tag: "lembrete" });
      }
      return json({ ok: true, sent });
    }

    // ---- avisos diários para a coach (agendamento do banco, 08h07 em São Paulo) ----
    if (body.type === "coach_cron") {
      if (req.headers.get("x-cron-secret") !== sec.cron_secret) return json({ error: "forbidden" }, 403);
      const sp = new Date(Date.now() - 3 * 3600 * 1000);
      const today = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate()));
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const plus = (n: number) => new Date(today.getTime() + n * 864e5);
      const names = (l: string[]) => l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1];
      const out: string[] = [];
      let sent = 0;

      // segunda: resumo da semana pronto
      if (today.getUTCDay() === 1) {
        const dow = (today.getUTCDay() + 6) % 7;
        const { data: d } = await db.from("digests").select("content").eq("week_start", iso(plus(-dow))).maybeSingle();
        if (d) { sent += await send([COACH_ID], { title: "✦ Resumo da semana pronto", body: (d.content as { headline?: string })?.headline ?? "Veja quem precisa de atenção esta semana.", tab: "dashboard", tag: "digest" }); out.push("digest"); }
      }

      const { data: aths } = await db.from("athletes").select("id,name,race,goal").eq("active", true);
      const all = aths ?? [];
      const fullName = (id: string) => all.find((a) => a.id === id)?.name ?? "";
      const short = (id: string) => {
        const n = fullName(id), f = first(n);
        return all.filter((a) => first(a.name) === f).length > 1 ? `${f} ${(n.split(" ")[1] ?? "").slice(0, 1)}.` : f;
      };

      // aluno que completou 7 dias sem registrar (avisa uma vez por sumiço)
      const { data: lastFbs } = await db.from("feedbacks").select("athlete_id,performed_at").gte("performed_at", iso(plus(-60))).order("performed_at", { ascending: false });
      const last: Record<string, string> = {};
      for (const f of lastFbs ?? []) if (!last[f.athlete_id] && f.performed_at) last[f.athlete_id] = f.performed_at;
      const gone = Object.keys(last).filter((id) => last[id] === iso(plus(-7)) && all.some((a) => a.id === id));
      if (gone.length) {
        const l = gone.map(short);
        sent += await send([COACH_ID], { title: `${gone.length === 1 ? l[0] + " está" : names(l) + " estão"} há 7 dias sem registrar`, body: "Vale um recado: use o Cutucar no radar da Home.", tab: "dashboard", tag: "sumido" });
        out.push("sumido");
      }

      // prova em 7 dias
      const raceIn7 = all.filter((a) => {
        const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(`${a.race ?? ""} ${a.goal ?? ""}`);
        if (!m) return false;
        let y = m[3] ? +m[3] : today.getUTCFullYear(); if (y < 100) y += 2000;
        const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
        if (!m[3] && d < today) d.setUTCFullYear(y + 1);
        return iso(d) === iso(plus(7));
      });
      if (raceIn7.length) {
        const l = raceIn7.map((a) => short(a.id));
        sent += await send([COACH_ID], { title: `🏁 Prova em 7 dias: ${names(l)}`, body: "Hora de revisar o polimento e o plano de prova.", tab: "athletes", tag: "prova" });
        out.push("prova");
      }

      // mensalidades: vence hoje e 3 dias de atraso (sem pagamento registrado no mês)
      const { data: bills } = await db.from("billing").select("athlete_id,amount,due_day,active").eq("active", true).not("due_day", "is", null);
      const activeIds = new Set(all.map((a) => a.id));
      const billsA = (bills ?? []).filter((b) => activeIds.has(b.athlete_id));
      if (billsA.length) {
        const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
        const ref = iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
        const { data: pays } = await db.from("payments").select("athlete_id").eq("ref_month", ref);
        const paid = new Set((pays ?? []).map((p) => p.athlete_id));
        const dueDay = (b: { due_day: number }) => Math.min(b.due_day, lastDay);
        const brl = (v: number) => "R$ " + (Math.round(v * 100) / 100).toFixed(2).replace(".", ",").replace(",00", "");
        const dueToday = billsA.filter((b) => !paid.has(b.athlete_id) && dueDay(b) === today.getUTCDate());
        const late3 = billsA.filter((b) => !paid.has(b.athlete_id) && dueDay(b) === today.getUTCDate() - 3);
        if (dueToday.length) {
          const tot = dueToday.reduce((s2, b) => s2 + (+b.amount || 0), 0);
          sent += await send([COACH_ID], { title: `💰 Vence hoje: ${names(dueToday.map((b) => short(b.athlete_id)))}`, body: tot ? `Total ${brl(tot)}. Marque como pago na aba Mensal.` : "Marque como pago na aba Mensal.", tab: "financeiro", tag: "mensal" });
          out.push("vence");
        }
        if (late3.length) {
          sent += await send([COACH_ID], { title: `Mensalidade atrasada: ${names(late3.map((b) => short(b.athlete_id)))}`, body: "3 dias após o vencimento, sem pagamento registrado.", tab: "financeiro", tag: "atraso" });
          out.push("atraso");
        }
      }

      // segunda: lembrete do check-in para os alunos que ainda não responderam
      if (today.getUTCDay() === 1) {
        const { data: cks } = await db.from("checkins").select("athlete_id").eq("week_start", iso(today));
        const done = new Set((cks ?? []).map((c) => c.athlete_id));
        const who = all.map((a) => a.id).filter((id) => !done.has(id));
        let n = 0;
        for (const id of who) n += await send([id], { title: "☀ Check-in da semana", body: "3 toques: sono, estresse e dores. Ajuda a treinadora a ajustar seus treinos.", tab: "home", tag: "checkin" });
        out.push("checkin:" + n);
      }

      // dia 1º: relatórios do mês anterior
      if (today.getUTCDate() === 1) {
        const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
        const prev = meses[(today.getUTCMonth() + 11) % 12];
        sent += await send([COACH_ID], { title: "📊 Hora dos relatórios", body: `Fechou ${prev}: dá pra gerar os relatórios com a IA e publicar pros alunos.`, tab: "athletes", tag: "relatorios" });
        out.push("relatorios");
      }
      return json({ ok: true, sent, out });
    }

    // ---- ações do app: precisa estar logado ----
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const me = (await anon.auth.getUser()).data.user;
    if (!me) return json({ error: "unauthorized" }, 401);
    const isCoach = me.id === COACH_ID;

    if (body.type === "test") {
      return json({ sent: await send([me.id], { title: "Run Base", body: "Notificações ativadas ✓", tag: "teste" }) });
    }

    if (body.type === "reply") {
      const { data: r } = await db.from("feedback_replies").select("author_id,body,feedbacks(athlete_id,athletes(name))").eq("id", body.reply_id).single();
      if (!r || r.author_id !== me.id) return json({ error: "forbidden" }, 403);
      const fb = r.feedbacks as unknown as { athlete_id: string; athletes: { name: string } };
      const preview = r.body.length > 110 ? r.body.slice(0, 110) + "…" : r.body;
      const to = isCoach ? fb.athlete_id : COACH_ID;
      const title = isCoach ? "Mensagem da treinadora" : `${first(fb.athletes?.name)} respondeu`;
      return json({ sent: await send([to], { title, body: preview, tab: isCoach ? "feedback" : "feedbacks", tag: "reply" }) });
    }

    if (body.type === "feedback") {
      const { data: f } = await db.from("feedbacks").select("athlete_id,rpe,dor,kind,strength_day,pain_exercises,comment,athletes(name),workouts(type)").eq("id", body.feedback_id).single();
      if (!f || f.athlete_id !== me.id) return json({ error: "forbidden" }, 403);
      const name = first((f.athletes as unknown as { name: string })?.name);
      const what = f.kind === "strength" ? "Força" : ((f.workouts as unknown as { type: string })?.type ?? "Treino");
      const pains = (f.pain_exercises as string[] | null) ?? [];
      const msg: Msg = f.dor
        ? { title: `⚠ ${name} relatou dor`, body: `${what}${pains.length ? " — " + pains.join(", ") : ""}${f.comment ? ": “" + f.comment + "”" : ""}`, tab: "feedbacks", tag: "dor" }
        : { title: `${name} deu feedback`, body: `${what} · RPE ${f.rpe}${f.comment ? " — “" + f.comment + "”" : ""}`, tab: "feedbacks", tag: "feedback" };
      return json({ sent: await send([COACH_ID], msg) });
    }

    if (body.type === "report") {
      if (!isCoach) return json({ error: "forbidden" }, 403);
      const { data: r } = await db.from("reports").select("athlete_id,title,status").eq("id", body.report_id).single();
      if (!r || r.status !== "published") return json({ error: "not_published" }, 400);
      return json({ sent: await send([r.athlete_id], { title: "Seu relatório chegou 📊", body: `${r.title} já está no app.`, tab: "relatorio", tag: "report" }) });
    }

    if (body.type === "event") {
      if (!isCoach) return json({ error: "forbidden" }, 403);
      const { data: e } = await db.from("events").select("title,starts_at,location").eq("id", body.event_id).single();
      if (!e) return json({ error: "not_found" }, 404);
      const d = new Date(new Date(e.starts_at).getTime() - 3 * 3600 * 1000);
      const when = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}h${String(d.getUTCMinutes()).padStart(2, "0")}`;
      const { data: aths } = await db.from("athletes").select("id").eq("active", true);
      return json({ sent: await send((aths ?? []).map((a) => a.id), { title: `Novo evento: ${e.title}`, body: `${when}${e.location ? " · " + e.location : ""} — confirme sua presença.`, tab: "eventos", tag: "event" }) });
    }

    if (body.type === "nudge") {
      if (!isCoach) return json({ error: "forbidden" }, 403);
      const { data: na } = await db.from("athletes").select("active").eq("id", String(body.athlete_id)).maybeSingle();
      if (na && na.active === false) return json({ sent: 0, inactive: true });
      const text = String(body.text ?? "").trim().slice(0, 180) || "Como estão os treinos? Registra no app pra eu acompanhar.";
      const tab = ["home", "feedback", "forca", "planilha"].includes(body.tab) ? body.tab : "home";
      return json({ sent: await send([String(body.athlete_id)], { title: "Recado da treinadora 👋", body: text, tab, tag: "nudge" }) });
    }

    return json({ error: "bad_request" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
