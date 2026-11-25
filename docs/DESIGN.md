# GeoQuiz – Design-Spezifikation

Verbindliche Gestaltungsregeln für alle Bildschirme. Die freigegebene visuelle Referenz liegt in `docs/prototype/` (Finden, Länder-Modus, Flaggen). Diese Dateien sind **nur Referenz**: Werte, Layouts, Texte und Animationen daraus übernehmen, aber nicht ihre Template-Syntax (`<x-dc>`, `<sc-if>`, `<sc-for>`, `{{…}}`, `DCLogic`) und nicht ihre `/_blob/…`-URLs. Im Zweifel gilt dieses Dokument.

## 1. Haltung

Swiss Style: typografiegetrieben, schwarz-weiß, strenges Raster.

- Schwarz und Weiß tragen das Layout. Rot kennzeichnet Fehler, Grün richtige Antworten und Blau die Kartenmarkierung. Im Atlas-Landesdesign und bei Flaggen kommen Landesfarben hinzu.
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
  --ease-smooth: cubic-bezier(.16,1,.3,1);
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
| Ländername (Lage-Frage) | 40 / 32 / 26 px | 800 | je nach Länge ≤11 / ≤18 / länger Zeichen; letter-spacing −.035em; line-height 1 |
| Ländername (Landesdesign) | 60 / 48 px | 800 | ≤10 / länger; letter-spacing −.045em; line-height .92 |
| Urteil („Richtig.“) | 40 px | 800 | letter-spacing −.035em |
| Menüeintrag | 44 px | 800 | letter-spacing −.04em |
| Punktestand groß | 56 / 88 / 120 px | 800 | letter-spacing −.05em |

### Abstände und Größen

- Außenabstand der Overlays zum Bildschirmrand: 12 px (+ `env(safe-area-inset-*)`)
- Innenabstand in Inhaltsspalten: 16 px; Abstände sonst 4 / 8 / 12 / 16 px
- Inhaltsspalten im Menü, Atlas-Steckbrief und Flaggen-Antwortbereich: max. 560 px breit, zentriert
- Fragepanel und reguläres Antwort-Sheet sind horizontal zentriert und maximal 460 px breit. Auf schmalen Bildschirmen nutzen sie die gesamte verfügbare Breite bis zum Außenabstand von 12 px je Seite.
- Touch-Ziele mindestens 44 px; quadratische Buttons 48 × 48; Primärbutton 56 px hoch

## 3. Komponenten

- **Panel**: weiß, 2 px Rahmen. Die **Meta-Zeile** zeigt links Kategorie, Fragenummer und Punkte im Label-Stil mit `space-between`. Im Atlas steht dort „ATLAS“. Eine 2-px-Linie trennt die Meta-Zeile vom Inhalt.
- **Quadrat-Feld**: 48 × 48 px, weiß, 2 px Linie zur Nachbarzelle, Strich-SVG mit 2 px Strichstärke. Auf dem Desktop invertieren Schwarz und Weiß beim Hover. In aktiven Fragen sitzt das Überspringen-Feld mit `→|` unmittelbar links vom Menü-Feld. Es hat das zugängliche Label „Überspringen“ und zeigt beim Desktop-Hover „Überspringen (S)“. Beim Urteil, in der Zusammenfassung und im Atlas bleibt das Menü-Feld sichtbar.
- **Primärbutton** („Antwort prüfen“, „Runde starten“, „Neue Runde“): volle Breite, 56 px, schwarz, Text weiß 16 px/700.
- **Weiter-Overlay**. Ein schwarzes Feld steht mittig oberhalb des Antwort-Sheets. Oben steht „WEITER“ in weißem Label-Stil, darunter „Leertaste“ bei Maus und Tastatur oder „Tippen“ bei Touch. Bei einer richtigen Antwort zeigt ein 4-px-Balken in `--ok` die verbleibende Zeit. Während einer Pause steht oben „PAUSIERT“.
- **Optionszeile** (Multiple Choice): Raster `48px 1fr`, min. 56 px hoch, 2 px Rahmen; Zeilen überlappen sich um 2 px (`margin-top: -2px`), sodass die Linien nicht doppelt werden. Links die Ziffer 1–4 in eigener Zelle (2 px Trennlinie), rechts der Text 16 px/600.
  - richtig: füllt sich schwarz, Text weiß
  - falsch gewählt: füllt sich rot, Text weiß, kurzes Wackeln
  - übrige: Text `--muted`
- **Flaggen-Kachel**: 2 px Rahmen und eine Flagge im Format 4:3. Darunter steht eine feste Zeile mit Ziffer links und reserviertem Platz für den Ländernamen. Nach der Antwort erscheint der Name. Die richtige Zeile ist schwarz mit weißer Schrift, die falsch gewählte rot mit weißer Schrift. Die übrigen bleiben weiß. Das richtige Bild erhält 5 px Innenkontur, die anderen Bilder werden auf 40 % Deckkraft abgeblendet.
- **Flagge**: immer 4:3 mit 2 px Kontur (`outline`), damit weiße Flaggen auf weißem Grund sichtbar bleiben.
- **Urteils-Punkt**: 10 × 10-px-Quadrat vor dem Label: `--ok` (richtig), `--accent` (falsch), `--muted` (übersprungen).
- **Fortschritt** (Vorlage „Ein Land komplett“): eine Zelle pro Frage, 10 px hoch, 2 px Rahmen, 4 px Abstand; Füllung schwarz (richtig), rot (falsch), grau `--land-hover` (aktuelle Frage).
### Menü

Das Vollbild-Overlay ist weiß. Die Menüspalte ist zentriert und maximal 560 px breit. Jede Ebene erhält oben eine Kopfzeile. Escape und das 48-px-Zurück-Feld gehen eine Ebene zurück. Auf der ersten Ebene schließt Escape das Menü.

1. **Hauptmenü**. Kopf mit „GEOQUIZ“, dem eingerahmten Label „GEBIET: WELT“ und dem Schließen-Feld rechts. Die nummerierte Liste zeigt „01 Üben →“, „02 Atlas →“ und „03 Fortschritt“ mit „FOLGT“. Zeilen verwenden 44 px/800 und 2-px-Trennlinien. Beim Desktop-Hover rückt der aktive Eintrag 12 px ein. Darunter steht die einklappbare Zeile „EINSTELLUNGEN“ mit Plus. Sie ist beim Öffnen geschlossen. Darin stehen Lösungszoom, Kleinstaaten-Ringe und „Weltansicht zurücksetzen“.
2. **Üben**. Links das Zurück-Feld mit `←`, daneben „Üben“ in 44 px/800. Unter „VORLAGEN“ stehen die verfügbaren Vorlagen als 28-px-Zeilen mit Gewicht 800. Die Zeile startet die Runde mit den zuletzt gewählten Einstellungen. Rechts führt „Anpassen“ in 13 px/700 zum Rundenaufbau und ist beim Hover unterstrichen. Vorlagen mit „FOLGT“ sind grau und deaktiviert. „EIGENE RUNDE“ führt mit einer Zeile zum Rundenaufbau.
3. **Rundenaufbau**. Links steht pro Zeile das Label in 11 px und Großbuchstaben, rechts die Optionen als eckige Segmente mit 2-px-Rahmen und −2 px Abstand. Gewählte Segmente sind schwarz mit weißer Schrift. Die Kategorie erlaubt Mehrfachauswahl. Unpassende Antwortarten werden ausgegraut. In „Auswahl“ steht Schwierigkeit als Platzhalter. Unten bleibt der 56-px-Primärbutton „Runde starten →“ sichtbar. Enter startet die Runde.

## 4. Karte

- Projektion Miller, horizontal endlos (wie umgesetzt), Antarktis entfernt.
- Meer `--sea`, Land `--paper`, Grenzen `--ink` 0,8 px mit `vector-effect: non-scaling-stroke`.
- Gradnetz alle 30° Länge und 20° Breite, 1 px `--grid`.
- Hover bei freier Auswahl und in Kartenfragen verwendet `--land-hover`. Gebiete ohne Quiz bleiben grau (`--land-off`).
- **Land → Kategorie**. Die Karte fliegt zum Land und markiert es blau (`--highlight`). Beim Urteil wird das Land grün (`--ok`) oder rot (`--accent`). Beim Überspringen bleibt es blau. Die Lage-Frage per Kartenklick hält das gesuchte Land bis zur Antwort verdeckt.
- **Kategorie → Land**. Bei Lage → Land beginnt die Frage mit dem hervorgehobenen Land. Bei den übrigen Kategorien erscheint die Lösung erst beim Urteil. Dann fliegt die Karte zur grünen Lösung. Eine falsch gewählte Entität erscheint rot und wird gemeinsam mit der Lösung eingerahmt. Welche Antwort bei mehreren passenden Ländern richtig ist, bestimmt die Übungs-Engine.
- Der automatische Quizzoom zeigt die Weltregion zwischen Fragepanel und Antwortbereich. Die Breite umfasst mindestens 50 Längengrade (`MIN_VIEW_SPAN_DEG`). Braucht die vollständige Geometrie mehr Raum, etwa bei Russland, Kanada oder Brasilien, zoomt die Karte weiter heraus. Der Ausschnitt reserviert pro Seite 15 % Rand für die Geometrie. Er nutzt nahe horizontale Weltkopien. Das Sheet kann bei wenig Platz scrollen. Mausrad, Ziehen und Touch-Gesten bleiben auf der freien Karte aktiv.
- Beim Fragenwechsel fliegt die Kamera von ihrer aktuellen Position zur nächsten Ansicht. Liegt das neue Land bereits im freien Ausschnitt und passt die Zoomstufe, schwenkt sie bei gleicher Vergrößerung. Fragen mit verdecktem Land wechseln sanft zur Weltansicht.
- Beim Zeigen der Lösung für einen Kleinstaat laufen drei blaue Radar-Ringe mit 2 px Strichstärke zum Marker zusammen. Der letzte Ring bleibt stehen. Eine kurze Linie verbindet ihn mit einem weißen Namensschild mit 2 px Rahmen und 13 px/700. Das Schild sitzt im freien Kartenbereich oberhalb des Weiter-Overlays und unterhalb des Fragepanels. Es folgt dem Marker beim Verschieben und Zoomen.
- In den Menü-Einstellungen lassen sich blaue Kleinstaaten-Ringe einschalten. Sie sind standardmäßig ausgeblendet. Die klickbaren Marker bleiben sichtbar. Der Ring hat 2 px Strichstärke mit `vector-effect: non-scaling-stroke`.
- Blau markierte Länder pulsieren bei ihrer ersten Hervorhebung kurz, unabhängig von ihrer Größe und der Ring-Einstellung. Bei Kleinstaaten pulsiert auch der Marker.

## 5. Bildschirme

### Üben

Die Karte liegt im Vollbild. Über ihr stehen die kompakte Frage und unten, je nach Antwortart, das Antwort-Sheet oder das Eingabefeld. Bei Land → Lage stehen „Wo liegt“ (14 px) und der große Ländername im Fragepanel. Nach der Antwort zeigt das Sheet Fragenummer, Urteils-Punkt, Urteil und Erklärung. Oberhalb erscheint das Weiter-Overlay. Am Ende gibt es „RUNDE BEENDET“, Ergebnis, Zusammenfassung und „Neue Runde“.

### Flaggen

- **Land → Flagge**. Das Antwort-Sheet ist bis 560 px breit. Vier Flaggen-Kacheln bilden ein 2×2-Raster. Die Ziffer und die reservierte Namenszeile stehen unter jedem Bild.
- **Flagge → Land**. Die gesuchte Flagge füllt im Format 4:3 die Innenbreite des Fragepanels. Darunter steht „Welches Land ist das?“. Das Antwort-Sheet ist bis 560 px breit und enthält vier Länderoptionen oder das Tippfeld.

### Atlas

Oben stehen „ATLAS“ und „Land antippen“. Unten öffnet ein Kartenklick den Steckbrief mit großem Ländernamen, Flagge und Zeilen für die befüllten Kategorien. Pro Zeile stehen links das Label und rechts der Wert. Anklickbare Nachbarn öffnen den jeweiligen Steckbrief und rücken das Land ins Kartenfenster.

### Ein Land komplett und Atlas-Landesdesign

- Oben ein **Farbblock** in der Hauptfarbe des Landes, Höhe `clamp(250px, 36vh, 380px)`, unten 2 px Linie. Darin: Zurück-Link „← Karte“ (umrandet in Textfarbe), „LAND 02 / 05“, rechts der Landesumriss (gefüllt in Textfarbe, 90 %), unten links Label „LAND“ und der Ländername groß. Der Atlas-Steckbrief übernimmt diese Kopfgestaltung in Meilenstein 6.
- Textfarbe im Farbblock automatisch: Weiß oder `--ink`, je nachdem, was nach WCAG den höheren Kontrast zur Landesfarbe hat.
- Darunter Spalte (max. 560 px): Fortschrittszellen, Fragenummer + Kategorie (Label-Stil), Frage, Optionen, Primärbutton.
- Fragenreihenfolge: **Flagge**, Hauptstadt, Kontinent, Währung, Zentralbank, Leitindex, Staatsform (Kategorien ohne Daten werden übersprungen).
- Die Flagge erscheint im Farbblock **erst, nachdem die Flaggenfrage beantwortet ist** (fällt über dem Ländernamen ein, 64 × 48 px).
- Am Ende ein **Steckbrief**: „STECKBRIEF“ + Ergebnis 56 px, darunter je Kategorie eine Zeile (Punkt schwarz/rot, Label, Wert; bei Flagge die Mini-Flagge), Primärbutton „Nächstes Land“.

## 6. Bewegung

| Moment | Dauer | Kurve | Details |
|---|---|---|---|
| Kartenflug | 700–1400 ms | `--ease-inout` | Dauer nach Entfernung. Beim Flug kurz herauszoomen, schwenken und wieder hineinzoomen. Ist das Ziel bereits im passenden Ausschnitt, nur schwenken. |
| Kleinstaat als Lösung | 3 × 700 ms | `--ease-out` | ab Bildschirmrand mit je 180 ms Versatz zum Marker zusammenziehen. Die Kontur wird dichter. |
| Radar-Ring und Namensschild | 150 ms | ease | nach dem letzten Durchlauf einblenden und bis zur nächsten Frage zeigen |
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
| Weiter-Overlay | 300 ms | `--ease-smooth` | 8 px von unten einblenden |
| Timerbalken (richtig) | 5000 ms | linear | 4 px, `--ok`, am unteren Rand des Weiter-Overlays. Läuft von voll auf leer und hält bei einer Pause an. |
| Länderwechsel: Farbe | 800 ms | `--ease-inout` | neue Farbe schiebt sich von unten über die alte (`clip-path`) |
| Ländername | 800 ms, 300 ms Verzögerung | `--ease-out` | gleitet aus einer Maske nach oben |
| Landesumriss | 1800 ms, 350 ms Verzögerung | `--ease-inout` | erst als Linie gezeichnet (`stroke-dashoffset`), ab 70 % füllt er sich |
| Flagge fällt in den Farbblock | 600 ms | `--ease-pop` | von oben, −8°, 70 % Größe |
| Fortschrittszelle | 450 ms | `--ease-inout` | füllt sich von links |
| Steckbrief | | | Ergebnis zählt alle 140 ms um 1 hoch; Zeilen je 60 ms versetzt |
| Namenszeile der Flaggen-Kachel | 250 ms | `--ease-out` | Name gleitet nach dem Urteil in die reservierte Zeile |
| Menü öffnen: Overlay | 150 ms | ease | weißes Overlay blendet ein |
| Menü öffnen: Blöcke | 600 ms | `--ease-smooth` | ab 150 ms von 24 px unten einblenden, je 50 ms Versatz in Lesereihenfolge |
| Menüebene vor: alte Blöcke | 200 ms | `--ease-smooth` | 24 px nach links ausblenden, je 20 ms Versatz |
| Menüebene vor: neue Blöcke | 600 ms | `--ease-smooth` | von 32 px rechts einblenden, je 50 ms Versatz |
| Menüebene zurück | 200 / 600 ms | `--ease-smooth` | spiegelbildlich nach rechts hinaus und von links hinein, je 20 / 50 ms Versatz |
| Menü schließen | 200 ms | `--ease-smooth` | Blöcke 12 px nach unten ausblenden, je 15 ms Versatz in umgekehrter Reihenfolge |
| Einstellungen | 350 ms | `--ease-smooth` | Höhe aufklappen, Zeilen je 40 ms versetzt einblenden und Plus um 45° zum × drehen |

Die Menüblöcke sind die Kopfzeilen, Listenzeilen, Abschnittslabels und Aktionsflächen. Bei `prefers-reduced-motion: reduce` bleiben nur Ein- und Ausblendungen mit 150 ms ohne Versatz. Kartenflüge springen direkt. Länder und Marker bleiben ruhig. Beim Radar erscheinen der stehende Ring und das Namensschild direkt als Überblendung.

## 7. Spielablauf und Tastatur

- **Richtig**. Grüner Urteils-Punkt. Nach **5000 ms** (`AUTO_ADVANCE_MS`) beginnt automatisch die nächste Frage. Ein Klick oder Tipp auf den freien Kartenbereich geht sofort weiter.
- **Falsch oder übersprungen**. Roter bzw. grauer Urteils-Punkt. Die Lösung bleibt zur Erkundung auf der Karte. Weiter geht es durch eine Aktion des Spielers.
- Nach jedem Urteil führen ein Tipp auf das Antwort-Sheet oder das Weiter-Overlay sowie Leertaste oder Enter weiter.
- Während einer Kartenbewegung oder solange die Maus über dem Antwort-Sheet steht, pausiert der Countdown einer richtigen Antwort. Das Feld zeigt „PAUSIERT“ und der Balken bleibt stehen. Sobald beide Interaktionen beendet sind, läuft die Restzeit weiter.
- **Tastatur**. `1`–`4` wählen eine Option. `S` überspringt außerhalb von Textfeldern. Enter im Tippfeld prüft die Antwort, bei leerem Feld überspringt es. Leertaste und Enter gehen nach dem Urteil weiter oder starten eine neue Runde. Enter startet im Rundenaufbau. Escape geht im Menü eine Ebene zurück und schließt es auf der ersten Ebene.
- Fokus für Tastaturnutzer ist als 3 px Kontur in `--ink` mit 2 px Abstand sichtbar (`:focus-visible`).

## 8. Daten für das Design

- **Hauptfarbe**: neue Spalte `color` (Hex) in `data/sets/world/entities.csv`. Startwert automatisch aus der Flagge berechnen (größte Fläche, die nicht weiß oder fast weiß ist), dann von Hand korrigierbar. Weiße oder sehr helle Ergebnisse vermeiden.
- **Flaggen**. Der Daten-Build legt die 4:3-SVGs aus `flag-icons` (MIT) anhand der ISO-Codes unter `public/data/flags/` ab. Kosovo `XKX` erhält `xk`.
- **Flagge als Kategorie**. Der Typ `flag` erzeugt vorwärts die Frage „Welche Flagge gehört zu X?“ mit vier Flaggen-Kacheln. Rückwärts zeigt das Fragepanel die Flagge oberhalb von „Welches Land ist das?“ und erlaubt Tippen oder vier Ländernamen zur Auswahl. Die optionale Spalte `flag_similar` enthält eine mit `|` getrennte Liste ähnlicher Länder-IDs. Für Ablenker haben diese IDs Vorrang, gefolgt von Nachbarländern und Ländern desselben Kontinents.
