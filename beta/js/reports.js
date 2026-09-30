// Run Base — relatório mensal: números automáticos, visualização, editor do coach e PDF
(function () {
  var sb = RB.sb;
  var R = RB.reports = {};

  R.monthRange = function (period) {
    var d = new Date(period + 'T12:00:00');
    var s = new Date(d.getFullYear(), d.getMonth(), 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    var iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01'; };
    return { start: iso(s), end: iso(e), label: RB.MES[s.getMonth()] + ' ' + s.getFullYear() };
  };
  R.periodLabel = function (period) { return R.monthRange(period).label; };

  // ---------- números do mês, direto dos feedbacks ----------
  R.autoStats = async function (athleteId, period) {
    var m = R.monthRange(period);
    var fr = await sb.from('feedbacks').select('id,rpe,energia,sono,fadiga,dor,comment,performed_at,created_at,workout_id,kind,strength_day,completion,load_trend,pain_exercises,workouts(week_id,type,day_label)')
      .eq('athlete_id', athleteId).gte('performed_at', m.start).lt('performed_at', m.end).order('performed_at');
    var fbs = fr.data || [];
    var gr = await sb.from('gym_logs').select('created_at').eq('athlete_id', athleteId).gte('created_at', m.start).lt('created_at', m.end);
    var gymDays = {};
    (gr.data || []).forEach(function (g) { gymDays[g.created_at.slice(0, 10)] = 1; });
    var weekIds = {};
    fbs.forEach(function (f) { if (f.workouts && f.workouts.week_id) weekIds[f.workouts.week_id] = 1; });
    var planned = 0, done = 0;
    var wids = Object.keys(weekIds).map(Number);
    if (wids.length) {
      var wr = await sb.from('workouts').select('id').in('week_id', wids);
      var ids = (wr.data || []).map(function (w) { return w.id; });
      planned = ids.length;
      var dr = await sb.from('feedbacks').select('workout_id').in('workout_id', ids.length ? ids : [-1]);
      var seen = {}; (dr.data || []).forEach(function (x) { seen[x.workout_id] = 1; });
      done = Object.keys(seen).length;
    }
    var count = function (key, opts) {
      var o = {}; opts.forEach(function (k) { o[k] = 0; });
      fbs.forEach(function (f) { if (f[key] && o[f[key]] !== undefined) o[f[key]]++; });
      return o;
    };
    var rpes = fbs.filter(function (f) { return f.rpe; });
    var str = fbs.filter(function (f) { return f.kind === 'strength'; });
    var strR = str.filter(function (f) { return f.rpe; });
    var pains = {}; str.forEach(function (f) { (f.pain_exercises || []).forEach(function (e) { pains[e] = (pains[e] || 0) + 1; }); });
    return {
      month: m.label,
      n: fbs.length,
      rpe_avg: rpes.length ? Math.round(rpes.reduce(function (a, f) { return a + f.rpe; }, 0) / rpes.length * 10) / 10 : null,
      rpe: rpes.map(function (f) { return { d: f.performed_at || f.created_at, v: f.rpe, label: f.kind === 'strength' ? 'Força' : (f.workouts ? f.workouts.type : '') }; }),
      strength: str.length ? {
        n: str.length,
        rpe_avg: strR.length ? Math.round(strR.reduce(function (a, f) { return a + f.rpe; }, 0) / strR.length * 10) / 10 : null,
        completion: { 'sim': str.filter(function (f) { return f.completion === 'sim'; }).length, 'parcial': str.filter(function (f) { return f.completion === 'parcial'; }).length, 'não': str.filter(function (f) { return f.completion === 'não'; }).length },
        subiu: str.filter(function (f) { return f.load_trend === 'subiu'; }).length,
        pain: pains
      } : null,
      adesao: planned ? Math.round(done / planned * 100) : null,
      planned: planned, done: done,
      dor: fbs.filter(function (f) { return f.dor; }).length,
      sono: count('sono', ['ruim', 'ok', 'bom', 'ótimo']),
      energia: count('energia', ['péssima', 'ruim', 'ok', 'boa', 'ótima']),
      fadiga: count('fadiga', ['leves', 'normais', 'pesadas', 'muito pesadas']),
      gym_days: Object.keys(gymDays).length,
      comments: fbs.filter(function (f) { return f.comment; }).map(function (f) { return f.comment; }).slice(0, 12)
    };
  };

  var COLORS = {
    sono: { 'ruim': '#B71C1C', 'ok': '#F9A825', 'bom': '#2E7D32', 'ótimo': '#1565C0' },
    energia: { 'péssima': '#B71C1C', 'ruim': '#E65100', 'ok': '#F9A825', 'boa': '#558B2F', 'ótima': '#2E7D32' },
    fadiga: { 'leves': '#2E7D32', 'normais': '#F9A825', 'pesadas': '#E65100', 'muito pesadas': '#B71C1C' }
  };
  R.distRows = function (obj, key) {
    return Object.keys(obj).map(function (k) { return { l: k, n: obj[k], c: COLORS[key][k] }; });
  };
  R.autoTiles = function (a) {
    return [
      { v: String(a.n), l: 'Treinos', s: a.planned ? 'de ' + a.planned + ' planejados' : 'com feedback' },
      { v: a.adesao != null ? a.adesao + '%' : '—', l: 'Adesão', s: 'nas semanas do mês' },
      { v: a.rpe_avg != null ? String(a.rpe_avg).replace('.', ',') : '—', l: 'RPE médio', s: a.dor ? a.dor + ' treino(s) com dor' : 'sem dor relatada' }
    ];
  };

  // ---------- visualização ----------
  var tiles = function (stats) {
    return '<div class="rsg">' + stats.map(function (s) {
      return '<div class="rst"><div class="rsv">' + RB.esc(s.v) + '</div><div class="rsl">' + RB.esc(s.l) + '</div><div class="rss">' + RB.esc(s.s || '') + '</div></div>';
    }).join('') + '</div>';
  };
  R.numbersBlock = function (a, withTiles) {
    if (!a || !a.n) return '';
    return RB.ew('O mês em números') + (withTiles ? tiles(R.autoTiles(a)) : '') +
      '<div class="card">' + RB.ew('Esforço percebido (RPE) por treino', 'mid') +
      RB.lineChart(a.rpe, { aria: 'RPE por treino no mês', band: [3, 6] }) +
      '<div class="ch-note">Faixa clara = zona de treino confortável a moderada (RPE 3–6)</div></div>' +
      '<div class="rig2"><div class="card">' + RB.ew('Sono', 'mid') + RB.barList(R.distRows(a.sono, 'sono')) + '</div>' +
      '<div class="card">' + RB.ew('Energia', 'mid') + RB.barList(R.distRows(a.energia, 'energia')) + '</div></div>' +
      R.strengthBlock(a.strength);
  };
  R.strengthBlock = function (s) {
    if (!s || !s.n) return '';
    var pains = Object.keys(s.pain || {});
    return '<div class="card">' + RB.ew('Treino de força', 'mid') +
      '<div class="str-g"><div><b>' + s.n + '</b><span>sessões</span></div><div><b>' + (s.rpe_avg != null ? String(s.rpe_avg).replace('.', ',') : '—') + '</b><span>RPE médio</span></div><div><b>' + s.subiu + '</b><span>vezes subiu carga</span></div></div>' +
      RB.barList([{ l: 'completou', n: s.completion['sim'], c: '#2E7D32' }, { l: 'parcial', n: s.completion['parcial'], c: '#F9A825' }, { l: 'não', n: s.completion['não'], c: '#B71C1C' }]) +
      (pains.length ? '<div class="str-pain">⚠ Desconforto em: ' + pains.map(function (p) { return RB.esc(p) + (s.pain[p] > 1 ? ' (' + s.pain[p] + 'x)' : ''); }).join(', ') + '</div>' : '') + '</div>';
  };
  R.view = function (r, opts) {
    opts = opts || {};
    var a = r.auto_stats;
    var badges = (r.badges || []).map(function (b) { return '<span class="rb2 ' + RB.esc(b.c || 'b') + '">' + RB.esc(b.t) + '</span>'; }).join('');
    var stats = (r.stats && r.stats.length) ? r.stats : (a && a.n ? R.autoTiles(a) : []);
    var hl = (r.highlights || []).filter(function (i) { return i.t || i.x; });
    var html = '<div class="report" id="report-view">' +
      '<div class="rep-head"><div class="rep-eyebrow">' + RB.esc(r.title) + (r.objective ? ' · ' + RB.esc(r.objective) : '') + '</div>' +
      RB.tt('RELATÓRIO MENSAL') + (opts.athleteName ? '<div class="rep-name">' + RB.esc(opts.athleteName) + '</div>' : '') +
      '<div style="margin-bottom:4px">' + badges + '</div></div>' +
      (stats.length ? tiles(stats) : '') +
      (r.summary ? RB.ew('Resumo do mês') + '<div class="rs">' + RB.md(r.summary) + '</div>' : '') +
      R.numbersBlock(a, !!(r.stats && r.stats.length)) +
      ((r.progress || []).length ? RB.ew('Análise') + '<div style="margin-bottom:16px">' + RB.progress(r.progress) + '</div>' : '') +
      (hl.length ? RB.ew('Destaques') + '<div class="rig">' + hl.map(function (i) {
        return '<div class="ri ' + RB.esc(i.cls || 'note') + '"><div class="ri-t">' + RB.esc(i.t) + '</div><p>' + RB.md(i.x) + '</p></div>';
      }).join('') + '</div>' : '') +
      (r.coach_note ? RB.ew('Nota do coach') + '<div class="rcn"><p>' + RB.md(r.coach_note) + '</p><div class="rcn-s">— Run Base by Behring · ' + RB.esc(R.periodLabel(r.period)) + '</div></div>' : '') +
      '</div>';
    if (!opts.noPdf) html += '<button class="btn btn-o no-print" onclick="RB.reports.print()">⤓ BAIXAR PDF</button>';
    return html;
  };
  R.print = function () {
    var src = RB.$('report-view'); if (!src) return;
    var root = RB.$('print-root');
    root.innerHTML = '<div class="print-brand">RUN<span>BASE</span> <span style="font-size:14px;color:var(--mid);font-style:normal;font-weight:400;font-family:Space Mono,monospace">by behring</span></div>' + src.innerHTML;
    root.querySelectorAll('.rpf[data-w]').forEach(function (b) { b.style.width = b.dataset.w + '%'; });
    document.body.classList.add('print-report');
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove('print-report'); root.innerHTML = ''; }, 500);
    }, 80);
  };

  // ---------- editor do coach ----------
  var ed = null; // { athlete, report }
  var HL_TYPES = [['highlight', '★ Destaque'], ['alert', '⚠ Atenção'], ['note', '↗ Observação'], ['next', '→ Próximo passo']];

  R.list = async function (athlete, el) {
    var res = await sb.from('reports').select('id,period,title,status,published_at,seen_at,updated_at').eq('athlete_id', athlete.id).order('period', { ascending: false }).order('created_at', { ascending: false });
    var rows = res.data || [];
    el.innerHTML = '<button class="btn btn-r" style="margin:0 0 14px" onclick="RB.reports.newFor()">+ NOVO RELATÓRIO</button>' +
      (rows.length ? rows.map(function (r) {
        var st = r.status === 'published'
          ? RB.tag(r.seen_at ? 'lido pelo aluno' : 'publicado', r.seen_at ? 'g' : 'b')
          : RB.tag('rascunho', 'm');
        return '<div class="ar" onclick="RB.reports.edit(\'' + r.id + '\')"><div style="flex:1;min-width:0"><div class="ar-n">' + RB.esc(r.title) + '</div>' +
          '<div class="ar-s">' + RB.esc(R.periodLabel(r.period)) + ' · editado ' + RB.ago(r.updated_at) + '</div></div>' + st + '<div class="chev">›</div></div>';
      }).join('') : RB.empty('Nenhum relatório ainda.'));
    ed = { athlete: athlete, listEl: el };
  };

  R.newFor = async function () {
    var now = new Date();
    // até o dia 10, sugere o mês anterior (fechamento); depois, o mês corrente
    var d = now.getDate() <= 10 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    var period = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    var a = ed.athlete;
    var auto = await R.autoStats(a.id, period);
    R.openEditor({
      athlete_id: a.id, period: period, title: R.periodLabel(period), objective: a.goal || '',
      badges: [], stats: [], auto_stats: auto, summary: '', progress: [], highlights: [], coach_note: '', status: 'draft'
    });
  };
  R.edit = async function (id) {
    var res = await sb.from('reports').select('*').eq('id', id).single();
    if (res.error) { RB.toast('Erro ao abrir', false); return; }
    R.openEditor(res.data);
  };

  function field(label, inner) { return '<div class="fld"><div class="fld-l">' + label + '</div>' + inner + '</div>'; }
  function inp(id, v, ph) { return '<input class="fi" id="' + id + '" value="' + RB.esc(v || '') + '" placeholder="' + RB.esc(ph || '') + '">'; }
  function area(id, v, rows, ph) { return '<textarea class="ft" id="' + id + '" rows="' + rows + '" placeholder="' + RB.esc(ph || '') + '">' + RB.esc(v || '') + '</textarea>'; }

  R.openEditor = function (r) {
    ed.report = r;
    var a = r.auto_stats;
    var hl = (r.highlights || []).slice(); while (hl.length < 4) hl.push({ cls: 'note', t: '', x: '' });
    var pr = (r.progress || []).slice(); while (pr.length < 4) pr.push({ l: '', v: '', w: '' });
    var st = (r.stats || []).slice(); while (st.length < 3) st.push({ v: '', l: '', s: '' });
    var html =
      '<div class="sh-top"><div>' + RB.ew(r.id ? 'Editar relatório' : 'Novo relatório') + '<div class="sh-t">' + RB.esc(ed.athlete.name) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="ed-row">' + field('Mês de referência', '<input type="month" class="fi" id="r-period" value="' + r.period.slice(0, 7) + '" onchange="RB.reports.changePeriod()">') + '</div>' +
      '<div class="ed-auto" id="r-auto">' + autoSummary(a) + '</div>' +
      '<div class="ai-box"><button class="btn btn-b" id="ai-btn" onclick="RB.reports.ai()">✦ ESCREVER COM IA</button><div class="ai-t">A IA lê os treinos e feedbacks do mês e preenche resumo, destaques e nota. Você revisa antes de publicar.</div></div>' +
      field('Título', inp('r-title', r.title, 'Setembro 2026')) +
      field('Objetivo', inp('r-objective', r.objective, '21K · 18/10 — Sub 2h10')) +
      field('Selos <span class="hint">separados por vírgula</span>', inp('r-badges', (r.badges || []).map(function (b) { return b.t; }).join(', '), '✓ Todos os treinos, 21K 18/10')) +
      field('Resumo do mês <span class="hint">**negrito** funciona</span>', area('r-summary', r.summary, 5, 'Como foi o mês...')) +
      field('Destaques', hl.map(function (h, i) {
        return '<div class="hl-ed"><select class="fi sel" id="r-hl-c' + i + '">' + HL_TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (h.cls === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
          inp('r-hl-t' + i, h.t, 'Título') + area('r-hl-x' + i, h.x, 2, 'Texto') + '</div>';
      }).join('')) +
      field('Nota do coach', area('r-note', r.coach_note, 4, 'Mensagem pessoal para o aluno...')) +
      '<details class="adv"><summary>Números e barras manuais (opcional)</summary>' +
      '<div class="hint" style="margin:8px 0">Se deixar em branco, o relatório mostra os números automáticos do mês.</div>' +
      field('Números em destaque', st.map(function (s, i) {
        return '<div class="st-ed">' + inp('r-st-v' + i, s.v, 'Valor') + inp('r-st-l' + i, s.l, 'Rótulo') + inp('r-st-s' + i, s.s, 'Detalhe') + '</div>';
      }).join('')) +
      field('Barras de análise', pr.map(function (p, i) {
        return '<div class="st-ed">' + inp('r-pr-l' + i, p.l, 'Item') + inp('r-pr-v' + i, p.v, 'Texto') + '<input class="fi" type="number" min="0" max="100" id="r-pr-w' + i + '" value="' + RB.esc(p.w) + '" placeholder="%">' + '</div>';
      }).join('')) + '</details>' +
      '<div class="ed-actions"><button class="btn btn-o" onclick="RB.reports.preview()">PRÉ-VISUALIZAR</button>' +
      '<button class="btn btn-o" onclick="RB.reports.save(\'draft\')">SALVAR RASCUNHO</button>' +
      '<button class="btn btn-r" onclick="RB.reports.save(\'published\')">' + (r.status === 'published' ? 'ATUALIZAR PUBLICADO' : 'PUBLICAR PARA O ALUNO') + '</button>' +
      (r.id ? '<button class="btn-link danger" onclick="RB.reports.remove()">Excluir relatório</button>' : '') + '</div>';
    RB.openSheet(html);
  };
  function autoSummary(a) {
    if (!a) return '<div class="muted-s">Sem números automáticos.</div>';
    if (!a.n) return '<div class="muted-s">Nenhum feedback registrado em ' + RB.esc(a.month) + '.</div>';
    return '<div class="ed-auto-t">Números automáticos · ' + RB.esc(a.month) + '</div><div class="ed-auto-g">' +
      R.autoTiles(a).map(function (t) { return '<div><b>' + RB.esc(t.v) + '</b><span>' + RB.esc(t.l) + '</span></div>'; }).join('') + '</div>' +
      (a.strength ? '<div class="ed-auto-s">Força: ' + a.strength.n + ' sessões · RPE ' + (a.strength.rpe_avg != null ? String(a.strength.rpe_avg).replace('.', ',') : '—') + '</div>' : '');
  }
  R.changePeriod = async function () {
    var v = RB.$('r-period').value; if (!v) return;
    var period = v + '-01';
    RB.$('r-auto').innerHTML = '<div class="muted-s">calculando...</div>';
    var a = await R.autoStats(ed.athlete.id, period);
    ed.report.period = period; ed.report.auto_stats = a;
    RB.$('r-auto').innerHTML = autoSummary(a);
    var t = RB.$('r-title'); if (!t.value || /^[A-Za-zç]+ \d{4}$/.test(t.value)) t.value = R.periodLabel(period);
  };
  function collect() {
    var r = ed.report, val = function (id) { var e = RB.$(id); return e ? e.value.trim() : ''; };
    var out = {
      athlete_id: ed.athlete.id,
      period: (val('r-period') || r.period.slice(0, 7)) + '-01',
      title: val('r-title') || R.periodLabel(r.period),
      objective: val('r-objective') || null,
      badges: val('r-badges') ? val('r-badges').split(',').map(function (t, i) { t = t.trim(); return t ? { t: t, c: ['r', 'b', 'g'][i % 3] } : null; }).filter(Boolean) : [],
      summary: val('r-summary') || null,
      coach_note: val('r-note') || null,
      auto_stats: r.auto_stats || null,
      highlights: [0, 1, 2, 3].map(function (i) { return { cls: val('r-hl-c' + i), t: val('r-hl-t' + i), x: val('r-hl-x' + i) }; }).filter(function (h) { return h.t || h.x; }),
      stats: [0, 1, 2].map(function (i) { return { v: val('r-st-v' + i), l: val('r-st-l' + i), s: val('r-st-s' + i) }; }).filter(function (s) { return s.v; }),
      progress: [0, 1, 2, 3].map(function (i) { return { l: val('r-pr-l' + i), v: val('r-pr-v' + i), w: Math.max(0, Math.min(100, +val('r-pr-w' + i) || 0)), c: ['#2E7D32', '#2B4EAA', '#C41731', '#2E7D32'][i] }; }).filter(function (p) { return p.l; })
    };
    // mantém as cores originais das barras já existentes
    (r.progress || []).forEach(function (p, i) { if (out.progress[i] && p.c) out.progress[i].c = p.c; });
    (r.badges || []).forEach(function (b, i) { if (out.badges[i] && out.badges[i].t === b.t) out.badges[i].c = b.c; });
    return out;
  }
  R.preview = function () {
    var data = collect();
    var box = document.createElement('div');
    box.className = 'preview-overlay';
    box.innerHTML = '<div class="preview-bar"><span>Como o aluno vai ver</span><button onclick="this.closest(\'.preview-overlay\').remove()">Fechar ✕</button></div><div class="preview-body">' + R.view(data, { noPdf: true }) + '</div>';
    document.body.appendChild(box);
  };
  R.save = async function (status) {
    var data = collect();
    data.status = status;
    data.updated_at = new Date().toISOString();
    if (status === 'published' && ed.report.status !== 'published') data.published_at = data.updated_at;
    var res = ed.report.id
      ? await sb.from('reports').update(data).eq('id', ed.report.id).select().single()
      : await sb.from('reports').insert(data).select().single();
    if (res.error) { RB.toast('Erro ao salvar', false); return; }
    ed.report = res.data;
    RB.toast(status === 'published' ? 'Publicado para o aluno ✓' : 'Rascunho salvo ✓');
    RB.closeSheet();
    if (ed.listEl && document.body.contains(ed.listEl)) R.list(ed.athlete, ed.listEl);
  };
  R.remove = async function () {
    if (!confirm('Excluir este relatório? Não dá para desfazer.')) return;
    var res = await sb.from('reports').delete().eq('id', ed.report.id);
    if (res.error) { RB.toast('Erro ao excluir', false); return; }
    RB.toast('Relatório excluído');
    RB.closeSheet();
    if (ed.listEl) R.list(ed.athlete, ed.listEl);
  };
  R.ai = async function () {
    var btn = RB.$('ai-btn');
    btn.disabled = true; btn.textContent = 'ESCREVENDO...';
    var period = (RB.$('r-period').value || ed.report.period.slice(0, 7)) + '-01';
    try {
      var res = await sb.functions.invoke('generate-report', { body: { athlete_id: ed.athlete.id, period: period } });
      if (res.error) throw res.error;
      var d = res.data || {};
      if (d.error === 'not_configured') { RB.toast('IA ainda não configurada', false); return; }
      if (d.error) throw new Error(d.error);
      if (d.summary) RB.$('r-summary').value = d.summary;
      if (d.coach_note) RB.$('r-note').value = d.coach_note;
      if (d.badges && d.badges.length) RB.$('r-badges').value = d.badges.join(', ');
      (d.highlights || []).slice(0, 4).forEach(function (h, i) {
        RB.$('r-hl-c' + i).value = h.cls || 'note'; RB.$('r-hl-t' + i).value = h.t || ''; RB.$('r-hl-x' + i).value = h.x || '';
      });
      RB.toast('Texto gerado — revise antes de publicar');
    } catch (e) {
      var msg = String((e && e.message) || e);
      RB.toast(/not_configured|404|FunctionsHttpError|Failed to send/i.test(msg) ? 'IA ainda não configurada' : 'Não deu para gerar agora', false);
    } finally {
      btn.disabled = false; btn.textContent = '✦ ESCREVER COM IA';
    }
  };
})();
