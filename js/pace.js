// Run Base — pace: zonas do aluno, conversão min/km ↔ km/h, blocos do treino e calculadora
(function () {
  var P = RB.pace = {};
  var UNIT_KEY = 'rb_pace_unit';
  P.unit = function () { try { return localStorage.getItem(UNIT_KEY) || 'min'; } catch (e) { return 'min'; } };
  P.setUnit = function (u) { try { localStorage.setItem(UNIT_KEY, u); } catch (e) {} if (RB.athlete && RB.athlete.tab) RB.athlete.go(RB.athlete.tab); };

  var toSec = function (m, s) { return (+m) * 60 + (+s); };
  var fmtPace = function (sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  var kmh = function (secPerKm) { return (3600 / secPerKm).toFixed(1).replace('.', ','); };

  // converte o texto de pace da zona para a unidade escolhida (mantém o texto original se não entender)
  P.show = function (txt) {
    if (!txt) return '';
    var u = P.unit();
    var isKmh = /km\/h/i.test(txt);
    if (u === 'min' && !isKmh) return txt;
    if (u === 'kmh' && isKmh) return txt;
    if (u === 'kmh') {
      var ms = txt.match(/(\d{1,2}):(\d{2})/g);
      if (!ms) return txt;
      var v = ms.map(function (x) { var p = x.split(':'); return kmh(toSec(p[0], p[1])); });
      // pace mais lento = velocidade menor: inverte a ordem para ficar do menor para o maior
      var pre = /≤|<|abaixo/i.test(txt) ? '≥ ' : (/≥|>|acima/i.test(txt) ? '≤ ' : '');
      return pre + v.reverse().join('–') + ' km/h';
    }
    var ks = txt.match(/\d+(?:[.,]\d+)?/g);
    if (!ks) return txt;
    return ks.map(function (x) { return fmtPace(3600 / parseFloat(x.replace(',', '.'))); }).reverse().join('–') + ' /km';
  };
  P.toggle = function () {
    var u = P.unit();
    return '<div class="unit-t"><button class="' + (u === 'min' ? 'on' : '') + '" onclick="RB.pace.setUnit(\'min\')">min/km</button><button class="' + (u === 'kmh' ? 'on' : '') + '" onclick="RB.pace.setUnit(\'kmh\')">km/h</button></div>';
  };

  // zona pelo número (Z1..Z5) nas zonas do aluno
  P.zone = function (zones, n) {
    return (zones || []).find(function (z) { return new RegExp('^\\s*Z' + n + '\\b', 'i').test(z.zone); }) || null;
  };
  // chips de pace para as zonas citadas na descrição do treino
  P.chips = function (text, zones) {
    if (!zones || !zones.length || !text) return '';
    var seen = {}, out = [];
    (text.match(/\bZ\s?([1-5])\b/gi) || []).forEach(function (m) {
      var n = m.replace(/\D/g, ''); if (seen[n]) return; seen[n] = 1;
      var z = P.zone(zones, n); if (!z) return;
      out.push('<span class="zchip" style="--zc:' + RB.esc(z.color) + '"><b>Z' + n + '</b> ' + RB.esc(P.show(z.pace)) + '</span>');
    });
    return out.length ? '<div class="zchips">' + out.join('') + '</div>' : '';
  };

  // blocos do treino (workouts.structure): [{fase, reps, vol, zona, obs}]
  P.FASES = { aquec: 'Aquecimento', principal: 'Principal', rec: 'Recuperação', desaq: 'Desaquecimento' };
  P.blocks = function (structure, zones) {
    if (!structure || !structure.length) return '';
    return '<div class="wblocks">' + structure.map(function (b) {
      var z = b.zona ? P.zone(zones, String(b.zona).replace(/\D/g, '')) : null;
      return '<div class="wbl wbl-' + RB.esc(b.fase || 'principal') + '"><div class="wbl-f">' + RB.esc(P.FASES[b.fase] || 'Principal') + '</div>' +
        '<div class="wbl-m"><span class="wbl-v">' + (b.reps ? RB.esc(b.reps) + '× ' : '') + RB.esc(b.vol || '') + '</span>' +
        (b.pace ? '<span class="zchip pace"><b>PACE</b> ' + RB.esc(P.show(b.pace)) + '</span>' :
          (b.zona ? '<span class="zchip" style="--zc:' + RB.esc(z ? z.color : '#999') + '"><b>' + RB.esc(b.zona + (b.zona2 ? '–' + b.zona2 : '')) + '</b>' + (z && !b.zona2 ? ' ' + RB.esc(P.show(z.pace)) : '') + '</span>' : '')) + '</div>' +
        (b.pace && b.zona ? '<div class="wbl-o">' + RB.esc(b.zona) + (z ? ' · ' + RB.esc(P.show(z.pace)) : '') + '</div>' : '') +
        (b.obs ? '<div class="wbl-o">' + RB.esc(b.obs) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  };

  // ---- leitura automática das descrições antigas: "2km aquece + 6x1000m a 4:25–4:35 (recupera 400m trote) + 2km desaquece. Total: ~13km."
  var RX_PACE = /(?:\bpace\s+(?:de\s+)?)?(?:\ba\s+)?(\d{1,2}:\d{2})(?:\s*[–-]\s*(\d{1,2}:\d{2}))?\s*(?:\/\s*km|min\/km)?/i;
  var RX_VOL = /(\d+(?:[.,]\d+)?)\s*(km|k|m|min|'|s|"|h)(?![a-zà-ú\/])/i;
  var RX_ZONE = /\bZ\s?([1-5])(?:\s*[–-]\s*Z?\s?([1-5]))?\b/i;
  var RX_START = /^(\d|Z\s?\d|\(|aquec|desaquec|caminhada|trote|leve|últimos)/i;
  function tidy(t) {
    return t.replace(/\(\s*[,;]\s*/g, '(').replace(/\s*[,;]\s*\)/g, ')').replace(/\(\s*\)/g, '').replace(/\s+([,.;)])/g, '$1')
      .replace(/\s{2,}/g, ' ').replace(/^[\s,;:·—–-]+|[\s,;:·—–-]+$/g, '').replace(/^\(([^()]*)\)$/, '$1').trim();
  }
  function seg(raw) {
    var t = raw.trim().replace(/\.$/, ''), b = { fase: 'principal' };
    if (/desaquec|desaq\b|volta à calma/i.test(t)) b.fase = 'desaq';
    else if (/aquec/i.test(t)) b.fase = 'aquec';
    var m = t.match(/^(\d+)\s*x\s*:?\s*/i) || t.match(/^(\d+)\s+(?=(acelera|strides?|tiros?|educativos?|retas?)\b)/i);
    if (m) { b.reps = m[1]; t = t.slice(m[0].length); }
    t = t.replace(/^\(([^()]*)\)$/, '$1');
    m = t.match(RX_VOL);
    if (m) {
      var u = m[2].toLowerCase(); u = u === "'" ? 'min' : u === '"' ? 's' : u === 'k' ? 'km' : u;
      var n = /^\d{1,2}\.\d{3}$/.test(m[1]) ? m[1].replace('.', '') : m[1].replace('.', ',');
      b.vol = n + u; t = t.replace(m[0], ' ');
    }
    m = t.match(RX_ZONE);
    if (m) { b.zona = 'Z' + m[1]; if (m[2]) b.zona2 = 'Z' + m[2]; t = t.replace(m[0], ' '); }
    m = t.match(RX_PACE);
    if (m) { b.pace = m[1] + (m[2] ? '–' + m[2] : '') + ' /km'; t = t.replace(m[0], ' '); }
    t = t.replace(/\b(aquecimento|aquece|aquecer|desaquecimento|desaquece|desaquecer)\b/gi, ' ').replace(/\s+de\s*$/i, '').replace(/\bde\s+(?=\s|$)/i, ' ').replace(/\s+em\s*$/i, '').replace(/^\s*em\s+/i, '');
    b.obs = tidy(t);
    return b;
  }
  P.parse = function (desc) {
    if (!desc || desc.indexOf(' + ') < 0) return null;
    var d = desc.trim(), total = '', intro = '', outro = '', notes = [];
    var tm = d.match(/\s*Total:?\s*([^.]*?)\.?\s*$/i) || d.match(/\s*·\s*(~?\d+(?:[.,]\d+)?\s*km)\s*$/i);
    if (tm) { total = tm[1].trim(); d = d.slice(0, tm.index).trim(); }
    // "10km: 2km leve + ..." / "18km — 13km Z2 + ..."
    var hm = d.match(/^(\d+(?:[.,]\d+)?\s*km[^:—+]{0,12}?)\s*(?::|—)\s+/i);
    if (hm) { if (!total) total = hm[1].trim(); d = d.slice(hm[0].length); }
    // separa nos " + " que não estão dentro de parênteses
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < d.length; i++) {
      var ch = d[i];
      if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && d.substr(i, 3) === ' + ') { parts.push(cur); cur = ''; i += 2; continue; }
      cur += ch;
    }
    parts.push(cur);
    if (parts.length < 2) return null;
    var f = parts[0].match(/^(.*[.!])\s+(\S[\s\S]*)$/);
    if (f) { intro = f[1].trim(); parts[0] = f[2]; }
    var l = parts[parts.length - 1].match(/^([\s\S]*?)\.\s+([A-ZÀ-Ú][\s\S]*)$/);
    if (l) { parts[parts.length - 1] = l[1]; outro = l[2].trim(); }
    var blocks = [];
    parts.forEach(function (p) { if (RX_START.test(p.trim())) blocks.push(seg(p)); else notes.push(p.trim().replace(/\.$/, '')); });
    if (blocks.length < 2) return null;
    // "10' leve + ... + 10' leve": primeiro e último leves viram aquecimento e desaquecimento
    if (blocks.length >= 3) {
      var easy = function (b) { return !b.reps && (/^(leve|trote)/i.test(b.obs || '') || b.zona === 'Z1'); };
      if (blocks[0].fase === 'principal' && easy(blocks[0])) blocks[0].fase = 'aquec';
      var z = blocks[blocks.length - 1];
      if (z.fase === 'principal' && easy(z)) z.fase = 'desaq';
    }
    if (notes.length) outro = notes.join(' · ') + (outro ? '. ' + outro : '');
    return { intro: intro, blocks: blocks, outro: outro, total: total };
  };
  // corpo do treino: blocos do coach, ou blocos lidos da descrição, ou texto + pace das zonas citadas
  P.workout = function (d, zones) {
    if (d.structure && d.structure.length) return '<div class="dr-t">' + RB.esc(d.description) + '</div>' + P.blocks(d.structure, zones);
    var p = P.parse(d.description);
    if (!p) return '<div class="dr-t">' + RB.esc(d.description) + '</div>' + P.chips(d.description, zones);
    return (p.intro ? '<div class="dr-t">' + RB.esc(p.intro) + '</div>' : '') + P.blocks(p.blocks, zones) +
      ((p.outro || p.total) ? '<div class="wbl-total">' + RB.esc(p.outro) + (p.outro && p.total ? ' · ' : '') + (p.total ? 'Total: ' + RB.esc(p.total) : '') + '</div>' : '');
  };

  // calculadora: distância + tempo → pace, ou distância + pace → tempo
  P.calcCard = function () {
    return '<div class="card">' + RB.ew('Calculadora de pace', 'blue') +
      '<div class="calc"><div class="fld-l">Distância</div><div class="calc-d">' + [['5', '5K'], ['10', '10K'], ['21.0975', '21K'], ['42.195', '42K']].map(function (d, i) {
        return '<button class="' + (i === 2 ? 'on' : '') + '" onclick="RB.pace.pickDist(this,\'' + d[0] + '\')">' + d[1] + '</button>';
      }).join('') + '<input class="fi" id="calc-km" inputmode="decimal" value="21.0975" oninput="RB.pace.calc(\'time\')"></div>' +
      '<div class="calc-r"><div><div class="fld-l">Tempo (h:mm:ss)</div><input class="fi" id="calc-time" inputmode="numeric" placeholder="1:59:00" oninput="RB.pace.mask(this);RB.pace.calc(\'time\')"></div>' +
      '<div><div class="fld-l">Pace (min/km)</div><input class="fi" id="calc-pace" inputmode="numeric" placeholder="5:39" oninput="RB.pace.mask(this,4);RB.pace.calc(\'pace\')"></div></div>' +
      '<div class="calc-out" id="calc-out">Preencha o tempo ou o pace.</div></div></div>';
  };
  P.pickDist = function (b, km) {
    b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
    RB.$('calc-km').value = km; P.calc(RB.$('calc-time').value ? 'time' : 'pace');
  };
  var parseHMS = function (s) {
    s = String(s || '').trim().replace(/[.,;h]/g, ':').replace(/[^0-9:]/g, '');
    // só números (teclado numérico do celular): 5230 → 52:30, 10530 → 1:05:30
    if (s.indexOf(':') < 0 && s.length >= 3) s = maskDigits(s, 6);
    if (!s) return null;
    var p = s.split(':').map(Number);
    if (p.some(isNaN) || !p.length) return null;
    return p.reduce(function (a, x) { return a * 60 + x; }, 0);
  };
  var fmtHMS = function (sec) {
    sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  // máscara de tempo: o aluno digita só números e os ":" entram sozinhos
  function maskDigits(d, max) {
    d = String(d).replace(/\D/g, '').slice(0, max || 6);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, -2) + ':' + d.slice(-2);
    return d.slice(0, -4) + ':' + d.slice(-4, -2) + ':' + d.slice(-2);
  }
  P.mask = function (el, max) {
    var prev = el.dataset.d || '', d = el.value.replace(/\D/g, '').slice(0, max || 6);
    // apagar um ":" apaga o número antes dele
    if (d === prev && el.value.length < (el.dataset.v || '').length) d = d.slice(0, -1);
    var v = maskDigits(d, max);
    el.value = v; el.dataset.d = d; el.dataset.v = v;
  };
  // km: aceita "10,5", "10.5", "10,5 km"; ignora o resto
  P.kmMask = function (el) {
    var v = el.value.replace(/[^0-9.,]/g, '').replace('.', ',');
    var i = v.indexOf(','); if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '').slice(0, 2);
    el.value = v;
  };
  // tempo em 3 caixinhas (h / min / seg): sem ":" e sem ambiguidade no teclado numérico
  P.timeFields = function (id, onchange) {
    var box = function (suf, ph, lbl, max) { return '<label class="tf-b"><input class="fi" id="' + id + '-' + suf + '" inputmode="numeric" maxlength="' + max + '" placeholder="' + ph + '" oninput="this.value=this.value.replace(/\\D/g,\'\');' + (onchange || '') + '"><span>' + lbl + '</span></label>'; };
    return '<div class="tf">' + box('h', '0', 'h', 2) + box('m', '52', 'min', 3) + box('s', '30', 'seg', 2) + '</div>';
  };
  P.readTime = function (id) {
    var v = function (suf) { var e = RB.$(id + '-' + suf); return e ? parseInt(e.value, 10) || 0 : 0; };
    var t = v('h') * 3600 + v('m') * 60 + v('s');
    return t > 0 ? t : null;
  };
  P.parseHMS = parseHMS; P.fmtHMS = fmtHMS; P.fmtPace = fmtPace; P.kmh = kmh;
  // "10,5" → 10.5
  P.km = function (s) { var v = parseFloat(String(s || '').replace(',', '.')); return v > 0 ? v : null; };
  P.fmtKm = function (v) { return (Math.round(v * 100) / 100).toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, '').replace('.', ','); };
  // resumo de um feedback com distância/tempo
  P.summary = function (f) {
    if (!f || !f.distance_km) return '';
    var out = [P.fmtKm(+f.distance_km) + ' km'];
    if (f.duration_sec) { out.push(fmtHMS(f.duration_sec)); out.push(fmtPace(f.duration_sec / f.distance_km) + ' /km'); }
    return out.join(' · ');
  };
  P.calc = function (from) {
    var km = parseFloat((RB.$('calc-km').value || '').replace(',', '.')), out = RB.$('calc-out');
    if (!km) { out.textContent = 'Informe a distância.'; return; }
    if (from === 'time') {
      var t = parseHMS(RB.$('calc-time').value); if (!t) { out.textContent = 'Preencha o tempo ou o pace.'; return; }
      var p = t / km; RB.$('calc-pace').value = fmtPace(p);
      out.innerHTML = 'Pace <b>' + fmtPace(p) + ' /km</b> · ' + kmh(p) + ' km/h';
    } else {
      var ps = parseHMS(RB.$('calc-pace').value); if (!ps) { out.textContent = 'Preencha o tempo ou o pace.'; return; }
      RB.$('calc-time').value = fmtHMS(ps * km);
      out.innerHTML = 'Tempo final <b>' + fmtHMS(ps * km) + '</b> · ' + kmh(ps) + ' km/h';
    }
  };
})();
