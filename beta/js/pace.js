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
        (b.zona ? '<span class="zchip" style="--zc:' + RB.esc(z ? z.color : '#999') + '"><b>' + RB.esc(b.zona) + '</b>' + (z ? ' ' + RB.esc(P.show(z.pace)) : '') + '</span>' : '') + '</div>' +
        (b.obs ? '<div class="wbl-o">' + RB.esc(b.obs) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  };

  // calculadora: distância + tempo → pace, ou distância + pace → tempo
  P.calcCard = function () {
    return '<div class="card">' + RB.ew('Calculadora de pace', 'blue') +
      '<div class="calc"><div class="fld-l">Distância</div><div class="calc-d">' + [['5', '5K'], ['10', '10K'], ['21.0975', '21K'], ['42.195', '42K']].map(function (d, i) {
        return '<button class="' + (i === 2 ? 'on' : '') + '" onclick="RB.pace.pickDist(this,\'' + d[0] + '\')">' + d[1] + '</button>';
      }).join('') + '<input class="fi" id="calc-km" inputmode="decimal" value="21.0975" oninput="RB.pace.calc(\'time\')"></div>' +
      '<div class="calc-r"><div><div class="fld-l">Tempo (h:mm:ss)</div><input class="fi" id="calc-time" placeholder="1:59:00" oninput="RB.pace.calc(\'time\')"></div>' +
      '<div><div class="fld-l">Pace (min/km)</div><input class="fi" id="calc-pace" placeholder="5:39" oninput="RB.pace.calc(\'pace\')"></div></div>' +
      '<div class="calc-out" id="calc-out">Preencha o tempo ou o pace.</div></div></div>';
  };
  P.pickDist = function (b, km) {
    b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
    RB.$('calc-km').value = km; P.calc(RB.$('calc-time').value ? 'time' : 'pace');
  };
  var parseHMS = function (s) {
    var p = (s || '').trim().split(':').map(Number);
    if (p.some(isNaN) || !p.length) return null;
    return p.reduce(function (a, x) { return a * 60 + x; }, 0);
  };
  var fmtHMS = function (sec) {
    sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
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
