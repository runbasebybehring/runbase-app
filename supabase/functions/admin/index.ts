// Run Base — ações de administração que só o coach pode fazer:
// criar aluno (login + cadastro), ver o e-mail de acesso e redefinir a senha de um aluno.
import { createClient } from "npm:@supabase/supabase-js@2";

const COACH_ID = "0eaff6f3-e538-4b79-8b94-922b57b3bb42";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const initials = (n: string) => n.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const me = (await anon.auth.getUser()).data.user;
    if (!me || me.id !== COACH_ID) return json({ error: "forbidden" }, 403);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json().catch(() => ({}));

    if (b.action === "create") {
      const name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
      if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "dados_invalidos" }, 400);
      if (password.length < 6) return json({ error: "senha_curta" }, 400);
      const cr = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (cr.error) return json({ error: /already|registered|exists/i.test(cr.error.message) ? "email_em_uso" : cr.error.message }, 400);
      const id = cr.data.user.id;
      const row = {
        id, name, img: String(b.img ?? "").trim().toUpperCase().slice(0, 3) || initials(name),
        goal: String(b.goal ?? "").trim() || "A definir", race: String(b.race ?? "").trim() || "Sem prova no momento",
        pace: String(b.pace ?? "").trim() || "A definir", vol: String(b.vol ?? "").trim() || "A definir",
        obs: String(b.obs ?? "").trim() || null, needs_anamnesis: true,
      };
      const ins = await db.from("athletes").insert(row).select().single();
      if (ins.error) { await db.auth.admin.deleteUser(id); return json({ error: ins.error.message }, 400); }
      return json({ athlete: ins.data });
    }

    if (b.action === "email") {
      const u = await db.auth.admin.getUserById(String(b.athlete_id ?? ""));
      if (u.error || !u.data.user) return json({ error: "not_found" }, 404);
      return json({ email: u.data.user.email });
    }

    if (b.action === "reset_password") {
      const password = String(b.password ?? "");
      if (password.length < 6) return json({ error: "senha_curta" }, 400);
      if (b.athlete_id === COACH_ID) return json({ error: "forbidden" }, 403);
      const up = await db.auth.admin.updateUserById(String(b.athlete_id ?? ""), { password });
      if (up.error) return json({ error: up.error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "bad_request" }, 400);
  } catch (e) {
    console.error("admin falhou", String(e));
    return json({ error: String(e) }, 500);
  }
});
