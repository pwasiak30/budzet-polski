# Budżet Polski 2025–2027

Strona wyjaśniająca budżet państwa: wykonanie 2025, ustawa na 2026 i projekt na 2027 —
dochody, wydatki, deficyt i dług. Przy każdej liczbie jest źródło (dymek po najechaniu,
fokusie lub dotknięciu), a duże kwoty są przeliczane na mieszkańca.

Czysty HTML/CSS/JS, bez frameworków i bez kroku budowania. Styl: Forge UI.

## Struktura

```
budzet-polski/
├── index.html          Start — przegląd trzech lat
├── dochody.html        Dochody wg źródeł, zmiany podatkowe 2027
├── wydatki.html        Wydatki wg działów, fundusze poza budżetem
├── dlug.html           Deficyt, dług (4 definicje), porównanie z UE
├── slowniczek.html     Pojęcia
├── metodologia.html    Zastrzeżenia i znane luki
├── zrodla.html         Lista źródeł (generowana z danych)
├── assets/
│   ├── style.css       Style (Forge UI + komponenty projektu)
│   └── app.js          Logika: motyw, dymki źródeł, wykresy, tabele
├── data/
│   └── budzet.json     WSZYSTKIE liczby — jedyny plik do aktualizacji
├── tools/
│   ├── build_pages.py  Generator podstron (wspólny nagłówek, FAB, stopka)
│   └── sprite.html     Ikony SVG wstawiane do każdej strony
├── LICENSE             Apache 2.0
└── README.md
```

## Test lokalny

Strona wczytuje dane przez `fetch()`, więc potrzebuje serwera (otwarcie pliku z dysku
pokaże komunikat o błędzie).

```bash
cd budzet-polski
python3 -m http.server 8000
```

Następnie w przeglądarce: http://localhost:8000

## Wdrożenie na GitHub Pages

```bash
cd budzet-polski
git init
git add .
git commit -m "Budżet Polski — pierwsza wersja"
git branch -M main
git remote add origin git@github.com:pwasiak30/budzet-polski.git
git push -u origin main
```

Potem na GitHubie: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main`, folder `/ (root)` → Save**. Strona będzie pod
`https://pwasiak30.github.io/budzet-polski/`.

## Zmiana treści podstron

Nagłówek, nawigacja, social FAB i stopka są identyczne na 7 stronach, więc strony generuje
skrypt. Treść edytuj w `tools/build_pages.py`, potem:

```bash
python3 tools/build_pages.py
```

Skrypt nie jest potrzebny do działania strony — GitHub Pages serwuje gotowe pliki `*.html`.

## Aktualizacja danych

Edytuj tylko `data/budzet.json`. Każda wartość ma postać:

```json
{ "v": 977.6, "src": ["mf_projekt_2027"], "uwaga": "…", "wyliczone": "…", "weryfikuj": "…" }
```

- `v` — wartość (domyślnie mld zł),
- `src` — identyfikatory z sekcji `zrodla` (muszą istnieć),
- `wyliczone` — wzór, jeśli liczba jest obliczona (na stronie: kreskowane podkreślenie),
- `weryfikuj` — opis wątpliwości (na stronie: pomarańczowa kropka).

Terminy: projekt budżetu — do 30 września, sprawozdanie z wykonania — do 31 maja.

## Licencja

Apache 2.0 — patrz `LICENSE`. Dane pochodzą z dokumentów publicznych (MF, NIK, Eurostat, GUS, Sejm).
