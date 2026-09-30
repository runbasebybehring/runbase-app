// Run Base — app do aluno
(function () {
  var sb = RB.sb;
  var A = RB.athlete = { tab: 'home', fbView: 'semana', openWeek: null };

  A.load = async function () {
    RB.show('athlete');
    RB.loading('athlete-content');
    var uid = RB.state.user.id;
    var r = await Promise.all([
      sb.from('athletes').select('*').eq('id', uid).single(),
      sb.from('weeks').select('*,workouts(*)').eq('athlete_id', uid).order('week_number'),
      sb.from('zones').select('*').eq('athlete_id', uid).order('sort_order'),
      sb.from('athlete_plans').select('*').eq('athlete_id', uid).maybeSingle(),
      sb.from('feedbacks').select('*,workouts(day_label,type,description,week_id)').eq('athlete_id', uid).order('created_at', { ascending: false }),
      sb.from('reports').select('id,period,title,objective,seen_at,published_at').eq('status', 'published').order('period', { ascending: false })
    ]);
    if (!r[0].data) { RB.toast('Perfil não encontrado', false); return; }
    A.me = r[0].data;
    A.weeks = (r[1].data || []).map(function (w) { w.workouts = (w.workouts || []).sort(function (a, b) { return a.sort_order - b.sort_order; }); return w; });
    A.zones = r[2].data || [];
    A.plan = r[3].data || null;
    A.feedbacks = r[4].data || [];
    A.reports = r[5].data || [];
    A.byWorkout = {};
    A.feedbacks.forEach(function (f) { if (f.workout_id && !A.byWorkout[f.workout_id]) A.byWorkout[f.workout_id] = f; });
    A.cur = A.weeks.find(function (w) { return w.is_current; }) || A.weeks[A.weeks.length - 1] || null;
    A.openWeek = A.cur ? A.cur.id : null;
    A.replies = await RB.threads.load(A.feedbacks.map(function (f) { return f.id; }));
    RB.$('ath-avatar').textContent = A.me.img || A.me.name.slice(0, 2).toUpperCase();
    RB.threads.onClose = A.refreshReplies;
    A.go(A.tab);
    A.reminder();
  };

  A.refreshReplies = async function () {
    A.replies = await RB.threads.load(A.feedbacks.map(function (f) { return f.id; }));
    A.go(A.tab);
  };

  A.unreadTotal = function () {
    var n = 0; Object.keys(A.replies).forEach(function (k) { n += RB.threads.unread(A.replies[k]); }); return n;
  };
  A.pending = function () {
    // treinos sem feedback: semana atual + semana anterior
    if (!A.cur) return [];
    var out = [];
    A.weeks.forEach(function (w) {
      if (w.week_number > A.cur.week_number || w.week_number < A.cur.week_number - 1) return;
      w.workouts.forEach(function (wo) { if (!A.byWorkout[wo.id]) out.push(Object.assign({ weekLabel: w.label, isCur: w.id === A.cur.id }, wo)); });
    });
    return out;
  };
  A.streak = function () {
    if (!A.cur) return 0;
    var list = A.weeks.filter(function (w) { return w.week_number <= A.cur.week_number; }).reverse();
    var has = function (w) { return w.workouts.some(function (wo) { return A.byWorkout[wo.id]; }); };
    if (list.length && !has(list[0])) list.shift();
    var n = 0; for (var i = 0; i < list.length; i++) { if (has(list[i])) n++; else break; }
    return n;
  };

  A.go = function (tab) {
    A.tab = tab;
    document.querySelectorAll('#screen-athlete .nav-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    RB.setBadge('pendBadge', A.pending().filter(function (w) { return w.isCur; }).length + A.unreadTotal());
    RB.setBadge('relBadge', A.reports.filter(function (r) { return !r.seen_at; }).length);
    var el = RB.$('athlete-content');
    ({ home: home, planilha: planilha, forca: function (el) { RB.strength.render(el); }, zonas: zonas, feedback: feedback, relatorio: relatorio })[tab](el);
    window.scrollTo(0, 0);
  };

  // ---------- HOME ----------
  function home(el) {
    var a = A.me, wk = A.cur, wo = wk ? wk.workouts : [];
    var next = wo.find(function (w) { return !A.byWorkout[w.id]; });
    var done = wo.filter(function (w) { return A.byWorkout[w.id]; }).length;
    var pct = wo.length ? Math.round(done / wo.length * 100) : 0;
    var html = '<div class="hello"><div class="hello-s">Olá,</div><div class="hello-n">' + RB.esc(a.name.split(' ')[0].toUpperCase()) + '.</div></div>';

    // mensagens novas do coach
    var unreadFbs = A.feedbacks.filter(function (f) { return RB.threads.unread(A.replies[f.id]); });
    if (unreadFbs.length) {
      html += '<div class="card coachmsg">' + RB.ew('💬 Mensagem do coach') + unreadFbs.slice(0, 2).map(function (f) {
        var reps = A.replies[f.id], last = reps[reps.length - 1];
        return '<div class="cm" onclick="RB.threads.open(' + f.id + ')"><div class="cm-w">' + RB.esc(f.workouts ? f.workouts.day_label + ' — ' + f.workouts.type : 'Treino') + '</div><div class="cm-b">' + RB.esc(last.body.length > 120 ? last.body.slice(0, 120) + '…' : last.body) + '</div><div class="cm-a">Responder ›</div></div>';
      }).join('') + '</div>';
    }
    // relatório novo
    var newRep = A.reports.find(function (r) { return !r.seen_at; });
    if (newRep) html += '<div class="card newrep" onclick="RB.athlete.go(\'relatorio\')">' + RB.ew('Novo relatório', 'blue') + '<div class="newrep-t">' + RB.esc(newRep.title) + ' está disponível</div><div class="cm-a">Ver relatório ›</div></div>';

    html += next
      ? '<div class="card rl">' + RB.ew('Próximo treino') + '<div class="tags">' + RB.tag(next.day_label, 'm') + ' ' + RB.tag(next.type, 'r') + '</div><div class="next-d">' + RB.esc(next.description) + '</div><button class="btn btn-r" onclick="RB.athlete.feedbackForm(' + next.id + ')">CONCLUIR + FEEDBACK</button></div>'
      : '<div class="card gl">' + RB.ew('Semana concluída', 'green') + '<div class="p">Todos os treinos desta semana foram realizados!</div></div>';

    var streak = A.streak();
    html += '<div class="card">' + RB.ew(wk ? RB.esc(wk.label) : 'Semana atual', 'blue') +
      RB.statGrid([{ v: done + '/' + wo.length, l: 'Treinos', a: true }, { v: streak ? streak + (streak > 1 ? ' sem' : ' sem') : '—', l: 'Sequência' }, { v: wk ? wk.volume : '—', l: 'Volume' }]) +
      '<div class="pb"><div class="pf" style="width:' + pct + '%"></div></div>' +
      (streak >= 3 ? '<div class="streak-t">🔥 ' + streak + ' semanas seguidas treinando. Constância é o que constrói a base.</div>' : '') + '</div>';

    var rd = RB.raceDate(a), days = rd ? RB.daysTo(rd) : null;
    html += '<div class="card">' + RB.ew('Objetivo') + '<div class="goal">' + RB.esc(a.goal) + '</div><div class="goal-s">' + RB.esc(a.pace) + ' · ' + RB.esc(a.vol) + '</div>' +
      (days != null && days >= 0 && days <= 365 ? '<div class="countdown"><div class="cd-n">' + days + '</div><div class="cd-l">' + (days === 1 ? 'dia para a prova' : days === 0 ? 'é hoje! Boa prova 🏁' : 'dias para a prova') + '<br><span>' + RB.esc(a.race) + '</span></div></div>' : '') + '</div>';

    var b = A.plan && A.plan.block;
    if (b && b.resumo) {
      html += '<div class="card">' + RB.ew('Bloco atual — ' + RB.esc(b.mes)) + '<div class="p" style="margin-bottom:12px">' + RB.md(b.resumo) + '</div>' +
        (b.infos || []).slice(0, 2).map(function (i) {
          var c = i.cls === 'alert' ? 'var(--red)' : i.cls === 'highlight' ? 'var(--green)' : 'var(--blue)';
          return '<div class="info" style="border-left-color:' + c + '"><div class="info-t" style="color:' + c + '">' + RB.esc(i.t) + '</div><div class="info-x">' + RB.md(i.x) + '</div></div>';
        }).join('') + '</div>';
    }
    var wl = A.plan && A.plan.week_layout;
    if (wl && wl.length) {
      var col = { red: 'var(--red)', blue: 'var(--blue)', green: 'var(--green)' };
      html += '<div class="card">' + RB.ew('Organização da semana', 'blue') + '<div class="wkgrid">' + wl.map(function (d) {
        var off = d.c === 'off';
        return '<div class="wkd' + (off ? ' off' : '') + '" style="' + (off ? '' : 'background:' + (col[d.c] || d.c)) + '"><div class="a">' + RB.esc(d.d) + '</div><div class="b">' + RB.esc(d.t) + '</div><div class="c">' + RB.esc(d.s) + '</div></div>';
      }).join('') + '</div></div>';
    }
    html += RB.installCard();
    el.innerHTML = html;
  }

  // ---------- PLANILHA ----------
  function planilha(el) {
    var html = RB.tt('PLANILHA') + '<div class="sub">' + RB.esc(A.me.goal) + '</div>';
    if (!A.weeks.length) { el.innerHTML = html + RB.empty('Planilha ainda não publicada.'); return; }
    A.weeks.forEach(function (wk) {
      var ic = A.cur && wk.id === A.cur.id, io = A.openWeek === wk.id;
      var dn = wk.workouts.filter(function (w) { return A.byWorkout[w.id]; }).length;
      html += '<div class="wb' + (ic ? ' cur' : '') + '"><div class="wh" onclick="RB.athlete.toggleWeek(' + wk.id + ')"><div><div class="wk-l' + (ic ? ' cur' : '') + '">' + RB.esc(wk.label) + '</div>' + (ic ? '<div class="wk-now">Semana atual</div>' : '') + '</div>' +
        '<div class="wk-r"><span class="wk-done">' + dn + '/' + wk.workouts.length + '</span><span class="wk-v">' + RB.esc(wk.volume) + '</span><span class="arrow">' + (io ? '▲' : '▼') + '</span></div></div>' +
        '<div class="wbd' + (io ? ' open' : '') + '">' + wk.workouts.map(function (d) {
          var f = A.byWorkout[d.id];
          return '<div class="dr' + (f ? ' ok' : '') + '"><div class="dr-h"><span class="dr-d">' + RB.esc(d.day_label) + '</span>' + RB.tag(d.type, 'r') + (f ? '<span class="dr-ok" style="color:' + RB.rpeColor(f.rpe) + '">✓ RPE ' + f.rpe + '</span>' : '') + '</div><div class="dr-t">' + RB.esc(d.description) + '</div>' +
            (!f && (ic || (A.cur && wk.week_number === A.cur.week_number - 1)) ? '<button class="mini" onclick="RB.athlete.feedbackForm(' + d.id + ')">Dar feedback</button>' : '') + '</div>';
        }).join('') + '</div></div>';
    });
    el.innerHTML = html;
  }
  A.toggleWeek = function (id) { A.openWeek = A.openWeek === id ? null : id; A.go('planilha'); };

  // ---------- ZONAS ----------
  function zonas(el) {
    var html = RB.tt('ZONAS DE TREINO');
    if (!A.zones.length) { el.innerHTML = html + RB.empty('Zonas ainda não disponíveis.<br>Seu coach irá publicar em breve.'); return; }
    html += '<div class="sub">Use estas zonas como guia — o corpo é o melhor monitor. Ajuste conforme sua resposta nas primeiras semanas.</div>';
    html += A.zones.map(function (z) {
      return '<div class="zone"><div class="zone-dot" style="background:' + RB.esc(z.color) + '"></div><div style="flex:1"><div class="zone-h"><span class="zone-n">' + RB.esc(z.zone) + '</span><span class="zone-p">' + RB.esc(z.pace) + '</span></div><div class="zone-d">' + RB.esc(z.description || '') + '</div></div></div>';
    }).join('');
    el.innerHTML = html;
  }

  // ---------- FEEDBACK ----------
  A.fbTab = function (v) { A.fbView = v; A.go('feedback'); };
  function feedback(el) {
    var html = RB.tt('FEEDBACK') + RB.seg([['semana', 'Pendentes'], ['conversas', 'Conversas' + (A.unreadTotal() ? ' •' : '')], ['historico', 'Histórico']], A.fbView, 'RB.athlete.fbTab');
    if (A.fbView === 'semana') {
      var pend = A.pending();
      html += pend.length ? RB.ew('Aguardando feedback') + pend.map(function (w) {
        return '<div class="pend"><div><div class="pend-w">' + RB.esc(w.day_label + ' — ' + w.type) + (w.isCur ? '' : ' · semana passada') + '</div><div class="pend-d">' + RB.esc(w.description) + '</div></div><button onclick="RB.athlete.feedbackForm(' + w.id + ')">DAR</button></div>';
      }).join('') : '<div class="card gl">' + RB.ew('Tudo em dia', 'green') + '<div class="p">Nenhum treino esperando feedback. 👊</div></div>';
      var curFbs = A.feedbacks.filter(function (f) { return A.cur && f.workouts && f.workouts.week_id === A.cur.id; });
      if (curFbs.length) html += RB.ew('Enviados nesta semana') + curFbs.map(function (f) { return RB.fbCard(f, { replies: A.replies[f.id] }); }).join('');
    } else if (A.fbView === 'conversas') {
      var withMsgs = A.feedbacks.filter(function (f) { return (A.replies[f.id] || []).length; });
      withMsgs.sort(function (x, y) { var a = A.replies[x.id], b = A.replies[y.id]; return new Date(b[b.length - 1].created_at) - new Date(a[a.length - 1].created_at); });
      html += '<div class="sub">Toque em qualquer treino para falar com o coach sobre ele.</div>' +
        (withMsgs.length ? withMsgs.map(function (f) { return RB.fbCard(f, { replies: A.replies[f.id] }); }).join('') : RB.empty('Nenhuma conversa ainda.<br>Quando o coach responder um feedback, aparece aqui.'));
    } else {
      html += history();
    }
    el.innerHTML = html;
  }
  function history() {
    var fbs = A.feedbacks.slice().reverse(); // antigo → novo
    if (!fbs.length) return RB.empty('Nenhum feedback enviado ainda.');
    var last = fbs.slice(-20);
    var rpes = last.filter(function (f) { return f.rpe; });
    var avg = rpes.length ? (rpes.reduce(function (a, f) { return a + f.rpe; }, 0) / rpes.length) : 0;
    var cnt = function (key, opts, colors) {
      return opts.map(function (k, i) { return { l: k, n: last.filter(function (f) { return f[key] === k; }).length, c: colors[i] }; });
    };
    var dor = last.filter(function (f) { return f.dor; }).length;
    return RB.statGrid([{ v: String(A.feedbacks.length), l: 'Feedbacks', a: true }, { v: avg ? avg.toFixed(1).replace('.', ',') : '—', l: 'RPE médio' }, { v: String(dor), l: 'Com dor' }]) +
      '<div class="card">' + RB.ew('RPE dos últimos ' + last.length + ' treinos', 'mid') +
      RB.lineChart(rpes.map(function (f) { return { d: f.performed_at || f.created_at, v: f.rpe, label: f.workouts ? f.workouts.type : '', color: RB.rpeColor(f.rpe) }; }), { aria: 'RPE por treino', band: [3, 6] }) +
      '<div class="ch-note">Toque num ponto para ver o treino. Faixa clara = RPE 3–6.</div></div>' +
      '<div class="rig2"><div class="card">' + RB.ew('Sono', 'mid') + RB.barList(cnt('sono', ['ruim', 'ok', 'bom', 'ótimo'], ['#B71C1C', '#F9A825', '#2E7D32', '#1565C0'])) + '</div>' +
      '<div class="card">' + RB.ew('Energia', 'mid') + RB.barList(cnt('energia', ['péssima', 'ruim', 'ok', 'boa', 'ótima'], ['#B71C1C', '#E65100', '#F9A825', '#558B2F', '#2E7D32'])) + '</div></div>' +
      RB.ew('Todos os feedbacks') + A.feedbacks.map(function (f) { return RB.fbCard(f, { replies: A.replies[f.id] }); }).join('');
  }

  // formulário de feedback
  var F = {};
  var OPTS = {
    energia: [['péssima', 'ruim', 'ok', 'boa', 'ótima'], ['#B71C1C', '#E65100', '#F9A825', '#558B2F', '#2E7D32']],
    fadiga: [['leves', 'normais', 'pesadas', 'muito pesadas'], ['#2E7D32', '#F9A825', '#E65100', '#B71C1C']],
    sono: [['ruim', 'ok', 'bom', 'ótimo'], ['#B71C1C', '#F9A825', '#2E7D32', '#1565C0']],
    dor: [['não', 'sim'], ['#2E7D32', '#B71C1C']],
    hidratacao: [['pouca', 'suficiente', 'bastante'], ['#E65100', '#2E7D32', '#1565C0']],
    gel: [['não usei', '1 gel', '2 géis', '3+ géis'], ['#C41731', '#C41731', '#C41731', '#C41731']],
    frequencia_cardiaca: [['normal', 'elevada', 'muito alta'], ['#2E7D32', '#E65100', '#B71C1C']]
  };
  var LABELS = { energia: 'Energia antes do treino', fadiga: 'Fadiga muscular', sono: 'Sono na noite anterior', dor: 'Sentiu alguma dor?', hidratacao: 'Hidratação durante o treino', gel: 'Usou gel / nutrição?', frequencia_cardiaca: 'Frequência cardíaca' };
  A.feedbackForm = function (workoutId) {
    var w; A.weeks.forEach(function (wk) { wk.workouts.forEach(function (x) { if (x.id === workoutId) w = x; }); });
    if (!w) return;
    F = { w: w };
    var html = '<div class="sh-top"><div>' + RB.ew('Feedback do treino') + '<div class="sh-t">' + RB.esc(w.day_label + ' — ' + w.type) + '</div><div class="sh-s">' + RB.esc(w.description) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fq">' + RB.ew('Percepção de esforço (1–10)', 'mid') + '<div class="rg">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button class="rb" data-k="rpe" data-v="' + n + '" onclick="RB.athlete.pick(this)">' + n + '</button>'; }).join('') + '</div><div id="rpe-label" class="rpe-l"></div></div>' +
      Object.keys(OPTS).map(function (k) {
        return '<div class="fq">' + RB.ew(LABELS[k], 'mid') + '<div class="opts">' + OPTS[k][0].map(function (v, i) { return '<button class="eb" data-k="' + k + '" data-v="' + v + '" data-c="' + OPTS[k][1][i] + '" onclick="RB.athlete.pick(this)">' + v + '</button>'; }).join('') + '</div></div>';
      }).join('') +
      '<div class="fq">' + RB.ew('Comentário (opcional)', 'mid') + '<textarea id="fb-comment" class="ft" rows="2" placeholder="Dor, dúvida, algo diferente..."></textarea></div>' +
      '<div class="fq">' + RB.ew('Data do treino', 'mid') + '<input type="date" class="fi" id="fb-date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
      '<button id="submit-fb" class="sb2" onclick="RB.athlete.submit()">preencha esforço e energia</button>';
    RB.openSheet(html);
  };
  A.pick = function (b) {
    var k = b.dataset.k, v = b.dataset.v;
    F[k] = k === 'rpe' ? +v : v;
    document.querySelectorAll('#sheet-body [data-k="' + k + '"]').forEach(function (x) {
      var c = k === 'rpe' ? RB.rpeColor(+x.dataset.v) : x.dataset.c;
      var on = x === b;
      x.style.background = on ? c + '22' : ''; x.style.borderColor = on ? c : ''; x.style.color = on ? c : '';
    });
    if (k === 'rpe') { var l = RB.$('rpe-label'); l.textContent = v + ' — ' + RB.RPE_LABELS[+v]; l.style.color = RB.rpeColor(+v); }
    var ok = F.rpe && F.energia, btn = RB.$('submit-fb');
    btn.classList.toggle('ready', !!ok); btn.textContent = ok ? 'ENVIAR FEEDBACK' : 'preencha esforço e energia';
  };
  A.submit = async function () {
    if (!F.rpe || !F.energia) return;
    var btn = RB.$('submit-fb'); btn.textContent = 'SALVANDO...'; btn.disabled = true;
    var payload = {
      workout_id: F.w.id, athlete_id: RB.state.user.id, rpe: F.rpe, energia: F.energia, fadiga: F.fadiga || null, sono: F.sono || null,
      hidratacao: F.hidratacao || null, gel: F.gel || null, frequencia_cardiaca: F.frequencia_cardiaca || null, dor: F.dor === 'sim',
      comment: RB.$('fb-comment').value.trim() || null, performed_at: RB.$('fb-date').value || undefined
    };
    var res = await sb.from('feedbacks').insert(payload).select('*,workouts(day_label,type,description,week_id)').single();
    btn.disabled = false;
    if (res.error) { btn.textContent = 'ENVIAR FEEDBACK'; RB.toast('Erro ao salvar', false); return; }
    A.feedbacks.unshift(res.data); A.byWorkout[F.w.id] = res.data;
    RB.closeSheet();
    RB.toast(F.dor === 'sim' ? 'Enviado ✓ — o coach vai ver o alerta de dor' : 'Feedback enviado ✓');
    A.go(A.tab);
  };

  // lembrete de treinos sem feedback (uma vez por semana)
  A.reminder = function () {
    var overdue = A.pending().filter(function (w) { return !w.isCur; }).length;
    if (!overdue || !A.cur) return;
    var key = 'rb_reminder_' + RB.state.user.id + '_' + A.cur.id;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Lembrete') + '<div class="sh-t">Treinos da semana passada<br>sem feedback</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="p" style="margin-bottom:20px">Você tem ' + overdue + ' treino' + (overdue > 1 ? 's' : '') + ' da semana passada sem feedback. Toda avaliação ajuda seu coach a ajustar o plano.</div>' +
      '<button class="btn btn-r" onclick="RB.closeSheet();RB.athlete.fbView=\'semana\';RB.athlete.go(\'feedback\')">DAR FEEDBACK AGORA</button><button class="btn btn-o" onclick="RB.closeSheet()">Lembrar depois</button>');
  };

  // ---------- RELATÓRIO ----------
  A.repSel = null;
  A.pickReport = function (id) { A.repSel = id; A.go('relatorio'); };
  async function relatorio(el) {
    if (!A.reports.length) {
      el.innerHTML = RB.tt('RELATÓRIO') + '<div class="card rl">' + RB.ew('Em breve') + '<div class="sh-t" style="margin-bottom:10px">Seu primeiro relatório</div><div class="p">Ao fim de cada mês você recebe aqui um resumo do seu progresso: números, evolução, destaques e uma nota do coach.</div></div>';
      return;
    }
    var id = A.repSel || A.reports[0].id;
    RB.loading('athlete-content');
    var res = await sb.from('reports').select('*').eq('id', id).single();
    if (res.error) { el.innerHTML = RB.empty('Não foi possível abrir o relatório.'); return; }
    var r = res.data;
    var picker = A.reports.length > 1 ? '<div class="rep-pick">' + A.reports.map(function (x) {
      return '<button class="' + (x.id === id ? 'on' : '') + '" onclick="RB.athlete.pickReport(\'' + x.id + '\')">' + RB.esc(x.title) + (x.seen_at ? '' : ' •') + '</button>';
    }).join('') + '</div>' : '';
    el.innerHTML = picker + RB.reports.view(r, { athleteName: A.me.name });
    if (!r.seen_at) {
      await sb.rpc('mark_report_seen', { p_report: r.id });
      A.reports.forEach(function (x) { if (x.id === r.id) x.seen_at = new Date().toISOString(); });
      RB.setBadge('relBadge', A.reports.filter(function (x) { return !x.seen_at; }).length);
    }
  }
})();
