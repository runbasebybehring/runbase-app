// Run Base — agenda do aluno (assinatura de calendário .ics). O link leva um código secreto por aluno (athletes.cal_token).
// O iPhone/Google Agenda buscam este endereço de tempos em tempos, então mudanças na planilha aparecem sozinhas.
import { createClient } from "npm:@supabase/supabase-js@2";

const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const monday = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); return x; };
// linhas de no máximo 75 caracteres (regra do formato .ics)
const fold = (l: string) => { const out: string[] = []; let s = l; while (s.length > 73) { out.push(s.slice(0, 73)); s = " " + s.slice(73); } out.push(s); return out.join("\r\n"); };

Deno.serve(async (req) => {
  try {
    const t = new URL(req.url).searchParams.get("t") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(t)) return new Response("not found", { status: 404 });
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: a } = await db.from("athletes").select("id,name,plan_start").eq("cal_token", t).maybeSingle();
    if (!a) return new Response("not found", { status: 404 });
    const [{ data: weeks }, { data: zones }] = await Promise.all([
      db.from("weeks").select("id,week_number,is_current,label,workouts(id,day_label,type,description)").eq("athlete_id", a.id).order("week_number"),
      db.from("zones").select("zone,pace").eq("athlete_id", a.id).order("sort_order"),
    ]);
    const ws = weeks ?? [];
    const cur = ws.find((w) => w.is_current) ?? ws[ws.length - 1];
    const nowMon = monday(new Date(Date.now() - 3 * 3600e3));
    const startOf = (n: number) => {
      if (a.plan_start) { const s = monday(new Date(a.plan_start + "T12:00:00Z")); s.setUTCDate(s.getUTCDate() + (n - 1) * 7); return s; }
      const s = new Date(nowMon); s.setUTCDate(s.getUTCDate() + (n - (cur?.week_number ?? n)) * 7); return s;
    };
    const zoneText = (desc: string) => {
      const seen = new Set<string>(); const out: string[] = [];
      for (const m of (desc ?? "").match(/Z[1-5]/gi) ?? []) {
        const z = (zones ?? []).find((x) => new RegExp("^\\s*Z" + m.slice(1) + "\\b", "i").test(x.zone));
        if (z && !seen.has(z.zone)) { seen.add(z.zone); out.push(z.zone.split("·")[0].trim() + " " + z.pace); }
      }
      return out.join(" · ");
    };
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RUNBASE//Treinos//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:RUNBASE · Treinos", "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
    const lo = (cur?.week_number ?? 1) - 2, hi = (cur?.week_number ?? 1) + 4;
    for (const w of ws) {
      if (w.week_number < lo || w.week_number > hi) continue;
      const base = startOf(w.week_number);
      for (const wo of w.workouts ?? []) {
        const i = DAYS.indexOf(String(wo.day_label ?? "").toUpperCase().trim().slice(0, 3).replace("SAB", "SÁB"));
        if (i < 0 || /DESCANSO|OFF/i.test(wo.type ?? "")) continue;
        const d = new Date(base); d.setUTCDate(d.getUTCDate() + i);
        const e = new Date(d); e.setUTCDate(e.getUTCDate() + 1);
        const zt = zoneText(wo.description ?? "");
        lines.push("BEGIN:VEVENT", `UID:rb-${wo.id}@runbase`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(e)}`,
          fold("SUMMARY:" + esc("RUNBASE · " + (wo.type ?? "Treino"))),
          fold("DESCRIPTION:" + esc((wo.description ?? "") + (zt ? "\n" + zt : "") + "\n" + w.label)),
          "TRANSP:TRANSPARENT", "END:VEVENT");
      }
    }
    lines.push("END:VCALENDAR");
    return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache", "Content-Disposition": "inline; filename=runbase.ics" } });
  } catch (e) {
    console.error("calendar falhou", String(e));
    return new Response("error", { status: 500 });
  }
});
