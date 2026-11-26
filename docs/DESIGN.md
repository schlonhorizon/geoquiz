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
  --river: #949494;        /* Flusslinien */
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

1. **Hauptmenü**. Kopf mit „GEOQUIZ“, dem eingerahmten Label „GEBIET: WELT“ und dem Schließen-Feld rechts. Die nummerierte Liste zeigt „01 Üben →“, „02 Atlas →“ und „03 Fortschritt“ mit „FOLGT“. Zeilen verwenden 44 px/800 und 2-px-Trennlinien. Beim Desktop-Hover rückt der aktive Eintrag 12 px ein. Darunter steht die einklappbare Zeile „EINSTELLUNGEN“ mit Plus. Sie ist beim Öffnen geschlossen. Darin stehen Lösungszoom, Kleinstaaten-Ringe, „Seen und Flüsse“ (standardmäßig an), „Weltansicht zurücksetzen“ und „Quellen und Lizenzen“. Die Quellenseite nutzt dieselbe Vollbildnavigation. Zurück und Escape führen zu den aufgeklappten Einstellungen.
2. **Üben**. Links das Zurück-Feld mit `←`, daneben „Üben“ in 44 px/800. Unter „VORLAGEN“ stehen die verfügbaren Vorlagen als 28-px-Zeilen mit Gewicht 800. Die Zeile startet die Runde mit den zuletzt gewählten Einstellungen. Rechts führt „Anpassen“ in 13 px/700 zum Rundenaufbau und ist beim Hover unterstrichen. Vorlagen mit „FOLGT“ sind grau und deaktiviert. „EIGENE RUNDE“ führt mit einer Zeile zum Rundenaufbau.
3. **Rundenaufbau**. Links steht pro Zeile das Label in 11 px und Großbuchstaben, rechts die Optionen als eckige Segmente mit 2-px-Rahmen und −2 px Abstand. Gewählte Segmente sind schwarz mit weißer Schrift. Die Kategorie erlaubt Mehrfachauswahl. Unpassende Antwortarten werden ausgegraut. In „Auswahl“ steht Schwierigkeit als Platzhalter. Unten bleibt der 56-px-Primärbutton „Runde starten →“ sichtbar. Enter startet die Runde.

Bei „Ein Land komplett“ bietet der Rundenaufbau Zufall, Region und ein bestimmtes Startland mit Suche nach Namen oder Alias. Die Anzahl ist 1, 3, 5 oder 10 Länder. Bei einem gewählten Startland folgen die weiteren Länder per Zufall.

Vor den Kategorie-Segmenten steht „Alle / Keine“. Ein Tipp schaltet zwischen vollständiger und leerer Auswahl um. Eine teilweise Auswahl wird vervollständigt. Bei leerer Auswahl steht „Mindestens eine Kategorie wählen“ über dem deaktivierten Startbutton.

## 4. Karte

- Projektion Miller, horizontal endlos (wie umgesetzt), Antarktis entfernt.
- Meer `--sea`, Land `--paper`, Grenzen `--ink` 0,8 px. Die Breiten gelten in CSS-Pixeln im Stand und in Bewegung. Canvas zeichnet mit der physischen Pixeldichte des Bildschirms.
- Gradnetz alle 30° Länge und 20° Breite, 1 px `--grid`.
- Die Übersicht verwendet Natural Earth 1:50 Mio. Ab 3-facher Vergrößerung stehen vier vorbereitete Stufen der 1:10-Mio.-Daten zur Verfügung. Der erste Wechsel zur Detailkarte blendet im Stillstand in 200 ms über. Mit reduzierter Bewegung erfolgt er direkt. Der Worker zeichnet für jede neue Kameraposition die Geometrie im Ausschnitt neu. Beim Ziehen kann ein 1,5-fach großer Randpuffer bis zu zwei Frames am Raster mitwandern. Beim Zoomen wartet die Karte auf den nächsten scharf gezeichneten Frame. Markierungen und Lösungen bleiben als animierbare SVG-Ebene darüber.
- Seen sind in `--sea` gefüllt und haben die gleiche Kontur wie die Küsten. Flüsse erscheinen mit 0,6 px in `--river` und behalten ihre Strichstärke beim Zoomen. Kleine Flüsse kommen bei 7-fachem Zoom hinzu. Gewässer haben keine Beschriftung.
- Im Atlas erscheint bei 60 px Diagonale des Kerngebiets ein festes 6-px-Quadrat in `--ink`. Ab 140 px erscheint der Hauptstadtname mit 11 px/600 und weißer Kontur. Größere Länder haben Vorrang, sobald sich die Namensflächen überschneiden. Seen, Flüsse und die sichtbaren Hauptstadtmarker bleiben beim Ziehen, Zoomen und Fliegen eingeblendet. Die zuletzt platzierten Namen wandern mit. Die Kollisionsprüfung läuft nach Ende der Bewegung erneut. Quizkarten zeigen diese Atlas-Ebene nicht.
- Hover bei freier Auswahl und in Kartenfragen verwendet `--land-hover`. Gebiete ohne Quiz bleiben grau (`--land-off`).
- **Land → Kategorie**. Die Karte fliegt zum Land und markiert es blau (`--highlight`). Beim Urteil wird das Land grün (`--ok`) oder rot (`--accent`). Beim Überspringen bleibt es blau. Die Lage-Frage per Kartenklick hält das gesuchte Land bis zur Antwort verdeckt.
- **Kategorie → Land**. Bei Lage → Land beginnt die Frage mit dem hervorgehobenen Land. Bei den übrigen Kategorien erscheint die Lösung erst beim Urteil. Dann fliegt die Karte zur grünen Lösung. Eine falsch gewählte Entität erscheint rot und wird gemeinsam mit der Lösung eingerahmt. Welche Antwort bei mehreren passenden Ländern richtig ist, bestimmt die Übungs-Engine.
- Der automatische Quizzoom zeigt die Weltregion zwischen Fragepanel und Antwortbereich. Die Breite umfasst mindestens 50 Längengrade (`MIN_VIEW_SPAN_DEG`). Braucht das Kerngebiet mehr Raum, etwa bei Russland, Kanada oder Brasilien, zoomt die Karte weiter heraus. Der Ausschnitt reserviert pro Seite 15 % Rand für das Kerngebiet und nutzt nahe horizontale Weltkopien. Alle Teilflächen bleiben sichtbar und als Treffer nutzbar. Im Atlas füllt die Karte bei der kleinsten Zoomstufe die Bildschirmhöhe. Vertikal hält sie an Nord- und Südrand, horizontal läuft sie endlos weiter.
- Beim Fragenwechsel fliegt die Kamera von ihrer aktuellen Position zur nächsten Ansicht. Liegt das neue Land bereits im freien Ausschnitt und passt die Zoomstufe, schwenkt sie bei gleicher Vergrößerung. Fragen mit verdecktem Land wechseln sanft zur Weltansicht.
- Beim Zeigen der Lösung für einen Kleinstaat laufen drei blaue Radar-Ringe mit 2 px Strichstärke zum Marker zusammen. Der letzte Ring bleibt stehen. Eine kurze Linie verbindet ihn mit einem weißen Namensschild mit 2 px Rahmen und 13 px/700. Das Schild sitzt im freien Kartenbereich oberhalb des Weiter-Overlays und unterhalb des Fragepanels. Es folgt dem Marker beim Verschieben und Zoomen.
- In den Menü-Einstellungen lassen sich blaue Kleinstaaten-Ringe einschalten. Sie sind standardmäßig ausgeblendet. Die klickbaren Marker bleiben sichtbar. Der Ring hat 2 px Strichstärke mit `vector-effect: non-scaling-stroke`.
- Blau markierte Länder pulsieren bei ihrer ersten Hervorhebung kurz, unabhängig von ihrer Größe und der Ring-Einstellung. Bei Kleinstaaten pulsiert auch der Marker.
- **Hauptstadt auf der Landeskarte**. Der Startausschnitt zeigt das Kerngebiet mit 15 % Rand und mindestens 12 Längengraden Breite. Das Zielland ist weiß (`--paper`), die Nachbarflächen sind grau (`--land-off`). Der Mauscursor ist beim Markieren ein Fadenkreuz. Ziehen verschiebt die Karte, Mausrad und Zwei-Finger-Gesten zoomen. Ein Tipp ohne Ziehbewegung setzt den Punkt. Zwei Ringe laufen vom Tipp weg. Das eigene Quadrat (12 px, 2 px Rahmen in `--ink`) erscheint mit weißer Füllung und bleibt am Ende leer stehen. Das weiße Namensschild (2 px Rahmen, 13 px/700) beginnt am Tipp mit Fragezeichen und folgt der gezeichneten Linie zur Hauptstadt. Beim Einrasten entfällt das Fragezeichen. Die Hauptstadt erscheint in `--ok` bei einem Treffer und in `--accent` bei einer Fehlschätzung. Das Distanzschild erscheint entlang der Linienmitte. Schild und Urteil zeigen ganze Kilometer, zum Beispiel „84 km“. Die Schilder bleiben im freien Kartenbereich und weichen bei wenig Platz auf eine andere Seite des Punkts aus. Die Toleranz beträgt 10 % der Kerngebietsdiagonale, mindestens 25 und höchstens 150 km.

## 5. Bildschirme

### Üben

Die Karte liegt im Vollbild. Über ihr stehen die kompakte Frage und unten, je nach Antwortart, das Antwort-Sheet oder das Eingabefeld. Bei Land → Lage stehen „Wo liegt“ (14 px) und der große Ländername im Fragepanel. Nach der Antwort zeigt das Sheet Fragenummer, Urteils-Punkt, Urteil und Erklärung. Auf dem Desktop erscheint darüber das Weiter-Overlay. Am Ende gibt es „RUNDE BEENDET“, Ergebnis, Zusammenfassung und „Neue Runde“.

Die Auflösung zeigt Textbuttons im Format „Ländername · Steckbrief“. Sie führen zum gesuchten und gegebenenfalls zum gewählten Land oder zu dessen eindeutig zuordenbarem Antwortwert. Der Atlas-Steckbrief öffnet als modales Bottom-Sheet über derselben Frage. Das Schließen-Feld, Escape und Wischen nach unten am oberen Ende des Sheets schließen es.

### Flaggen

- **Land → Flagge**. Das Antwort-Sheet ist bis 560 px breit. Vier Flaggen-Kacheln bilden ein 2×2-Raster. Die Ziffer und die reservierte Namenszeile stehen unter jedem Bild.
- **Flagge → Land**. Die gesuchte Flagge füllt im Format 4:3 die Innenbreite des Fragepanels. Darunter steht „Welches Land ist das?“. Das Antwort-Sheet ist bis 560 px breit und enthält vier Länderoptionen oder das Tippfeld.

### Handy und Querformat

- Die mobile Anordnung gilt unter 600 px Breite sowie auf flachen Touch-Viewports bis 500 px Höhe. Sie nutzt `100dvh`, `viewport-fit=cover`, alle vier Safe-Area-Inset-Werte und mindestens 44 px hohe Touch-Ziele. Menüs und der Länder-Modus scrollen innerhalb ihrer Ansicht. Im Tipp-Modus hält der `visualViewport` das Eingabefeld über der Bildschirmtastatur. Wenn der freie Bereich sehr niedrig wird, erhält das Eingabefeld vorübergehend Vorrang vor dem Fragepanel.
- Nach der Antwort bleiben die Lösung und gegebenenfalls die falsch gewählte Option stehen. Andere Optionen und Flaggen-Kacheln blenden aus und klappen ein. Das Urteil ist 28 px groß. Erklärung und Steckbrief-Links stehen zusammen und dürfen auf schmalen Geräten umbrechen. Der schwarze Weiter-Balken bildet die 56 px hohe letzte Zeile des Antwort-Sheets. Links steht „Weiter“ oder „Pausiert“, rechts „Tippen“. Bei korrekter Antwort läuft der Timer am unteren Rand. Bei Platzmangel scrollt nur der Inhalt oberhalb des Balkens.
- Bei **Flagge → Land** passt die Flagge innerhalb von 28 % der Viewporthöhe und höchstens 240 px. Nach dem Urteil zieht sie sich auf 96 px Breite zusammen und sitzt neben der Meta-Zeile. Bei **Land → Flagge** bleibt der Platz für die Namen von Anfang an reserviert. Auf kurzen Viewports stehen die vier Flaggen in einer Reihe. Kurze Querformate zeigen Textoptionen in zwei Spalten.

### Atlas

Oben stehen „ATLAS“ und „Land antippen“. Unten öffnet ein Kartenklick den Steckbrief mit dem Farbblock des Länderdesigns, Landesumriss, Hauptstadtpunkt, Flagge und Namen. Pro Zeile stehen links das Label und rechts der Wert. Zugehörige Hinweise für Hauptstadt, Kontinent, Zentralbank und Staatsform sowie der Leitindex-Status stehen beim jeweiligen Feld. Anklickbare Nachbarn öffnen ihren Steckbrief und rücken das Land ins Kartenfenster. „← Karte“ schließt den Steckbrief.

Im mobilen Layout verwenden Atlas und Quiz-Steckbrief ein randbündiges Bottom-Sheet inklusive unterem Safe-Area-Inset. Es öffnet auf halber Höhe. Über den Griff lässt es sich bis knapp unter den oberen Sichtrand ziehen. Der Griff schaltet per Tipp zwischen beiden Höhen um. Ein Abwärtswisch aus der halben Höhe schließt das Sheet. Aus der großen Höhe rastet ein kurzer Zug auf halber Höhe ein. Ein stärkerer Abwärtswisch schließt direkt. Der Inhalt scrollt vertikal mit `overscroll-behavior: contain`, während die Karte unter dem Sheet stehen bleibt.

### Ein Land komplett und Atlas-Landesdesign

- Oben ein **Farbblock** in der Hauptfarbe des Landes, Höhe `clamp(250px, 36dvh, 380px)`, unten 2 px Linie. „← Karte“ ist in der Textfarbe umrandet. Die Kopfzeile zeigt „LAND 02 / 05“ und das Menüfeld. Flagge, Label „LAND“ und Name beginnen bündig am linken Innenrand bei 16 px. Der Name startet mit 60 px und wird in Schritten von 2 px bis auf 36 px verkleinert, bevor er an Wortgrenzen umbricht (`hyphens: manual`). Die Namensmaske hält oben `.12em` und unten `.2em` für Akzente und Unterlängen frei. Negative Ränder gleichen das Padding aus. Der Umriss zeigt das Kerngebiet, zu 90 % in der Textfarbe gefüllt. Er passt sich mit 8 % Rand der verbleibenden Fläche an. Bei einem Seitenverhältnis über 1,6 oder wenn ein einzelnes Wort seitlich bei 36 px zu breit wäre, liegt der Umriss oberhalb der Länderangaben. Die Kopfzeile hat einen eigenen Bereich. Der Atlas-Steckbrief verwendet denselben Farbblock mit „ATLAS“ und eingezeichnetem Hauptstadtpunkt.
- Textfarbe im Farbblock automatisch: Weiß oder `--ink`, je nachdem, was nach WCAG den höheren Kontrast zur Landesfarbe hat.
- Darunter Spalte (max. 560 px): Fortschrittszellen, Fragenummer + Kategorie (Label-Stil), Frage, Optionen, Primärbutton.
- In Reihenfolge werden Flagge, Name der Hauptstadt, Hauptstadtpunkt, Kontinent, Währung, Zentralbank, Leitindex, Staatsform und Regierungsform nach V-Dem 2025 gefragt. Kategorien und Koordinaten ohne hinterlegten Wert werden übersprungen.
- Die Flagge fällt nach Auflösung der Flaggenfrage über dem Ländernamen ein (64 × 48 px).
- Für die Hauptstadtposition wächst der Farbblock auf etwa 60 % der sichtbaren Höhe. Die große Karte im Farbblock nimmt den Tipp entgegen und behält Punkt und Verbindung bis zum Weitergehen im Bild. Beim Wechsel schrumpft der Farbblock wieder.
- Nach jedem Land erscheint der **Steckbrief** mit Label „STECKBRIEF“ und Ergebnis in 56 px. Darunter steht eine Zeile je Frage mit Urteils-Punkt, Bezeichnung und Wert. Die Flaggenzeile zeigt eine Mini-Flagge. „Im Atlas öffnen“ führt zum Land. Der Primärbutton heißt „Nächstes Land“ oder nach dem letzten Land „Neue Runde“.

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
| Mobile Steckbrief-Rastpunkte | 300 ms | `--ease-smooth` | zur halben oder fast vollen Höhe einrasten |
| Nicht beteiligte mobile Optionen | 350 ms | `--ease-smooth` | Höhe einklappen und ausblenden |
| Mobile Frageflagge nach Auflösung | 400 ms | `--ease-smooth` | auf 96 px verkleinern und neben die Meta-Zeile bewegen |
| Timerbalken (richtig) | 5000 ms | linear | 4 px, `--ok`, am unteren Rand des Weiter-Overlays. Läuft von voll auf leer und hält bei einer Pause an. |
| Länderwechsel: Farbe | 800 ms | `--ease-inout` | neue Farbe schiebt sich von unten über die alte (`clip-path`) |
| Ländername | 800 ms, 300 ms Verzögerung | `--ease-out` | gleitet aus einer Maske nach oben |
| Landesumriss | 1800 ms, 350 ms Verzögerung | `--ease-inout` | erst als Linie gezeichnet (`stroke-dashoffset`), ab 70 % füllt er sich |
| Landeskarte im Farbblock | 600 ms | `--ease-smooth` | Farbblock auf ca. 60 % der sichtbaren Höhe vergrößern und beim Weitergehen zurücksetzen |
| Landeskarte im freien Kartenbereich | 650 ms | `--ease-smooth` | auf den eingepassten Ausschnitt vergrößern |
| Hauptstadt-Tipp | 2 × 500 ms | `--ease-out` | zwei auslaufende und verblassende Ringe, 100 ms versetzt |
| Eigenes Hauptstadt-Quadrat | 300 ms | `--ease-pop` | am Tipp auf volle Größe bringen. Bei Ankunft am Ziel wird die weiße Innenfläche transparent. |
| Linie mit Hauptstadtname | 600 ms, 300 ms Verzögerung | `--ease-inout` | Den Pfad mit `pathLength="1"` und `stroke-dasharray: 1` zeichnen. Das Namensschild folgt der Linie. Nach dem Zeichnen sowie bei Zoom, Ziehen oder Weitergehen bleibt der volle Pfad sichtbar. |
| Richtiger Hauptstadtpunkt | 300 ms und einmal 500 ms | `--ease-pop`, dann `--ease-out` | bei Ankunft erscheinen und einmal pulsieren |
| Distanzschild | 150 ms | ease | nach der Linie einblenden |
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

Die Menüblöcke sind die Kopfzeilen, Listenzeilen, Abschnittslabels und Aktionsflächen. Bei `prefers-reduced-motion: reduce` bleiben nur Ein- und Ausblendungen mit 150 ms ohne Versatz. Kartenflüge springen direkt. Länder und Marker bleiben ruhig. Beim Radar erscheinen der stehende Ring und das Namensschild direkt als Überblendung. Die Hauptstadt-Auflösung blendet Quadrat, vollständige Linie, Zielpunkt und Schilder ohne Ringe und ohne Bewegung an ihrer Endposition ein.

## 7. Spielablauf und Tastatur

- **Richtig**. Grüner Urteils-Punkt. Nach **5000 ms** (`AUTO_ADVANCE_MS`) beginnt automatisch die nächste Frage. Ein Klick oder Tipp auf den freien Kartenbereich geht sofort weiter.
- **Falsch oder übersprungen**. Roter bzw. grauer Urteils-Punkt. Die Lösung bleibt zur Erkundung auf der Karte. Weiter geht es durch eine Aktion des Spielers.
- Nach jedem Urteil führen ein Tipp auf das Antwort-Sheet oder das Weiter-Overlay sowie Leertaste oder Enter weiter.
- Während einer Kartenbewegung, bei offenem Steckbrief-Overlay oder solange die Maus über dem Antwort-Sheet steht, pausiert der Countdown einer richtigen Antwort. Das Feld zeigt „PAUSIERT“ und der Balken bleibt stehen. Danach läuft die verbleibende Zeit weiter.
- **Tastatur**. `1`–`4` wählen eine Option. `S` überspringt außerhalb von Textfeldern. Enter im Tippfeld prüft die Antwort, bei leerem Feld überspringt es. Leertaste und Enter gehen nach dem Urteil weiter oder starten eine neue Runde. Enter startet im Rundenaufbau. Escape geht im Menü eine Ebene zurück und schließt es auf der ersten Ebene.
- **Landeskarten per Tastatur**. Die Pfeiltasten bewegen den Zeiger. Umschalt + Pfeiltaste bewegt ihn in größeren Schritten. Enter oder Leertaste bestätigen den Punkt.
- Tastenfokus auf der Karte zeichnet den Länderpfad oder den Kleinstaatenmarker mit 3 px in `--ink` und nicht skalierender Strichstärke (`:focus-visible`). Bei Maus und Touch bleibt die normale Ländergrenze sichtbar. Schaltflächen und Eingaben verwenden weiterhin eine 3 px Kontur mit 2 px Abstand.

## 8. Daten für das Design

- **Hauptfarbe**. `color` in `data/sets/world/entities.csv` speichert einen von Hand editierbaren Wert im Format `#RRGGBB`. `npm run data:seed-colors` leitet Startwerte aus der größten geeigneten Fläche der lokalen 4:3-Flagge ab. Weiß und annähernd weiße Flächen werden übersprungen. Das Skript ergänzt fehlende Werte in `entities.seed.csv`. Der Daten-Build übernimmt die geprüften Farben aus `entities.csv`.
- **Hauptstadt-Hinweise und Kontinente**. Der Steckbrief zeigt den Hauptwert und gegebenenfalls zusätzliche Kontinente. Hauptstadt-Hinweise stehen im Steckbrief und nach der Auflösung von Hauptstadtfragen.
- **Flaggen**. Der Daten-Build legt die 4:3-SVGs aus `flag-icons` (MIT) anhand der ISO-Codes unter `public/data/flags/` ab. Kosovo `XKX` erhält `xk`.
- **Flagge als Kategorie**. Der Typ `flag` erzeugt vorwärts die Frage „Welche Flagge gehört zu X?“ mit vier Flaggen-Kacheln. Rückwärts zeigt das Fragepanel die Flagge oberhalb von „Welches Land ist das?“ und erlaubt Tippen oder vier Ländernamen zur Auswahl. Die optionale Spalte `flag_similar` enthält eine mit `|` getrennte Liste ähnlicher Länder-IDs. Für Ablenker haben diese IDs Vorrang, gefolgt von Nachbarländern und Ländern desselben Kontinents.
