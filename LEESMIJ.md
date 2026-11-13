# Website Ongelijk Investeren

De nieuwe site, gebouwd met [Astro](https://docs.astro.build). Alle pagina's staan in de
huisstijl; op `/dashboard/` staat het openbare dashboard.

**Er wordt nog niets gepubliceerd.** Alles staat op de lokale branch
`nieuwe-site` en is niet gecommit. De live pagina op ongelijkinvesteren.nl is
nog steeds de oude `index.html` in deze map.

## Lokaal starten en bouwen

Eenmalig (in deze map): `npm install`

- `npm run dev` – start de site op http://localhost:4321 en ververst bij elke wijziging. Stoppen met Ctrl+C.
- `npm run build` – bouwt de complete site in de map `dist/`.
- `npm run preview` – toont de gebouwde site uit `dist/` lokaal.

## Teksten aanpassen

Elke pagina is een Markdown-bestand in `src/content/paginas/`. De bestandsnaam
bepaalt het adres: `over.md` wordt `/over/`, `home.md` is de homepage.

Bovenaan elk bestand staan gegevens tussen `---`:

```yaml
---
titel: "Over"                     # tabtitel, wordt "Over · Ongelijk Investeren"
beschrijving: "Korte omschrijving" # voor zoekmachines
kop: "Over het bureau"            # grote kop op de pagina
intro: "Eén of twee zinnen."      # optioneel
tegels:                            # optioneel
  - titel: "Dashboard"
    tekst: "Korte tekst."
    link: "/dashboard/"
    linktekst: "Naar het dashboard"
knop:                              # optioneel
  tekst: "Neem contact op"
  link: "/contact/"
---

Hier de lopende tekst, in gewone Markdown.
```

Een nieuw bestand in die map wordt vanzelf een nieuwe pagina. Ontbreekt een
verplicht veld, dan meldt `npm run build` dat.

Bedrijfsgegevens, mailadres, menu, het Tally-formulier (`tallyId` en `tallyLive`)
en de werkversiebalk (`werkversie`) staan in `src/site.config.ts`.

Het formulier is op 13 november 2026 gepubliceerd (https://tally.so/r/je6gL4) en
`tallyLive` staat op `true`: de contactpagina toont het formulier. Zet je `tallyLive`
op `false`, dan staat er weer alleen het mailadres met de zes vakjes. Wijzig je het
formulier bij Tally, dan moet je het daar opnieuw publiceren; de site hoeft niet
opnieuw gebouwd. Het iframe in `src/pages/contact.astro` heeft bewust alleen
`data-tally-src` en geen `src`: met allebei pakt het script van Tally het niet op
en groeit het formulier niet mee, waardoor de verzendknop wegvalt. Controleren:
`node scripts/controle/schermen.mjs <basis-url> <uitmap> --paginas=/contact/ --vol --wacht=7000`.

De homepage heeft geen lopende tekst: alle teksten staan daar als velden bovenin
`home.md`. De andere pagina's zijn gewone Markdown; elke tussenkop (`##`) wordt
een eigen blok op de pagina. Pagina's met een eigen indeling hebben een sjabloon
in `src/pages/` (bijvoorbeeld `aanbod.astro`); een nieuw Markdown-bestand zonder
eigen sjabloon krijgt de eenvoudige indeling van `[naam].astro`.

## Vormgeving

De huisstijl is versie 4 van het huisstijl-artifact (Bricolage Grotesque, kleurstellingen Rood, Blauw en Groen).

- `public/huisstijl/tokens.css` – het enige bestand met kleuren, letters, lettergroottes, afstanden en hoekradii. De site, het dashboard en het A4-gemeenteprofiel laden alle drie dit bestand. De map `public/huisstijl/` gaat altijd als geheel mee (met `fonts/`).
- `public/huisstijl/fonts/` – Bricolage Grotesque, zelf gehost (open licentie, zie `LICENTIE-OFL.txt`).
- `src/styles/basis.css` – algemene opmaak van de site, gebaseerd op de tokens.
- `src/components/` – kop, voet, knop, tegel, het beeldmerk (`Beeldmerk.astro`), het kaartvlak (`KaartSymbolen.astro`, `Vlak.astro`) en de staven met cijfers (`Staven.astro`).
- `public/favicon.svg` – het beeldmerk.

De kleurstelling van een pagina kies je in de layout met `thema="rood"`, `"blauw"` of `"groen"`.

## Controleren (schermen, contrast, toetsenbord)

In `scripts/controle/` staan drie scripts die de gebouwde site nalopen met Google Chrome zonder venster (Node 24, geen extra pakketten). Ze hebben een adres nodig waar de gebouwde site draait, bijvoorbeeld `npm run preview`.

- `node scripts/controle/schermen.mjs http://localhost:4321 <uitmap> --breedtes=1240,1075,375` – schermafbeeldingen van elke pagina (met `--vol` de hele pagina op ware grootte) en een lijst met overlopende tekst, console-fouten, ontbrekende bestanden en verzoeken naar andere sites.
- `node scripts/controle/contrast.mjs http://localhost:4321 --breedtes=640,820,1000,1075,1240,1440` – per pagina met een vlak: het contrast van de kop, de zin eronder, de regel onderaan en het menu, gemeten tegen wat er werkelijk achter de tekst staat, en de afstand tussen het kaartlabel en de kop. Norm uit de huisstijl: koppen minstens 3:1, kleine tekst minstens 4,5:1.
- `node scripts/controle/toetsen.mjs http://localhost:4321` – loopt elke pagina met Tab door (focus zichtbaar) en test het menu op telefoonbreedte.

Draai `contrast.mjs` opnieuw als de kaart, een kop of de uitsnede van het vlak verandert. Het vlak schuift op smallere schermen naar rechts (`--schuif` in `src/components/Hero.astro`), het label wisselt onder 73,5rem van kant (`auto` in `Vlak.astro`) en staat er tussen 40 en 62rem niet, en op de lage hero's loopt het vlak onderaan uit in papier: dat is zo gekozen omdat kop en menu anders over de donkere kern vallen.

## De kaart en de cijfers van Helmond

De homepage toont de echte stapeling per buurt in Helmond. Die cijfers staan in `src/data/helmond.json`
en komen uit de werkversie van het dashboard (de map `Ongelijk Investeren Dashboard/` naast deze map, die
niet in de repository staat). Verversen na een nieuwe versie van het dashboard:

`node scripts/helmond-data.mjs`

Het script rekent met dezelfde regels als het dashboard en schrijft ook `src/data/gemeenten.json`
(de lijst voor het zoekveld). `scripts/kaart-helmond-vorm.json` bevat de vereenvoudigde buurtgrenzen uit het huisstijlblad.

## Het dashboard op /dashboard/

Het openbare Ongelijk Investeren Dashboard Nederland staat in `public/dashboard/` (een losse pagina met
`data/themascores.json` en `geo/`). Het is geen Astro-pagina en wordt niet met de hand gewijzigd: het komt uit de
map `Ongelijk Investeren Dashboard/` naast deze map. Verversen:

```
cd "../Ongelijk Investeren Dashboard"
python3 bouw/3_openbaar.py && python3 bouw/4_naar_site.py
```

en daarna de site opnieuw bouwen. Kop, afsluiter en voet van het dashboard zijn een kopie van `Kop.astro`,
`Afsluiter.astro` en `Voet.astro` (zie de LEESMIJ van het dashboard); menu, mailadres en de werkversiebalk leest het
script uit `src/site.config.ts`. Verander je die, of de kop of voet zelf, draai dan de twee scripts opnieuw.
Er mag geen `src/pages/dashboard.astro` meer komen: die zou op hetzelfde adres uitkomen. De sitemap neemt
`/dashboard/` mee via `customPages` in `astro.config.mjs`.

Het zoekveld op de homepage stuurt een bekende gemeente naar `/dashboard/#gm0794`; anders (en zonder JavaScript)
gaat het formulier naar `/dashboard/?gemeente=<invoer>` en zoekt het dashboard zelf.

## Livegang (nog niet doen)

0. `werkversie` in `src/site.config.ts` op `false` zetten en het dashboard verversen (zie hierboven), anders blijft de werkversiebalk op `/dashboard/` staan.
1. De oude `index.html` uit deze map verwijderen. `CNAME` mag blijven; er staat ook een kopie in `public/`.
2. Op GitHub: Settings > Pages > Source op **GitHub Actions** zetten.
3. Alles committen, `nieuwe-site` samenvoegen met `main` en pushen. Het bestand `.github/workflows/publiceer.yml` bouwt en publiceert de site dan automatisch.
4. Controleren dat ongelijkinvesteren.nl de nieuwe site toont en dat HTTPS aan staat.
