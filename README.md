# SpaceBlox 🎮

Twaalf **echt speelbare** browsergames voor kinderen, met een profiellaag eromheen
die aan Roblox doet denken: muntjes, levels, dagelijkse beloningen, vrienden en
highscores. Alles draait in de browser — geen server, geen download, geen advertenties.

> **Live proberen:** `npm run serve` en open de getoonde URL.

---

## Inhoud

- [Wat er is veranderd](#wat-er-is-veranderd)
- [De spellen](#de-spellen)
- [Projectstructuur](#projectstructuur)
- [Lokaal draaien](#lokaal-draaien)
- [Tests](#tests)
- [Een spel toevoegen](#een-spel-toevoegen)
- [Admin-account en wachtwoord](#admin-account-en-wachtwoord)
- [Eerlijk over beveiliging](#eerlijk-over-beveiliging)

---

## Wat er is veranderd

De vorige versie van deze repo telde **3277 bestanden**, waarvan **3215 nepgame-pagina's**.
Elke `game_0.html` t/m `game_3214.html` toonde een titel en een aantal "spelers", maar
bevatte geen spel — alleen een leeg vak met de tekst *"Klik om te spelen"*. `gs.js`
(333 KB) was een lijst met 3215 verzonnen namen die allemaal naar dezelfde paar
echte pagina's linkten.

Ook stond er een admin-wachtwoord **in plaintext in de broncode** (`index.html`),
zodat iedereen met F12 admin kon worden.

Nu:

| | Voor | Na |
|---|---|---|
| Bestanden | 3277 | ~60 |
| Omvang | 14 MB | ~400 KB |
| Echte spellen | 12 (los, inconsistent) | 12 (één engine, allemaal speelbaar) |
| Nepspellen | 3215 | 0 |
| Admin-wachtwoord | plaintext in `index.html` | SHA-256 + zout in `assets/js/admin.config.js` |
| Gebruikerswachtwoorden | plaintext in localStorage | gezouten hash |
| Touch-bediening | afwezig | in elke game |
| Tests | geen | 57 + pagina-check |

---

## De spellen

| Spel | Soort | Besturing |
|---|---|---|
| 🏎️ **Kart Race** | Top-down racer, 3 ronden, 3 rivalen | pijltjes / WASD, of de knoppen op scherm |
| 🐍 **Neon Snake** | Klassieker, steeds sneller | pijltjes / WASD |
| 👾 **Space Blaster** | 5 golven aliens, eindbazen, power-ups | pijltjes + spatie (schiet automatisch) |
| 🚗 **Neon Rush** | Eindeloze snelweg ontwijken | ◀ ▶ |
| 🦖 **Dino Runner** | Springen en bukken | spatie / ▲, omlaag = bukken |
| 🏓 **Pong Duo** | Eerste tot 7, drie niveaus | muis/vinger of ▲▼ |
| 🃏 **Memory Match** | Paren zoeken, drie bordgroottes | klikken |
| 🔢 **Raad het Getal** | 1–100, zo min mogelijk gokken | typen |
| 🪙 **Munt Clicker** | Upgrades kopen, automatiseren | klikken |
| 🎲 **Orlog** | Dobbelduel met tokens | klikken |
| 🌙 **Maan Kolonie** | 30 dagen overleven op de maan | klikken |
| 🧱 **Block Run** | Platformer, 5 levels | ◀ ▶ + spatie/▲ |

Score = muntjes. Hoe beter je speelt, hoe meer 🪙 — met een plafond per beurt, zodat
één spel niet het hele saldo kan laten ontploffen.

---

## Projectstructuur

```
index.html                  homepage: gamelijst, profiel, vrienden, inloggen
dashboard.html              statistieken, records, admin-overzicht
games/<id>.html             dunne pagina per spel (alleen markup + script-tags)
assets/
  css/app.css               gedeelde look: kleuren, knoppen, formulieren
  css/home.css              homepage
  css/shell.css             de "Roblox-laag" om een spel heen
  css/dashboard.css         dashboard
  css/games/<id>.css        alleen wat dat specifieke spel extra nodig heeft
  js/store.js               opslaglaag: muntjes, scores, profiel, vrienden
  js/auth.js                accounts + gezouten SHA-256 hashing
  js/admin.config.js        ⚠️ admin salt + hash
  js/games.js               de gamebibliotheek — één item per spel
  js/shell.js               laadt een spel, regelt HUD/geluid/invoer/beloning
  js/games/<id>.js          de spelcode zelf
scripts/serve.mjs           lokale webserver (npm run serve)
scripts/check-pages.mjs     vindt kapotte links en ontbrekende modules
scripts/smoke-pages.mjs     laadt elke pagina in jsdom, let op JS-fouten
scripts/play-games.mjs      speelt de spellen echt na
scripts/hash-password.mjs   maakt een nieuwe admin-hash
tests/run.mjs               57 tests
sw.js                       service worker (offline)
manifest.json               installeren als app
```

**Eén spel toevoegen = één item in `games.js` + één module.** De homepage, de
highscores, de muntjes en de categorieën volgen automatisch.

---

## Lokaal draaien

```bash
npm run serve          # start een server op http://localhost:8080
```

Gewoon `index.html` openen werkt ook, maar dan blokkeert de browser de service
worker — de spellen zelf werken prima.

---

## Tests

```bash
npm install            # één keer, voor jsdom
npm test               # 57 tests: muntjes, scores, accounts, bibliotheek
npm run check          # tests + kapotte links en ontbrekende modules
npm run smoke          # laadt élke pagina in jsdom en let op JS-fouten
npm run play           # speelt de spellen echt: toetsen, klikken, uitspelen
npm run verify         # alles achter elkaar
```

Vier lagen, van snel naar grondig:

| | Wat het doet |
|---|---|
| `npm test` | Draait de **echte** modules tegen een namaak-`localStorage` |
| `npm run check` | 193 bestandsverwijzingen + module/pagina/css per game |
| `npm run smoke` | Elke pagina in jsdom mét scripts; vangt laadfouten |
| `npm run play` | Stuurt echte invoer en speelt een beurt uit |

De smoketest is geen rubberen stempel: met een expres ingebouwde fout in
`snake.js` meldt hij drie problemen.

### Bugs die de tests vonden (en die er echt in zaten)

1. **SHA-256 kon geen emoji's aan.** De handgeschreven UTF-8-loop behandelde
   surrogeerparen (🎮) als twee losse tekens. Belangrijk, want kinderen zetten
   emoji's in hun gebruikersnaam.
2. **Een aankoop vergiftigde de standaardwaarden.** `getProfile()` kloonde `owned`
   niet, dus `buyItem()` muteerde `DEFAULT_PROFILE`. Na één aankoop "bezat" elk
   volgend profiel dat item al en kon niemand meer iets kopen.
3. **Elke "beschikbaar"-knop stond op slot.** `ctx.el()` deed
   `setAttribute('disabled', null)`, wat de letterlijke string `"null"` oplevert —
   en dus een permanently grijze knop. Dat legde de hele winkel van Munt Clicker
   en de dobbelstenen van Orlog plat.

Alle drie hebben een regressietest.

---

## Een spel toevoegen

1. **Maak de module** `assets/js/games/mijnspel.js`:

```js
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  root.SBGames.mijnspel = function (ctx) {
    // ctx.canvas / ctx.ctx2d  — alleen bij render:'canvas' in games.js
    // ctx.stage               — het speelveld (voor DOM-spellen)
    // ctx.el(tag, attrs, kids) — elementen maken
    // ctx.hud([{icon,label,value}])  — de teller bovenin
    // ctx.sound('tap'|'eat'|'hit'|'jump'|'coin'|'win'|'lose')
    // ctx.onEnd({ score, won })      — beurt voorbij, muntjes + record
    // ctx.after(fn, ms)              — setTimeout

    function reset() { /* ... */ }
    return {
      init: reset,
      reset: reset,
      update(dt) { /* dt in seconden */ },
      onDir(d) {},            // 'up' | 'down' | 'left' | 'right'
      onKey(d, down) {},      //zelfde, maar met "nog ingedrukt?" (voor platformers)
      onAction(t) {},         // 'down' | 'up' | 'pause'
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
```

2. **Registreer het** in `assets/js/games.js`:

```js
{
  id: 'mijnspel', name: 'Mijn Spel', icon: '🎯', cat: 'actie',
  tagline: 'Korte omschrijving op de kaart',
  desc: 'Langere omschrijving op de spelpagina.',
  players: 1, touches: true,
  grad: ['#ff6a00', '#ff2d55'],
  best: 'highest',   // 'lowest' als minder beter is (Memory, Raad het Getal)
  unit: 'punten',
  render: 'canvas', width: 480, height: 480,   // weglaten voor een DOM-spel
},
```

3. **Maak de pagina** — kopieer `games/snake.html` en vervang `snake` door `mijnspel`
   (of voor een DOM-spel: kopieer `games/memory.html`).

4. **Controleer het:** `npm run check` zegt of je iets vergeten bent.

---

## Admin-account en wachtwoord

**Gebruikersnaam:** `esper`
**Wachtwoord:** `Blokjes2026!`

> ⚠️ **Verander dit.** Het staat in deze README en is dus niet geheim.

Nieuw wachtwoord instellen:

```bash
npm run hash -- "JouwNieuweWachtwoord"
```

Dat schrijft een nieuw zout en een nieuwe hash naar `assets/js/admin.config.js`.
Commit dat bestand. Het wachtwoord zelf staat nergens op schijf.

Het oude wachtwoord `/adminesper331911` uit de vorige versie werkt niet meer —
het is uit de code gehaald.

---

## Eerlijk over beveiliging

Dit is een **statische site zonder server**. Dat heeft gevolgen die je moet kennen:

- Wachtwoorden worden gezouten en met SHA-256 gehashet, dus ze staan niet als
  leesbare tekst op schijf. Maar wie de broncode leest, kan offline gaan raden.
  SHA-256 is daar snel in.
- "Inloggen" herkent je binnen **deze browser op dit apparaat**. Er is geen
  sessie die een server controleert.
- Muntjes en highscores staan in `localStorage` en zijn via de console aan te
  passen. Dat is bij een spelletje geen ramp, maar noem het geen economie.

Voor echte accounts, echte highscores tussen spelers en echte beveiliging hoort
er een backend bij met `bcrypt`/`argon2` en een sessiecookie. Wat hier staat is
bewust zo gebouwd dat die stap later kan zonder de spellen om te gooien: alle
opslag loopt via `assets/js/store.js` en alle accounts via `assets/js/auth.js`.

---

## Licentie

Vrij te gebruiken en aan te passen.
