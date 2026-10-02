// Run Base — app do coach
(function () {
  var sb = RB.sb;
  var C = RB.coach = { tab: 'dashboard', athlete: null, dtab: 'semana', fbFilter: 'pendentes' };
  var RECENT_DAYS = 14;

  C.load = async function () {
    RB.show('coach');
    RB.threads.onClose = function () { C.refresh(); };
    await C.refresh();
  };
  C.refresh = async function () {
    RB.loading('coach-content');
    var since = new Date(Date.now() - 60 * 864e5).toISOString();
    var r = await Promise.all([
      sb.from('athletes').select('*').order('name'),
      sb.from('feedbacks').select('*,athletes(name,img),workouts(day_label,type,description)').gte('created_at', since).order('created_at', { ascending: false })
    ]);
    C.all = r[0].data || [];
    C.athletes = C.all.filter(function (a) { return a.active !== false; });
    C.inactive = C.all.filter(function (a) { return a.active === false; });
    C.fbs = r[1].data || [];
    C.replies = await RB.threads.load(C.fbs.map(function (f) { return f.id; }));
    await Promise.all([RB.ms.coachLoad(), RB.radar.loadDigest(), RB.radar.loadCheckins()]);
    C.gymWeeks = {}; Object.keys(RB.ms.coach.gym).forEach(function (id) { C.gymWeeks[id] = RB.ms.coach.gym[id].weeks; });
    C.lastFb = {}; C.fbs.forEach(function (f) { if (!C.lastFb[f.athlete_id]) C.lastFb[f.athlete_id] = f.created_at; });
    RB.setBadge('fbBadge', C.awaiting().length);
    C.render();
  };
  C.awaiting = function () {
    var lim = Date.now() - RECENT_DAYS * 864e5;
    return C.fbs.filter(function (f) { return new Date(f.created_at) > lim && RB.threads.awaitingCoach(f, C.replies[f.id]); });
  };
  C.go = function (tab) {
    C.tab = tab; if (tab !== 'athletes') C.athlete = null;
    C.render();
  };
  C.render = function () {
    document.querySelectorAll('#screen-coach .nav-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === C.tab); });
    var el = RB.$('coach-content');
    if (C.tab === 'dashboard') dashboard(el);
    else if (C.tab === 'athletes') { if (C.athlete) detail(el); else list(el); }
    else if (C.tab === 'feedbacks') inbox(el);
    else if (C.tab === 'calendar') agenda(el);
    else if (C.tab === 'eventos') RB.events.render(el);
    else if (C.tab === 'financeiro') RB.fin.render(el);
    window.scrollTo(0, 0);
  };

  function athleteRow(a, size) {
    var gw = C.gymWeeks[a.id] || 0, last = C.lastFb[a.id];
    var wait = C.awaiting().filter(function (f) { return f.athlete_id === a.id; }).length;
    return '<div class="ar" onclick="RB.coach.open(\'' + a.id + '\')">' + RB.av(a.img, size || 46) + '<div style="flex:1;min-width:0"><div class="ar-n">' + RB.esc(a.name) + '</div>' +
      '<div class="ar-s red">' + RB.esc(a.race || a.goal) + '</div><div class="tags">' +
      (RB.ms.coach && RB.ms.coach.cur[a.id] && RB.ms.coach.cur[a.id].n ? RB.tag('semana ' + RB.ms.coach.cur[a.id].n + '/' + RB.ms.coach.cur[a.id].last, 'b') : '') +
      (wait ? RB.tag(wait + ' sem resposta', 'r') : '') +
      (gw >= RB.cfg.gymSwapWeeks ? RB.tag('⚠ força ' + gw + 'sem', 'r') : '') +
      RB.tag(last ? 'último feedback ' + RB.ago(last) : 'sem feedback recente', 'm') + '</div></div><div class="chev">›</div></div>';
  }

  // ---------- HOME ----------
  function dashboard(el) {
    var h = new Date().getHours();
    var hi = h < 12 ? 'Bom dia,' : h < 18 ? 'Boa tarde,' : 'Boa noite,';
    var wait = C.awaiting();
    var weekAgo = Date.now() - 7 * 864e5;
    var pain = C.fbs.filter(function (f) { return f.dor && new Date(f.created_at) > weekAgo; });
    var wk = C.fbs.filter(function (f) { return new Date(f.created_at) > weekAgo; });
    var html = '<div class="hello"><div class="hello-s">' + hi + '</div><div class="hello-n">' + RB.esc(RB.cfg.coachName.toUpperCase()) + '.</div></div>' +
      RB.push.card() + '<div class="card">' + RB.ew('Visão geral') + RB.statGrid([{ v: String(C.athletes.length), l: 'Alunos', a: true }, { v: String(wk.length), l: 'Feedbacks 7d' }, { v: String(wait.length), l: 'Sem resposta' }]) + '</div>';
    html += RB.radar.digestCard() + RB.radar.card(C.athletes, C.fbs) + RB.ms.coachCards(C.athletes);
    if (wait.length) {
      html += RB.ew('Aguardando sua resposta') + wait.slice(0, 4).map(function (f) { return RB.fbCard(f, { athlete: f.athletes, replies: C.replies[f.id] }); }).join('') +
        (wait.length > 4 ? '<button class="btn btn-o" onclick="RB.coach.go(\'feedbacks\')">Ver todos (' + wait.length + ')</button>' : '');
    } else {
      html += '<div class="card gl">' + RB.ew('Tudo respondido', 'green') + '<div class="p">Nenhum feedback esperando resposta. 👊</div></div>';
    }
    html += '<div style="margin-top:18px">' + RB.ew('Alunos') + C.athletes.map(function (a) { return athleteRow(a); }).join('') + '</div>' + RB.installCard();
    el.innerHTML = html;
  }

  function list(el) {
    el.innerHTML = RB.tt('ALUNOS') + '<button class="btn btn-r sm" style="margin-bottom:12px" onclick="RB.radar.newAthlete()">+ NOVO ALUNO</button>' + C.athletes.map(function (a) { return athleteRow(a, 52); }).join('') +
      (C.inactive.length ? '<details class="inact"><summary>Inativos (' + C.inactive.length + ')</summary><div class="hint" style="margin:6px 0 10px">Não aparecem no radar, no resumo, nas mensalidades nem nos avisos, e não recebem notificações.</div>' +
        C.inactive.map(function (a) { return '<div class="ar off" onclick="RB.coach.open(\'' + a.id + '\')">' + RB.av(a.img, 40) + '<div style="flex:1;min-width:0"><div class="ar-n">' + RB.esc(a.name) + '</div><div class="ar-s">' + (a.inactive_since ? 'Inativo desde ' + RB.fmtDate(a.inactive_since + 'T12:00:00') : 'Inativo') + '</div></div><div class="chev">›</div></div>'; }).join('') + '</details>' : '');
  }
  // inativar / reativar aluno
  C.setActive = async function (on) {
    var a = C.athlete;
    if (!on && !confirm('Mover ' + a.name.split(' ')[0] + ' para Inativos? Ele sai do radar, do resumo e das mensalidades, e para de receber notificações. Os treinos e o histórico ficam guardados.')) return;
    var r = await sb.from('athletes').update({ active: on, inactive_since: on ? null : (function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date()) }).eq('id', a.id);
    if (r.error) { RB.toast('Não deu para salvar', false); return; }
    RB.toast(on ? a.name.split(' ')[0] + ' voltou para os ativos ✓' : a.name.split(' ')[0] + ' foi para Inativos');
    C.athlete = null; C.tab = 'athletes'; await C.refresh();
  };

  // ---------- DETALHE DO ALUNO ----------
  C.open = function (id) {
    C.athlete = C.all.find(function (a) { return a.id === id; });
    C.dtab = 'planilha'; C.tab = 'athletes';
    C.render();
  };
  C.newReport = async function (id) {
    C.open(id); C.dtab = 'relatorios';
    await detail(RB.$('coach-content'));
    RB.reports.newFor();
  };
  C.dt = function (t) { C.dtab = t; return detail(RB.$('coach-content')); };
  async function detail(el) {
    var a = C.athlete;
    var head = '<button class="bb" onclick="RB.coach.go(\'athletes\')">← Alunos</button>' +
      '<div class="ath-h">' + RB.av(a.img, 60) + '<div style="flex:1"><div class="ath-n">' + RB.esc(a.name) + '</div><div class="ath-g">' + RB.esc(a.goal) + '</div><div class="tags">' + RB.tag(a.pace, 'm') + ' ' + RB.tag(a.vol, 'm') + '</div></div><span class="acc-bs"><button class="mini ghost acc-b" onclick="RB.radar.access()">Acesso</button>' + (a.active === false ? '' : '<button class="mini ghost acc-b" onclick="RB.coach.setActive(false)">Inativar</button>') + '</span></div>';
    if (a.active === false) head += '<div class="card inact-b">' + RB.ew('Aluno inativo', 'mid') + '<div class="p">Não recebe notificações e não aparece no radar, no resumo nem nas mensalidades.</div><button class="btn btn-o sm" style="margin-top:12px" onclick="RB.coach.setActive(true)">REATIVAR ALUNO</button></div>';
    var gw = C.gymWeeks[a.id] || 0;
    if (gw >= RB.cfg.gymSwapWeeks) head += '<div class="card rl">' + RB.ew('⚠ Treino de força há ' + gw + ' semanas') + '<div class="p">Está na hora de considerar trocar os exercícios ou progredir a carga/estrutura.</div><button class="btn btn-o sm" style="margin-top:12px" onclick="RB.edit.gotoForca()">EDITAR TREINO DE FORÇA</button></div>';
    head += RB.seg([['planilha', 'Planilha de corrida'], ['plano', 'Força e plano'], ['feedbacks', 'Feedbacks'], ['relatorios', 'Relatórios']], C.dtab, 'RB.coach.dt').replace('class="tr"', 'class="tr tr4"');
    el.innerHTML = head + '<div id="dt-body"><div class="ld"><div class="sp"></div></div></div>';
    var body = RB.$('dt-body');
    if (C.dtab === 'planilha') {
      await RB.edit.planilha(a, body);
    } else if (C.dtab === 'feedbacks') {
      var fr2 = await sb.from('feedbacks').select('*,workouts(day_label,type,description)').eq('athlete_id', a.id).order('created_at', { ascending: false }).limit(40);
      var fbs = fr2.data || [];
      var reps = await RB.threads.load(fbs.map(function (f) { return f.id; }));
      var rp = fbs.filter(function (f) { return f.rpe; }).slice(0, 20).reverse();
      var ckr = await sb.from('checkins').select('*').eq('athlete_id', a.id).order('week_start', { ascending: false }).limit(1);
      body.innerHTML = RB.checkin.line((ckr.data || [])[0]) + RB.trainLoad.card(fbs) + (rp.length > 1 ? '<div class="card">' + RB.ew('RPE dos últimos treinos', 'mid') + RB.lineChart(rp.map(function (f) { return { d: f.performed_at || f.created_at, v: f.rpe, label: f.kind === 'strength' ? 'Força' : (f.workouts ? f.workouts.type : ''), color: RB.rpeColor(f.rpe) }; }), { aria: 'RPE por treino', band: [3, 6] }) + '</div>' : '') +
        (fbs.length ? fbs.map(function (f) { return RB.fbCard(f, { athlete: a, replies: reps[f.id] }); }).join('') : RB.empty('Nenhum feedback ainda'));
    } else if (C.dtab === 'relatorios') {
      await RB.reports.list(a, body);
    } else if (C.dtab === 'plano') {
      await RB.edit.plano(a, body);
    }
  }

  // ---------- FEEDBACKS ----------
  C.ff = function (v) { C.fbFilter = v; inbox(RB.$('coach-content')); };
  function inbox(el) {
    var wait = C.awaiting();
    var items = C.fbFilter === 'pendentes' ? wait : C.fbFilter === 'dor' ? C.fbs.filter(function (f) { return f.dor; }) : C.fbs;
    el.innerHTML = RB.tt('FEEDBACKS') + RB.seg([['pendentes', 'Sem resposta (' + wait.length + ')'], ['dor', 'Com dor'], ['todos', 'Todos']], C.fbFilter, 'RB.coach.ff') +
      (C.fbFilter === 'pendentes' ? '<div class="sub">Feedbacks dos últimos ' + RECENT_DAYS + ' dias em que a última palavra ainda é do aluno.</div>' : '<div class="sub">Últimos 60 dias</div>') +
      (items.length ? items.map(function (f) { return RB.fbCard(f, { athlete: f.athletes, replies: C.replies[f.id], showDesc: true }); }).join('') : RB.empty(C.fbFilter === 'pendentes' ? 'Tudo respondido 👊' : 'Nada por aqui'));
  }

  // ---------- AGENDA ----------
  async function agenda(el) {
    RB.loading('coach-content');
    var wres = await sb.from('weeks').select('id,athlete_id,label').eq('is_current', true);
    var cur = wres.data || [];
    var map = {};
    if (cur.length) {
      var wo = (await sb.from('workouts').select('*').in('week_id', cur.map(function (w) { return w.id; })).order('sort_order')).data || [];
      wo.forEach(function (w) {
        var wk = cur.find(function (x) { return x.id === w.week_id; }); if (!wk) return;
        var a = C.athletes.find(function (x) { return x.id === wk.athlete_id; }); if (!a) return;
        var k = (w.day_label || '').toUpperCase().trim();
        (map[k] = map[k] || []).push({ a: a, type: w.type });
      });
    }
    var days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'], lbl = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    var palette = ['var(--red)', 'var(--blue)', '#2E7D32', '#E65100', '#7B1FA2', '#8B6914', '#0277BD'];
    var col = {}; C.athletes.forEach(function (a, i) { col[a.id] = palette[i % palette.length]; });
    var today = (new Date().getDay() + 6) % 7;
    var now = new Date();
    el.innerHTML = RB.tt('AGENDA') + '<div class="sub">Semana atual · ' + RB.MES[now.getMonth()] + ' ' + now.getFullYear() + '</div>' +
      days.map(function (d, i) {
        var evs = map[d] || [];
        return '<div class="ag-row' + (i === today ? ' today' : '') + '"><div class="ag-d">' + lbl[i] + '</div><div class="ag-evs">' +
          (evs.length ? evs.map(function (e) {
            return '<div class="ag-ev" style="border-left-color:' + col[e.a.id] + '" onclick="RB.coach.open(\'' + e.a.id + '\')">' + RB.av(e.a.img, 24) + '<span class="ag-n">' + RB.esc(e.a.name.split(' ')[0]) + '</span><span class="ag-t">' + RB.esc(e.type) + '</span></div>';
          }).join('') : '<div class="ag-empty">—</div>') + '</div></div>';
      }).join('');
  }
})();
