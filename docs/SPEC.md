# GeoQuiz – Spezifikation (Phase 1 + 2)

Arbeitstitel „GeoQuiz“ – Name ist austauschbar.

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
    { "key": "neighbors", "label": "Nachbarländer", "type": "entityRefList" },
    { "key": "seas", "label": "Meereszugang", "type": "list", "emptyMeans": "Binnenstaat" },
    { "key": "memberships", "label": "Mitgliedschaften", "type": "list", "groupQuiz": true },
    { "key": "regime_type", "label": "Regierungsform", "type": "enum",
      "values": ["Geschlossene Autokratie", "Wahlautokratie", "Wahldemokratie", "Liberale Demokratie"] },
    { "key": "un_member", "label": "UN-Mitglied", "type": "boolean", "quiz": false }
  ]
}
```

Ein Unterteilungs-Set (z. B. `de`) hat `"parent": { "set": "world", "entity": "DEU" }`. Im Länder-Modus von Deutschland erscheint dann ein Link „Bundesländer-Quiz“.

### 3.5 Attributtypen → automatisch erzeugte Fragetypen

| Typ | Beispiel | Erzeugte Fragen |
|---|---|---|
| `text` | Hauptstadt, Währung, Zentralbank, Leitindex | vorwärts (Land → Wert), rückwärts (Wert → Land), jeweils getippt oder 4 Antwortmöglichkeiten; rückwärts zusätzlich „auf der Weltkarte anklicken“ |
| `text` + `point` | Hauptstadt mit Koordinaten | zusätzlich: Punkt auf der Landeskarte markieren (Bewertung nach Distanz) |
| `enum` | Kontinent, Regierungsform | vorwärts mit festen Optionen; rückwärts „Welches dieser Länder ist eine Wahlautokratie?“ (genau eine richtige Option) |
| `boolean` | Binnenstaat | Ja/Nein; Karten-Mehrfachauswahl „Markiere alle …“ |
| `list` | Meere, Mitgliedschaften | „Zu welchem Meer hat X Zugang?“ (eine richtige Option); bei `groupQuiz: true` pro Listenwert eine Gruppe: „Markiere alle EU-Mitglieder“, „Ist X in der NATO?“ |
| `entityRefList` | Nachbarn | „Markiere alle Nachbarn von X auf der Karte“; MC „Welches Land grenzt an X?“ |
| `number` (Phase 2, spät) | Handelsbilanz, mit `year`/`source` | „Höher oder niedriger?“ zwischen zwei Ländern; Vorzeichen-Frage |

Jedes Attribut kann über `"modes": [...]` einzelne Fragetypen abschalten und über `"prompts"` eigene Fragetexte bekommen; sonst gelten Standardtexte.

Zusätzlich gibt es zwei Kartenmodi, die direkt an der Entity hängen und kein Attribut brauchen:
- **Finden**: „Wo liegt Bulgarien?“ → Land auf der Karte anklicken
- **Benennen**: Land ist hervorgehoben → Name tippen oder aus 4 Optionen wählen

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
- **Vollbild-Layout**: Die Karte füllt den Viewport (`100dvw × 100dvh`). Die Frage mit Fortschritt liegt oben, das aufklappbare Menü für Modus und Einstellungen oben rechts. Unten liegt der Antwortbereich als Bottom-Sheet. Die Zoom-Tasten liegen am Kartenrand. Die Overlays berücksichtigen die Safe Area und lassen die übrige Karte bedienbar. Auf der Karte sind Browser-Scrollen, Pull-to-refresh und Doppeltipp-Zoom deaktiviert. Der Fokusrahmen wird bei Tastaturbedienung sichtbar.
- **Homescreen**: Das Web-App-Manifest startet GeoQuiz im Standalone-Modus und enthält Theme-Farbe und App-Icons.
- **Kleinstaaten**: Länder unter einer Flächenschwelle (z. B. < 2.000 km² oder Inselstaaten) bekommen einen klickbaren Kreis als Marker; zusätzlich zählt ein Klick als Treffer, wenn er innerhalb einer kleinen Toleranz (in Pixeln, zoomabhängig) zum richtigen Land liegt.
- Landeskarten: einzelnes Land mit `fitExtent` automatisch eingepasst; Antimeridian-Fälle (Russland, USA, Fidschi, Neuseeland) mit rotierter Projektion lösen.
- Unterteilungen: aus Natural Earth 10m admin-1 pro Land extrahieren (`scripts/extract-subdivisions.ts`, z. B. mit mapshaper), IDs = `iso_3166_2`. Für die USA alternativ `us-atlas`.
- Feedback auf der Karte: richtig = grün, falsch angeklickt = rot. Die Karte hebt die Lösung kurz hervor und zoomt zur nächstgelegenen Kopie.

## 5. Antworteingabe

### 5.1 Getippte Antworten (unscharfer Abgleich)

Normalisierung (auf Eingabe und alle Kandidaten): Kleinschreibung → `ä/ö/ü` → `ae/oe/ue`, `ß` → `ss` → restliche Diakritika entfernen (NFKD) → Leerzeichen, Bindestriche, Apostrophe, Punkte entfernen.

Abgleich mit Damerau-Levenshtein-Distanz gegen **alle** möglichen Antworten des Attributs im Set (inkl. Aliasse), nicht nur gegen die richtige:
- Erlaubte Distanz nach Länge der richtigen Antwort: ≤ 4 Zeichen → 0; 5–7 → 1; 8–11 → 2; ≥ 12 → `round(Länge × 0,3)`
- Richtig nur, wenn der beste Treffer die richtige Antwort (oder ein Alias davon) ist **und** innerhalb der Toleranz liegt
- Trifft die Eingabe eine *andere* gültige Antwort exakt (z. B. „Niger“ statt „Nigeria“), ist sie falsch
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
- Tastatur: 1–4 zum Auswählen, Enter für nächste Frage

## 6. Spielmodi

- **Kategorie-Modus**: Set + Attribut + Fragetyp wählen (z. B. Welt / Hauptstadt / rückwärts / getippt)
- **Zufallsmodus**: Fragen aus allen aktivierten Attributen und Fragetypen gemischt; Filter nach Kontinent bzw. Region
- **Länder-Modus**: ein Land wählen (oder zufällig), dann werden nacheinander alle Attribute dieses Landes abgefragt; am Ende ein Steckbrief des Landes mit allen Werten und der Karte
- **Gruppen-Modus**: „Markiere alle EU-Mitglieder“ – Mehrfachauswahl auf der Karte, Bewertung nach richtig / falsch / vergessen
- **Durchgang**: alle Entities eines Sets einmal (wie „alle 50 US-Staaten“), mit Zeit und Fehlerzahl; persönliche Bestzeit speichern
- Rundenlänge wählbar (10 / 25 / alle)
- Antwortart pro Runde wählbar: getippt / 4 Optionen / gemischt

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

## 8. Meilensteine (je ein Codex-Auftrag)

1. **Gerüst**: Vite + TS, Ordnerstruktur, GitHub-Actions-Deploy auf Pages, `build-data.ts` mit Validierung, Beispiel-Set `world` mit ~10 Ländern
2. **Weltkarte**: Rendering, Zoom/Pan, Kleinstaaten-Marker, Modi „Finden“ und „Benennen“ (MC)
3. **Antwort-Engine**: Normalisierung + unscharfer Abgleich mit allen Testfällen aus 5.1; getippte Eingabe in „Benennen“
4. **Attribut-Engine**: Fragen aus `set.json` erzeugen für `text` und `enum` (vorwärts/rückwärts, getippt/MC); Kategorie- und Zufallsmodus
5. **Seeding**: `seed-world.ts`, vollständige Länderliste, Report fehlender Werte
6. **Länder-Modus + Landeskarten**: Steckbrief, Hauptstadt auf Landeskarte markieren (Distanzbewertung)
7. **Weitere Typen**: `boolean`, `list` mit Gruppen-Modus (EU, NATO), `entityRefList` (Nachbarn auf der Karte markieren)
8. **Unterteilungen**: `extract-subdivisions.ts`, Sets `de` und `us`, Set-Auswahl, Durchgangs-Modus mit Bestzeit
9. **Fortschritt**: Lernkarten, Statistik-Seite mit Wissenskarte, Export/Import

## 9. Nicht in Phase 1/2

Login/Sync, Nachrichten pro Land, Konflikte, Handelsverflechtungen als Netzwerkgrafik, `number`-Attribute mit automatischem Datenabruf (World-Bank-API). Die Datenarchitektur soll diese Erweiterungen aber ohne Umbau zulassen.
