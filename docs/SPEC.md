# GeoQuiz – Spezifikation (Phase 1 + 2)

Arbeitstitel „GeoQuiz“ – Name ist austauschbar.

Die verbindlichen Vorgaben für Layout, Kartenstil, Bewegung und Bedienung stehen in der [Design-Spezifikation](DESIGN.md).

## 1. Ziel

Ein interaktives Lernspiel im Browser, mit dem ich Länder der Welt (und später Unterteilungen wie Bundesländer, US-Staaten, Oblaste) spielerisch lerne: Lage auf der Karte, Hauptstädte, Kontinente, Nachbarn, Meereszugang, Mitgliedschaften (EU, NATO …), Regierungsform, Währung, Zentralbank, Leitindex usw.

Der wichtigste Designgrundsatz: **Neue Inhalte kommen über Daten dazu, nicht über Code.**
- Neue Kategorie = neue Spalte in einer CSV + ein Eintrag in der Set-Definition → die Quiz-Engine erzeugt die Fragen automatisch.
- Neue Ebene (z. B. „Bundesländer Deutschland“) = neuer Ordner mit CSV, Set-Definition und Karte → erscheint automatisch im Spiel.

Phase 1 + 2 laufen komplett statisch (GitHub Pages, kein Backend). Login/Sync ist Phase 3 und nicht Teil dieser Spezifikation, aber die Architektur muss es vorbereiten (siehe 7.4).

## 2. Tech-Stack

- Vite + TypeScript, ohne schweres Framework (Vanilla TS oder leichtgewichtig, z. B. Preact – Entscheidung im Meilenstein 1, dann beibehalten)
- Karten: `d3-geo`, `d3-zoom`, `topojson-client`, SVG-Rendering
- Tests: Vitest
- Deployment: GitHub Actions → GitHub Pages
- Fortschritt: `localStorage` hinter einem austauschbaren Interface
- UI-Sprache: Deutsch; Länder- und Ortsnamen auf Deutsch

## 3. Datenarchitektur

### 3.1 Begriffe

- **Set**: eine Ebene von Einheiten mit eigener Karte. Beispiele: `world` (Länder), `de` (Bundesländer), `us` (Bundesstaaten), `ua` (Oblaste).
- **Entity**: eine Einheit in einem Set (ein Land, ein Bundesland).
- **Attribut**: eine Eigenschaft einer Entity (Hauptstadt, Kontinent, Nachbarn …), definiert in der Set-Definition.

### 3.2 Ordnerstruktur

```
data/
  presets.json          # Vorlagen und Standardwerte für eigene Runden
  sets/
    world/
      set.json          # Metadaten + Attribut-Definitionen
      entities.csv      # eine Zeile pro Land, eine Spalte pro Attribut
      map.topojson      # Geometrien, verknüpft über id
    de/
      set.json
      entities.csv
      map.topojson
    us/ ...
scripts/
  build-data.ts         # CSV → JSON, Validierung
  seed-world.ts         # einmaliges Befüllen aus offenen Quellen (s. 3.6)
  extract-subdivisions.ts  # Landeskarten aus Natural Earth admin-1 schneiden
```

Beim Build werden CSVs in JSON umgewandelt (`public/data/...`). Die CSV ist die einzige Quelle der Wahrheit und wird von Hand gepflegt (Excel).

### 3.3 CSV-Format

- UTF-8, **Semikolon als Trennzeichen** (deutsches Excel speichert so), erste Zeile = Spaltennamen
- Listen innerhalb einer Zelle mit `|` getrennt
- Leere Zelle = unbekannt / nicht zutreffend → Entity wird für dieses Attribut nicht abgefragt
- IDs: Länder ISO 3166-1 alpha-3 (`DEU`), Unterteilungen ISO 3166-2 (`DE-RP`)

Beispiel `data/sets/world/entities.csv` (Ausschnitt):

```
id;name;name_aliases;continent;capital;capital_aliases;capital_lat;capital_lon;neighbors;seas;memberships;currency;central_bank;stock_index;regime_type;un_member
BGR;Bulgarien;;Europa;Sofia;;42.6977;23.3219;GRC|MKD|ROU|SRB|TUR;Schwarzes Meer;EU|NATO;Bulgarischer Lew;Bulgarische Nationalbank;SOFIX;Wahldemokratie;true
CIV;Elfenbeinküste;Côte d'Ivoire|Cote d'Ivoire;Afrika;Yamoussoukro;;6.8276;-5.2893;BFA|GHA|GIN|LBR|MLI;Atlantischer Ozean;AU;CFA-Franc BCEAO;BCEAO;BRVM Composite;Wahlautokratie;true
```

(Die Werte sind Beispiele für das Format; die echten Daten werden beim Seeding erzeugt und von Hand geprüft.)

### 3.4 Set-Definition (`set.json`)

```json
{
  "id": "world",
  "label": "Länder der Welt",
  "entityLabel": "Land",
  "entityLabelPlural": "Länder",
  "parent": null,
  "map": { "file": "map.topojson", "object": "countries", "idProperty": "id", "projection": "miller" },
  "attributes": [
    {
      "key": "capital",
      "label": "Hauptstadt",
      "type": "text",
      "aliasesColumn": "capital_aliases",
      "point": { "lat": "capital_lat", "lon": "capital_lon" },
      "prompts": {
        "forward": "Was ist die Hauptstadt von {entity}?",
        "reverse": "{value} ist die Hauptstadt von …?",
        "mapPoint": "Markiere {value} auf der Karte von {entity}."
      }
    },
    { "key": "continent", "label": "Kontinent", "type": "enum",
      "values": ["Europa", "Asien", "Afrika", "Nordamerika", "Südamerika", "Ozeanien"] },
    { "key": "flag", "label": "Flagge", "type": "flag" },
    { "key": "neighbors", "label": "Nachbarländer", "type": "entityRefList" },
    { "key": "seas", "label": "Meereszugang", "type": "list", "emptyMeans": "Binnenstaat" },
    { "key": "memberships", "label": "Mitgliedschaften", "type": "list", "groupQuiz": true },
    { "key": "regime_type", "label": "Regierungsform", "type": "enum",
      "values": ["Geschlossene Autokratie", "Wahlautokratie", "Wahldemokratie", "Liberale Demokratie"] },
    { "key": "un_member", "label": "UN-Mitglied", "type": "boolean", "quiz": false }
  ]
}
```

Ein Unterteilungs-Set (z. B. `de`) hat `"parent": { "set": "world", "entity": "DEU" }`. Der Atlas-Steckbrief von Deutschland erhält mit der Gebietsauswahl einen Link „Bundesländer-Quiz“.

### 3.5 Attributtypen → automatisch erzeugte Fragetypen

| Typ | Beispiel | Erzeugte Fragen |
|---|---|---|
| `location` | Lage | eingebaut in jedem Set mit Karte. Land → Lage per Kartenklick. Lage → Land zeigt die Geometrie und erlaubt vier Optionen oder Tippen. |
| `text` | Hauptstadt, Währung, Zentralbank, Leitindex | vorwärts (Land → Wert), rückwärts (Wert → Land), jeweils getippt oder 4 Antwortmöglichkeiten; rückwärts zusätzlich „auf der Weltkarte anklicken“ |
| `text` + `point` | Hauptstadt mit Koordinaten | zusätzlich: Punkt auf der Landeskarte markieren (Bewertung nach Distanz) |
| `enum` | Kontinent, Regierungsform | vorwärts mit festen Optionen oder getippt; rückwärts ein passendes Land tippen oder aus vier Antworten wählen (genau eine richtige Option) |
| `flag` | Länderflagge | vorwärts eine von vier Flaggen wählen; rückwärts Ländernamen tippen oder auswählen. Die Flaggen-Zuordnung wird beim Build erzeugt. |
| `boolean` | Binnenstaat | Ja/Nein; Karten-Mehrfachauswahl „Markiere alle …“ |
| `list` | Meere, Mitgliedschaften | „Zu welchem Meer hat X Zugang?“ (eine richtige Option); bei `groupQuiz: true` pro Listenwert eine Gruppe: „Markiere alle EU-Mitglieder“, „Ist X in der NATO?“ |
| `entityRefList` | Nachbarn | „Markiere alle Nachbarn von X auf der Karte“; MC „Welches Land grenzt an X?“ |
| `number` (Phase 2, spät) | Handelsbilanz, mit `year`/`source` | „Höher oder niedriger?“ zwischen zwei Ländern; Vorzeichen-Frage |

Bei `text`, `enum` und `flag` kann `"modes": [...]` die verfügbaren Varianten eingrenzen. Ein Eintrag für die Richtung (`forward`, `reverse`), Antwortart (`typed`, `choice`, `map`) oder Kombination (z. B. `reverse-typed`) erlaubt die passenden Varianten. `"prompts"` kann Standardfragen über `forward`, `reverse` und `reverseMap` ersetzen. Die Platzhalter `{entity}` und `{value}` stehen für Ländernamen und Attributwert. Bei einer getippten rückwärtigen Frage oder einer Kartenfrage zählt jedes Land mit passendem Wert.

`location` verwendet Länder-IDs und Geometrien direkt aus dem Set. Die Kategorie ist automatisch vorhanden. Eine CSV-Spalte oder ein Eintrag in `attributes` ist dafür entbehrlich. Die Fragetexte kommen aus `map.prompts.find` und `map.prompts.name`, falls das Set sie definiert.

### 3.6 Erstbefüllung (Seeding)

`scripts/seed-world.ts` erzeugt einmalig einen Entwurf der `entities.csv`:
- Grunddaten (deutscher Name, Nachbarn als ISO-Codes, Binnenstaat, Region, Währung): npm-Paket `world-countries` (enthält deutsche Übersetzungen der Ländernamen)
- Hauptstadt-Koordinaten: Natural Earth `populated_places` (Admin-0-Hauptstädte)
- Deutsche Hauptstadtnamen, Zentralbank, Leitindex: Wikidata (deutsche Labels), wenn erreichbar; sonst Spalte leer lassen
- Regierungsform: V-Dem-Regimeklassifikation („Regimes of the World“), manuell eingepflegt

Danach ist die CSV die Wahrheit; das Seed-Script überschreibt sie nie ungefragt (schreibt in `entities.seed.csv`).

### 3.7 Validierung (`build-data.ts`)

Der Build schlägt fehl oder warnt bei:
- doppelten IDs, CSV-Spalten ohne Attribut-Definition (Warnung), Attributen ohne Spalte (Fehler)
- `entityRefList`-Werten, die auf keine existierende ID zeigen
- Nachbarschaften, die nicht symmetrisch sind (Warnung)
- Entities ohne Geometrie in der Karte und umgekehrt
- `enum`-Werten außerhalb der erlaubten Liste
- Ausgabe: Report pro Attribut, wie viele Entities befüllt sind

### 3.8 Länderauswahl und Sonderfälle

- Basis: 193 UN-Mitglieder + Vatikanstadt, Palästina, Kosovo, Taiwan (Attribut `un_member` unterscheidet). In den Einstellungen: „Nur UN-Mitglieder“ an/aus.
- Gebiete ohne Quiz (z. B. Westsahara, Grönland als Teil Dänemarks) werden grau gezeichnet, aber nicht abgefragt.
- Mehrere Hauptstädte (Südafrika, Bolivien …): Hauptwert in `capital`, weitere in `capital_aliases` werden als richtig akzeptiert; Hinweis im Feedback.
- Natural-Earth-Falle: In manchen Versionen ist `ISO_A3` für Frankreich und Norwegen `-99` → IDs über `ADM0_A3` bzw. eine Mapping-Tabelle zuordnen.

## 4. Karten

- **Weltkarte**: Natural Earth 50m (`Admin 0 – Countries`), Miller-Projektion (`d3-geo-projection`), Zoom und Verschieben (`d3-zoom`) per Maus und Touch. Drei Kartenkopien und ein horizontaler Versatz modulo Kartenbreite erlauben nahtloses, endloses Verschieben. Die Karte ist vertikal begrenzt und endet im Süden vor der Antarktis. Alle Kopien unterstützen Länder- und Markerklicks.
- **Vollbild-Layout**: Die Karte füllt den Viewport (`100dvw × 100dvh`). Fragepanel und Antwort-Sheet sind oben und unten horizontal zentriert. Rechts in der Meta-Zeile sitzen die 48-px-Felder für Überspringen und Menü. Zoom und Verschieben laufen über die Kartengesten. Die Overlays berücksichtigen die Safe Area und lassen die übrige Karte bedienbar. Auf der Karte sind Browser-Scrollen, Pull-to-refresh und Doppeltipp-Zoom deaktiviert. Der Fokusrahmen wird bei Tastaturbedienung sichtbar.
- **Homescreen**: Das Web-App-Manifest startet GeoQuiz im Standalone-Modus und enthält Theme-Farbe und App-Icons.
- **Kleinstaaten**: Länder unter einer Flächenschwelle (z. B. < 2.000 km² oder Inselstaaten) bekommen einen klickbaren Kreis als Marker; zusätzlich zählt ein Klick als Treffer, wenn er innerhalb einer kleinen Toleranz (in Pixeln, zoomabhängig) zum richtigen Land liegt.
- Landeskarten: einzelnes Land mit `fitExtent` automatisch eingepasst; Antimeridian-Fälle (Russland, USA, Fidschi, Neuseeland) mit rotierter Projektion lösen.
- Unterteilungen: aus Natural Earth 10m admin-1 pro Land extrahieren (`scripts/extract-subdivisions.ts`, z. B. mit mapshaper), IDs = `iso_3166_2`. Für die USA alternativ `us-atlas`.
- Das Kartenfeedback folgt [DESIGN.md](DESIGN.md#4-karte). Kartenflüge verwenden den sichtbaren Bereich zwischen den Panels und bei Bedarf die nächstgelegenen Weltkopien. Bei einer falschen Länderantwort werden Lösung und Auswahl gemeinsam eingerahmt.

## 5. Antworteingabe

### 5.1 Getippte Antworten (unscharfer Abgleich)

Normalisierung (auf Eingabe und alle Kandidaten): Kleinschreibung → `ä/ö/ü` → `ae/oe/ue`, `ß` → `ss` → restliche Diakritika entfernen (NFKD) → Leerzeichen, Bindestriche, Apostrophe, Punkte entfernen.

Abgleich mit Damerau-Levenshtein-Distanz gegen **alle** möglichen Antworten des Attributs im Set (inkl. Aliasse), nicht nur gegen die richtige:
- Erlaubte Distanz nach Länge der richtigen Antwort: ≤ 4 Zeichen → 0; 5–7 → 1; 8–11 → 2; ≥ 12 → `round(Länge × 0,3)`
- Richtig nur, wenn der beste Treffer die richtige Antwort (oder ein Alias davon) ist **und** innerhalb der Toleranz liegt
- Trifft die Eingabe eine *andere* gültige Antwort exakt (z. B. „Niger“ statt „Nigeria“), ist sie falsch
- Die Toleranz richtet sich nach der Länge der jeweils abgeglichenen normalisierten Schreibweise. Bei einem Gleichstand zwischen verschiedenen Entities ist die Antwort falsch.
- Bei Tippfehler-Treffern: als richtig werten, aber Feedback „Richtig – geschrieben wird es: Rheinland-Pfalz“

Pflicht-Testfälle (Vitest):
- `rehinlant-plfaz` → Rheinland-Pfalz ✔
- `Rheinland Pfalz`, `rheinlandpfalz` → ✔
- `Niger` bei Lösung Nigeria → ✘
- `Austria` bei Lösung Australien → ✘ (zu weit weg)
- `Cote d'Ivoire`, `Côte d’Ivoire` → Elfenbeinküste ✔ (über Alias)
- `Muenchen` ↔ `München` → ✔
- `Pretoria` und `Kapstadt` bei Südafrika → ✔

### 5.2 Multiple Choice

- 4 Optionen, eine richtig
- Ablenker bevorzugt plausibel: gleicher Kontinent bzw. gleiches Eltern-Set, ähnlicher Wert-Typ; bei `enum` mit ≤ 4 Werten alle Werte zeigen
- `1`–`4` wählen eine Option. `S` überspringt außerhalb von Textfeldern, leeres Enter überspringt bei Tippfragen. Enter oder Leertaste gehen nach dem Urteil weiter.

## 6. Üben, Atlas und Fortschritt

Die App startet im **Atlas**. Im weißen Vollbildmenü stehen neben „GEOQUIZ“ der Gebietshinweis „GEBIET: WELT“ und das Schließen-Feld. Die Liste führt zu **01 Üben**, **02 Atlas** und **03 Fortschritt**. Fortschritt ist als „Folgt“ markiert. Unter der Liste lassen sich Lösungszoom, Kleinstaaten-Ringe und das Zurücksetzen der Weltansicht aufklappen. [Menü in der Design-Spezifikation](DESIGN.md#menü)

### 6.1 Üben

Die gemeinsame Übungs-Engine erzeugt alle Fragen aus dem aktiven Set. Unter „Üben“ startet ein Tipp auf eine **Vorlage** sofort eine Runde. „Anpassen“ öffnet den Rundenaufbau für diese Vorlage. „Eigene Runde“ startet den Rundenaufbau mit den Standardwerten. Das Zurück-Feld und Escape gehen jeweils eine Ebene zurück. Auf der ersten Ebene schließt Escape das Menü.

Der Rundenaufbau hat sechs Stellschrauben:

| Stellschraube | Werte |
|---|---|
| Kategorie | Eine oder mehrere verfügbare Kategorien des Sets, einschließlich Lage |
| Richtung | Land → Kategorie, Kategorie → Land, Gemischt |
| Antwortart | Karte, 4 Optionen, Tippen. Bei mehreren Kategorien werden die Varianten verwendet, die Richtung und Antwortart unterstützen. |
| Reihenfolge | Gemischt oder Land für Land. Bei Land für Land stehen alle ausgewählten Fragen zu einem Land zusammen. |
| Auswahl | Region oder alle Regionen. Schwierigkeit ist als „Folgt“ gekennzeichnet. |
| Länge | 10, 20 oder alle passenden Fragen. Enthält die Auswahl weniger Fragen, ist die Runde entsprechend kürzer. |

`data/presets.json` enthält Standardwerte, Vorlagen und ihren Freigabestatus. Der Daten-Build validiert die Datei und liefert sie mit den Sets aus. Ein `SettingsStore` speichert die zuletzt gewählten Einstellungen je Set und Vorlage. `LocalSettingsStore` verwendet einen versionierten Schlüssel in `localStorage`.

| Vorlage | Voreinstellung |
|---|---|
| Länder finden | Lage · Land → Kategorie · Karte |
| Länder benennen | Lage · Kategorie → Land · 4 Optionen |
| Hauptstädte | Hauptstadt · beide Richtungen · 4 Optionen |
| Flaggen | Flagge · beide Richtungen · 4 Optionen |
| Ein Land komplett | Alle Kategorien · Land für Land · Folgt in Meilenstein 6 |
| Alles gemischt | Alle Kategorien · beide Richtungen · gemischte Reihenfolge |
| Fällige Wiederholungen | Fällige Lernkarten · Folgt in Meilenstein 9 |

### 6.2 Atlas

Im Atlas steht oben „ATLAS“ und „Land antippen“. Die Karte lässt sich frei erkunden. Ein Klick auf ein Land öffnet unten seinen Steckbrief und rückt das Land in den sichtbaren Kartenausschnitt. Der Steckbrief zeigt die Flagge und den Ländernamen sowie befüllte Einträge aus `set.json`. Bei verknüpften Ländern, etwa Nachbarn, springt ein Tipp direkt zum verknüpften Steckbrief und Kartenort.

### 6.3 Fortschritt

„Fortschritt“ führt nach Meilenstein 9 zur Statistik, Wissenskarte und Verwaltung der Lernkarten nach Abschnitt 7.

## 7. Fortschritt und Statistik

### 7.1 Lernkarten

Jede Kombination `set:entity:attribut:fragetyp` ist eine Lernkarte. Leitner-System mit 5 Fächern (Intervalle 0 / 1 / 3 / 7 / 21 Tage). Richtig → ein Fach hoch, falsch → zurück in Fach 1.

- **Lernmodus**: bevorzugt fällige und schwache Karten
- **Freies Spiel**: ignoriert Fälligkeit, zählt aber in die Statistik

### 7.2 Statistik-Seite

- **Weltkarte als Wissenskarte**: jedes Land eingefärbt nach Trefferquote (grau = noch nie gefragt, rot → grün); umschaltbar nach Attribut
- Trefferquote pro Attribut, pro Kontinent, pro Set
- Schwächste 10 Entities, Verlauf über die Zeit, Bestzeiten der Durchgänge

### 7.3 Speicherung

- `localStorage`, versioniertes Schema
- Export/Import des Fortschritts als JSON-Datei (Backup, bis es Sync gibt)

### 7.4 Vorbereitung für Phase 3 (Login)

Alle Zugriffe auf den Fortschritt laufen über ein Interface `ProgressStore` (`load`, `save`, `recordAnswer`, `export`, `import`). Phase 1/2 implementiert nur `LocalProgressStore`. Später kommt z. B. ein Supabase-Store mit GitHub-Login dazu, ohne die Spiellogik anzufassen.

## 8. Meilensteine und aktueller Stand

### Erledigt

- **Meilenstein 1 – Gerüst**. Vite und TypeScript, Ordnerstruktur, GitHub-Actions-Deployment auf Pages und Datenpipeline mit Validierung. Das erste Weltset enthielt zehn Länder.
- **Meilenstein 2 – Weltkarte**. Kartenrendering, Zoom und Verschieben per Maus und Touch, Kleinstaaten-Marker sowie Finden per Kartenklick und Benennen mit vier Antwortmöglichkeiten.
- **Meilenstein 3 – Antwort-Engine**. Getippte Antworten in Benennen werden normalisiert und mit allen Ländernamen und Aliasen verglichen. Die Pflichtfälle aus Abschnitt 5.1 sind automatisiert geprüft.
- **Meilenstein 4 – Attribut-Engine**. Die gemeinsame Übungs-Engine erzeugt Lage-, Text-, Enum- und Flaggenfragen in beiden Richtungen. Rückwärtige Textfragen lassen sich auch auf der Weltkarte beantworten.
- **Meilenstein 5 – Grunddaten**. Das vollständige Weltset enthält 197 Spielentitäten mit passenden Natural-Earth-Geometrien. [Validierungsreport](world-data-report.md)
- **Vollbild-Layout**. Rahmenlose Miller-Karte mit nahtlosem horizontalem Verschieben, Overlays für die Bedienung und Standalone-Manifest.
- **Üben, Atlas und Vollbildmenü**. Vorlagen und Rundenaufbau, gespeicherte Einstellungen je Vorlage, Atlas-Steckbrief, beide Flaggenlayouts und gestaffelte Menü-Animationen sind umgesetzt. [Design-Spezifikation](DESIGN.md)

### Offen in Umsetzungsreihenfolge

1. **Datenkorrekturen**. Das Weltset um `continent_alt` und `capital_note` ergänzen. Die Spalte `color` mit der aus der Flagge abgeleiteten Hauptfarbe befüllen. Die Farbwerte lassen sich von Hand korrigieren. [Daten für das Design](DESIGN.md#8-daten-für-das-design)
2. **Meilenstein 5 – Weitere Länderdaten**. Währung, Zentralbank, Leitindex und Regierungsform befüllen. Quellen und Report über fehlende Werte folgen den Abschnitten 3.6 und 3.7.
3. **Meilenstein 6 – Ein Land komplett und Landeskarten**. Die Vorlage „Ein Land komplett“ freischalten. Der Atlas-Steckbrief übernimmt das Länderdesign mit Farbblock, Landesumriss und Flagge. Landeskarten ergänzen und das Markieren der Hauptstadt nach Distanz bewerten. [Länderdesign](DESIGN.md#ein-land-komplett-und-atlas-landesdesign)
4. **Meilenstein 7 – Weitere Typen**. `boolean`, `list` mit Gruppen-Modus (EU, NATO) und `entityRefList` zum Markieren von Nachbarn auf der Karte.
5. **Meilenstein 8 – Unterteilungen**. `extract-subdivisions.ts`, Sets `de` und `us`, Set-Auswahl und Durchgangsmodus mit Bestzeit.
6. **Meilenstein 9 – Fortschritt**. Lernkarten, Statistik-Seite mit Wissenskarte sowie Export und Import.

## 9. Nicht in Phase 1/2

Login/Sync, Nachrichten pro Land, Konflikte, Handelsverflechtungen als Netzwerkgrafik, `number`-Attribute mit automatischem Datenabruf (World-Bank-API). Die Datenarchitektur soll diese Erweiterungen aber ohne Umbau zulassen.
