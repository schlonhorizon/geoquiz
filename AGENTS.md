# AGENTS.md – Hinweise für Codex

Projekt: GeoQuiz, ein Geografie- und Länderwissen-Quiz im Browser. Die vollständige Spezifikation steht in `docs/SPEC.md` – lies sie vor jeder Aufgabe, vor allem die Abschnitte zu Datenarchitektur (3) und Antworteingabe (5).

## Grundsätze

- **Daten statt Code**: Länder, Attribute und Fragetexte gehören in `data/sets/*` (CSV + `set.json`), nie hart codiert in TypeScript. Eine neue Spalte plus Attribut-Definition muss ohne Codeänderung zu neuen Fragen führen.
- Arbeite immer nur am angefragten Meilenstein aus `docs/SPEC.md` Abschnitt 8. Keine Features aus Abschnitt 9 vorziehen.
- Bestehende Daten in `data/sets/*/entities.csv` nie automatisch überschreiben; Seed-Ausgaben gehen nach `entities.seed.csv`.
- UI-Texte auf Deutsch. Code, Bezeichner und Commit-Messages auf Englisch.
- Erstelle nach jeder abgeschlossenen und geprüften Umsetzung direkt einen Pull Request.

## Stack

- Vite + TypeScript (strict), `d3-geo`, `d3-zoom`, `topojson-client`, Vitest
- Statisch auf GitHub Pages, kein Backend
- Fortschritt nur über das Interface `ProgressStore` (`src/progress/`), nie direkt `localStorage` in der Spiellogik

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm run data` – CSV → JSON + Validierung
- `npm test` – Vitest
- `npm run build` – Produktionsbuild (führt `npm run data` aus)

Vor Abschluss jeder Aufgabe: `npm test` und `npm run build` müssen grün sein.

## Konventionen

- CSV: UTF-8, Semikolon als Trennzeichen, Listen mit `|`
- IDs: ISO 3166-1 alpha-3 für Länder, ISO 3166-2 für Unterteilungen
- Neue Antwortlogik immer mit Tests; die Pflicht-Testfälle in SPEC 5.1 dürfen nie rot werden
- Kleine, gut benannte Module: `src/data/`, `src/quiz/` (Fragengenerierung), `src/match/` (Antwortabgleich), `src/map/`, `src/progress/`, `src/ui/`
- Beim Abschluss kurz zusammenfassen: was gebaut wurde, was offen ist, welche Daten fehlen
