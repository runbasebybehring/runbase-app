// Run Base — ferramentas do coach: radar da semana (com "cutucar"), resumo semanal com IA,
// cadastro de aluno e acesso (e-mail / redefinir senha)
(function () {
  var sb = RB.sb;
  var R = RB.radar = {};
  var esc = function (s) { return RB.esc(s); };
  var DAY = 864e5;
  var first = function (n) { return String(n || '').split(' ')[0]; };
  RB.appUrl = function () { return location.origin + location.pathname.replace(/beta\/.*$/, '').replace(/index\.html$/, ''); };
  var fdate = function (f) { return new Date((f.performed_at || f.created_at.slice(0, 10)) + 'T12:00:00'); };

  // ---------- RADAR ----------
  // quem precisa de atenção: dor recente, esforço alto seguido ou muitos dias sem registrar
  R.compute = function (athletes, fbs) {
    var now = Date.now(), out = [];
    athletes.forEach(function (a) {
      var mine = fbs.filter(function (f) { return f.athlete_id === a.id; }).sort(function (x, y) { return fdate(y) - fdate(x); });
      var items = [], score = 0;
      var pain = mine.filter(function (f) { return f.dor && now - fdate(f) < 10 * DAY; });
      if (pain.length) {
        var p = pain[0], ex = (p.pain_exercises || []).join(', ');
        items.push({ t: 'dor', l: '⚠ dor ' + RB.ago(p.created_at) + (ex ? ' · ' + ex : ''), fid: p.id }); score += 100;
      }
      var last3 = mine.filter(function (f) { return f.rpe; }).slice(0, 3);
      var hi = last3.filter(function (f) { return f.rpe >= 8; }).length;
      if (hi >= 2) { items.push({ t: 'rpe', l: 'RPE alto em ' + hi + ' dos últimos ' + last3.length }); score += 50; }
      var lastD = mine.length ? fdate(mine[0]) : null;
      var gap = lastD ? Math.floor((now - lastD) / DAY) : null;
      if (gap == null || gap >= 7) { items.push({ t: 'gap', l: gap == null ? 'sem registro há mais de 60 dias' : gap + ' dias sem registrar' }); score += gap == null ? 20 : Math.min(gap, 40); }
      if (items.length) out.push({ a: a, items: items, score: score, gap: gap });
    });
    return out.sort(function (x, y) { return y.score - x.score; });
  };
  R.card = function (athletes, fbs) {
    var rows = R.compute(athletes, fbs);
    R.rows = rows;
    if (!rows.length) return '<div class="card gl">' + RB.ew('Radar da semana', 'green') + '<div class="p">Ninguém sumido, sem dor e sem esforço alto seguido. 👊</div></div>';
    var show = R.all ? rows : rows.slice(0, 6);
    return '<div class="card radar">' + RB.ew('Radar da semana · ' + rows.length) +
      show.map(function (r, i) {
        var pain = r.items.find(function (x) { return x.t === 'dor'; });
        return '<div class="rd-r">' + RB.av(r.a.img, 32) + '<div class="rd-t"><b onclick="RB.coach.open(\'' + r.a.id + '\')">' + esc(r.a.name) + '</b><div class="rd-tags">' +
          r.items.map(function (x) { return '<span class="rd-tag ' + x.t + '">' + esc(x.l) + '</span>'; }).join('') + '</div></div>' +
          '<div class="rd-a">' + (pain ? '<button class="mini" onclick="RB.threads.open(' + pain.fid + ')">Ver</button>' : '') +
          '<button class="mini ghost" onclick="RB.radar.nudge(' + i + ')">Cutucar</button></div></div>';
      }).join('') +
      (rows.length > 6 && !R.all ? '<button class="btn-link" onclick="RB.radar.all=true;RB.coach.render()">Ver todos (' + rows.length + ')</button>' : '') + '</div>';
  };
  R.nudge = function (i) {
    var r = R.rows[i], n = first(r.a.name);
    var t = r.items[0].t;
    var msg = t === 'dor' ? 'Oi ' + n + ', vi que você sentiu dor no último treino. Me conta como está hoje?'
      : t === 'rpe' ? 'Oi ' + n + ', os últimos treinos vieram bem pesados. Como está o corpo? Se precisar, a gente ajusta.'
      : 'Oi ' + n + ', sentimos sua falta por aqui! Como estão os treinos? Registra no app pra eu acompanhar.';
    R.target = r.a;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Cutucar') + '<div class="sh-t">' + esc(r.a.name) + '</div><div class="sh-s">Chega como notificação no celular do aluno.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Mensagem</div><textarea class="ft" id="nudge-t" rows="4" maxlength="180">' + esc(msg) + '</textarea></div>' +
      '<div class="fld"><div class="fld-l">Ao tocar, abre</div><div class="opts" id="nudge-tab">' + [['feedback', 'Feedback'], ['home', 'Home'], ['planilha', 'Planilha'], ['forca', 'Força']].map(function (o, k) {
        return '<button class="eb' + (k === (t === 'gap' ? 0 : 1) ? ' sel' : '') + '" data-v="' + o[0] + '" onclick="this.parentNode.querySelectorAll(\'.eb\').forEach(function(b){b.classList.remove(\'sel\')});this.classList.add(\'sel\')">' + o[1] + '</button>';
      }).join('') + '</div></div>' +
      '<button class="btn btn-r" id="nudge-go" onclick="RB.radar.sendNudge()">ENVIAR RECADO</button>');
  };
  R.sendNudge = async function () {
    var btn = RB.$('nudge-go'); btn.disabled = true; btn.textContent = 'ENVIANDO...';
    var tab = (document.querySelector('#nudge-tab .sel') || {}).dataset;
    var r = await sb.functions.invoke('notify', { body: { type: 'nudge', athlete_id: R.target.id, text: RB.$('nudge-t').value, tab: tab ? tab.v : 'home' } });
    btn.disabled = false; btn.textContent = 'ENVIAR RECADO';
    if (r.error) { RB.toast('Não deu para enviar', false); return; }
    RB.closeSheet();
    if (r.data && r.data.sent) RB.toast('Recado enviado ✓');
    else RB.toast(first(R.target.name) + ' ainda não ativou as notificações. Mande pelo WhatsApp.', false);
  };

  // ---------- RESUMO SEMANAL (IA) ----------
  R.digest = null;
  R.loadDigest = async function () {
    var r = await sb.from('digests').select('*').order('week_start', { ascending: false }).limit(1).maybeSingle();
    R.digest = r.data || null;
  };
  function dsec(title, list, cls) {
    if (!list || !list.length) return '';
    return '<div class="dg-s ' + cls + '"><div class="dg-h">' + title + '</div>' + list.map(function (x) {
      return typeof x === 'string' ? '<div class="dg-i">→ ' + esc(x) + '</div>' : '<div class="dg-i"><b>' + esc(x.nome) + '</b> ' + esc(x.texto) + '</div>';
    }).join('') + '</div>';
  }
  R.digestCard = function () {
    var d = R.digest;
    if (!d) return '<div class="card dg">' + RB.ew('✦ Resumo da semana', 'blue') + '<div class="p" style="margin-bottom:10px">Toda segunda de manhã a IA lê os treinos da semana e te diz quem precisa de atenção, quem evoluiu e quem tem prova chegando.</div>' +
      '<button class="btn btn-o sm" id="dg-go" onclick="RB.radar.genDigest()">GERAR AGORA</button></div>';
    var c = d.content || {}, open = !!R.dgOpen;
    return '<div class="card dg">' + RB.ew('✦ Resumo da semana · ' + RB.fmtDate(d.week_start + 'T12:00:00'), 'blue') +
      '<div class="dg-head">' + esc(c.headline || '') + '</div>' +
      (open ? dsec('Atenção', c.atencao, 'a') + dsec('Provas chegando', c.provas, 'p') + dsec('Evolução', c.evolucao, 'e') + dsec('Ações da semana', c.acoes, 'n') +
        '<div class="dg-f"><span class="muted-s">Gerado ' + RB.ago(c.generated_at || d.created_at) + '</span><button class="btn-link" id="dg-go" onclick="RB.radar.genDigest()">Gerar de novo</button></div>'
        : '<button class="btn-link" onclick="RB.radar.dgOpen=true;RB.coach.render()">Ler o resumo completo ›</button>') + '</div>';
  };
  R.genDigest = async function () {
    var b = RB.$('dg-go'); if (b) { b.disabled = true; b.textContent = 'A IA está lendo a semana... (até 1 min)'; }
    var r = await sb.functions.invoke('weekly-digest', { body: {} });
    if (r.error || (r.data && r.data.error)) {
      if (b) { b.disabled = false; b.textContent = 'GERAR AGORA'; }
      RB.toast(r.data && r.data.error === 'not_configured' ? 'IA ainda não configurada' : 'Não deu para gerar agora', false); return;
    }
    R.digest = r.data; R.dgOpen = true; RB.coach.render();
  };

  // ---------- NOVO ALUNO ----------
  function pw() { var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  R.newAthlete = function () {
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Novo aluno') + '<div class="sh-t">Cadastrar aluno</div><div class="sh-s">Cria o login e o cadastro. Depois é só montar a planilha e o treino de força.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Nome completo</div><input class="fi" id="na-name" placeholder="Claudio Giraldi"></div>' +
      '<div class="fld"><div class="fld-l">E-mail de acesso</div><input class="fi" id="na-email" type="email" inputmode="email" placeholder="nome@runbase.com" autocapitalize="off"></div>' +
      '<div class="fld"><div class="fld-l">Senha <span class="hint">mínimo 6 caracteres</span></div><div class="z-row"><input class="fi" id="na-pw" value="' + pw() + '" autocapitalize="off"><button class="mini" onclick="RB.$(\'na-pw\').value=RB.radar.pw()">Gerar</button></div></div>' +
      '<div class="fld"><div class="fld-l">Objetivo <span class="hint">opcional</span></div><input class="fi" id="na-goal" placeholder="Meia maratona · Fortalecimento"></div>' +
      '<div class="fld"><div class="fld-l">Prova <span class="hint">com data dd/mm/aaaa</span></div><input class="fi" id="na-race" placeholder="SP City 21K — 07/12/2026"></div>' +
      '<div class="z-row"><div class="fld" style="flex:1"><div class="fld-l">Pace de referência</div><input class="fi" id="na-pace" placeholder="6:00 /km Z2"></div><div class="fld" style="flex:1"><div class="fld-l">Rotina</div><input class="fi" id="na-vol" placeholder="3 corridas + 2 força"></div></div>' +
      '<button class="btn btn-r" id="na-go" onclick="RB.radar.createAthlete()">CADASTRAR</button>');
  };
  R.pw = pw;
  R.createAthlete = async function () {
    var v = function (id) { return (RB.$(id).value || '').trim(); };
    var body = { action: 'create', name: v('na-name'), email: v('na-email'), password: v('na-pw'), goal: v('na-goal'), race: v('na-race'), pace: v('na-pace'), vol: v('na-vol') };
    if (body.name.length < 2) { RB.toast('Preencha o nome', false); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) { RB.toast('E-mail inválido', false); return; }
    if (body.password.length < 6) { RB.toast('Senha com no mínimo 6 caracteres', false); return; }
    var btn = RB.$('na-go'); btn.disabled = true; btn.textContent = 'CADASTRANDO...';
    var r = await sb.functions.invoke('admin', { body: body });
    btn.disabled = false; btn.textContent = 'CADASTRAR';
    var err = r.data && r.data.error;
    if (r.error || err) { RB.toast(err === 'email_em_uso' ? 'Esse e-mail já tem cadastro' : 'Não deu para cadastrar', false); return; }
    var a = r.data.athlete;
    RB.coach.athletes.push(a); RB.coach.athletes.sort(function (x, y) { return x.name.localeCompare(y.name); });
    welcome(a, body.email, body.password, 'Aluno cadastrado ✓');
  };
  function welcomeText(a, email, password) {
    return 'Oi ' + first(a.name) + '! Seu acesso ao app da RUNBASE 💪\n' + RB.appUrl() + '\nLogin: ' + email + '\nSenha: ' + password +
      '\n\nDica: abre o link no celular e adiciona à tela inicial (no iPhone: Compartilhar → "Adicionar à Tela de Início").';
  }
  function welcome(a, email, password, title) {
    R.welcome = welcomeText(a, email, password); R.welcomeId = a.id;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew(title) + '<div class="sh-t">' + esc(a.name) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="welcome">' + esc(R.welcome).replace(/\n/g, '<br>') + '</div>' +
      '<button class="btn btn-r" onclick="RB.radar.copyWelcome()">COPIAR MENSAGEM</button>' +
      '<a class="btn btn-o" href="https://wa.me/?text=' + encodeURIComponent(R.welcome) + '" target="_blank" rel="noopener">ENVIAR PELO WHATSAPP</a>' +
      '<button class="btn-link" onclick="RB.closeSheet();RB.coach.open(\'' + a.id + '\')">Abrir o aluno ›</button>');
  }
  R.copyWelcome = async function () {
    try { await navigator.clipboard.writeText(R.welcome); RB.toast('Mensagem copiada ✓'); }
    catch (e) { RB.toast('Selecione o texto e copie', false); }
  };

  // ---------- ACESSO DO ALUNO ----------
  R.access = async function () {
    var a = RB.coach.athlete;
    RB.openSheet('<div class="ld"><div class="sp"></div></div>');
    var r = await sb.functions.invoke('admin', { body: { action: 'email', athlete_id: a.id } });
    var email = r.data && r.data.email;
    R.accessEmail = email;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Acesso ao app') + '<div class="sh-t">' + esc(a.name) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">E-mail de login</div><div class="acc-email">' + esc(email || 'não encontrado') + '</div></div>' +
      '<div class="fld"><div class="fld-l">Nova senha <span class="hint">o aluno também pode trocar depois, tocando nas iniciais dele no app</span></div><div class="z-row"><input class="fi" id="acc-pw" value="' + pw() + '" autocapitalize="off"><button class="mini" onclick="RB.$(\'acc-pw\').value=RB.radar.pw()">Gerar</button></div></div>' +
      '<button class="btn btn-r" id="acc-go" onclick="RB.radar.resetPw()">REDEFINIR SENHA</button>');
  };
  R.resetPw = async function () {
    var a = RB.coach.athlete, p = RB.$('acc-pw').value.trim();
    if (p.length < 6) { RB.toast('Senha com no mínimo 6 caracteres', false); return; }
    if (!confirm('Trocar a senha de ' + first(a.name) + '? A senha antiga deixa de funcionar.')) return;
    var btn = RB.$('acc-go'); btn.disabled = true;
    var r = await sb.functions.invoke('admin', { body: { action: 'reset_password', athlete_id: a.id, password: p } });
    btn.disabled = false;
    if (r.error || (r.data && r.data.error)) { RB.toast('Não deu para trocar a senha', false); return; }
    welcome(a, R.accessEmail || '', p, 'Senha redefinida ✓');
  };
})();
