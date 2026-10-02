// Run Base — eventos (treinões, provas do grupo, encontros) com confirmação de presença
(function () {
  var sb = RB.sb;
  var V = RB.events = { list: [], mine: {}, att: {}, showPast: false };
  var KIND = { treino: ['Treinão', 'r'], prova: ['Prova', 'b'], evento: ['Evento', 'g'] };
  var WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  var MS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  V.load = async function () {
    var since = new Date(Date.now() - 60 * 864e5).toISOString();
    var r = await Promise.all([
      sb.from('events').select('*').gte('starts_at', since).order('starts_at'),
      sb.from('event_rsvps').select('event_id,user_id,status')
    ]);
    V.list = r[0].data || [];
    V.rsvps = r[1].data || [];
    V.mine = {};
    var me = RB.state.user.id;
    V.rsvps.forEach(function (x) { if (x.user_id === me) V.mine[x.event_id] = x.status; });
    var ids = V.list.map(function (e) { return e.id; });
    var res = await Promise.all(ids.map(function (id) { return sb.rpc('event_attendees', { p_event: id }); }));
    V.att = {}; ids.forEach(function (id, i) { V.att[id] = res[i].data || []; });
  };
  V.upcoming = function () { var t = Date.now() - 3 * 3600e3; return V.list.filter(function (e) { return new Date(e.starts_at).getTime() >= t; }); };
  V.pendingCount = function () { return V.upcoming().filter(function (e) { return !V.mine[e.id]; }).length; };

  function when(e) {
    var d = new Date(e.starts_at);
    return { wd: WD[d.getDay()], day: d.getDate(), mon: MS[d.getMonth()], time: String(d.getHours()).padStart(2, '0') + 'h' + (d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : '') };
  }
  function card(e, coach) {
    var w = when(e), k = KIND[e.kind] || KIND.evento, att = V.att[e.id] || [];
    var going = att.filter(function (a) { return a.status === 'vou'; }), maybe = att.filter(function (a) { return a.status === 'talvez'; });
    var days = RB.daysTo(new Date(new Date(e.starts_at).setHours(0, 0, 0, 0)));
    var soon = days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : (days > 1 && days <= 7 ? 'Em ' + days + ' dias' : '');
    var mine = V.mine[e.id];
    var html = '<div class="card ev' + (new Date(e.starts_at) < Date.now() - 3 * 3600e3 ? ' past' : '') + '"><div class="ev-top"><div class="ev-date"><div class="ev-wd">' + w.wd + '</div><div class="ev-d">' + w.day + '</div><div class="ev-m">' + w.mon + '</div></div>' +
      '<div class="ev-info"><div class="tags">' + RB.tag(k[0], k[1]) + (soon ? RB.tag(soon, 'd') : '') + '</div><div class="ev-t">' + RB.esc(e.title) + '</div>' +
      '<div class="ev-meta">' + w.time + (e.location ? ' · ' + RB.esc(e.location) : '') + '</div></div></div>' +
      (e.description ? '<div class="ev-desc">' + RB.md(e.description) + '</div>' : '') +
      (e.link ? '<a class="ev-link" href="' + RB.esc(e.link) + '" target="_blank" rel="noopener">Mais informações ↗</a>' : '') +
      '<div class="ev-att">' + (going.length ? '<div class="ev-avs">' + going.slice(0, 8).map(function (a) { return RB.av(a.img || a.name.slice(0, 2).toUpperCase(), 28); }).join('') + '</div>' : '') +
      '<div class="ev-cnt">' + (going.length ? '<b>' + going.length + '</b> ' + (going.length === 1 ? 'vai' : 'vão') : 'Ninguém confirmou ainda') + (maybe.length ? ' · ' + maybe.length + ' talvez' : '') + (going.length ? '<span class="ev-names"> — ' + going.map(function (a) { return a.is_me ? 'você' : RB.esc(a.name); }).join(', ') + '</span>' : '') + '</div></div>';
    if (!coach) {
      html += '<div class="ev-rsvp">' + [['vou', 'Vou ✓'], ['talvez', 'Talvez'], ['nao', 'Não vou']].map(function (o) {
        return '<button class="' + (mine === o[0] ? 'on ' + o[0] : '') + '" onclick="RB.events.rsvp(\'' + e.id + '\',\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('') + '</div>';
    } else {
      html += '<div class="wk-acts"><button onclick="RB.events.form(\'' + e.id + '\')">Editar</button><button onclick="RB.events.notify(\'' + e.id + '\')">Avisar alunos</button><button class="danger" onclick="RB.events.del(\'' + e.id + '\')">Excluir</button></div>';
    }
    return html + '</div>';
  }

  V.render = async function (el, opts) {
    V.el = el; V.opts = opts || V.opts || {};
    RB.loading(el.id);
    await V.load();
    var coach = RB.state.isCoach;
    var up = V.upcoming(), past = V.list.filter(function (e) { return up.indexOf(e) < 0; }).reverse();
    var html = (V.opts.noTitle && el.id === 'galera-body' ? '' : RB.tt('EVENTOS')) + '<div class="sub">Treinões, provas do grupo e encontros da Run Base.</div>' +
      (coach ? '<button class="btn btn-r" style="margin:0 0 16px" onclick="RB.events.form()">+ NOVO EVENTO</button>' : '') +
      (up.length ? up.map(function (e) { return card(e, coach); }).join('') : RB.empty('Nenhum evento marcado por enquanto.' + (coach ? '' : '<br>Quando a treinadora criar, aparece aqui.'))) +
      (past.length ? '<button class="btn-link" onclick="RB.events.togglePast()">' + (V.showPast ? 'Esconder' : 'Ver') + ' eventos anteriores (' + past.length + ')</button>' + (V.showPast ? past.map(function (e) { return card(e, coach); }).join('') : '') : '');
    el.innerHTML = html;
    if (!coach) RB.setBadge('evBadge', V.pendingCount());
  };
  V.togglePast = function () { V.showPast = !V.showPast; V.render(V.el); };

  V.rsvp = async function (id, status) {
    var r = await sb.from('event_rsvps').upsert({ event_id: id, user_id: RB.state.user.id, status: status, updated_at: new Date().toISOString() });
    if (r.error) { RB.toast('Erro ao confirmar', false); return; }
    RB.toast(status === 'vou' ? 'Presença confirmada ✓' : status === 'talvez' ? 'Marcado como talvez' : 'Ok, fica pra próxima');
    V.render(V.el);
  };

  // ---- coach ----
  var cur = null;
  V.form = function (id) {
    var e = id ? V.list.find(function (x) { return x.id === id; }) : { title: '', kind: 'treino', starts_at: null, location: '', description: '', link: '' };
    cur = e;
    var dt = '';
    if (e.starts_at) { var d = new Date(e.starts_at); dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    RB.openSheet('<div class="sh-top"><div>' + RB.ew(id ? 'Editar evento' : 'Novo evento') + '</div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Título</div><input class="fi" id="ev-title" value="' + RB.esc(e.title) + '" placeholder="Treinão no Ibirapuera"></div>' +
      '<div class="fld"><div class="fld-l">Tipo</div><select class="fi sel" id="ev-kind">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (e.kind === k ? ' selected' : '') + '>' + KIND[k][0] + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><div class="fld-l">Data e hora</div><input class="fi" type="datetime-local" id="ev-when" value="' + dt + '"></div>' +
      '<div class="fld"><div class="fld-l">Local</div><input class="fi" id="ev-loc" value="' + RB.esc(e.location || '') + '" placeholder="Portão 3 do Ibirapuera"></div>' +
      '<div class="fld"><div class="fld-l">Descrição <span class="hint">opcional</span></div><textarea class="ft" id="ev-desc" rows="3" placeholder="Rodagem 10km Z2 em grupo, café depois.">' + RB.esc(e.description || '') + '</textarea></div>' +
      '<div class="fld"><div class="fld-l">Link <span class="hint">opcional · inscrição, mapa…</span></div><input class="fi" id="ev-link" value="' + RB.esc(e.link || '') + '" placeholder="https://"></div>' +
      (id ? '' : '<label class="ck-l big"><input type="checkbox" id="ev-push" checked> <span>Avisar os alunos por notificação</span></label>') +
      '<button class="btn btn-r" onclick="RB.events.save()">SALVAR EVENTO</button>');
  };
  V.save = async function () {
    var title = RB.$('ev-title').value.trim(), when = RB.$('ev-when').value;
    if (!title || !when) { RB.toast('Preencha título, data e hora', false); return; }
    var link = RB.$('ev-link').value.trim();
    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
    var data = { title: title, kind: RB.$('ev-kind').value, starts_at: new Date(when).toISOString(), location: RB.$('ev-loc').value.trim() || null, description: RB.$('ev-desc').value.trim() || null, link: link || null };
    var push = RB.$('ev-push') && RB.$('ev-push').checked;
    var r = cur.id ? await sb.from('events').update(data).eq('id', cur.id).select().single() : await sb.from('events').insert(data).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    RB.closeSheet(); RB.toast('Evento salvo ✓');
    if (push) RB.push.notify({ type: 'event', event_id: r.data.id });
    V.render(V.el);
  };
  V.notify = function (id) {
    if (!confirm('Mandar notificação deste evento para todos os alunos?')) return;
    RB.push.notify({ type: 'event', event_id: id }, 'Aviso enviado ✓');
  };
  V.del = async function (id) {
    if (!confirm('Excluir este evento? As confirmações de presença também serão apagadas.')) return;
    var r = await sb.from('events').delete().eq('id', id);
    if (r.error) { RB.toast('Erro ao excluir', false); return; }
    RB.toast('Evento excluído'); V.render(V.el);
  };
})();
