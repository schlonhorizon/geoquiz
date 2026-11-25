# Validierungsreport für das Weltset

`npm run data` meldet **197 Spielentitäten, 197 zugeordnete Geometrien, 0 Fehler und 0 Warnungen**. Das Set enthält alle 193 UN-Mitglieder sowie Vatikanstadt, Palästina, Kosovo und Taiwan. Die vier zusätzlichen Einträge haben `un_member=false`. Für Kosovo verwendet das Quiz `XKX` als benutzerdefinierten Alpha-3-Code. Die Quelle führt es als `UNK`. [UN-Mitgliedstaaten](https://www.un.org/en/about-us/member-states) · [UN-Beobachterstaaten](https://www.un.org/en/about-us/non-member-states)

| Feld | Befüllte Zeilen |
|---|---:|
| `id`, `name`, `continent`, `un_member` | je 197/197 |
| `name_aliases` | 190/197 |
| `capital` | 194/197 |
| `capital_aliases` | 52/197 |
| `capital_note` | 16/197 |
| `continent_alt` | 19/197 |
| `flag`, `color` | je 197/197 |
| `neighbors` | 157/197 |
| `seas`, `capital_lat`, `capital_lon`, `memberships`, `currency`, `central_bank`, `stock_index`, `regime_type` | je 0/197 |

- Ländernamen, Namensvarianten und die ursprünglichen Hauptstadtwerte stammen aus `world-countries` 5.1.0. Geläufige deutsche Schreibweisen wurden ergänzt. Die Korrekturen stehen unten. [world-countries 5.1.0](https://www.npmjs.com/package/world-countries/v/5.1.0)
- Nachbarschaften sind beidseitig bestätigte Landgrenzen aus `borders` zwischen Spielentitäten. Verweise auf Französisch-Guayana, Gibraltar, Hongkong, Macau und Westsahara entfallen. Der einseitige Eintrag von Sri Lanka zu Indien entfällt ebenfalls. `world-countries` unterscheidet Binnenstaaten, liefert aber keine Meeresnamen. Leere `seas`-Felder stehen deshalb für fehlende Meeresangaben. [Feldbeschreibung von world-countries](https://github.com/mledoze/countries)
- Natural Earth 5.1.2 liefert die Geometrien des 50m-Datensatzes `Admin 0 – Countries`. `ADM0_A3` ersetzt bei Frankreich und Norwegen den Platzhalter `ISO_A3=-99`. Die Natural-Earth-ID `KOS` ist `XKX` zugeordnet. Beim Build verschmilzt Somaliland (`SOL`) für das Quiz mit Somalia (`SOM`) und Nordzypern (`CYN`) mit Zypern (`CYP`). Klicks auf diese Flächen zählen entsprechend als Somalia oder Zypern. 42 Gebiete, darunter Westsahara und Grönland, liegen im grauen Hintergrundobjekt `land`. [Natural Earth 5.1.2](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson) · [Natural Earth Nutzungsbedingungen](https://www.naturalearthdata.com/about/terms-of-use/)
- Die Zuordnungen stehen in `map.mergeLand` in `set.json`. „Abhängige Gebiete“ könnten später als optionale Quiz-Einstellung hinzukommen.

Die aus `world-countries` abgeleiteten Länderdaten in `entities.csv` stehen unter ODbL 1.0. [Lizenz von world-countries](https://github.com/mledoze/countries/blob/master/LICENSE) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)

## Hauptstadt-Korrekturen

Stand der Korrekturen ist der 25. November 2026. In sechs zuvor offenen Fällen steht ein verifizierter Hauptwert in `capital`. Drei weitere Fälle sind im Atlas über `capital_note` erläutert.

| Land | Quizwert und Hinweis | Quelle |
|---|---|---|
| Äquatorialguinea | Ciudad de la Paz. Das Dekret vom 2. Januar 2026 löst Malabo ab. | [Regierungsdekret](https://www.guineaecuatorialpress.com/index.php/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial) |
| Eswatini | Mbabane als Verwaltungshauptstadt. Lobamba zählt als Sitz von Parlament und Monarchie ebenfalls. | [Afrikanische Union](https://au.int/en/cities/lobambaroyal-and-legislative-mbabane-administrative) |
| Indonesien | Jakarta. Der Wechsel nach Nusantara erfordert einen Präsidialerlass. | [Indonesisches Verfassungsgericht, Mai 2026](https://en.mkri.id/news/details/2026-05-12/Capital_Relocation_Depends_on_Issuance_of_Presidential_Decree) · [Stand des Verfahrens, Oktober 2026](https://en.mkri.id/news/details/2026-10-29/Court_Declares_IKN_Law_Petition_Inadmissible) |
| Jemen | Sanaa als verfassungsmäßige Hauptstadt. Aden zählt als vorläufige Hauptstadt der international anerkannten Regierung ebenfalls. | [Ständige Vertretung bei den Vereinten Nationen](https://www.un.int/yemen/about) |
| Sri Lanka | Sri Jayewardenepura Kotte als Verwaltungshauptstadt und Parlamentssitz. Das Quiz akzeptiert geläufige Schreibvarianten einschließlich Kotte. Colombo wird im Hinweis als Wirtschaftszentrum eingeordnet. | [Botschaft Sri Lankas](https://www.emb-seoul.gov.lk/en/srilanka-at-glance) · [Parlament Sri Lankas](https://www.parliament.lk/files/pdf/parliament-booklet-v2019.pdf) |
| Sudan | Khartum. Die Regierung meldete im Januar 2026 ihre Rückkehr aus Port Sudan. | [Qatar News Agency zur Regierungsankündigung](https://qna.org.qa/en/news/news-details?date=12%2F01%2F2026&id=sudans-government-officially-returns-to-khartoum-after-25-years) |
| Israel und Palästina | Der Quizwert ist leer. Die Atlas-Hinweise erläutern Jerusalem, Ost-Jerusalem und den Verwaltungssitz der Palästinensischen Autonomiebehörde in Ramallah. | [Vereinte Nationen zum Status Jerusalems](https://www.un.org/unispal/permanent-status-issues/) · [Palästinensisches Außenministerium](https://www.mfae.gov.ps/en-us/fundamentalissues/jerusalem) · [UN-Bericht zu Ramallah](https://palestine.un.org/sites/default/files/2021-11/sdg_11_report_english.pdf) |
| Nauru | Der Quizwert ist leer. Die Regierung sitzt im Distrikt Yaren. | [UNCTAD](https://dgff2021.unctad.org/nauru/index.html) |

Südafrika und Bolivien akzeptieren ihre weiteren Hauptstadt- oder Regierungsstandorte beim Tippen. Die Hinweise für die Schweiz, Benin, die Elfenbeinküste, Malaysia und die Niederlande erklären Bundesstadt, Regierungssitz oder frühere Hauptstadt. [Südafrikanische Regierung](https://www.gov.za/south-africa-glance) · [Bolivianischer Staatenbericht](https://documents.un.org/doc/undoc/gen/g07/416/23/pdf/g0741623.pdf) · [Schweizer EDA](https://www.aboutswitzerland.eda.admin.ch/de/politisches-system) · [OECD zu Benin](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/global-forum-on-transparency-and-exchange-of-information-for-tax-purposes-benin-2026-second-round-phase-1_f469dbe5/4cfacc95-en.pdf) · [France Diplomatie zur Elfenbeinküste](https://www.diplomatie.gouv.fr/fr/information-par-pays/cote-d-ivoire/presentation-de-la-cote-d-ivoire) · [Malaysisches Außenministerium](https://www.kln.gov.my/web/fin_helsinki/post/federal-territory-day-hari-wilayah-persekutuan) · [Niederländische Regierung](https://www.government.nl/site/binaries/site-content/collections/documents/2017/04/21/culture-at-a-first-glance/CIB2015_ENG_publicatie_v8_DEF.pdf)

## Flaggen-Hauptfarben

Alle 197 Werte liegen als manuell änderbares `#RRGGBB` in `entities.csv`. Der Startwert ist die häufigste sichtbare RGB-Farbe im gerasterten 4:3-SVG. Pixel ab 225 in allen drei Kanälen und Pixel unter 50 % Deckkraft werden beim Seed übersprungen. Bei gleich großen Flächen entscheidet die erste gefundene Farbe. `npm run data:seed-colors` übernimmt vorhandene Werte und schreibt Ergänzungen in `entities.seed.csv`. [flag-icons 7.6.0](https://github.com/lipis/flag-icons/tree/v7.6.0)

## Kontinentzuordnungen zur Prüfung

Das Quiz verwendet pro Entität die Region aus `world-countries`. Für Amerika unterscheidet es die Subregion Südamerika und fasst Mittelamerika und die Karibik mit Nordamerika zusammen. Daraus ergeben sich 54 Länder in Afrika, 48 in Asien, 46 in Europa, 23 in Nordamerika, 14 in Ozeanien und 12 in Südamerika. Die Hauptzuordnung steuert den Regionenfilter. Die Tabelle nennt zusätzlich akzeptierte Kontinente und dokumentiert Grenzfälle. Separat geführte Gebiete wie Grönland, britische und australische Außengebiete zählen hier nicht zum jeweiligen Quizland. Frankreichs Übersee-Départements und die karibischen Gemeinden der Niederlande zählen zur Spielgeometrie ihrer Länder. [world-countries](https://github.com/mledoze/countries) · [Übersicht zu transkontinentalen Ländern](https://worldpopulationreview.com/country-rankings/transcontinental-countries) · [Insee zu Übersee-Départements](https://www.insee.fr/en/metadonnees/definition/c2031) · [Niederländische Regierung zur Karibik](https://www.government.nl/themes/government-and-democracy/caribbean-parts-of-the-kingdom/question-and-answer/what-are-the-different-parts-of-the-kingdom-of-the-netherlands)

| Land | Hauptzuordnung | Zusätzlich richtig | Geografische Einordnung |
|---|---|---|---|
| Ägypten | Afrika | Asien | Sinai liegt in Asien. |
| Russland | Europa | Asien | Sibirien und der Ferne Osten liegen in Asien. |
| Türkei | Asien | Europa | Ostthrakien liegt in Europa. |
| Kasachstan | Asien | Europa | Das Gebiet westlich des Uralflusses wird Europa zugerechnet. |
| Aserbaidschan | Asien | Europa | Bei der Wasserscheide des Großen Kaukasus als Grenze liegen Teile nördlich davon in Europa. |
| Georgien | Asien | Europa | Bei derselben Grenzziehung liegen Teile nördlich der Wasserscheide in Europa. |
| Griechenland | Europa | Asien | Einige Inseln der östlichen Ägäis können nach ihrer Lage an der anatolischen Küste Asien zugerechnet werden. |
| Spanien | Europa | Afrika | Ceuta, Melilla und die Kanaren liegen in Afrika. |
| Portugal | Europa | Afrika | Madeira wird geografisch Afrika zugerechnet. |
| Italien | Europa | — | Lampedusa und Lampione liegen auf dem afrikanischen Kontinentalschelf. |
| Frankreich | Europa | Afrika, Nordamerika, Südamerika | Die Geometrie enthält Mayotte, Réunion, Guadeloupe, Martinique und Französisch-Guayana. |
| Dänemark | Europa | — | Grönland ist Teil des Königreichs und liegt in Nordamerika. |
| Niederlande | Europa | Nordamerika | Die Karibischen Niederlande gehören geografisch zur Karibik und im Quiz zur Region Nordamerika. |
| Vereinigtes Königreich | Europa | — | Überseegebiete liegen unter anderem in Amerika, Afrika und Ozeanien. Die souveränen Stützpunktgebiete auf Zypern können geografisch zu Asien gerechnet werden. |
| Vereinigte Staaten | Nordamerika | Ozeanien | Hawaii liegt in Ozeanien. |
| Kolumbien | Südamerika | Nordamerika | San Andrés und Providencia liegen in der Karibik vor Mittelamerika. |
| Venezuela | Südamerika | Nordamerika | Die Isla de Aves wird der nordamerikanischen Karibik zugerechnet. |
| Chile | Südamerika | Ozeanien | Rapa Nui und Sala y Gómez gehören geografisch zu Polynesien. |
| Jemen | Asien | Afrika | Sokotra liegt vor dem Horn von Afrika und kann geografisch Afrika zugerechnet werden. |
| Indonesien | Asien | Ozeanien | Westneuguinea gehört geografisch zu Ozeanien. |
| Australien | Ozeanien | — | Die Weihnachtsinsel und die Kokosinseln können geografisch Asien zugerechnet werden. |
| Japan | Asien | Ozeanien | Abgelegene pazifische Inseln wie Minamitorishima werden teils Ozeanien zugerechnet. |
| Zypern | Europa | Asien | Die Insel liegt geografisch in Westasien. Die Hauptzuordnung folgt der Paketregion. |

Weitere Grenzfälle mit je einer Zuordnung im Quiz

- **Armenien → Asien.** Es liegt südlich des Großen Kaukasus.
- **Panama → Nordamerika.** Die Staatsgrenze zu Kolumbien ist hier die Grenze zwischen den Kontinenten. **Trinidad und Tobago → Nordamerika.** Die Karibikzuordnung gilt im Quiz auch für Inseln am südamerikanischen Kontinentalschelf.
- **Ecuador → Südamerika.** Das schließt die Galápagosinseln ein. **Timor-Leste → Asien.** Das folgt der Einordnung in Südostasien. **Island → Europa.** Die Zugehörigkeit zu verschiedenen tektonischen Platten ändert hier den Quiz-Kontinent nicht.
- Antarktische Gebietsansprüche zählen für diese Liste nicht zur Kontinentzuordnung. [Antarktisvertrag](https://www.ats.aq/e/antarctictreaty.html)
