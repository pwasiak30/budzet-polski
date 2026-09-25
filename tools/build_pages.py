# Generuje podstrony HTML z jednego szablonu (nagłówek, sprite, FAB, stopka identyczne na każdej stronie).
# Użycie (z katalogu głównego repozytorium):  python3 tools/build_pages.py
# Edytuj treść podstron w stałych START, DOCHODY, WYDATKI… poniżej, a nie bezpośrednio w plikach *.html —
# inaczej zmiany znikną przy następnym uruchomieniu skryptu.
import os
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV = [("index.html", "Start"), ("dochody.html", "Dochody"), ("wydatki.html", "Wydatki"), ("dlug.html", "Deficyt i dług"),
       ("slowniczek.html", "Słowniczek"), ("metodologia.html", "Metodologia"), ("zrodla.html", "Źródła")]

SPRITE = open(os.path.join(os.path.dirname(__file__), "sprite.html"), encoding="utf-8").read()

SOCIAL = [("https://x.com/panserhjertet", "X (Twitter)", "x", ""), ("https://www.linkedin.com/in/pwasiak30/", "LinkedIn", "linkedin", ""),
          ("https://www.youtube.com/@WasiakYT", "YouTube", "youtube", ""), ("https://www.instagram.com/psychologia.wasiak/", "Instagram", "instagram", ""),
          ("https://www.facebook.com/psychologia.wasiak", "Facebook", "facebook", ""), ("https://github.com/pwasiak30", "GitHub", "github", ""),
          ("https://linktree.wasiakpawel.pl/", "Linktree", "linktree", "accent"), ("https://mastodon.social/@s3in610", "Mastodon", "mastodon", "")]

def fab():
    rows = []
    for url, name, icon, acc in SOCIAL:
        cls = "social-fab__link" + (" social-fab__link--accent" if acc else "")
        rows.append(f'    <a href="{url}" target="_blank" rel="noopener me" aria-label="{name}" class="{cls}">\n      <svg class="icon" width="18" height="18" aria-hidden="true"><use href="#icon-{icon}"></use></svg>\n    </a>')
    return "\n".join(rows)

def footer_links():
    rows = []
    for url, name, icon, acc in SOCIAL:
        cls = ' class="social-links__accent"' if acc else ""
        rows.append(f'        <a href="{url}" target="_blank" rel="noopener me" aria-label="{name}"{cls}>\n          <svg class="icon" width="16" height="16" aria-hidden="true"><use href="#icon-{icon}"></use></svg>\n        </a>')
    return "\n".join(rows)

def page(fname, title, desc, data_page, main):
    CUR = ' aria-current="page"'
    nav = "\n".join(f'        <a href="{h}"{CUR if h == fname else ""}>{t}</a>' for h, t in NAV)
    return f'''<!DOCTYPE html>
<html lang="pl" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Budżet Polski 2025–2027</title>
  <meta name="description" content="{desc}">
  <meta name="color-scheme" content="light dark">

  <!-- ============================================================
       CZCIONKI
       Red Hat Display — nagłówki / elementy display
       Inter — tekst podstawowy
       JetBrains Mono — etykiety, dane, elementy techniczne
  ============================================================= -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="assets/style.css">
  <script src="assets/app.js" defer></script>
</head>
<body data-page="{data_page}">

  <a class="skip-link" href="#tresc">Przejdź do treści</a>

{SPRITE}

  <!-- ============================================================
       NAGŁÓWEK / NAWIGACJA
       Ta sama nawigacja na każdej podstronie; aktywna ma aria-current.
  ============================================================= -->
  <header class="site-header">
    <div class="container site-header__inner">
      <a href="index.html" class="logo">Budżet<span class="logo__accent">Polski</span></a>

      <nav class="main-nav" aria-label="Nawigacja główna">
{nav}
      </nav>

      <button type="button" class="theme-toggle" id="themeToggle" aria-label="Przełącz tryb jasny/ciemny">
        <svg class="icon icon--sun" width="18" height="18" aria-hidden="true"><use href="#icon-sun"></use></svg>
        <svg class="icon icon--moon" width="18" height="18" aria-hidden="true"><use href="#icon-moon"></use></svg>
      </button>
    </div>
  </header>

  <main id="tresc">
    <p class="container data-status" id="data-status" role="status">Wczytywanie danych…</p>
{main}
  </main>

  <!-- ============================================================
       SOCIAL FAB — stały, statyczny pasek linków autora
       Desktop (≥768px): pionowa kolumna, lewy dolny róg.
       Mobile (<768px): pozioma pigułka na dole ekranu.
       BEZ JS do rozwijania. Prawy dolny róg zarezerwowany dla CTA projektu.
  ============================================================= -->
  <nav class="social-fab" aria-label="Profile społecznościowe autora">
{fab()}
  </nav>

  <!-- ============================================================
       STOPKA — linki autora, licencja, portfolio, stan danych
  ============================================================= -->
  <footer class="site-footer">
    <div class="container site-footer__inner">

      <div class="social-links" aria-label="Profile społecznościowe autora">
{footer_links()}
      </div>

      <p class="site-footer__data">Dane: Ministerstwo Finansów, NIK, Eurostat, GUS — stan na 25.09.2026 · <a href="zrodla.html">wszystkie źródła</a> · <a href="data/budzet.json">dane (JSON)</a></p>
      <p class="site-footer__copyright">
        © <span id="currentYear">2026</span> Paweł Wasiak. Licencja Apache 2.0.
      </p>
      <p class="site-footer__portfolio">
        Zobacz więcej projektów na <a href="https://wasiakpawel.pl" target="_blank" rel="noopener">wasiakpawel.pl</a>
      </p>

    </div>
  </footer>

</body>
</html>
'''

HOW_TO = '<p class="small muted">Liczby z <span style="text-decoration:underline dotted">kropkowanym podkreśleniem</span> pokazują źródło po najechaniu, fokusie lub dotknięciu. Kreskowane = wartość wyliczona, pomarańczowa kropka = do weryfikacji.</p>'

START = f'''
    <!-- HERO -->
    <section class="hero container">
      <p class="eyebrow">Projekt open-source · Licencja Apache 2.0 · dane: stan na 25.09.2026</p>
      <h1 class="hero__title">Budżet Polski 2025–2027 bez żargonu</h1>
      <p class="hero__lead">
        Ile państwo zarabia, na co wydaje i ile pożycza — wykonanie 2025, ustawa na 2026 i projekt na 2027
        w jednym miejscu. Przy każdej liczbie jest źródło, a duże kwoty przeliczamy na mieszkańca.
      </p>
      <div class="hero__actions">
        <a href="wydatki.html" class="btn btn--primary">Na co idą pieniądze</a>
        <a href="dlug.html" class="btn btn--ghost">Deficyt i dług</a>
      </div>
    </section>

    <!-- KAFELKI KPI: projekt 2027 vs ustawa 2026 -->
    <section class="container" aria-label="Najważniejsze liczby projektu budżetu 2027">
      <div class="kpi-grid" id="kpi"></div>
      {HOW_TO}
    </section>

    <!-- BENTO -->
    <section class="bento container">
      <div class="bento-grid">

        <article class="glass-card bento-item bento-item--full">
          <h2>Trzy budżety obok siebie</h2>
          <p class="muted">2025 to wykonanie (ile naprawdę wpłynęło i wydano), 2026 — obowiązująca ustawa, 2027 — projekt rządu przed pracami w Sejmie.</p>
          <div id="chart-years"></div>
          <details class="more"><summary>Pokaż jako tabelę</summary><div id="table-years"></div></details>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Na co idzie każde 100 zł wydatków (2027)</h2>
          <p class="muted small">Działy klasyfikacji budżetowej. „Różne rozliczenia” to głównie subwencje dla samorządów, składka do UE i rezerwy.</p>
          <div id="chart-where"></div>
          <p class="small"><a href="wydatki.html">Wszystkie działy i porównanie lat →</a></p>
        </article>

        <article class="glass-card bento-item">
          <h2>Wykonanie 2026 po sierpniu</h2>
          <p class="muted small">Pionowa kreska = upłynęło 8 z 12 miesięcy (66,7%).</p>
          <div class="progress" id="progress-2026"></div>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Skąd państwo ma pieniądze (2027)</h2>
          <div id="chart-income"></div>
          <p class="small"><a href="dochody.html">Szczegóły dochodów i zmiany podatkowe →</a></p>
        </article>

        <article class="glass-card bento-item">
          <h2>Budżet to nie wszystko</h2>
          <div id="outside"></div>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Dług w relacji do PKB</h2>
          <div id="chart-debt"></div>
          <p class="small muted" id="debt-note"></p>
          <p class="small"><a href="dlug.html">Cztery definicje długu, progi i porównanie z UE →</a></p>
        </article>

        <article class="glass-card bento-item">
          <h2>Na jednego mieszkańca</h2>
          <div id="per-person"></div>
        </article>

      </div>
    </section>
'''

DOCHODY = f'''
    <section class="hero hero--page container">
      <p class="eyebrow">Dochody budżetu państwa</p>
      <h1 class="hero__title">Skąd państwo ma pieniądze</h1>
      <p class="hero__lead">Ponad połowa dochodów budżetu państwa to VAT. Poniżej wszystkie podatki i dochody niepodatkowe
        w trzech latach oraz zmiany podatkowe zapisane w projekcie na 2027 r.</p>
      {HOW_TO}
    </section>

    <section class="bento container">
      <div class="bento-grid">

        <article class="glass-card bento-item bento-item--full">
          <h2>Główne źródła dochodów</h2>
          <div id="chart-income"></div>
          <details class="more" open><summary>Pełna tabela (z planem 2025 i przewidywanym wykonaniem 2026)</summary><div id="table-income"></div></details>
          <p class="small muted" style="margin-top:0.75rem">Kolumna „2027 vs 2026 przew.” porównuje projekt z przewidywanym wykonaniem 2026 — tak robi Ministerstwo Finansów, bo ustawa na 2026 okazała się zbyt optymistyczna.</p>
        </article>

        <article class="glass-card bento-item">
          <h2>Dlaczego PIT w budżecie jest „mały”</h2>
          <div id="pit-box"></div>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Dochody niepodatkowe</h2>
          <div id="table-nontax"></div>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Zmiany podatkowe w projekcie na 2027</h2>
          <div id="changes-2027"></div>
        </article>

        <article class="glass-card bento-item">
          <h2>2026: wpłynie mniej, niż zakładano</h2>
          <div id="pw-2026"></div>
        </article>

      </div>
    </section>
'''

WYDATKI = f'''
    <section class="hero hero--page container">
      <p class="eyebrow">Wydatki budżetu państwa</p>
      <h1 class="hero__title">Na co idą pieniądze</h1>
      <p class="hero__lead">Wydatki według działów klasyfikacji budżetowej, najważniejsze pozycje projektu 2027
        i pieniądze wydawane obok budżetu — przez fundusze w BGK i NFZ.</p>
      {HOW_TO}
    </section>

    <section class="bento container">
      <div class="bento-grid">

        <article class="glass-card bento-item bento-item--full">
          <h2>Wydatki według działów</h2>
          <div class="seg" id="seg-year" role="group" aria-label="Wybierz rok">
            <button type="button" data-value="2025" aria-pressed="false">2025 — wykonanie</button>
            <button type="button" data-value="2026" aria-pressed="false">2026 — ustawa</button>
            <button type="button" data-value="2027" aria-pressed="true">2027 — projekt</button>
          </div>
          <p class="small" id="sections-total" aria-live="polite"></p>
          <div id="chart-sections"></div>
          <details class="more"><summary>Wszystkie 33 działy — tabela z porównaniem lat</summary><div id="table-sections"></div></details>
          <p class="callout small" id="sections-note"></p>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Największe pozycje projektu 2027</h2>
          <div id="chart-items"></div>
        </article>

        <article class="glass-card bento-item">
          <h2>Rodzaje wydatków (2027)</h2>
          <p class="small muted">Ponad 60% budżetu to przelewy do innych: samorządów, ZUS, NFZ, UE i obywateli.</p>
          <div id="chart-groups"></div>
        </article>

        <article class="glass-card bento-item bento-item--full">
          <h2>Obszary razem z funduszami poza budżetem</h2>
          <p class="muted small">Rząd podaje wydatki na obronność czy zdrowie łącznie ze źródłami spoza ustawy budżetowej. Tu widać, ile z tego jest w samym budżecie.</p>
          <div id="table-areas"></div>
        </article>

        <article class="glass-card bento-item bento-item--full">
          <h2>Cały sektor finansów publicznych (2025)</h2>
          <p class="muted small">Budżet państwa, samorządy, ZUS, NFZ i fundusze celowe razem — według funkcji (dane NIK).</p>
          <div id="chart-sector"></div>
          <p class="small muted" id="sector-total"></p>
        </article>

        <article class="glass-card bento-item bento-item--full">
          <h2>Fundusze przy BGK (2027)</h2>
          <p class="small muted">Poza ustawą budżetową, ale ich zadłużenie wlicza się do długu wg definicji UE.</p>
          <div id="table-bgk"></div>
        </article>

      </div>
    </section>
'''

DLUG = f'''
    <section class="hero hero--page container">
      <p class="eyebrow">Deficyt i dług publiczny</p>
      <h1 class="hero__title">Ile pożyczamy i ile to kosztuje</h1>
      <p class="hero__lead">Deficyt to roczna dziura w budżecie, dług — suma wszystkich dziur z przeszłości.
        Polska ma dziś jeden z najwyższych deficytów w UE, a dług zbliża się do ustawowego progu 55% PKB.</p>
      {HOW_TO}
    </section>

    <section class="container" aria-label="Najważniejsze liczby o długu">
      <div class="kpi-grid" id="kpi"></div>
    </section>

    <section class="bento container">
      <div class="bento-grid">

        <article class="glass-card bento-item bento-item--full">
          <h2>Dług według czterech definicji</h2>
          <div class="seg" id="seg-variant" role="group" aria-label="Wariant prognozy">
            <button type="button" data-value="przewidywane" aria-pressed="true">Prognoza przewidywana</button>
            <button type="button" data-value="limity" aria-pressed="false">Pełne wykorzystanie limitów deficytu</button>
          </div>
          <div id="chart-debt"></div>
          <details class="more"><summary>Kwoty w mld zł (tabela)</summary><div id="table-debt"></div></details>
          <p class="callout small" id="prog-55"></p>
        </article>

        <article class="glass-card bento-item bento-item--full">
          <h2>Deficyt: budżet państwa a cały sektor</h2>
          <div id="table-deficit"></div>
          <p class="small muted" style="margin-top:0.75rem">Deficyt sektora wg UE obejmuje też samorządy, ZUS, NFZ i fundusze BGK (m.in. Fundusz Wsparcia Sił Zbrojnych), dlatego jest wyższy od deficytu samego budżetu.</p>
        </article>

        <article class="glass-card bento-item bento-item--wide">
          <h2>Deficyt w UE (2025, % PKB)</h2>
          <div id="chart-eu-deficit"></div>
        </article>

        <article class="glass-card bento-item">
          <h2>Procedura nadmiernego deficytu</h2>
          <p id="edp"></p>
          <p class="small muted">Wartości referencyjne UE: deficyt do 3% PKB, dług do 60% PKB (Traktat o funkcjonowaniu UE).</p>
        </article>

        <article class="glass-card bento-item bento-item--full">
          <h2>Dług w UE (2025, % PKB)</h2>
          <div id="chart-eu-debt"></div>
        </article>

        <article class="glass-card bento-item bento-item--full">
          <h2>Na co wydają państwa UE (2024, % PKB)</h2>
          <p class="small muted">Wydatki całego sektora wg funkcji COFOG (Eurostat). Obrona w tej klasyfikacji różni się od definicji NATO.</p>
          <div id="table-cofog"></div>
        </article>

      </div>
    </section>
'''

SLOWNICZEK = '''
    <section class="hero hero--page container">
      <p class="eyebrow">Słowniczek</p>
      <h1 class="hero__title">Pojęcia budżetowe po ludzku</h1>
      <p class="hero__lead">Najczęściej mylone terminy — krótko i bez żargonu.</p>
    </section>

    <section class="about container">
      <div class="glass-card about__card">
        <dl class="glossary">
          <dt id="budzet-panstwa">Budżet państwa</dt>
          <dd>Roczny plan dochodów i wydatków rządu uchwalany jako ustawa budżetowa. Nie obejmuje samorządów, ZUS, NFZ ani funduszy w BGK — to tylko część finansów publicznych.</dd>

          <dt id="ustawa-budzetowa">Ustawa budżetowa / projekt</dt>
          <dd>Projekt przygotowuje rząd (do 30 września), uchwala Sejm, poprawia Senat, podpisuje Prezydent. Ustawa to plan — wykonanie poznajemy dopiero w sprawozdaniu po zakończeniu roku.</dd>

          <dt id="wykonanie">Wykonanie</dt>
          <dd>Ile faktycznie wpłynęło i ile wydano. Zwykle wydatki są niższe od planu o kilka procent (niewykonanie), a dochody — różnie.</dd>

          <dt id="przewidywane-wykonanie">Przewidywane wykonanie</dt>
          <dd>Szacunek Ministerstwa Finansów, jak zakończy się bieżący rok. Służy za punkt odniesienia dla projektu na kolejny rok.</dd>

          <dt id="deficyt">Deficyt</dt>
          <dd>Różnica między wydatkami a dochodami w jednym roku. Pokrywa się ją pożyczkami, więc deficyt zwiększa dług.</dd>

          <dt id="dlug">Dług publiczny</dt>
          <dd>Suma zobowiązań państwa narosłych przez lata. Ma kilka definicji: krajową (państwowy dług publiczny), „kwotę z art. 38a” (od niej liczy się progi ostrożnościowe) i unijną (dług sektora instytucji rządowych i samorządowych, z funduszami BGK).</dd>

          <dt id="sektor-gg">Sektor instytucji rządowych i samorządowych (GG)</dt>
          <dd>Definicja unijna całego „państwa”: rząd, samorządy, ZUS, NFZ, fundusze BGK i inne. Według niej UE ocenia deficyt (3% PKB) i dług (60% PKB).</dd>

          <dt id="pkb">PKB</dt>
          <dd>Wartość wszystkiego, co wytworzono w kraju w ciągu roku. Relacja do PKB pozwala porównywać kwoty między latami i krajami.</dd>

          <dt id="obsluga-dlugu">Obsługa długu</dt>
          <dd>Głównie odsetki od obligacji i kredytów. To wydatek, który nie kupuje żadnej usługi — koszt wcześniejszych pożyczek.</dd>

          <dt id="progi">Progi ostrożnościowe (55% i 60%)</dt>
          <dd>Jeśli dług (liczony jako kwota z art. 38a ustawy o finansach publicznych) przekroczy 55% PKB, budżet na kolejny rok musi obniżać relację długu do PKB — co oznacza m.in. zamrożenie płac w sferze budżetowej. 60% to limit zapisany w Konstytucji.</dd>

          <dt id="edp">Procedura nadmiernego deficytu (EDP)</dt>
          <dd>Unijna procedura wobec krajów z deficytem powyżej 3% PKB. Polska jest nią objęta od lipca 2024 r. i ma zlikwidować nadmierny deficyt do 2028 r.</dd>

          <dt id="regula-wydatkowa">Stabilizująca reguła wydatkowa</dt>
          <dd>Krajowy wzór ograniczający, o ile mogą rosnąć wydatki większości instytucji publicznych. Wydatki obronne mają w niej szczególne traktowanie („klauzula obronna”).</dd>

          <dt id="bgk">Fundusze przy BGK</dt>
          <dd>Fundusze zarządzane przez Bank Gospodarstwa Krajowego, np. Fundusz Wsparcia Sił Zbrojnych czy Krajowy Fundusz Drogowy. Działają obok budżetu, często na pożyczkach — dlatego krytycy mówią o „ukrywaniu” części wydatków i długu.</dd>

          <dt id="fwsz">Fundusz Wsparcia Sił Zbrojnych (FWSZ)</dt>
          <dd>Fundusz w BGK finansujący głównie zakupy uzbrojenia. W 2027 r. ma wydać 66,4 mld zł netto — ok. jednej trzeciej wszystkich wydatków na obronność.</dd>

          <dt id="safe">SAFE</dt>
          <dd>Unijny instrument pożyczek na zbrojenia. Zakupy w ramach SAFE są zwolnione z VAT, co obniża wpływy z VAT, ale pozwala kupić więcej sprzętu za tę samą kwotę.</dd>

          <dt id="dzial">Dział i część budżetowa</dt>
          <dd>Dział to obszar tematyczny wydatku (np. 851 Ochrona zdrowia), część — instytucja, która wydaje (np. część 29 Obrona narodowa). Ta sama kwota może być w dziale „obrona”, a w części innego ministerstwa.</dd>

          <dt id="subwencja">Subwencja</dt>
          <dd>Pieniądze z budżetu państwa dla samorządów, którymi same dysponują (np. subwencja oświatowa). Dotacja jest przeznaczona na konkretny cel.</dd>

          <dt id="dochody-niepodatkowe">Dochody niepodatkowe</dt>
          <dd>Wpływy inne niż podatki: dywidendy ze spółek Skarbu Państwa, cło, sprzedaż uprawnień do emisji CO2, opłaty i grzywny.</dd>

          <dt id="bse">Budżet środków europejskich</dt>
          <dd>Osobny budżet na programy finansowane z UE (fundusze strukturalne, rolnictwo). Ma własne dochody, wydatki i wynik, który też trzeba sfinansować.</dd>

          <dt id="potrzeby-pozyczkowe">Potrzeby pożyczkowe</dt>
          <dd>Ile państwo musi pożyczyć w roku: deficyt budżetu, deficyt budżetu środków europejskich i inne potrzeby (netto) plus wykup starego długu (brutto).</dd>

          <dt id="cofog">COFOG</dt>
          <dd>Międzynarodowa klasyfikacja wydatków państwa według funkcji (zdrowie, obrona, edukacja…). Pozwala porównywać kraje UE.</dd>
        </dl>
      </div>
    </section>
'''

METODOLOGIA = '''
    <section class="hero hero--page container">
      <p class="eyebrow">Metodologia i zastrzeżenia</p>
      <h1 class="hero__title">Skąd te liczby i czego nie pokazują</h1>
      <p class="hero__lead">Dla dziennikarzy i wszystkich, którzy chcą cytować dane z tej strony.</p>
    </section>

    <section class="about container">
      <div class="glass-card about__card prose">
        <h2>Stan danych</h2>
        <p id="meta-state"></p>

        <h2>Co porównujemy</h2>
        <ul class="list-tight">
          <li><strong>2025 — wykonanie</strong>: Sprawozdanie z wykonania budżetu państwa za 2025 r. (MF, 31.05.2026). Plan 2025 = ustawa budżetowa na 2025 r.</li>
          <li><strong>2026 — ustawa</strong>: Ustawa budżetowa na rok 2026 z 9.01.2026 (Dz.U. 2026 poz. 62) z załącznikami. Dodatkowo przewidywane wykonanie z uzasadnienia projektu 2027 i szacunek MF po sierpniu.</li>
          <li><strong>2027 — projekt</strong>: projekt ustawy budżetowej przyjęty przez Radę Ministrów 28.08.2026, z uzasadnieniem. Liczby zmienią się w trakcie prac w Sejmie.</li>
        </ul>

        <h2>Najważniejsze zastrzeżenia</h2>
        <ul class="list-tight">
          <li><strong>Budżet państwa ≠ finanse publiczne.</strong> Budżet nie obejmuje samorządów, ZUS, NFZ ani funduszy w BGK. Kwot z różnych definicji nie sumujemy.</li>
          <li><strong>Ceny bieżące.</strong> Wszystkie kwoty są nominalne (bez korekty o inflację). Porównania między latami najlepiej robić w relacji do PKB.</li>
          <li><strong>Plan a wykonanie.</strong> Porównując 2025 z 2026–2027, zestawiamy wykonanie z planami. Wydatki zwykle są wykonywane w 94–97%.</li>
          <li><strong>Działy klasyfikacji.</strong> W trakcie roku rezerwy z działu 758 „Różne rozliczenia” są rozdzielane do innych działów, dlatego wykonanie działów różni się od planu.</li>
          <li><strong>Projekty podatkowe.</strong> Dochody 2027 zakładają zmiany podatkowe, które są dopiero projektami ustaw.</li>
          <li><strong>Relacje do PKB.</strong> Liczymy je z PKB nominalnego z założeń makroekonomicznych MF; Eurostat używa własnych danych, więc wyniki mogą się różnić o 0,1–0,3 pkt proc.</li>
        </ul>

        <h2>Jak czytać liczby</h2>
        <ul class="list-tight">
          <li>Kropkowane podkreślenie — liczba prosto ze źródła; po najechaniu, fokusie lub dotknięciu widać dokument źródłowy.</li>
          <li>Kreskowane podkreślenie — wartość wyliczona (np. suma, przeliczenie na mieszkańca); wzór jest w dymku.</li>
          <li>Pomarańczowa kropka — wartość do weryfikacji (sprzeczne źródła lub brak oficjalnego dokumentu).</li>
          <li>W danych kwoty są zapisane z dokładnością do 1 mln zł; na stronie zaokrąglamy do 0,1 mld zł, żeby nie sugerować fałszywej precyzji.</li>
        </ul>
        <p id="pop"></p>

        <h2>Znane luki</h2>
        <div id="todo"></div>

        <h2>Aktualizacja i licencja</h2>
        <p>Wszystkie liczby są w jednym pliku <a href="data/budzet.json">data/budzet.json</a> — każda z polem <code>src</code> wskazującym źródło. Dane aktualizowane są po publikacji projektu budżetu (wrzesień) i sprawozdania z wykonania (maj). Kod na licencji Apache 2.0.</p>
      </div>
    </section>
'''

ZRODLA = '''
    <section class="hero hero--page container">
      <p class="eyebrow">Źródła</p>
      <h1 class="hero__title">Skąd pochodzą dane</h1>
      <p class="hero__lead" id="src-meta">Pierwszeństwo mają dokumenty Ministerstwa Finansów i instytucji publicznych; media są źródłem tylko tam, gdzie brakuje dokumentu.</p>
    </section>

    <section class="bento container">
      <div class="bento-grid">
        <article class="glass-card bento-item bento-item--wide">
          <h2>Dokumenty urzędowe i statystyki</h2>
          <div id="src-primary"></div>
        </article>
        <article class="glass-card bento-item">
          <h2>Media i opracowania</h2>
          <div id="src-secondary"></div>
        </article>
      </div>
    </section>
'''

PAGES = [
  ("index.html", "Start", "Budżet Polski 2025–2027: dochody, wydatki, deficyt i dług z źródłem przy każdej liczbie i przeliczeniem na mieszkańca.", "start", START),
  ("dochody.html", "Dochody", "Skąd państwo ma pieniądze: VAT, akcyza, CIT, PIT i dochody niepodatkowe w latach 2025–2027 oraz zmiany podatkowe w projekcie 2027.", "dochody", DOCHODY),
  ("wydatki.html", "Wydatki", "Na co idą pieniądze z budżetu państwa: wydatki według działów 2025–2027, największe pozycje i fundusze poza budżetem.", "wydatki", WYDATKI),
  ("dlug.html", "Deficyt i dług", "Deficyt i dług publiczny Polski: cztery definicje długu, progi 55% i 60% PKB, porównanie z krajami UE.", "dlug", DLUG),
  ("slowniczek.html", "Słowniczek", "Słowniczek pojęć budżetowych: deficyt, dług, PKB, reguła wydatkowa, fundusze BGK i inne.", "slowniczek", SLOWNICZEK),
  ("metodologia.html", "Metodologia", "Metodologia i zastrzeżenia: skąd pochodzą dane o budżecie Polski i jak je czytać.", "metodologia", METODOLOGIA),
  ("zrodla.html", "Źródła", "Pełna lista źródeł danych o budżecie Polski 2025–2027.", "zrodla", ZRODLA),
]

for fname, title, desc, dp, main in PAGES:
    open(os.path.join(OUT, fname), "w", encoding="utf-8").write(page(fname, title, desc, dp, main))
    print("zapisano", fname)
