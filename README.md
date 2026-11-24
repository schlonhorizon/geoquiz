# GeoQuiz

GeoQuiz ist ein statisches Geografiequiz in Vanilla TypeScript und Vite. Das Gerüst zeigt die verfügbaren Datensätze mit ihren Ländern an. [Spezifikation](docs/SPEC.md)

## Lokal starten

Node.js 24 und npm werden auch in GitHub Actions verwendet.

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run data` validiert die Quelldaten und erzeugt `public/data/`. Sowohl der Entwicklungsserver als auch der Produktionsbuild führen diesen Schritt beim Start aus. Vite kopiert die Ausgabe nach `dist/data/`.

## Daten pflegen

Jedes Set liegt unter `data/sets/<id>/`. `entities.csv` ist die Quelle für alle Entity-Werte. Die Datei nutzt UTF-8, Semikolons als Spaltentrenner und `|` für Listen und Aliasse. Leere Attributzellen werden als `null` ausgegeben. `set.json` definiert Attribute, Fragetexte und die Verknüpfung mit `map.topojson`.

Für ein neues Attribut genügen die CSV-Spalte und der Eintrag in `set.json`. Für ein weiteres Set genügen die drei Quelldateien in einem neuen Ordner. Der Build nimmt das Set automatisch in `public/data/index.json` auf. Definition, Entities und Karte liegen danach unter `public/data/sets/<id>/`.

Das Beispielset `world` enthält zehn Länder. Nachbarschaften beziehen sich auf Länder innerhalb des Beispielsets. Meere und Mitgliedschaften sind eine Auswahl. Zentralbank, Leitindex und Regierungsform sind noch leer. Die Geometrien stammen aus dem 50m-Datensatz von Natural Earth, aufbereitet von World Atlas. Das Objekt `countries` verwendet ISO-Alpha-3-IDs. Das Objekt `land` enthält die Weltumrisse als Kartenhintergrund. [World Atlas 2.0.2](https://github.com/topojson/world-atlas/tree/v2.0.2) · [Natural Earth](https://www.naturalearthdata.com/)

## GitHub Pages

In den Repository-Einstellungen unter **Pages → Build and deployment → Source** einmalig **GitHub Actions** auswählen. Der Workflow prüft Pull Requests und veröffentlicht nach einem erfolgreichen Build von `main` das Verzeichnis `dist/`. Auf `main` lässt er sich auch manuell starten. [Pages-Workflow](.github/workflows/pages.yml)
