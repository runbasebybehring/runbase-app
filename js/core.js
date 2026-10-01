// Run Base — utilitários, login e navegação
(function () {
  var S = RB.state = { user: null, isCoach: false };
  var sb = RB.sb;

  // ---------- texto ----------
  RB.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  // texto simples com **negrito** e quebras de linha
  RB.md = function (s) {
    return RB.esc(s).replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  };
  RB.$ = function (id) { return document.getElementById(id); };

  // ---------- pedaços de interface ----------
  RB.tag = function (t, c) { return '<span class="tag ' + c + '">' + RB.esc(t) + '</span>'; };
  RB.av = function (i, s) { return '<div class="av" style="width:' + s + 'px;height:' + s + 'px;font-size:' + (s * .28) + 'px">' + RB.esc(i || '·') + '</div>'; };
  RB.ew = function (t, c) { return '<div class="ew' + (c ? ' ' + c : '') + '" style="margin-bottom:8px">' + t + '</div>'; };
  RB.tt = function (t) { return '<div class="ttl">' + t + '</div>'; };
  RB.statGrid = function (stats) {
    return '<div class="sg">' + stats.map(function (s) {
      return '<div class="sb"><div class="sv"' + (s.a ? ' style="color:var(--blue)"' : '') + '>' + RB.esc(s.v) + '</div><div class="sl">' + RB.esc(s.l) + '</div></div>';
    }).join('') + '</div>';
  };
  RB.empty = function (msg) { return '<div class="empty">' + msg + '</div>'; };
  RB.loading = function (id) { RB.$(id).innerHTML = '<div class="ld"><div class="sp"></div><div class="ld-t">carregando...</div></div>'; };
  RB.seg = function (items, active, fn) {
    return '<div class="tr">' + items.map(function (it) {
      return '<button class="tb' + (it[0] === active ? ' active' : '') + '" onclick="' + fn + '(\'' + it[0] + '\')">' + it[1] + '</button>';
    }).join('') + '</div>';
  };

  var toastTimer;
  RB.toast = function (msg, ok) {
    var t = RB.$('toast');
    t.textContent = msg; t.className = 'toast show' + (ok === false ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2800);
  };

  // ---------- datas ----------
  var MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  RB.MES = MES;
  RB.fmtDate = function (d, withTime) {
    if (!d) return '';
    d = new Date(d);
    var s = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    if (withTime) s += ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return s;
  };
  RB.ago = function (d) {
    var m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return m + 'min';
    var h = Math.round(m / 60); if (h < 24) return h + 'h';
    var dd = Math.round(h / 24); if (dd < 7) return dd + 'd';
    return RB.fmtDate(d);
  };
  RB.weeksSince = function (d) { return d ? Math.floor((Date.now() - new Date(d).getTime()) / (7 * 864e5)) : 0; };
  // data da prova a partir de textos como "Amsterdam 21K — 18/10/2026" ou "21K · 18/10"
  RB.raceDate = function (a) {
    var src = [a.race, a.goal].join(' ');
    var m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(src);
    if (!m) return null;
    var now = new Date(), y = m[3] ? +m[3] : now.getFullYear();
    if (y < 100) y += 2000;
    var d = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(y + 1);
    return d;
  };
  RB.daysTo = function (d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 864e5);
  };

  // ---------- escalas dos feedbacks ----------
  RB.RPE_COLORS = ['#2E7D32', '#2E7D32', '#558B2F', '#827717', '#F9A825', '#F57F17', '#E65100', '#BF360C', '#B71C1C', '#7B1FA2'];
  RB.RPE_LABELS = ['', 'Muito fácil', 'Muito fácil', 'Fácil', 'Moderado', 'Moderado', 'Difícil', 'Difícil', 'Muito difícil', 'Muito difícil', 'Máximo'];
  RB.rpeColor = function (r) { return RB.RPE_COLORS[(r || 1) - 1] || 'var(--border)'; };
  RB.fbExtras = function (f) {
    var ex = [];
    if (f.fadiga) ex.push('pernas ' + f.fadiga);
    if (f.sono) ex.push('sono ' + f.sono);
    if (f.hidratacao) ex.push('hidra ' + f.hidratacao);
    if (f.gel && f.gel !== 'não usei') ex.push(f.gel);
    if (f.frequencia_cardiaca && f.frequencia_cardiaca !== 'normal') ex.push('fc ' + f.frequencia_cardiaca);
    return ex;
  };

  // ---------- telas e modais ----------
  RB.show = function (id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    RB.$('screen-' + id).classList.add('active');
  };
  RB.openSheet = function (html) {
    clearTimeout(RB._sheetT);
    RB.$('sheet-body').innerHTML = html;
    RB.$('sheet-body').scrollTop = 0;
    RB.$('sheet').classList.add('open');
    document.body.classList.add('locked');
  };
  RB.closeSheet = function () {
    RB.$('sheet').classList.remove('open');
    document.body.classList.remove('locked');
    clearTimeout(RB._sheetT);
    RB._sheetT = setTimeout(function () { if (!RB.$('sheet').classList.contains('open')) RB.$('sheet-body').innerHTML = ''; }, 300);
    if (RB.onSheetClose) { var f = RB.onSheetClose; RB.onSheetClose = null; f(); }
  };
  RB.setBadge = function (id, n) {
    var b = RB.$(id); if (!b) return;
    if (n > 0) { b.textContent = n > 9 ? '9+' : n; b.style.display = 'flex'; } else b.style.display = 'none';
  };

  // ---------- login ----------
  RB.login = async function () {
    var email = RB.$('login-email').value.trim(), pwd = RB.$('login-password').value;
    var btn = RB.$('login-btn'), err = RB.$('login-error');
    if (!email || !pwd) { err.style.display = 'block'; err.textContent = 'Preencha email e senha'; return; }
    btn.textContent = 'ENTRANDO...'; btn.disabled = true; err.style.display = 'none';
    var res = await sb.auth.signInWithPassword({ email: email, password: pwd });
    btn.textContent = 'ENTRAR'; btn.disabled = false;
    if (res.error) { err.style.display = 'block'; err.textContent = 'Email ou senha incorretos'; return; }
    start(res.data.user);
  };
  RB.logout = async function () {
    if (RB.push) await RB.push.unlink();
    await sb.auth.signOut();
    S.user = null;
    RB.onSheetClose = null; RB.closeSheet();
    RB.$('login-email').value = ''; RB.$('login-password').value = '';
    RB.show('login');
  };
  async function start(user) {
    S.user = user;
    S.isCoach = user.id === RB.cfg.coachId;
    if (S.isCoach) await RB.coach.load(); else await RB.athlete.load();
    if (RB.push) RB.push.sync();
    // aberto por uma notificação (#aba)
    var h = (location.hash || '').slice(1);
    if (h) { history.replaceState(null, '', location.pathname); RB.openTab(h); }
  }
  RB.openTab = function (tab) {
    if (!S.user) return;
    if (S.isCoach) { RB.coach.go(['feedbacks', 'eventos', 'calendar', 'athletes'].indexOf(tab) >= 0 ? tab : (tab === 'feedback' ? 'feedbacks' : 'dashboard')); return; }
    if (tab === 'feedback') RB.athlete.fbView = 'conversas';
    RB.athlete.go(['home', 'planilha', 'forca', 'eventos', 'feedback', 'relatorio'].indexOf(tab) >= 0 ? tab : 'home');
  };

  document.addEventListener('DOMContentLoaded', async function () {
    RB.$('login-password').addEventListener('keydown', function (e) { if (e.key === 'Enter') RB.login(); });
    var s = await sb.auth.getSession();
    if (s.data.session) start(s.data.session.user); else RB.show('login');
  });

  // ---------- app instalável ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        reg.update().catch(function () {});
        // ao voltar para o app, procura versão nova
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
      }).catch(function () {});
    });
    // versão nova instalada: recarrega uma vez para usar
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded) { hadController = true; return; }
      reloaded = true; location.reload();
    });
  }
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; RB.installReady = true; });
  RB.isStandalone = function () { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; };
  RB.installCard = function () {
    if (RB.isStandalone()) return '';
    try { if (localStorage.getItem('rb_install_dismissed')) return ''; } catch (e) {}
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!ios && !deferredPrompt) return '';
    var how = ios
      ? 'No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.'
      : 'Tenha a Run Base na tela inicial, como um app.';
    return '<div class="card install" id="install-card">' + RB.ew('Instale o app', 'blue') +
      '<div class="install-t">' + how + '</div><div class="install-a">' +
      (ios ? '' : '<button class="btn btn-r sm" onclick="RB.install()">INSTALAR</button>') +
      '<button class="btn btn-o sm" onclick="RB.dismissInstall()">Agora não</button></div></div>';
  };
  RB.install = async function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null;
    RB.dismissInstall();
  };
  RB.dismissInstall = function () {
    try { localStorage.setItem('rb_install_dismissed', '1'); } catch (e) {}
    var c = RB.$('install-card'); if (c) c.remove();
  };
})();
