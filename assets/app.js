/* ============================================================
   BUDŻET POLSKI — SKRYPT GŁÓWNY
   1. Motyw jasny/ciemny (zapis w localStorage — plik do pobrania,
      nie artefakt Claude.ai) + rok w stopce
   2. Formatowanie liczb (polski zapis, przeliczenie na mieszkańca)
   3. Rejestr liczb ze źródłami + dymek (tooltip) ze źródłem
   4. Wykresy słupkowe HTML/CSS i tabele
   5. Renderery podstron (wybierane przez <body data-page="...">),
      w tym kalkulator „Twoja pensja a budżet”
   6. Wczytanie danych z data/budzet.json i start
   Wszystkie liczby na stronie pochodzą z budzet.json — żeby
   zaktualizować stronę, edytuj tylko ten plik.
   ============================================================= */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. MOTYW JASNY / CIEMNY + ROK W STOPCE
     Brak zapisanego wyboru = data-theme="auto" (decyduje system).
  ---------------------------------------------------------- */
  var STORAGE_KEY = 'forge-ui-theme';
  var root = document.documentElement;

  function applyStoredTheme() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (err) { stored = null; }
    if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  }

  function currentEffectiveTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (err) { /* brak zapisu — nie jest krytyczny */ }
  }

  applyStoredTheme();
  var toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleTheme);

  var yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ----------------------------------------------------------
     2. FORMATOWANIE
     fmt(12.345)        → "12,3"
     fmt(12.345, 0)     → "12"
     zl(1629)           → "1 629 zł"
     Kwoty w danych są w mld zł; na mieszkańca liczymy jako
     mld × 10^9 / ludność.
  ---------------------------------------------------------- */
  var D = null;          // dane z budzet.json
  var POP = 37.332e6;    // nadpisywane z danych po wczytaniu

  function fmt(v, dec) {
    if (dec === undefined) dec = 1;
    return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  }
  function zl(v) { return fmt(Math.round(v), 0) + ' zł'; }
  function perPerson(mld) { return mld * 1e9 / POP; }
  function pct(a, b) { return (a / b - 1) * 100; }
  function signed(v, dec) { return (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), dec === undefined ? 1 : dec); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Wartość w formacie danych: {v, src, wyliczone?, weryfikuj?, uwaga?}.
     mk() tworzy taki obiekt dla liczb, które w JSON są „gołe”
     (np. tabela Eurostatu ma jedno źródło dla całej grupy). */
  function mk(v, src, extra) {
    var o = { v: v, src: src || [] };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  /* Dostęp do zagnieżdżonych pól: get(D, 'lata.2027.deficyt') */
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  /* ----------------------------------------------------------
     3. REJESTR LICZB + DYMEK ZE ŹRÓDŁEM
     num(valObj, opts) zwraca HTML przycisku .num i zapamiętuje
     obiekt w rejestrze. Dymek pokazuje: dokładną wartość,
     przeliczenie na mieszkańca, uwagi, wzór (jeśli wyliczone),
     ostrzeżenie (jeśli do weryfikacji) i listę źródeł z linkami.
     Opcje:
       unit   — jednostka w tekście (domyślnie "mld zł")
       dec    — miejsca po przecinku (domyślnie 1)
       label  — opis w nagłówku dymka
       person — true = dodaj „na mieszkańca”
       text   — własny tekst zamiast sformatowanej liczby
  ---------------------------------------------------------- */
  var REG = [];

  function register(val, opts) {
    REG.push({ val: val, opts: opts || {} });
    return REG.length - 1;
  }

  function num(val, opts) {
    opts = opts || {};
    if (!val || val.v === undefined || val.v === null) return '<span class="muted">b.d.</span>';
    var unit = opts.unit === undefined ? 'mld zł' : opts.unit;
    var text = opts.text || (fmt(val.v, opts.dec === undefined ? 1 : opts.dec) + (unit ? ' ' + unit : ''));
    var cls = 'num' + (val.wyliczone ? ' num--calc' : '') + (val.weryfikuj ? ' num--verify' : '');
    var id = register(val, opts);
    var extra = val.weryfikuj ? ' (do weryfikacji)' : '';
    return '<button type="button" class="' + cls + '" data-k="' + id + '" aria-label="' + esc(text + extra + ' — pokaż źródło') + '">' + esc(text) + '</button>';
  }

  var tip = document.createElement('div');
  tip.id = 'num-tip';
  tip.className = 'tip';
  var HAS_POPOVER = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;
  if (HAS_POPOVER) tip.setAttribute('popover', 'manual');
  tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-label', 'Źródło liczby');
  document.body.appendChild(tip);

  var tipAnchor = null;     // element, przy którym stoi dymek
  var tipPinned = false;    // otwarty kliknięciem (np. na telefonie)
  var hideTimer = null;

  function tipHTML(entry) {
    var v = entry.val, o = entry.opts;
    var unit = o.unit === undefined ? 'mld zł' : o.unit;
    var h = '';
    if (o.label) h += '<p class="tip__row"><strong>' + esc(o.label) + '</strong></p>';
    var dec = Math.abs(v.v) < 100 && unit === 'mld zł' ? 3 : (o.dec === undefined ? 1 : o.dec);
    h += '<p class="tip__value">' + esc(fmt(v.v, dec) + (unit ? ' ' + unit : '')) + '</p>';
    if (o.person && unit === 'mld zł') h += '<p class="tip__row">Na mieszkańca: <strong>' + esc(zl(perPerson(v.v))) + '</strong> rocznie</p>';
    if (v.uwaga) h += '<p class="tip__row">' + esc(v.uwaga) + '</p>';
    if (v.wyliczone) h += '<p class="tip__row">Wyliczone: ' + esc(v.wyliczone) + '</p>';
    if (v.weryfikuj) h += '<p class="tip__row tip__verify">Do weryfikacji: ' + esc(v.weryfikuj) + '</p>';
    var src = (v.src || []).map(function (id) { return D && D.zrodla[id] ? D.zrodla[id] : null; }).filter(Boolean);
    if (src.length) {
      h += '<ul class="tip__src">' + src.map(function (s) {
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.tytul) + '</a><small>' + esc(s.wydawca) + ' · ' + esc(s.data) + '</small></li>';
      }).join('') + '</ul>';
    }
    return h;
  }

  function positionTip(anchor) {
    var r = anchor.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var gap = 8;
    var top = r.bottom + gap;
    if (top + th > vh - gap && r.top - gap - th > gap) top = r.top - gap - th;   // odwrócenie w górę
    var left = r.left + r.width / 2 - tw / 2;
    left = Math.max(gap, Math.min(left, vw - tw - gap));
    tip.style.top = Math.max(gap, top) + 'px';
    tip.style.left = left + 'px';
  }

  function showTip(anchor) {
    var entry = REG[+anchor.getAttribute('data-k')];
    if (!entry) return;
    clearTimeout(hideTimer);
    if (tipAnchor && tipAnchor !== anchor) tipAnchor.removeAttribute('aria-expanded');
    tipAnchor = anchor;
    tip.innerHTML = tipHTML(entry);
    if (HAS_POPOVER) { if (!tip.matches(':popover-open')) tip.showPopover(); }
    else tip.classList.add('is-open');
    if (anchor.classList.contains('num')) anchor.setAttribute('aria-expanded', 'true');
    positionTip(anchor);
  }

  function hideTip() {
    clearTimeout(hideTimer);
    if (HAS_POPOVER) { if (tip.matches(':popover-open')) tip.hidePopover(); }
    else tip.classList.remove('is-open');
    if (tipAnchor) tipAnchor.removeAttribute('aria-expanded');
    tipAnchor = null;
    tipPinned = false;
  }

  function scheduleHide() {
    if (tipPinned) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTip, 220);
  }

  // Najechanie myszą na liczbę lub słupek wykresu
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var a = e.target.closest('[data-k]');
    if (a) { if (!tipPinned || tipAnchor === a) showTip(a); }
  });
  document.addEventListener('pointerout', function (e) {
    var a = e.target.closest('[data-k]');
    if (a && !(e.relatedTarget && (a.contains(e.relatedTarget) || tip.contains(e.relatedTarget)))) scheduleHide();
  });
  // Dymek musi dać się „najechać” (WCAG 1.4.13)
  tip.addEventListener('pointerenter', function () { clearTimeout(hideTimer); });
  tip.addEventListener('pointerleave', scheduleHide);

  // Fokus z klawiatury
  document.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('.num[data-k]');
    if (a) showTip(a);
  });
  document.addEventListener('focusout', function (e) {
    var a = e.target.closest && e.target.closest('.num[data-k]');
    if (a && !(e.relatedTarget && tip.contains(e.relatedTarget))) scheduleHide();
    if (tip.contains(e.target) && !(e.relatedTarget && (tip.contains(e.relatedTarget) || e.relatedTarget === tipAnchor))) scheduleHide();
  });

  // Kliknięcie / dotknięcie — przypina dymek; klik poza nim zamyka
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.num[data-k]');
    if (a) {
      if (tipPinned && tipAnchor === a) { hideTip(); return; }
      showTip(a); tipPinned = true; return;
    }
    if (!tip.contains(e.target)) hideTip();
  });

  // Escape zamyka dymek (i wraca fokusem do liczby, jeśli był w dymku)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && tipAnchor) {
      var back = tip.contains(document.activeElement) ? tipAnchor : null;
      hideTip();
      if (back) back.focus();
    }
  });
  window.addEventListener('scroll', function () { if (tipAnchor && !tipPinned) hideTip(); else if (tipAnchor) positionTip(tipAnchor); }, { passive: true });
  window.addEventListener('resize', function () { if (tipAnchor) positionTip(tipAnchor); });

  /* ----------------------------------------------------------
     4. WYKRESY I TABELE
     hbar(el, cfg) — poziome słupki, 1–3 serie.
       cfg.series: [{name, cls: 1|2|3}]
       cfg.rows:   [{label, values: [valObj|null...], highlight?}]
       cfg.unit:   jednostka (domyślnie "mld zł")
       cfg.max:    maksimum osi (domyślnie największa wartość)
       cfg.refs:   [{at, label}] — pionowe linie progów
       cfg.person: dodaj „na mieszkańca” w dymku
     Słupki wskazują dymek przy najechaniu; dostęp z klawiatury
     zapewnia tabela pod wykresem („Pokaż jako tabelę”).
  ---------------------------------------------------------- */
  var YEAR_SERIES = [
    { name: '2025 — wykonanie', cls: 1 },
    { name: '2026 — ustawa', cls: 2 },
    { name: '2027 — projekt', cls: 3 }
  ];

  function legend(series) {
    if (series.length < 2) return '';
    return '<ul class="chart__legend" aria-hidden="true">' + series.map(function (s) {
      return '<li><span class="swatch swatch--' + s.cls + '"></span>' + esc(s.name) + '</li>';
    }).join('') + '</ul>';
  }

  function hbar(el, cfg) {
    if (!el) return;
    var unit = cfg.unit === undefined ? 'mld zł' : cfg.unit;
    var dec = cfg.dec === undefined ? 1 : cfg.dec;
    var max = cfg.max || 0;
    cfg.rows.forEach(function (r) { r.values.forEach(function (v) { if (v && Math.abs(v.v) > max) max = Math.abs(v.v); }); });
    if (!max) max = 1;
    var single = cfg.series.length === 1;
    var maxChars = 6;   // najdłuższa etykieta wartości → szerokość kolumny wartości
    var h = legend(cfg.series) + '<div class="chart__rows">';
    cfg.rows.forEach(function (r) {
      h += '<div class="chart__row' + (r.highlight ? ' chart__row--highlight' : '') + '"><div class="chart__label">' + esc(r.label) + '</div><div class="chart__bars">';
      r.values.forEach(function (v, i) {
        var s = cfg.series[i];
        if (!v || v.v === null || v.v === undefined) {
          h += '<div class="chart__bar-line"><span class="chart__value">' + esc(s.name) + ': b.d.</span></div>';
          return;
        }
        var w = Math.max(0, Math.abs(v.v)) / max * 100;
        var id = register(v, { unit: unit, dec: dec, label: r.label + ' — ' + s.name, person: cfg.person });
        var shown = r.valueText && r.valueText[i] ? r.valueText[i] : fmt(v.v, dec) + (unit ? ' ' + unit : '');
        if (shown.length > maxChars) maxChars = shown.length;
        h += '<div class="chart__bar-line"><div class="chart__bar chart__bar--' + s.cls + '" data-k="' + id + '" style="width:' + w.toFixed(2) + '%"></div>' +
             '<span class="chart__value">' + esc(shown) + '</span></div>';
      });
      if (cfg.refs) {
        h += '<div class="chart__refs" aria-hidden="true">' + cfg.refs.map(function (ref) {
          var x = ref.at / max * 100;
          return '<span class="chart__ref" style="left:' + x.toFixed(2) + '%"></span>';
        }).join('') + '</div>';
      }
      h += '</div></div>';
    });
    h += '</div>';
    if (cfg.refs) {
      h += '<p class="small muted" style="margin-top:0.75rem">' + cfg.refs.map(function (r) {
        return '<span style="color:var(--chart-ref)">┆</span> ' + esc(r.label);
      }).join(' · ') + '</p>';
    }
    el.style.setProperty('--value-w', Math.min(maxChars * 0.62 + 0.5, 16).toFixed(1) + 'em');
    el.classList.add('chart');
    if (single) el.classList.add('chart--single');
    el.innerHTML = h;
  }

  /* Tabela: cols = [{head, cls?}], rows = [[html...]] */
  function table(el, cfg) {
    if (!el) return;
    var h = '<div class="table-wrap"><table class="data-table">';
    if (cfg.caption) h += '<caption>' + cfg.caption + '</caption>';
    h += '<thead><tr>' + cfg.cols.map(function (c) { return '<th scope="col" class="' + (c.cls || '') + '">' + c.head + '</th>'; }).join('') + '</tr></thead><tbody>';
    cfg.rows.forEach(function (r) {
      h += '<tr>' + r.map(function (cell, i) {
        var c = cfg.cols[i] || {};
        return (i === 0 ? '<th scope="row"' : '<td') + ' class="' + (c.cls || '') + '">' + cell + (i === 0 ? '</th>' : '</td>');
      }).join('') + '</tr>';
    });
    h += '</tbody>';
    if (cfg.foot) h += '<tfoot><tr>' + cfg.foot.map(function (cell, i) { return '<td class="' + ((cfg.cols[i] || {}).cls || '') + '">' + cell + '</td>'; }).join('') + '</tr></tfoot>';
    h += '</table></div>';
    el.innerHTML = h;
  }

  /* Zmiana procentowa jako tekst z kolorem.
     goodWhenUp: true = wzrost jest dobry (np. dochody), false = zły (np. deficyt), null = neutralnie */
  function deltaHTML(a, b, goodWhenUp) {
    if (!a || !b || !b.v) return '<span class="muted">—</span>';
    var d = pct(a.v, b.v);
    var cls = 'delta--neutral';
    if (goodWhenUp === true) cls = d >= 0 ? 'delta--down-good' : 'delta--up-bad';
    if (goodWhenUp === false) cls = d > 0 ? 'delta--up-bad' : 'delta--down-good';
    return '<span class="' + cls + '">' + signed(d) + '%</span>';
  }

  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  /* Przełącznik segmentowy: buttons z data-value, callback(value) */
  function seg(id, onChange) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-value]');
      if (!b) return;
      el.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      onChange(b.getAttribute('data-value'));
    });
  }

  /* Krótkie nazwy działów klasyfikacji budżetowej (pełne w tabeli) */
  var DZIAL_SHORT = {
    '751': 'Najwyższe organy państwa i sądownictwo',
    '752': 'Obrona narodowa (dział 752, bez FWSZ)',
    '753': 'Ubezpieczenia społeczne (dotacje do ZUS/KRUS)',
    '754': 'Bezpieczeństwo publiczne i straż pożarna',
    '757': 'Obsługa długu publicznego',
    '758': 'Różne rozliczenia (subwencje dla JST, składka UE, rezerwy)',
    '853': 'Pozostała polityka społeczna',
    '855': 'Rodzina (m.in. 800+)',
    '900': 'Gospodarka komunalna i ochrona środowiska',
    '921': 'Kultura i dziedzictwo narodowe',
    '925': 'Ogrody botaniczne, zoo i obszary chronione',
    '730': 'Szkolnictwo wyższe i nauka'
  };
  function dzialName(d) { return DZIAL_SHORT[d.kod] || d.nazwa; }

  /* Wydatki wg działów dla danego roku → [{kod, nazwa, val}] */
  function dzialy(year) {
    return D.lata[year].wydatki.dzialy.map(function (d) {
      return { kod: d.kod, nazwa: d.nazwa, val: year === '2025' ? d.wykonanie : { v: d.v, src: d.src } };
    });
  }

  /* ----------------------------------------------------------
     5. RENDERERY PODSTRON
  ---------------------------------------------------------- */
  var L = function (y) { return D.lata[y]; };

  var pages = {};

  /* ===== STRONA GŁÓWNA ===== */
  pages.start = function () {
    var p27 = L('2027'), u26 = L('2026'), w25 = L('2025');

    // Kafelki KPI (projekt 2027 vs ustawa 2026)
    var kpis = [
      { label: 'Wydatki 2027 (projekt)', val: p27.wydatki.ogolem, prev: u26.wydatki.ogolem, up: null },
      { label: 'Dochody 2027 (projekt)', val: p27.dochody.ogolem, prev: u26.dochody.ogolem, up: true },
      { label: 'Deficyt 2027 (limit)', val: p27.deficyt, prev: u26.deficyt, up: false },
      { label: 'Obsługa długu 2027', val: p27.wydatki.obsluga_dlugu_sp, prev: u26.wydatki.obsluga_dlugu_sp, up: false }
    ];
    set('kpi', kpis.map(function (k) {
      return '<article class="glass-card"><p class="kpi__label">' + esc(k.label) + '</p>' +
        '<p class="kpi__value">' + num(k.val, { label: k.label, person: true, text: fmt(k.val.v) }) + '<span class="kpi__unit"> mld zł</span></p>' +
        '<p class="kpi__sub">' + zl(perPerson(k.val.v)) + ' na mieszkańca · ' + deltaHTML(k.val, k.prev, k.up) + ' wobec ustawy na 2026</p></article>';
    }).join(''));

    // Trzy lata: dochody, wydatki, deficyt
    hbar(document.getElementById('chart-years'), {
      series: YEAR_SERIES, person: true,
      rows: [
        { label: 'Dochody', values: [w25.dochody.ogolem, u26.dochody.ogolem, p27.dochody.ogolem] },
        { label: 'Wydatki', values: [w25.wydatki.ogolem, u26.wydatki.ogolem, p27.wydatki.ogolem] },
        { label: 'Deficyt', values: [w25.deficyt, u26.deficyt, p27.deficyt] }
      ]
    });
    table(document.getElementById('table-years'), {
      cols: [{ head: '' }, { head: '2025 wykonanie', cls: 'n' }, { head: '2026 ustawa', cls: 'n' }, { head: '2027 projekt', cls: 'n' }],
      rows: [['Dochody', w25.dochody.ogolem, u26.dochody.ogolem, p27.dochody.ogolem],
             ['Wydatki', w25.wydatki.ogolem, u26.wydatki.ogolem, p27.wydatki.ogolem],
             ['Deficyt', w25.deficyt, u26.deficyt, p27.deficyt]].map(function (r) {
        return [r[0], num(r[1]), num(r[2]), num(r[3])];
      })
    });

    // Na co idzie 100 zł wydatków (2027)
    var dz = dzialy('2027').sort(function (a, b) { return b.val.v - a.val.v; });
    var total = p27.wydatki.ogolem.v;
    var top = dz.slice(0, 8);
    var restV = dz.slice(8).reduce(function (s, d) { return s + d.val.v; }, 0);
    var rows = top.map(function (d) { return { label: dzialName(d), values: [d.val], valueText: [fmt(d.val.v / total * 100, 0) + ' zł ze 100 zł'] }; });
    rows.push({ label: 'Pozostałe działy (' + (dz.length - 8) + ')', values: [mk(restV, ['mf_projekt_2027'], { wyliczone: 'suma pozostałych działów' })], valueText: [fmt(restV / total * 100, 0) + ' zł ze 100 zł'] });
    hbar(document.getElementById('chart-where'), { series: [YEAR_SERIES[2]], rows: rows, person: true });

    // Skąd pieniądze (2027)
    var inc = p27.dochody;
    var incRows = inc.podatki.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, 4).map(function (t) { return { label: t.nazwa, values: [t] }; });
    var otherTax = inc.podatki.slice().sort(function (a, b) { return b.v - a.v; }).slice(4).reduce(function (s, t) { return s + t.v; }, 0);
    incRows.push({ label: 'Pozostałe podatki', values: [mk(otherTax, ['mf_uzas_2027'], { wyliczone: 'gry, kopaliny, bankowy, detaliczny, wyrównawcze, rekompensacyjny' })] });
    incRows.push({ label: 'Dochody niepodatkowe', values: [inc.niepodatkowe] });
    incRows.push({ label: 'Środki z UE (w budżecie państwa)', values: [inc.srodki_ue] });
    incRows.forEach(function (r) { r.valueText = [fmt(r.values[0].v, 1) + ' mld zł · ' + fmt(r.values[0].v / inc.ogolem.v * 100, 0) + '%']; });
    hbar(document.getElementById('chart-income'), { series: [YEAR_SERIES[2]], rows: incRows, person: true });

    // Dług — relacja do PKB, wariant przewidywany
    var dl = D.dlug;
    hbar(document.getElementById('chart-debt'), {
      series: YEAR_SERIES, unit: '% PKB', max: 72,
      rows: [
        { label: 'Dług do progu 55% (kwota z art. 38a)', values: [dl.koniec_2025.kwota_art_38a.pkb_proc, dl.koniec_2026_przewidywane.kwota_art_38a.pkb_proc, dl.koniec_2027_przewidywane.kwota_art_38a.pkb_proc] },
        { label: 'Dług sektora wg UE', values: [dl.koniec_2025.gg.pkb_proc, dl.koniec_2026_przewidywane.gg.pkb_proc, dl.koniec_2027_przewidywane.gg.pkb_proc] }
      ],
      refs: [{ at: 55, label: 'próg ostrożnościowy 55%' }, { at: 60, label: 'limit konstytucyjny i próg UE 60%' }]
    });
    set('debt-note', 'Serie: koniec 2025 (wykonanie), koniec 2026 i 2027 (prognoza MF). Dług na mieszkańca na koniec 2025 r.: ' +
      num(D.na_osobe.dlug_gg_2025_na_osobe_zl, { unit: 'zł', dec: 0 }) + '.');

    // Wykonanie 2026 po sierpniu
    var e = u26.wykonanie_I_VIII;
    var elapsed = 8 / 12 * 100;
    var items = [
      { label: 'Dochody', val: e.dochody, plan: u26.dochody.ogolem },
      { label: 'Wydatki', val: e.wydatki, plan: u26.wydatki.ogolem },
      { label: 'Deficyt', val: e.deficyt, plan: u26.deficyt }
    ];
    set('progress-2026', items.map(function (it) {
      var p = it.val.v / it.plan.v * 100;
      var id = register(it.val, { label: it.label + ' po sierpniu 2026' });
      return '<div><div class="progress__head"><span>' + it.label + ': ' + num(it.val, { label: it.label + ' po sierpniu 2026' }) + ' z ' + num(it.plan) + '</span><strong>' + fmt(p, 1) + '%</strong></div>' +
        '<div class="progress__track" role="img" aria-label="' + esc(it.label + ': ' + fmt(p, 1) + '% planu rocznego po 8 miesiącach') + '"><div class="progress__fill" data-k="' + id + '" style="width:' + p.toFixed(1) + '%"></div>' +
        '<span class="progress__marker" style="left:' + elapsed.toFixed(1) + '%"></span></div></div>';
    }).join(''));

    // Poza budżetem państwa — obronność 2027
    var o = D.obszary.obronnosc['2027'];
    set('outside', '<p>Na obronność w 2027 r. rząd planuje ' + num(o.lacznie, { person: true, label: 'Obronność 2027 łącznie' }) +
      '. W samym budżecie państwa jest tylko ' + num(o.budzet_panstwa, { label: 'Obronność z budżetu państwa' }) +
      ', a ' + num(o.fwsz, { label: 'Fundusz Wsparcia Sił Zbrojnych' }) + ' wyda Fundusz Wsparcia Sił Zbrojnych w BGK — poza ustawą budżetową, ale w długu liczonym przez UE.</p>' +
      '<p class="small muted">Fundusze przy BGK wydadzą w 2027 r. łącznie ' + num(D.obszary.fundusze_bgk_2027.wydatki, { label: 'Wydatki funduszy BGK 2027' }) + '.</p>');

    // Ciekawostki na mieszkańca
    var n = D.na_osobe;
    set('per-person', '<ul class="list-tight">' +
      '<li>Wydatki budżetu 2027 to ' + num(n.wydatki_2027_na_osobe_zl, { unit: 'zł', dec: 0 }) + ' na każdego mieszkańca Polski.</li>' +
      '<li>Deficyt 2027: ' + num(n.deficyt_2027_na_osobe_zl, { unit: 'zł', dec: 0 }) + ' na osobę — tyle państwo pożyczy w naszym imieniu w jeden rok.</li>' +
      '<li>Odsetki i obsługa długu w 2027 r.: ' + num(n.obsluga_dlugu_2027_dziennie_mln_zl, { unit: 'mln zł', dec: 1 }) + ' dziennie.</li>' +
      '<li>Program „Rodzina 800+” kosztuje ' + num(n.rodzina800_2027_na_osobe_zl, { unit: 'zł', dec: 0 }) + ' na mieszkańca rocznie.</li></ul>');
  };

  /* ===== DOCHODY ===== */
  pages.dochody = function () {
    var w25 = L('2025'), u26 = L('2026'), p27 = L('2027');
    var pw26 = u26.przewidywane_wykonanie.dochody;
    function byKey(list) { var m = {}; list.forEach(function (t) { m[t.klucz] = t; }); return m; }
    var K = [byKey(w25.dochody.podatki), byKey(u26.dochody.podatki), byKey(p27.dochody.podatki)];
    var P25 = byKey(w25.plan.dochody.podatki), PW = byKey(pw26.podatki);

    var order = ['vat', 'akcyza', 'cit', 'pit', 'gry', 'bankowy', 'kopaliny', 'detaliczny'];
    var names = { vat: 'VAT', akcyza: 'Akcyza', cit: 'CIT (firmy)', pit: 'PIT — część budżetu państwa', gry: 'Podatek od gier', bankowy: 'Podatek bankowy', kopaliny: 'Podatek od kopalin', detaliczny: 'Podatek od sprzedaży detalicznej' };
    var rows = order.map(function (k) { return { label: names[k], values: K.map(function (m) { return m[k] || null; }) }; });
    rows.push({ label: 'Dochody niepodatkowe', values: [w25.dochody.niepodatkowe, u26.dochody.niepodatkowe, p27.dochody.niepodatkowe] });
    hbar(document.getElementById('chart-income'), { series: YEAR_SERIES, rows: rows, person: true });

    // Tabela pełna
    var allKeys = ['vat', 'akcyza', 'cit', 'pit', 'gry', 'bankowy', 'kopaliny', 'detaliczny', 'wyrownawcze', 'rekompensacyjny'];
    var allNames = Object.assign({}, names, { wyrownawcze: 'Podatki wyrównawcze', rekompensacyjny: 'Podatek rekompensacyjny' });
    var trows = allKeys.map(function (k) {
      return [allNames[k], num(P25[k]), num(K[0][k]), num(K[1][k]), num(PW[k]), num(K[2][k]), deltaHTML(K[2][k], PW[k], null)];
    });
    trows.push(['<strong>Dochody podatkowe</strong>', num(w25.plan.dochody.podatkowe), num(w25.dochody.podatkowe), num(u26.dochody.podatkowe), num(pw26.podatkowe), num(p27.dochody.podatkowe), deltaHTML(p27.dochody.podatkowe, pw26.podatkowe, null)]);
    trows.push(['Dochody niepodatkowe', num(w25.plan.dochody.niepodatkowe), num(w25.dochody.niepodatkowe), num(u26.dochody.niepodatkowe), num(pw26.niepodatkowe), num(p27.dochody.niepodatkowe), deltaHTML(p27.dochody.niepodatkowe, pw26.niepodatkowe, null)]);
    trows.push(['Środki z UE (w budżecie państwa)', num(w25.plan.dochody.srodki_ue), num(w25.dochody.srodki_ue), num(u26.dochody.srodki_ue), '<span class="muted">—</span>', num(p27.dochody.srodki_ue), '<span class="muted">—</span>']);
    table(document.getElementById('table-income'), {
      cols: [{ head: 'Źródło' }, { head: '2025 plan', cls: 'n' }, { head: '2025 wykonanie', cls: 'n' }, { head: '2026 ustawa', cls: 'n' }, { head: '2026 przewidywane', cls: 'n' }, { head: '2027 projekt', cls: 'n' }, { head: '2027 vs 2026 przew.', cls: 'n' }],
      rows: trows,
      foot: ['Dochody ogółem', num(w25.plan.dochody.ogolem), num(w25.dochody.ogolem), num(u26.dochody.ogolem), num(pw26.ogolem), num(p27.dochody.ogolem), deltaHTML(p27.dochody.ogolem, pw26.ogolem, null)]
    });

    // PIT i samorządy
    var e = u26.wykonanie_I_VIII;
    set('pit-box', '<p>Do budżetu państwa trafi w 2027 r. tylko ' + num(K[2].pit, { label: 'PIT dla budżetu państwa 2027' }) + ' z PIT, bo większość tego podatku należy do gmin, powiatów i województw: ich udziały to ' +
      num(p27.udzialy_jst_w_pit, { label: 'Udziały samorządów w PIT 2027' }) + '. Po sierpniu 2026 r. PIT w budżecie państwa był nawet ujemny: ' +
      num(e.pit_budzet_panstwa, { label: 'PIT budżetu państwa I–VIII 2026' }) + ' — przelewy do samorządów przewyższyły wpływy.</p>' +
      '<p class="small muted">Dlatego „mały PIT” w tabeli nie znaczy, że Polacy płacą mało podatku dochodowego — zmienił się tylko podział między państwo i samorządy (reforma dochodów JST).</p>');

    // Dlaczego w 2026 wpłynie mniej
    var pw = u26.przewidywane_wykonanie;
    set('pw-2026', '<p>Ustawa zakładała ' + num(u26.dochody.ogolem) + ' dochodów, MF przewiduje ' + num(pw.dochody.ogolem, { label: 'Przewidywane dochody 2026' }) + '. Główne powody wg MF:</p>' +
      '<ul class="list-tight">' + pw.przyczyny_odchylen.map(function (p) { return '<li>' + esc(p.opis) + '</li>'; }).join('') + '</ul>' +
      '<p class="small muted" style="margin-top:0.75rem">Deficyt ma mimo to zmieścić się w limicie ' + num(pw.deficyt) + ', bo wydatki będą niższe od planu (w ostatnich 3 latach niewykonanie wydatków wynosiło średnio 4,7%).</p>');

    // Zmiany podatkowe 2027
    set('changes-2027', '<ul class="list-tight">' + p27.zmiany_podatkowe_w_projekcie.map(function (z) {
      return '<li>' + esc(z.opis) + (z.skutek_mld ? ' — skutek dla dochodów: ' + num(z.skutek_mld, { text: signed(z.skutek_mld.v) + ' mld zł', label: 'Skutek finansowy' }) : '') + '</li>';
    }).join('') + '</ul><p class="callout callout--warn small">' + esc(p27.uwaga) + '</p>');

    // Niepodatkowe
    var nr = [0, 1, 2].map(function (i) {
      return [w25.dochody.niepodatkowe_szczegoly[i].nazwa, num(w25.dochody.niepodatkowe_szczegoly[i]), num(u26.dochody.niepodatkowe_szczegoly[i]), num(pw26.niepodatkowe_szczegoly[i]), num(p27.dochody.niepodatkowe_szczegoly[i])];
    });
    table(document.getElementById('table-nontax'), {
      cols: [{ head: 'Pozycja' }, { head: '2025 wykonanie', cls: 'n' }, { head: '2026 ustawa', cls: 'n' }, { head: '2026 przewidywane', cls: 'n' }, { head: '2027 projekt', cls: 'n' }],
      rows: nr
    });
  };

  /* ===== WYDATKI ===== */
  pages.wydatki = function () {
    var w25 = L('2025'), u26 = L('2026'), p27 = L('2027');
    var YEARS = { '2025': YEAR_SERIES[0], '2026': YEAR_SERIES[1], '2027': YEAR_SERIES[2] };

    function drawYear(y) {
      var dz = dzialy(y).filter(function (d) { return d.val.v > 0; }).sort(function (a, b) { return b.val.v - a.val.v; });
      var total = L(y).wydatki.ogolem.v;
      var top = dz.slice(0, 12);
      var rest = dz.slice(12).reduce(function (s, d) { return s + d.val.v; }, 0);
      var rows = top.map(function (d) { return { label: dzialName(d), values: [d.val], valueText: [fmt(d.val.v) + ' mld zł · ' + fmt(d.val.v / total * 100, 1) + '%'] }; });
      rows.push({ label: 'Pozostałe działy (' + (dz.length - 12) + ')', values: [mk(rest, [y === '2025' ? 'mf_spr_2025' : y === '2026' ? 'mf_ub_2026' : 'mf_projekt_2027'], { wyliczone: 'suma pozostałych działów' })], valueText: [fmt(rest) + ' mld zł · ' + fmt(rest / total * 100, 1) + '%'] });
      hbar(document.getElementById('chart-sections'), { series: [YEARS[y]], rows: rows, person: true });
      set('sections-total', 'Razem: ' + num(L(y).wydatki.ogolem, { person: true, label: 'Wydatki ogółem ' + y }) + ' — ' + esc(YEARS[y].name));
    }
    drawYear('2027');
    seg('seg-year', drawYear);

    // Pełna tabela działów
    var map = {};
    w25.wydatki.dzialy.forEach(function (d) { map[d.kod] = { kod: d.kod, nazwa: d.nazwa, p25: d.plan, w25: d.wykonanie }; });
    u26.wydatki.dzialy.forEach(function (d) { (map[d.kod] = map[d.kod] || { kod: d.kod, nazwa: d.nazwa }).u26 = d; });
    p27.wydatki.dzialy.forEach(function (d) { (map[d.kod] = map[d.kod] || { kod: d.kod, nazwa: d.nazwa }).p27 = d; });
    var rows = Object.keys(map).sort().map(function (k) {
      var r = map[k];
      return [esc(r.kod + ' ' + r.nazwa), num(r.p25), num(r.w25), num(r.u26), num(r.p27), deltaHTML(r.p27, r.u26, null)];
    });
    table(document.getElementById('table-sections'), {
      cols: [{ head: 'Dział' }, { head: '2025 plan', cls: 'n' }, { head: '2025 wykonanie', cls: 'n' }, { head: '2026 ustawa', cls: 'n' }, { head: '2027 projekt', cls: 'n' }, { head: '2027 vs 2026', cls: 'n' }],
      rows: rows,
      foot: ['Ogółem', num(w25.plan.wydatki), num(w25.wydatki.ogolem), num(u26.wydatki.ogolem), num(p27.wydatki.ogolem), deltaHTML(p27.wydatki.ogolem, u26.wydatki.ogolem, null)]
    });
    set('sections-note', esc(p27.wydatki.uwaga_dzialy));

    // Najważniejsze pozycje 2027
    var pr = D.programy_spoleczne;
    var w = p27.wydatki;
    var items = [
      ['Obsługa długu Skarbu Państwa', w.obsluga_dlugu_sp],
      ['Subwencje i dotacje dla samorządów', w.subwencje_i_dotacje_jst],
      ['Dotacja do Funduszu Ubezpieczeń Społecznych (ZUS)', w.dotacja_fus],
      ['Rodzina 800+', pr.rodzina_800_plus['2027']],
      ['Składka do budżetu UE', w.skladka_do_budzetu_ue],
      ['13. i 14. emerytura', pr.emerytura_13_i_14['2027']],
      ['Dotacja do Funduszu Emerytalno-Rentowego (KRUS)', w.dotacja_fer_krus],
      ['Świadczenie wspierające (niepełnosprawność)', pr.swiadczenie_wspierajace['2027']],
      ['Podwyżki 3% w sferze budżetowej (koszt r/r)', pr.podwyzki_sfera_budzetowa_3proc['2027']],
      ['Aktywny Rodzic', pr.aktywny_rodzic['2027']]
    ];
    hbar(document.getElementById('chart-items'), { series: [YEAR_SERIES[2]], rows: items.map(function (i) { return { label: i[0], values: [i[1]] }; }), person: true });

    // Grupy ekonomiczne 2027
    hbar(document.getElementById('chart-groups'), { series: [YEAR_SERIES[2]], rows: w.grupy_ekonomiczne.map(function (g) { return { label: g.nazwa, values: [g], valueText: [fmt(g.v) + ' mld zł · ' + fmt(g.v / w.ogolem.v * 100, 0) + '%'] }; }) });

    // Obszary z funduszami
    var ob = D.obszary;
    table(document.getElementById('table-areas'), {
      cols: [{ head: 'Obszar' }, { head: 'Łącznie', cls: 'n' }, { head: 'z budżetu państwa', cls: 'n' }, { head: 'poza budżetem', cls: 'n' }],
      rows: [
        ['Obronność 2026', num(ob.obronnosc['2026'].lacznie, { person: true }), num(ob.obronnosc['2026'].budzet_panstwa), num(ob.obronnosc['2026'].fwsz_i_safe)],
        ['Obronność 2027', num(ob.obronnosc['2027'].lacznie, { person: true }), num(ob.obronnosc['2027'].budzet_panstwa), num(ob.obronnosc['2027'].fwsz)],
        ['Ochrona zdrowia 2027', num(ob.zdrowie['2027'].lacznie, { person: true }), num(ob.zdrowie['2027'].z_budzetu_panstwa), '<span class="small muted">głównie składka zdrowotna w NFZ</span>'],
        ['Drogi i kolej 2027', num(ob.drogi_i_kolej['2027'], { person: true }), '<span class="small muted">26,4 mld zł (w uwadze)</span>', '<span class="small muted">KFD, Fundusz Kolejowy, UE</span>'],
        ['Bezpieczeństwo wewnętrzne 2027', num(ob.bezpieczenstwo_wewnetrzne['2027'].lacznie), num(ob.bezpieczenstwo_wewnetrzne['2027'].struktury_mundurowe, { label: 'Struktury mundurowe (bez emerytur)' }), '<span class="small muted">fundusze wsparcia służb</span>']
      ]
    });

    // Fundusze BGK
    var f = ob.fundusze_bgk_2027;
    table(document.getElementById('table-bgk'), {
      cols: [{ head: 'Fundusz' }, { head: 'Wpływy 2027', cls: 'n' }, { head: 'Wydatki 2027', cls: 'n' }],
      rows: f.najwieksze.map(function (x) { return [esc(x.nazwa), num(x.wplywy), num(x.wydatki)]; }),
      foot: ['Wszystkie fundusze BGK (20)', num(f.wplywy), num(f.wydatki)]
    });

    // Sektor 2025 wg funkcji (NIK)
    var s = D.sektor_finansow_publicznych_2025;
    hbar(document.getElementById('chart-sector'), { series: [YEAR_SERIES[0]], rows: s.funkcje.map(function (x) { return { label: x.nazwa, values: [x] }; }), person: true });
    set('sector-total', 'Razem ' + num(s.ogolem, { person: true, label: 'Wydatki sektora finansów publicznych 2025' }) + '. ' + esc(s.uwaga));
  };

  /* ===== DEFICYT I DŁUG ===== */
  pages.dlug = function () {
    var dl = D.dlug, pkb = D.makro.pkb_nominalne_mld;
    var w25 = L('2025'), u26 = L('2026'), p27 = L('2027');

    set('kpi', [
      { label: 'Dług sektora wg UE, koniec 2025', val: dl.koniec_2025.gg.mld, sub: num(dl.koniec_2025.gg.pkb_proc, { unit: '% PKB' }) },
      { label: 'Prognoza na koniec 2027', val: dl.koniec_2027_przewidywane.gg.mld, sub: num(dl.koniec_2027_przewidywane.gg.pkb_proc, { unit: '% PKB' }) + ' (wariant przewidywany)' },
      { label: 'Obsługa długu 2027', val: p27.wydatki.obsluga_dlugu_sp, sub: num(D.na_osobe.obsluga_dlugu_2027_dziennie_mln_zl, { unit: 'mln zł', dec: 1 }) + ' dziennie' },
      { label: 'Dług na mieszkańca, koniec 2025', val: D.na_osobe.dlug_gg_2025_na_osobe_zl, unit: 'zł', dec: 0, sub: 'dług sektora wg UE / ludność' }
    ].map(function (k) {
      var unit = k.unit || 'mld zł';
      return '<article class="glass-card"><p class="kpi__label">' + esc(k.label) + '</p><p class="kpi__value">' +
        num(k.val, { unit: unit, dec: k.dec, text: fmt(k.val.v, k.dec === undefined ? 1 : k.dec), label: k.label, person: unit === 'mld zł' }) + '<span class="kpi__unit"> ' + unit + '</span></p><p class="kpi__sub">' + k.sub + '</p></article>';
    }).join(''));

    function drawDebt(variant) {
      var suf = variant === 'limity' ? '_wg_limitow' : '_przewidywane';
      var y26 = dl['koniec_2026' + suf], y27 = dl['koniec_2027' + suf], y25 = dl.koniec_2025;
      var defs = [['kwota_art_38a', 'Kwota z art. 38a (od niej liczy się próg 55%)'], ['pdp', 'Państwowy dług publiczny (definicja krajowa)'], ['dlug_sp', 'Dług Skarbu Państwa'], ['gg', 'Dług sektora instytucji rządowych i samorządowych (UE)']];
      hbar(document.getElementById('chart-debt'), {
        series: [{ name: 'koniec 2025', cls: 1 }, { name: 'koniec 2026', cls: 2 }, { name: 'koniec 2027', cls: 3 }],
        unit: '% PKB', max: 72,
        rows: defs.map(function (d) { return { label: d[1], values: [y25[d[0]].pkb_proc, y26[d[0]].pkb_proc, y27[d[0]].pkb_proc] }; }),
        refs: [{ at: 55, label: 'próg ostrożnościowy 55% (dotyczy kwoty z art. 38a)' }, { at: 60, label: 'limit konstytucyjny 60% (krajowy) i wartość referencyjna UE 60%' }]
      });
      table(document.getElementById('table-debt'), {
        cols: [{ head: 'Definicja' }, { head: 'koniec 2025', cls: 'n' }, { head: 'koniec 2026', cls: 'n' }, { head: 'koniec 2027', cls: 'n' }],
        rows: defs.map(function (d) {
          return [esc(d[1])].concat([y25, y26, y27].map(function (y) { return num(y[d[0]].mld) + '<br><span class="small muted">' + num(y[d[0]].pkb_proc, { unit: '% PKB' }) + '</span>'; }));
        })
      });
    }
    drawDebt('przewidywane');
    seg('seg-variant', drawDebt);
    set('prog-55', esc(dl.prog_55));
    set('edp', esc(dl.procedura_nadmiernego_deficytu));

    // Deficyt: budżet państwa vs sektor
    function ofPkb(val, y) { return mk(val.v / pkb[y].v * 100, val.src.concat(pkb[y].src), { wyliczone: 'kwota / PKB nominalne (' + fmt(pkb[y].v) + ' mld zł)' }); }
    table(document.getElementById('table-deficit'), {
      cols: [{ head: '' }, { head: '2025 wykonanie', cls: 'n' }, { head: '2026 ustawa', cls: 'n' }, { head: '2027 projekt', cls: 'n' }],
      rows: [
        ['Deficyt budżetu państwa', num(w25.deficyt, { person: true }), num(u26.deficyt, { person: true }), num(p27.deficyt, { person: true })],
        ['— w relacji do PKB', num(ofPkb(w25.deficyt, '2025'), { unit: '% PKB' }), num(ofPkb(u26.deficyt, '2026'), { unit: '% PKB' }), num(ofPkb(p27.deficyt, '2027'), { unit: '% PKB' })],
        ['Wynik budżetu środków europejskich', num(w25.budzet_srodkow_europejskich.wynik), num(u26.budzet_srodkow_europejskich.wynik), num(p27.budzet_srodkow_europejskich.wynik)],
        ['Deficyt sektora wg UE (% PKB)', num(w25.sektor_gg.deficyt_pkb_proc, { unit: '% PKB' }), num(u26.sektor_gg.deficyt_pkb_proc, { unit: '% PKB' }), num(p27.sektor_gg.deficyt_pkb_proc, { unit: '% PKB' })],
        ['Obsługa długu Skarbu Państwa', num(dl.obsluga_dlugu_sp['2025']), num(dl.obsluga_dlugu_sp['2026']), num(dl.obsluga_dlugu_sp['2027'])]
      ]
    });

    // Polska na tle UE — deficyt 2025
    var ue = D.porownanie_ue.saldo_i_dlug_2025;
    var src = ue.src;
    var countries = Object.keys(ue.kraje).map(function (k) { return { name: k, s: ue.kraje[k].saldo, d: ue.kraje[k].dlug }; });
    var byDef = countries.slice().sort(function (a, b) { return a.s - b.s; });
    hbar(document.getElementById('chart-eu-deficit'), {
      series: [{ name: 'Deficyt 2025, % PKB', cls: 1 }], unit: '% PKB', max: 8,
      rows: byDef.map(function (c) {
        var v = c.s < 0 ? -c.s : 0;
        return { label: c.name, highlight: c.name === 'Polska', values: [mk(v, src, c.s > 0 ? { uwaga: 'Nadwyżka ' + fmt(c.s) + '% PKB' } : null)], valueText: [c.s > 0 ? 'nadwyżka ' + fmt(c.s) + '%' : fmt(-c.s) + '%'] };
      }).concat([{ label: 'Średnia UE-27', values: [mk(-ue.agregaty.UE27.saldo, src)], valueText: [fmt(-ue.agregaty.UE27.saldo) + '%'] }]),
      refs: [{ at: 3, label: 'wartość referencyjna UE: 3% PKB' }]
    });
    var byDebt = countries.slice().sort(function (a, b) { return b.d - a.d; });
    hbar(document.getElementById('chart-eu-debt'), {
      series: [{ name: 'Dług 2025, % PKB', cls: 1 }], unit: '% PKB', max: 150, dec: 1,
      rows: byDebt.map(function (c) { return { label: c.name, highlight: c.name === 'Polska', values: [mk(c.d, src)] }; }).concat([{ label: 'Średnia UE-27', values: [mk(ue.agregaty.UE27.dlug, src)] }]),
      refs: [{ at: 60, label: 'wartość referencyjna UE: 60% PKB' }]
    });

    // COFOG — wybrane kraje
    var cof = D.porownanie_ue.wydatki_wg_funkcji_2024;
    var pick = ['Polska', 'UE-27', 'Czechy', 'Słowacja', 'Litwa', 'Estonia', 'Niemcy', 'Francja', 'Szwecja'];
    var f = [['obrona', 'Obrona'], ['zdrowie', 'Zdrowie'], ['edukacja', 'Edukacja'], ['ochrona_socjalna', 'Ochrona socjalna'], ['ogolem', 'Wydatki ogółem']];
    table(document.getElementById('table-cofog'), {
      cols: [{ head: 'Kraj' }].concat(f.map(function (x) { return { head: x[1], cls: 'n' }; })),
      rows: pick.filter(function (k) { return cof.kraje[k]; }).map(function (k) {
        return [k === 'Polska' ? '<strong>Polska</strong>' : esc(k)].concat(f.map(function (x) { return num(mk(cof.kraje[k][x[0]], cof.src), { unit: '%' }); }));
      })
    });
  };

  /* ===== KALKULATOR: TWOJA PENSJA A BUDŻET =====
     Liczy wszystko rocznie, a pokazuje średnią miesięczną.
     Parametry (stawki ZUS, skala PIT, akcyza, ceny) pochodzą
     z budzet.json → parametry_podatkowe. Założenia są opisane
     w dymkach wyników (pole „wyliczone”). */
  pages.kalkulator = function () {
    var P = D.parametry_podatkowe;
    var P26 = P['2026'];
    var AK = P.akcyza_2026, OP = P.oplata_paliwowa_2026, CENY = P.ceny_referencyjne;
    var SRC_PL = P26.src;                        // parametry płacowe
    var SRC_AK = AK.src, SRC_OP = OP.src;

    /* Podział PIT: budżet państwa vs samorządy (projekt 2027) */
    var pitBP = L('2027').dochody.podatki.filter(function (t) { return t.klucz === 'pit'; })[0].v;
    var pitJST = L('2027').udzialy_jst_w_pit.v;
    var SHARE_JST = pitJST / (pitJST + pitBP);

    var form = document.getElementById('calc-form');
    var kwota = document.getElementById('kwota');

    /* ---------- Skala PIT ---------- */
    function pitScale(podstawa, rok) {
      var p = Math.max(0, Math.round(podstawa));
      var t;
      if (rok === '2027') {
        // projekt 2027: 12% do 130 tys., 24% 130–150 tys., 32% powyżej; kwota zmniejszająca jak w 2026
        t = 0.12 * Math.min(p, 130000) + 0.24 * Math.max(0, Math.min(p, 150000) - 130000) + 0.32 * Math.max(0, p - 150000) - P26.pit.kwota_zmniejszajaca_mies * 12;
      } else {
        t = p <= P26.pit.prog_roczny
          ? P26.pit.stawka_1 * p - P26.pit.kwota_zmniejszajaca_mies * 12
          : P26.pit.stawka_1 * P26.pit.prog_roczny - P26.pit.kwota_zmniejszajaca_mies * 12 + P26.pit.stawka_2 * (p - P26.pit.prog_roczny);
      }
      return Math.max(0, Math.round(t));
    }

    /* ---------- Umowa o pracę: roczne kwoty z brutto miesięcznego ---------- */
    function uop(bruttoMies, o) {
      var B = bruttoMies * 12;
      var z = P26.zus_pracownik, zp = P26.zus_pracodawca;
      var baseLim = Math.min(B, z.limit_30_krotnosci_roczny);   // emerytalna i rentowa do limitu 30-krotności
      var r = {};
      r.brutto = B;
      r.emerytalna = z.emerytalna * baseLim;
      r.rentowa = z.rentowa * baseLim;
      r.chorobowa = z.chorobowa * B;
      r.zus = r.emerytalna + r.rentowa + r.chorobowa;
      r.zdrowotna = P26.zdrowotna.stawka * (B - r.zus);
      var exempt = o.mlody ? Math.min(B, P26.ulga_dla_mlodych_limit.v) : 0;
      var taxableRev = B - exempt;
      var kup = taxableRev > 0 ? (o.kup300 ? P26.pit.koszty_uzyskania_mies.podwyzszone : P26.pit.koszty_uzyskania_mies.podstawowe) * 12 : 0;
      var zusTaxable = B > 0 ? r.zus * taxableRev / B : 0;       // składki od przychodu zwolnionego nie pomniejszają dochodu
      r.podstawa = Math.max(0, taxableRev - zusTaxable - kup);
      r.pit = pitScale(r.podstawa, o.rok);
      r.netto = B - r.zus - r.zdrowotna - r.pit;
      // składki pracodawcy (koszt pracy ponad brutto)
      r.pr_emerytalna = zp.emerytalna * baseLim;
      r.pr_rentowa = zp.rentowa * baseLim;
      r.pr_wypadkowa = zp.wypadkowa_typowa * B;
      r.pr_fp = zp.fp_i_fs * B;
      r.pr_fgsp = zp.fgsp * B;
      r.pracodawca = r.pr_emerytalna + r.pr_rentowa + r.pr_wypadkowa + r.pr_fp + r.pr_fgsp;
      r.kosztPracy = B + r.pracodawca;
      return r;
    }

    /* ---------- Emerytura: zdrowotna 9% od brutto, PIT bez kosztów uzyskania ---------- */
    function emeryt(bruttoMies, o) {
      var B = bruttoMies * 12;
      var r = { brutto: B, emerytalna: 0, rentowa: 0, chorobowa: 0, zus: 0, pracodawca: 0,
                pr_emerytalna: 0, pr_rentowa: 0, pr_wypadkowa: 0, pr_fp: 0, pr_fgsp: 0 };
      r.zdrowotna = P26.zdrowotna.stawka * B;
      r.podstawa = B;
      r.pit = pitScale(B, o.rok);
      r.netto = B - r.zdrowotna - r.pit;
      r.kosztPracy = B;
      return r;
    }

    /* Netto → brutto: szukanie połówkowe (funkcja netto(brutto) jest rosnąca) */
    function fromNetto(nettoMies, calc, o) {
      var lo = 0, hi = Math.max(1000, nettoMies * 3);
      for (var i = 0; i < 60; i++) {
        var mid = (lo + hi) / 2;
        if (calc(mid, o).netto / 12 < nettoMies) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }

    /* ---------- Wydatki i podatki pośrednie (miesięcznie) ---------- */
    var EXP = [
      { key: 'jedzenie', label: 'Jedzenie i napoje bezalkoholowe', share: 0.25, note: 'VAT 5%' },
      { key: 'paliwo', label: 'Paliwo (benzyna)', share: 0.06, note: 'VAT 23% + akcyza + opłata paliwowa' },
      { key: 'energia', label: 'Prąd i gaz', share: 0.07, note: 'VAT 23% (akcyza na prąd pominięta — ok. 0,5% ceny)' },
      { key: 'papierosy', label: 'Papierosy', share: 0, note: 'VAT 23% + akcyza kwotowa i procentowa' },
      { key: 'epapierosy', label: 'E-papierosy i liquidy', share: 0, note: 'tylko VAT 23% — akcyza do weryfikacji' },
      { key: 'alkohol', label: 'Alkohol', share: 0, note: 'tylko VAT 23% — akcyza pominięta' },
      { key: 'vat23', label: 'Pozostałe zakupy (ubrania, elektronika, chemia, telefon, internet)', share: 0.22, note: 'VAT 23%' },
      { key: 'vat8', label: 'Usługi z VAT 8% (restauracje, bilety, hotele, woda)', share: 0.08, note: 'VAT 8%' },
      { key: 'bezvat', label: 'Bez VAT (czynsz, najem, raty, leczenie, oszczędności)', share: 0.32, note: 'bez podatków pośrednich' }
    ];

    var box = document.getElementById('expenses');
    box.innerHTML = EXP.map(function (e) {
      return '<label class="field field--row"><span class="field__label">' + esc(e.label) + '<small>' + esc(e.note) + '</small></span>' +
        '<span class="field__input"><input type="number" inputmode="decimal" min="0" step="1" data-exp="' + e.key + '" value="0"><span aria-hidden="true">zł</span></span></label>';
    }).join('');

    var cenaBenzyny = CENY.benzyna_95_zl_l.v, cenaPaczki = CENY.paczka_papierosow_zl.v;
    document.getElementById('assumptions').innerHTML =
      '<p class="small">Cena benzyny: <label class="inline-field"><input type="number" id="cena-benzyny" step="0.01" min="1" value="' + cenaBenzyny + '"> zł/l</label> (średnia krajowa: ' + num(CENY.benzyna_95_zl_l, { unit: 'zł/l', dec: 2 }) + '). ' +
      'Akcyza ' + num(mk(AK.benzyna_zl_1000l / 1000, SRC_AK), { unit: 'zł/l', dec: 3 }) + ', opłata paliwowa ' + num(mk(OP.benzyna_zl_1000l / 1000, SRC_OP), { unit: 'zł/l', dec: 3 }) + '.</p>' +
      '<p class="small">Cena paczki papierosów (20 szt.): <label class="inline-field"><input type="number" id="cena-paczki" step="0.01" min="1" value="' + cenaPaczki + '"> zł</label> (' + num(CENY.paczka_papierosow_zl, { unit: 'zł', dec: 2 }) + '). ' +
      'Akcyza: ' + num(mk(AK.papierosy.kwotowa_zl_1000szt, SRC_AK), { unit: 'zł/1000 szt.', dec: 2 }) + ' + ' + num(mk(AK.papierosy.procentowa_ceny_detalicznej * 100, SRC_AK), { unit: '% ceny', dec: 2 }) + '.</p>' +
      '<p class="small">VAT w cenie brutto: stawka 23% = 18,7% ceny, 8% = 7,4% ceny, 5% = 4,8% ceny.</p>';

    var touched = false;
    var lastNetto = 0;
    function fillBasket(nettoMies) {
      box.querySelectorAll('input[data-exp]').forEach(function (inp) {
        var e = EXP.filter(function (x) { return x.key === inp.getAttribute('data-exp'); })[0];
        inp.value = Math.round(nettoMies * e.share);
      });
    }

    function indirect() {
      var v = {}; box.querySelectorAll('input[data-exp]').forEach(function (i) { v[i.getAttribute('data-exp')] = Math.max(0, parseFloat(i.value) || 0); });
      var pb = parseFloat(document.getElementById('cena-benzyny').value) || cenaBenzyny;
      var pp = parseFloat(document.getElementById('cena-paczki').value) || cenaPaczki;
      var vat23 = function (x) { return x * 23 / 123; };
      var litry = v.paliwo / pb, paczki = v.papierosy / pp;
      var r = {};
      r.vat = v.jedzenie * 5 / 105 + vat23(v.paliwo) + vat23(v.energia) + vat23(v.papierosy) + vat23(v.epapierosy) + vat23(v.alkohol) + vat23(v.vat23) + v.vat8 * 8 / 108;
      r.akcyza = litry * AK.benzyna_zl_1000l / 1000 + paczki * 20 / 1000 * AK.papierosy.kwotowa_zl_1000szt + v.papierosy * AK.papierosy.procentowa_ceny_detalicznej;
      r.oplata = litry * OP.benzyna_zl_1000l / 1000;
      r.suma = Object.keys(v).reduce(function (s, k) { return s + v[k]; }, 0);
      return r;   // miesięcznie
    }

    /* ---------- Rysowanie wyników ---------- */
    function Z(v, src, wyl, extra) { return mk(Math.round(v), src, Object.assign({ wyliczone: wyl }, extra || {})); }
    function zlNum(val, label) { return num(val, { unit: 'zł', dec: 0, label: label }); }

    function run() {
      var fd = new FormData(form);
      var o = { typ: fd.get('typ'), tryb: fd.get('tryb'), kup300: !!fd.get('kup300'), mlody: !!fd.get('mlody'), rok: fd.get('rok') };
      document.getElementById('uop-options').hidden = o.typ !== 'uop';
      var amount = Math.max(0, parseFloat(kwota.value) || 0);
      var calc = o.typ === 'uop' ? uop : emeryt;
      var bruttoMies = o.tryb === 'brutto' ? amount : fromNetto(amount, calc, o);
      var r = calc(bruttoMies, o);
      var m = function (x) { return x / 12; };
      var nettoMies = m(r.netto);
      lastNetto = nettoMies;
      if (!touched) fillBasket(nettoMies);
      var ind = indirect();

      var rokTxt = o.rok === '2027' ? 'projekt 2027' : 'zasady 2026';
      var srcPIT = o.rok === '2027' ? SRC_PL.concat(['mf_uzas_2027']) : SRC_PL;
      var srcMlody = o.mlody ? ['mf_kas_mlodzi'] : [];

      var directM = m(r.zus + r.zdrowotna + r.pit);
      var indirectM = ind.vat + ind.akcyza + ind.oplata;
      var employerM = m(r.pracodawca);
      var totalM = directM + indirectM + employerM;
      var costM = m(r.kosztPracy);

      // KPI
      document.getElementById('calc-kpis').innerHTML = [
        ['Brutto', Z(m(r.brutto), SRC_PL, o.tryb === 'netto' ? 'wyliczone z netto (' + rokTxt + ')' : 'wpisana kwota')],
        ['Netto (na rękę)', Z(nettoMies, srcPIT.concat(srcMlody), 'brutto − składki ZUS − zdrowotna − PIT (' + rokTxt + ', średnio miesięcznie)')],
        [o.typ === 'uop' ? 'Koszt pracodawcy' : 'Wypłata brutto', Z(costM, SRC_PL, o.typ === 'uop' ? 'brutto + składki pracodawcy (emerytalna, rentowa, wypadkowa 1,67%, FP+FS, FGŚP); bez PPK' : 'emerytura brutto')],
        ['Wszystkie podatki i składki', Z(totalM, SRC_PL.concat(SRC_AK, SRC_OP), 'składki i PIT od pensji + ' + (o.typ === 'uop' ? 'składki pracodawcy + ' : '') + 'VAT, akcyza i opłata paliwowa z wydatków')]
      ].map(function (k, i) {
        var extra = i === 3 ? '<p class="kpi__sub">' + fmt(totalM / costM * 100, 0) + '% ' + (o.typ === 'uop' ? 'kosztu Twojej pracy' : 'emerytury brutto') + '</p>' : '';
        return '<div class="calc-kpi"><p class="kpi__label">' + esc(k[0]) + '</p><p class="kpi__value kpi__value--sm">' + num(k[1], { unit: 'zł', dec: 0, text: fmt(k[1].v, 0), label: k[0] }) + '<span class="kpi__unit"> zł</span></p>' + extra + '</div>';
      }).join('');

      // „Pasek wypłaty”
      var rows = [];
      if (o.typ === 'uop') {
        rows.push(['Składka emerytalna (9,76%)', Z(m(r.emerytalna), SRC_PL, '9,76% brutto (do limitu 30-krotności)'), 'ZUS — Twoje konto emerytalne']);
        rows.push(['Składka rentowa (1,5%)', Z(m(r.rentowa), SRC_PL, '1,5% brutto'), 'ZUS']);
        rows.push(['Składka chorobowa (2,45%)', Z(m(r.chorobowa), SRC_PL, '2,45% brutto'), 'ZUS']);
      }
      rows.push(['Składka zdrowotna (9%)', Z(m(r.zdrowotna), SRC_PL, o.typ === 'uop' ? '9% × (brutto − składki społeczne)' : '9% emerytury brutto'), 'NFZ']);
      rows.push(['Podatek PIT', Z(m(r.pit), srcPIT.concat(srcMlody), 'skala PIT (' + rokTxt + ') od rocznej podstawy ' + fmt(r.podstawa, 0) + ' zł, minus kwota zmniejszająca 3600 zł rocznie' + (o.mlody ? '; przychód do limitu ulgi dla młodych zwolniony' : '')), 'ok. ' + fmt(SHARE_JST * 100, 0) + '% samorządy, reszta budżet państwa']);
      rows.push(['<strong>Netto</strong>', Z(nettoMies, srcPIT, 'brutto − powyższe'), 'Ty']);
      if (o.typ === 'uop') {
        rows.push(['Składki pracodawcy (ponad brutto)', Z(employerM, SRC_PL, 'emerytalna 9,76%, rentowa 6,5%, wypadkowa 1,67% (typowa), Fundusz Pracy i Solidarnościowy 2,45%, FGŚP 0,1%'), 'ZUS, Fundusz Pracy, FGŚP']);
      }
      table(document.getElementById('calc-payslip'), {
        cols: [{ head: 'Pozycja · dokąd trafia' }, { head: 'Miesięcznie', cls: 'n' }],
        rows: rows.map(function (r0) { return [r0[0] + '<br><span class="small muted" style="font-weight:400">' + esc(r0[2]) + '</span>', zlNum(r0[1], r0[0].replace(/<[^>]+>/g, ''))]; })
      });

      // Sprawdzenie koszyka
      var diff = nettoMies - ind.suma;
      document.getElementById('basket-check').innerHTML = 'Suma wydatków: <strong>' + fmt(ind.suma, 0) + ' zł</strong> · ' +
        (Math.abs(diff) < 1 ? 'równa pensji netto.' : diff > 0 ? 'zostaje ' + fmt(diff, 0) + ' zł z pensji netto (bez podatków pośrednich).' : '<span class="delta--up-bad">o ' + fmt(-diff, 0) + ' zł więcej niż netto.</span>');

      // Przepływy roczne
      var Y = function (x) { return x * 12; };
      var pitJ = r.pit * SHARE_JST, pitB = r.pit - pitJ;
      var zusAll = r.zus + r.pr_emerytalna + r.pr_rentowa + r.pr_wypadkowa;
      var flows = [
        { label: 'Budżet państwa (VAT, akcyza, część PIT)', v: Y(ind.vat + ind.akcyza) + pitB, wyl: 'VAT + akcyza z wydatków ×12 + ' + fmt((1 - SHARE_JST) * 100, 0) + '% PIT', src: SRC_AK.concat(['mf_uzas_2027']) },
        { label: 'ZUS — emerytury, renty, zasiłki', v: zusAll, wyl: 'składki społeczne pracownika' + (o.typ === 'uop' ? ' i pracodawcy (emerytalna, rentowa, wypadkowa)' : ''), src: SRC_PL },
        { label: 'NFZ — leczenie', v: r.zdrowotna, wyl: 'składka zdrowotna ×12', src: SRC_PL },
        { label: 'Samorządy (gmina, powiat, województwo)', v: pitJ, wyl: fmt(SHARE_JST * 100, 1) + '% PIT — udział JST w projekcie 2027 (' + fmt(pitJST) + ' z ' + fmt(pitJST + pitBP) + ' mld zł)', src: ['mf_uzas_2027'] },
        { label: 'Fundusz Pracy, Solidarnościowy, FGŚP', v: r.pr_fp + r.pr_fgsp, wyl: 'składki pracodawcy 2,45% + 0,1%', src: SRC_PL },
        { label: 'Fundusze drogowe (opłata paliwowa)', v: Y(ind.oplata), wyl: 'opłata paliwowa × litry ×12', src: SRC_OP }
      ].filter(function (f) { return f.v > 0.5; });
      hbar(document.getElementById('calc-flows'), {
        series: [{ name: 'rocznie', cls: 1 }], unit: 'zł', dec: 0,
        rows: flows.map(function (f) { return { label: f.label, values: [Z(f.v, f.src, f.wyl)] }; })
      });

      // Ty a budżet
      var yb = o.rok === '2027' ? '2027' : '2026';
      var B_ = L(yb);
      var contrib = Y(ind.vat + ind.akcyza) + pitB;
      var ratio = B_.wydatki.ogolem.v / B_.dochody.ogolem.v;
      var perPersonSpend = perPerson(B_.wydatki.ogolem.v);
      document.getElementById('calc-budget-summary').innerHTML =
        '<p>Do budżetu państwa wpłacasz rocznie ok. <strong>' + zlNum(Z(contrib, SRC_AK.concat(['mf_uzas_2027']), 'VAT + akcyza + część PIT'), 'Twój wkład do budżetu państwa') + '</strong>.</p>' +
        '<p>Budżet ' + yb + ' wydaje ' + num(mk(ratio, B_.wydatki.ogolem.src.concat(B_.dochody.ogolem.src), { wyliczone: 'wydatki / dochody budżetu ' + yb }), { unit: 'zł', dec: 2 }) + ' na każdą złotówkę dochodów. Na Twoje ' + fmt(contrib, 0) +
        ' zł przypada więc ok. <strong>' + zlNum(Z(contrib * (ratio - 1), B_.deficyt.src, 'Twój wkład × (wydatki/dochody − 1)'), 'Pożyczone „na Ciebie”') + '</strong> wydatków finansowanych długiem.</p>' +
        '<p class="small muted">Dla porównania: wydatki budżetu na jednego mieszkańca to ' + zlNum(Z(perPersonSpend, B_.wydatki.ogolem.src.concat(['gus_ludnosc_2025']), 'wydatki budżetu / ludność'), 'Wydatki na mieszkańca') + ' rocznie.</p>';

      // Na co budżet wyda Twój wkład
      document.getElementById('alloc-title').textContent = 'Na co budżet państwa wyda Twoje ' + fmt(contrib, 0) + ' zł rocznie';
      document.getElementById('alloc-lead').textContent = 'Twój wkład rozłożony proporcjonalnie na działy wydatków budżetu ' + yb + ' (' + (yb === '2027' ? 'projekt' : 'ustawa') + '). Podatki nie są „znaczone” — to udział, nie konkretne przelewy.';
      var dz = dzialy(yb).filter(function (d) { return d.val.v > 0; }).sort(function (a, b) { return b.val.v - a.val.v; });
      var tot = B_.wydatki.ogolem.v;
      var top = dz.slice(0, 10), restV = dz.slice(10).reduce(function (s, d) { return s + d.val.v; }, 0);
      var arows = top.map(function (d) { return { label: dzialName(d), values: [Z(contrib * d.val.v / tot, d.val.src, 'Twój wkład × udział działu w wydatkach (' + fmt(d.val.v / tot * 100, 1) + '%)')] }; });
      arows.push({ label: 'Pozostałe działy (' + (dz.length - 10) + ')', values: [Z(contrib * restV / tot, B_.wydatki.ogolem.src, 'Twój wkład × udział pozostałych działów')] });
      hbar(document.getElementById('calc-alloc'), { series: [{ name: yb, cls: yb === '2027' ? 3 : 2 }], unit: 'zł', dec: 0, rows: arows });

      // Wybrane programy (tylko 2027 — dane w projekcie)
      var pr = D.programy_spoleczne, w = L('2027').wydatki, ob = D.obszary;
      var items = [
        ['Obsługa długu (odsetki)', w.obsluga_dlugu_sp], ['Obronność z budżetu państwa', ob.obronnosc['2027'].budzet_panstwa],
        ['Rodzina 800+', pr.rodzina_800_plus['2027']], ['Dotacja do ZUS (FUS)', w.dotacja_fus], ['Składka do budżetu UE', w.skladka_do_budzetu_ue],
        ['13. i 14. emerytura', pr.emerytura_13_i_14['2027']], ['Ochrona zdrowia z budżetu państwa', ob.zdrowie['2027'].z_budzetu_panstwa]
      ];
      var t27 = L('2027').wydatki.ogolem.v;
      table(document.getElementById('calc-items'), {
        cols: [{ head: 'Pozycja (budżet 2027)' }, { head: 'Kwota', cls: 'n' }, { head: 'Z Twoich podatków rocznie', cls: 'n' }],
        rows: items.map(function (it) { return [esc(it[0]), num(it[1]), zlNum(Z(contrib * it[1].v / t27, it[1].src, 'Twój wkład × udział pozycji w wydatkach 2027'), it[0])]; })
      });
    }

    // Zdarzenia: każda zmiana formularza przelicza wynik
    form.addEventListener('input', run);
    form.addEventListener('change', function (e) {
      if (e.target.name === 'tryb' || e.target.name === 'typ') {
        var hint = document.getElementById('kwota-hint');
        var t = form.querySelector('input[name=tryb]:checked').value, typ = form.querySelector('input[name=typ]:checked').value;
        hint.textContent = typ === 'emeryt' ? 'Wpisz emeryturę ' + t + ' (miesięcznie).' : t === 'netto' ? 'Kwota „na rękę” z paska wypłaty.' : 'Kwota z umowy o pracę.';
      }
      run();
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    // Edycja kategorii: pole „Bez VAT” domyka budżet do kwoty netto,
    // dopóki użytkownik sam go nie zmieni.
    var restTouched = false;
    box.addEventListener('input', function (e) {
      touched = true;
      var rest = box.querySelector('input[data-exp=bezvat]');
      if (e.target === rest) { restTouched = true; }
      else if (!restTouched) {
        var others = 0;
        box.querySelectorAll('input[data-exp]').forEach(function (i) { if (i !== rest) others += Math.max(0, parseFloat(i.value) || 0); });
        rest.value = Math.max(0, Math.round(lastNetto - others));
      }
      run();
    });
    document.getElementById('assumptions').addEventListener('input', run);
    document.getElementById('fill-basket').addEventListener('click', function () { touched = false; restTouched = false; run(); });
    run();
  };

  /* ===== ŹRÓDŁA ===== */
  pages.zrodla = function () {
    var used = {};
    (function walk(x) {
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (x && typeof x === 'object') {
        if (Array.isArray(x.src)) x.src.forEach(function (s) { used[s] = (used[s] || 0) + 1; });
        Object.keys(x).forEach(function (k) { if (k !== 'zrodla') walk(x[k]); });
      }
    })(D);
    var primary = /^(mf_|nik_|eurostat|gus_|sejm_|konstytucja)/;
    function list(filter) {
      return '<ol class="list-tight">' + Object.keys(D.zrodla).filter(filter).sort(function (a, b) { return (used[b] || 0) - (used[a] || 0); }).map(function (id) {
        var s = D.zrodla[id];
        return '<li id="src-' + esc(id) + '"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.tytul) + '</a><br><span class="small muted">' + esc(s.wydawca) + ' · ' + esc(s.data) + ' · użyte przy ' + (used[id] || 0) + ' wartościach</span></li>';
      }).join('') + '</ol>';
    }
    set('src-primary', list(function (id) { return primary.test(id); }));
    set('src-secondary', list(function (id) { return !primary.test(id); }));
    set('src-meta', 'Dane w stanie na ' + esc(D.meta.stan_na) + '. Łącznie ' + Object.keys(D.zrodla).length + ' źródeł. Pełne dane: <a href="data/budzet.json">data/budzet.json</a>.');
  };

  /* ===== METODOLOGIA ===== */
  pages.metodologia = function () {
    set('meta-state', 'Stan danych: <strong>' + esc(D.meta.stan_na) + '</strong>. ' + esc(D.meta.zasady));
    set('todo', '<ul class="list-tight">' + D.do_uzupelnienia.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>');
    set('pop', 'Przeliczenia „na mieszkańca” używają liczby ludności na koniec 2025 r.: ' + num(D.na_osobe.ludnosc_mln, { unit: 'mln', dec: 3 }) + '.');
  };

  pages.slowniczek = function () { /* treść statyczna w HTML */ };

  /* ----------------------------------------------------------
     6. START — wczytanie danych i uruchomienie renderera strony
     fetch() wymaga serwera HTTP (GitHub Pages lub lokalnie
     `python3 -m http.server`). Otwarcie pliku z dysku (file://)
     pokaże komunikat z instrukcją.
  ---------------------------------------------------------- */
  var page = document.body.getAttribute('data-page');
  var status = document.getElementById('data-status');

  fetch('data/budzet.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      D = data;
      POP = data.na_osobe.ludnosc_mln.v * 1e6;
      if (pages[page]) pages[page]();
      if (status) status.remove();
    })
    .catch(function (err) {
      if (status) {
        status.classList.add('data-status--error');
        status.textContent = 'Nie udało się wczytać danych (' + err.message + '). Jeśli otwierasz stronę z dysku, uruchom lokalny serwer: python3 -m http.server — i wejdź na http://localhost:8000';
      }
    });

})();
