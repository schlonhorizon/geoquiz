# GeoQuiz – Design-Spezifikation

Verbindliche Gestaltungsregeln für alle Bildschirme. Die freigegebene visuelle Referenz liegt in `docs/prototype/` (Finden, Länder-Modus, Flaggen). Diese Dateien sind **nur Referenz**: Werte, Layouts, Texte und Animationen daraus übernehmen, aber nicht ihre Template-Syntax (`<x-dc>`, `<sc-if>`, `<sc-for>`, `{{…}}`, `DCLogic`) und nicht ihre `/_blob/…`-URLs. Im Zweifel gilt dieses Dokument.

## 1. Haltung

Swiss Style: typografiegetrieben, schwarz-weiß, strenges Raster.

- Schwarz und Weiß tragen das Layout. Rot kennzeichnet Fehler, Grün richtige Antworten und Blau die Kartenmarkierung. Im Länder-Modus und bei Flaggen kommen Landesfarben hinzu.
- Rahmen 2 px schwarz, **keine Rundungen** (border-radius 0 überall), keine Schatten, keine Verläufe, keine Emojis.
- Hierarchie entsteht über Schriftgröße und -stärke, nicht über Farbe oder Boxen.
- Bewegung ist sparsam, präzise und hat immer eine Funktion (Feedback, Orientierung, Übergang).

## 2. Tokens

Als CSS Custom Properties in einer zentralen Datei (`src/ui/tokens.css`):

```css
:root {
  --ink: #111111;          /* Text, Rahmen, Primärbutton */
  --paper: #FFFFFF;        /* Panels, Land auf der Karte */
  --sea: #F1F1F1;          /* Meer, App-Hintergrund */
  --land-hover: #D6D6D6;
  --land-off: #E4E4E4;     /* Gebiete ohne Quiz (Westsahara, Grönland …) */
  --muted: #6B6B6B;        /* deaktivierte Einträge, abgeblendete Optionen */
  --hover: #EDEDED;        /* Hover auf Optionszeilen */
  --grid: rgba(17,17,17,.14); /* Gradnetz */
  --accent: #E3000F;       /* falsch */
  --ok: #00A651;           /* richtig */
  --highlight: #0047FF;   /* Kartenmarkierung und Kleinstaaten-Ring */
  --line: 2px;

  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-inout: cubic-bezier(.65,0,.35,1);
  --ease-pop: cubic-bezier(.3,1.5,.5,1);
}
```

### Typografie

Eine Familie: **Inter Tight** (400, 500, 600, 700, 800), selbst gehostet (z. B. `@fontsource/inter-tight`), Fallback `'Helvetica Neue', Helvetica, Arial, sans-serif`. Alle Zahlen mit `font-variant-numeric: tabular-nums`.

| Rolle | Größe | Gewicht | Sonstiges |
|---|---|---|---|
| Label / Meta | 11 px | 600 | UPPERCASE, letter-spacing .1em |
| Klein | 13–14 px | 500–700 | |
| Fließtext | 15–16 px | 500–600 | line-height 1.35 |
| Frage | 24 px | 700 | letter-spacing −.02em, line-height 1.15 |
| Ländername (Finden) | 40 / 32 / 26 px | 800 | je nach Länge ≤11 / ≤18 / länger Zeichen; letter-spacing −.035em; line-height 1 |
| Ländername (Länder-Modus) | 60 / 48 px | 800 | ≤10 / länger; letter-spacing −.045em; line-height .92 |
| Urteil („Richtig.“) | 40 px | 800 | letter-spacing −.035em |
| Menüeintrag | 44 px | 800 | letter-spacing −.04em |
| Punktestand groß | 56 / 88 / 120 px | 800 | letter-spacing −.05em |

### Abstände und Größen

- Außenabstand der Overlays zum Bildschirmrand: 12 px (+ `env(safe-area-inset-*)`)
- Innenabstand in Inhaltsspalten: 16 px; Abstände sonst 4 / 8 / 12 / 16 px
- Inhaltsspalten (Länder-Modus, Flaggen): max. 560 px breit, zentriert
- Fragepanel und Antwort-Sheet sind horizontal zentriert und maximal 460 px breit. Auf schmalen Bildschirmen nutzen sie die gesamte verfügbare Breite bis zum Außenabstand von 12 px je Seite.
- Touch-Ziele mindestens 44 px; quadratische Buttons 48 × 48; Primärbutton 56 px hoch

## 3. Komponenten

- **Panel**: weiß, 2 px Rahmen. Optional mit **Meta-Zeile** oben (Label-Stil, drei Werte mit `space-between`, z. B. „Finden · 07 / 20 · 05 Punkte“, darunter 2 px Linie).
- **Quadrat-Button** (Menü, Zoom, Schließen) misst 48 × 48 px. Er ist weiß, hat einen 2 px starken Rahmen und ein Strich-SVG mit 2 px Strichstärke. Beim Hover invertieren Schwarz und Weiß. Der Menü-Button sitzt als rechtes Feld in der Meta-Zeile des Fragepanels und ist links durch eine 2 px starke Linie abgetrennt.
- **Primärbutton** („Weiter“, „Neue Runde“): volle Breite, 56 px, schwarz, Text weiß 16 px/700. Links das Label, rechts „LEERTASTE“ (Label-Stil, 75 % Deckkraft) und `→`. Unten optional der **Timerbalken** (siehe 6).
- **Optionszeile** (Multiple Choice): Raster `48px 1fr`, min. 56 px hoch, 2 px Rahmen; Zeilen überlappen sich um 2 px (`margin-top: -2px`), sodass die Linien nicht doppelt werden. Links die Ziffer 1–4 in eigener Zelle (2 px Trennlinie), rechts der Text 16 px/600.
  - richtig: füllt sich schwarz, Text weiß
  - falsch gewählt: füllt sich rot, Text weiß, kurzes Wackeln
  - übrige: Text `--muted`
- **Flaggen-Kachel** (Flaggenfrage): 4:3, 2 px Rahmen, Ziffer als 24-px-Quadrat oben links (schwarz, weiß). Nach der Antwort fährt unten eine Beschriftung mit dem Ländernamen ein (richtig: schwarz, falsch gewählt: rot, sonst weiß). Richtige Kachel bekommt einen 5-px-Innenrahmen, die übrigen 40 % Deckkraft.
- **Flagge**: immer 4:3 mit 2 px Kontur (`outline`), damit weiße Flaggen auf weißem Grund sichtbar bleiben.
- **Urteils-Punkt**: 10 × 10-px-Quadrat vor dem Label: `--ok` (richtig), `--accent` (falsch), `--muted` (übersprungen).
- **Fortschritt** (Länder-Modus): eine Zelle pro Frage, 10 px hoch, 2 px Rahmen, 4 px Abstand; Füllung schwarz (richtig), rot (falsch), grau `--land-hover` (aktuelle Frage).
- **Menü**. Der Hintergrund des Vollbild-Overlays ist weiß. Der Inhalt ist horizontal zentriert und maximal 560 px breit. Unter dem Kopf „GEOQUIZ“ mit Schließen-Button stehen das Label „Modus“ und die nummerierte Liste mit 2-px-Trennlinien. Die Einträge sind `01 Finden`, `02 Benennen`, `03 Flaggen`, `04 Länder` und `05 Statistik`. Noch nicht fertige Modi sind grau und mit „FOLGT“ gekennzeichnet. Beim Hover rückt der Eintrag 12 px ein. Unter der Liste öffnen „Kategorie“ und „Zufall“ die Rundeneinstellungen.

## 4. Karte

- Projektion Miller, horizontal endlos (wie umgesetzt), Antarktis entfernt.
- Meer `--sea`, Land `--paper`, Grenzen `--ink` 0,8 px mit `vector-effect: non-scaling-stroke`.
- Gradnetz alle 30° Länge und 20° Breite, 1 px `--grid`.
- Hover während einer Kartenfrage verwendet `--land-hover`. In Benennen ist das gesuchte Land blau (`--highlight`). In Finden erscheint die Lösung nach einem Fehler oder beim Überspringen blau, ein korrekt angeklicktes Land grün (`--ok`). Falsch ausgewählte Länder erscheinen rot (`--accent`). Gebiete ohne Quiz bleiben grau (`--land-off`).
- In den Menü-Einstellungen lassen sich blaue Kleinstaaten-Ringe einschalten. Sie sind standardmäßig ausgeblendet. Die klickbaren Marker bleiben sichtbar. Der Ring hat 2 px Strichstärke mit `vector-effect: non-scaling-stroke`.
- Blau markierte Länder pulsieren bei ihrer ersten Hervorhebung kurz, unabhängig von ihrer Größe und der Ring-Einstellung. Bei Kleinstaaten pulsiert auch der Marker.

## 5. Bildschirme

### Finden
- Karte im Vollbild, alles andere als Overlay.
- Oben steht das zentrierte Fragepanel. In der Meta-Zeile sitzt rechts der Menü-Button. Darunter stehen „Wo liegt“ (14 px), der große Ländername und rechts daneben die Flagge (56 px breit).
- Unten links steht „Überspringen“ (48 px hoch, weiß, Rahmen). Unten rechts stehen die Zoom-Buttons +/− als Stapel.
- Nach der Antwort erscheint unten mittig das **Sheet** mit Urteils-Punkt, Fragenummer, Urteil („Richtig.“ / „Falsch.“ / „Übersprungen.“), Erklärung und Primärbutton. Bei falscher Antwort steht die Flagge des falsch gewählten Landes rechts neben dem Urteil.
- Ende der Runde (20 Fragen): Sheet mit „RUNDE BEENDET“, Ergebnis 88 px, ein Satz, „Neue Runde“.

### Benennen
Der Aufbau entspricht Finden. Das gesuchte Land ist blau markiert. Das zentrierte Antwort-Sheet zeigt standardmäßig vier Optionszeilen. Unter „Antwort in Benennen“ im Menü lässt sich auf das Eingabefeld umschalten. Auf schmalen Bildschirmen sitzt das Sheet oberhalb der Eckbedienelemente, solange diese sichtbar sind.

### Flaggen
- Spalte (max. 560 px): oben Zurück-Button (48 px, `←`) und Meta-Leiste daneben.
- Große Flagge 4:3 über die volle Breite, darunter „Welches Land ist das?“, 4 Optionszeilen, Primärbutton.
- Nach der Antwort fährt am unteren Flaggenrand eine schwarze Beschriftung mit dem richtigen Ländernamen ein (20 px/800).
- Falsche Optionen: geografisch nahe Länder (die 6 nächsten nach Mittelpunkt, davon 3 zufällig).

### Länder-Modus
- Oben ein **Farbblock** in der Hauptfarbe des Landes, Höhe `clamp(250px, 36vh, 380px)`, unten 2 px Linie. Darin: Zurück-Link „← Karte“ (umrandet in Textfarbe), „LAND 02 / 05“, rechts der Landesumriss (gefüllt in Textfarbe, 90 %), unten links Label „LÄNDER-MODUS“ und der Ländername groß.
- Textfarbe im Farbblock automatisch: Weiß oder `--ink`, je nachdem, was nach WCAG den höheren Kontrast zur Landesfarbe hat.
- Darunter Spalte (max. 560 px): Fortschrittszellen, Fragenummer + Kategorie (Label-Stil), Frage, Optionen, Primärbutton.
- Fragenreihenfolge: **Flagge**, Hauptstadt, Kontinent, Währung, Zentralbank, Leitindex, Staatsform (Kategorien ohne Daten werden übersprungen).
- Die Flagge erscheint im Farbblock **erst, nachdem die Flaggenfrage beantwortet ist** (fällt über dem Ländernamen ein, 64 × 48 px).
- Am Ende ein **Steckbrief**: „STECKBRIEF“ + Ergebnis 56 px, darunter je Kategorie eine Zeile (Punkt schwarz/rot, Label, Wert; bei Flagge die Mini-Flagge), Primärbutton „Nächstes Land“.

## 6. Bewegung

| Moment | Dauer | Kurve | Details |
|---|---|---|---|
| Kartenflug zur Lösung / zurück | 800 ms | `--ease-inout` | nur bei falsch oder übersprungen |
| Kleinstaaten-Ring erscheint | 2 × 600 ms | `--ease-out` | Ring pulsiert zweimal und bleibt danach sichtbar |
| Land wird hervorgehoben | 2 × 600 ms | `--ease-out` | Land und gegebenenfalls Marker pulsieren am Anfang und bleiben danach blau |
| Mausrad-Zoom | 180 ms | ease-out | |
| Neue Frage (Text, Optionen) | 500 ms | `--ease-out` | von 14–16 px unten einblenden; Optionen je 50 ms versetzt |
| Flagge in der Fragekarte | 550 ms, 80 ms Verzögerung | `--ease-out` | von 16 px rechts, 4° gedreht |
| Sheet hochfahren | 450 ms | `--ease-out` | von unterhalb des Bildschirms |
| Urteils-Punkt | 350 ms, 150 ms Verzögerung | `--ease-pop` | von 0 auf volle Größe |
| Punktestand bei Treffer | 450 ms | `--ease-out` | kurz auf 135 % und zurück |
| Option füllt sich | 420 ms | `--ease-inout` | Fläche wächst von links (`scaleX`), Textfarbe 120 ms verzögert |
| Falsche Option wackelt | 420 ms | | ±6 px horizontal |
| Timerbalken (richtig) | 1100 ms | linear | 4 px, `--ok`, am unteren Rand des Primärbuttons, wächst von links |
| Länderwechsel: Farbe | 800 ms | `--ease-inout` | neue Farbe schiebt sich von unten über die alte (`clip-path`) |
| Ländername | 800 ms, 300 ms Verzögerung | `--ease-out` | gleitet aus einer Maske nach oben |
| Landesumriss | 1800 ms, 350 ms Verzögerung | `--ease-inout` | erst als Linie gezeichnet (`stroke-dashoffset`), ab 70 % füllt er sich |
| Flagge fällt in den Farbblock | 600 ms | `--ease-pop` | von oben, −8°, 70 % Größe |
| Fortschrittszelle | 450 ms | `--ease-inout` | füllt sich von links |
| Steckbrief | | | Ergebnis zählt alle 140 ms um 1 hoch; Zeilen je 60 ms versetzt |
| Flaggen-Modus: neue Flagge | 700 ms | `--ease-inout` | wird von links nach rechts aufgedeckt |
| Beschriftung unter Flagge | 400 ms, 100 ms Verzögerung | `--ease-out` | fährt von unten ein |
| Menü | 200 ms | ease | einblenden |
| Menüpunkte | je 260 ms | `--ease-out` beim Öffnen, `--ease-inout` beim Schließen | Modusliste gleitet 16 px von links ein und nach links aus |

Bei `prefers-reduced-motion: reduce` ersetzen Einblendungen von 150 ms die sonstigen Bewegungen. Kartenflüge springen direkt, hervorgehobene Länder und ihre Marker bleiben ruhig.

## 7. Spielablauf und Tastatur

- **Richtig**: Urteils-Punkt grün, Karte bleibt stehen, nach **1100 ms automatisch** zur nächsten Frage (Timerbalken läuft). Leertaste springt sofort weiter.
- **Falsch**: rot, Karte fliegt zur Lösung (im Finden-Modus), es geht erst per Klick/Leertaste weiter.
- **Übersprungen**: grauer Punkt, wie falsch, zählt nicht als Punkt.
- **Tastatur** (global auf `window`, nicht bei Fokus in einem Textfeld):
  - Leertaste / Enter: Weiter (bzw. „Neue Runde“)
  - 1–4: Option wählen
  - Escape: Menü schließen
  - Im Tipp-Modus: Enter schickt die Antwort ab; danach wirkt Enter/Leertaste als Weiter.
- Fokus für Tastaturnutzer sichtbar: 3 px Kontur `--ink`, 2 px Abstand (`:focus-visible`).

## 8. Daten für das Design

- **Hauptfarbe**: neue Spalte `color` (Hex) in `data/sets/world/entities.csv`. Startwert automatisch aus der Flagge berechnen (größte Fläche, die nicht weiß oder fast weiß ist), dann von Hand korrigierbar. Weiße oder sehr helle Ergebnisse vermeiden.
- **Flaggen**. Der Daten-Build legt die 4:3-SVGs aus `flag-icons` (MIT) anhand der ISO-Codes unter `public/data/flags/` ab. Kosovo `XKX` erhält `xk`.
- **Flagge als Kategorie**. Der Typ `flag` erzeugt vorwärts die Frage „Welche Flagge gehört zu X?“ mit vier Flaggen-Kacheln. Rückwärts zeigt das Fragepanel die Flagge neben „Welches Land ist das?“ und erlaubt Tippen oder vier Ländernamen zur Auswahl. Die optionale Spalte `flag_similar` enthält eine mit `|` getrennte Liste ähnlicher Länder-IDs. Für Ablenker haben diese IDs Vorrang, gefolgt von Nachbarländern und Ländern desselben Kontinents.
