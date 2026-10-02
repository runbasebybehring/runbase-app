// Run Base — mensalidades (só a coach vê): valor e vencimento por aluno, pagamentos do mês
(function () {
  var sb = RB.sb;
  var F = RB.fin = { month: null, billing: {}, pays: {} };
  var esc = function (s) { return RB.esc(s); };
  var MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var METHODS = ['Pix', 'Cartão', 'Transferência', 'Dinheiro'];
  var brl = function (v) { try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0); } catch (e) { return 'R$ ' + (+v || 0).toFixed(2).replace('.', ','); } };
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var today0 = function () { var t = new Date(); t.setHours(0, 0, 0, 0); return t; };

  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  F.shift = function (n) { F.month = new Date(F.month.getFullYear(), F.month.getMonth() + n, 1); F.render(F.el); };
  // situação de um aluno no mês: pago, em dia, vence hoje, atrasado...
  F.status = function (a) {
    var b = F.billing[a.id], p = F.pays[a.id];
    if (p) return { k: 'pago', l: 'Pago ' + RB.fmtDate(p.paid_at + 'T12:00:00'), c: 'g' };
    if (b && b.active === false) return { k: 'off', l: 'Sem cobrança', c: 'm' };
    if (!b || !b.amount || !b.due_day) return { k: 'cfg', l: 'Definir valor e vencimento', c: 'm' };
    var m = F.month, last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var due = new Date(m.getFullYear(), m.getMonth(), Math.min(b.due_day, last));
    var d = Math.round((due - today0()) / 864e5);
    if (d < 0) return { k: 'late', l: 'Atrasado ' + (-d) + (d === -1 ? ' dia' : ' dias'), c: 'r', due: due };
    if (d === 0) return { k: 'today', l: 'Vence hoje', c: 'r', due: due };
    return { k: 'open', l: d <= 7 ? 'Vence em ' + d + (d === 1 ? ' dia' : ' dias') : 'Vence dia ' + due.getDate(), c: d <= 3 ? 'd' : 'b', due: due };
  };

  F.render = async function (el) {
    F.el = el; if (!F.month) F.month = monthStart(new Date());
    el.innerHTML = '<div class="ld"><div class="sp"></div></div>';
    var ref = iso(F.month);
    var r = await Promise.all([sb.from('billing').select('*'), sb.from('payments').select('*').eq('ref_month', ref)]);
    F.billing = {}; (r[0].data || []).forEach(function (b) { F.billing[b.athlete_id] = b; });
    F.pays = {}; (r[1].data || []).forEach(function (p) { F.pays[p.athlete_id] = p; });
    var aths = RB.coach.athletes.slice();
    var rows = aths.map(function (a) { return { a: a, s: F.status(a), b: F.billing[a.id] }; });
    var order = { late: 0, today: 1, open: 2, cfg: 3, pago: 4, off: 5 };
    rows.sort(function (x, y) { return order[x.s.k] - order[y.s.k] || (x.s.due && y.s.due ? x.s.due - y.s.due : 0) || x.a.name.localeCompare(y.a.name); });
    var rec = 0, open = 0, late = 0, nl = 0;
    rows.forEach(function (x) {
      if (x.s.k === 'pago') rec += +(F.pays[x.a.id].amount || 0);
      else if (x.s.k === 'late') { late += +(x.b.amount || 0); nl++; }
      else if (x.s.k === 'open' || x.s.k === 'today') open += +(x.b.amount || 0);
    });
    var active = rows.filter(function (x) { return x.s.k !== 'off'; }), off = rows.filter(function (x) { return x.s.k === 'off'; });
    var row = function (x) {
      var b = x.b, p = F.pays[x.a.id];
      return '<div class="fin-r" onclick="RB.fin.open(\'' + x.a.id + '\')">' + RB.av(x.a.img, 34) + '<div class="fin-t"><b>' + esc(x.a.name) + '</b><span>' +
        (p ? brl(p.amount) + (p.method ? ' · ' + esc(p.method) : '') : b && b.amount ? brl(b.amount) + (b.due_day ? ' · dia ' + b.due_day : '') : '—') + '</span></div>' +
        RB.tag(x.s.l, x.s.c) + (x.s.k === 'late' || x.s.k === 'today' || x.s.k === 'open' ? '<button class="mini" onclick="event.stopPropagation();RB.fin.quickPay(\'' + x.a.id + '\')">Pago</button>' : '') + '</div>';
    };
    el.innerHTML = RB.tt('MENSALIDADES') + '<div class="sub">Só você vê esta tela.</div>' +
      '<div class="fin-m"><button onclick="RB.fin.shift(-1)">‹</button><b>' + MES[F.month.getMonth()] + ' ' + F.month.getFullYear() + '</b><button onclick="RB.fin.shift(1)">›</button></div>' +
      '<div class="card">' + RB.statGrid([{ v: brl(rec).replace(',00', ''), l: 'Recebido', a: true }, { v: brl(open).replace(',00', ''), l: 'A receber' }, { v: brl(late).replace(',00', ''), l: nl ? 'Atrasado (' + nl + ')' : 'Atrasado' }]) + '</div>' +
      (active.length ? '<div class="card fin-list">' + active.map(row).join('') + '</div>' : '') +
      (off.length ? '<details class="fin-off"><summary>Sem cobrança ativa (' + off.length + ')</summary><div class="card fin-list">' + off.map(row).join('') + '</div></details>' : '') +
      '<div class="hint" style="text-align:center;margin-top:8px">Toque no aluno para definir valor e dia de vencimento. Você recebe um aviso no dia do vencimento e quando atrasar 3 dias.</div>';
  };

  F.open = function (id) {
    var a = RB.coach.athletes.find(function (x) { return x.id === id; }), b = F.billing[id] || { active: true }, p = F.pays[id];
    F.cur = a;
    var mes = MES[F.month.getMonth()].toLowerCase();
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Mensalidade') + '<div class="sh-t">' + esc(a.name) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld-l">Pagamento de ' + mes + '</div>' +
      (p ? '<div class="fin-paid">✓ Pago em ' + RB.fmtDate(p.paid_at + 'T12:00:00') + ' · ' + brl(p.amount) + (p.method ? ' · ' + esc(p.method) : '') + '<button class="btn-link danger" onclick="RB.fin.undo()">Desfazer</button></div>'
        : '<div class="calc-r"><div><div class="fld-l">Valor</div><input class="fi" id="fp-v" inputmode="decimal" value="' + (b.amount != null ? String(b.amount).replace('.', ',') : '') + '" placeholder="350"></div>' +
          '<div><div class="fld-l">Data</div><input class="fi" type="date" id="fp-d" value="' + iso(new Date()) + '"></div></div>' +
          '<div class="fld"><div class="fld-l">Forma</div><div class="opts" id="fp-m">' + METHODS.map(function (m, i) { return '<button class="eb' + (i === 0 ? ' sel' : '') + '" onclick="this.parentNode.querySelectorAll(\'.eb\').forEach(function(x){x.classList.remove(\'sel\')});this.classList.add(\'sel\')">' + m + '</button>'; }).join('') + '</div></div>' +
          '<button class="btn btn-r" onclick="RB.fin.pay()">MARCAR COMO PAGO</button>') +
      '<div class="fin-cfg"><div class="fld-l">Cobrança</div>' +
      '<div class="calc-r"><div><div class="fld-l">Valor mensal (R$)</div><input class="fi" id="fb-v" inputmode="decimal" value="' + (b.amount != null ? String(b.amount).replace('.', ',') : '') + '" placeholder="350"></div>' +
      '<div><div class="fld-l">Dia do vencimento</div><input class="fi" id="fb-d" inputmode="numeric" value="' + (b.due_day || '') + '" placeholder="10"></div></div>' +
      '<div class="fld"><div class="fld-l">Observação</div><input class="fi" id="fb-n" value="' + esc(b.notes || '') + '" placeholder="Plano trimestral, desconto..."></div>' +
      '<label class="ck-l big"><input type="checkbox" id="fb-a"' + (b.active !== false ? ' checked' : '') + '> <span><b>Cobrança ativa</b><br>Desmarque para alunos que não pagam mensalidade (pausa, cortesia, parceria).</span></label>' +
      '<button class="btn btn-o" onclick="RB.fin.saveCfg()">SALVAR COBRANÇA</button></div>');
  };
  var num = function (v) { v = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isNaN(v) ? null : v; };
  F.saveCfg = async function () {
    var d = parseInt(RB.$('fb-d').value, 10);
    if (RB.$('fb-d').value && (!(d >= 1) || d > 31)) { RB.toast('Dia entre 1 e 31', false); return; }
    var r = await sb.from('billing').upsert({ athlete_id: F.cur.id, amount: num(RB.$('fb-v').value), due_day: d || null, notes: RB.$('fb-n').value.trim() || null, active: RB.$('fb-a').checked, updated_at: new Date().toISOString() });
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    RB.closeSheet(); RB.toast('Cobrança salva ✓'); F.render(F.el);
  };
  async function savePay(id, amount, date, method) {
    var r = await sb.from('payments').upsert({ athlete_id: id, ref_month: iso(F.month), amount: amount, paid_at: date, method: method }, { onConflict: 'athlete_id,ref_month' });
    if (r.error) { RB.toast('Erro ao salvar', false); return false; }
    return true;
  }
  F.pay = async function () {
    var m = document.querySelector('#fp-m .sel');
    if (await savePay(F.cur.id, num(RB.$('fp-v').value), RB.$('fp-d').value || iso(new Date()), m ? m.textContent : null)) { RB.closeSheet(); RB.toast('Pagamento registrado ✓'); F.render(F.el); }
  };
  F.quickPay = async function (id) {
    var b = F.billing[id] || {};
    if (await savePay(id, b.amount || null, iso(new Date()), 'Pix')) { RB.toast('Pagamento registrado ✓ (Pix, hoje)'); F.render(F.el); }
  };
  F.undo = async function () {
    if (!confirm('Desfazer o pagamento deste mês?')) return;
    await sb.from('payments').delete().eq('athlete_id', F.cur.id).eq('ref_month', iso(F.month));
    RB.closeSheet(); F.render(F.el);
  };
})();
