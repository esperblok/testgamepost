# FAKEVIRUS 🚨 (nep-virus voor in een grap)

**Dit is geen virus.** Dit is een prank-engine: een hoop niet-echte terminals, niet-echt
hackgeluid en niet-echte meldingen die op een Windows-pc lijken dat je gehackt wordt.
Er gebeurt **niets** — geen bestanden worden veranderd, versleuteld, weggehaald of
doorgestuurd. De engine leest niets van je pc en schrijft niets naar je pc.

> 🎬 Voor de testrijn van **Tremiun**: deze repo bevat een speciaal terminalvenster
> (rol `tremium`) dat de stream meemaakt. Draai `node app.js --terminals 14` en
> alle vensters openen zich zelf.

---

## Wat het doet (en wat het niet doet)

**Doet:**
- opent **14 fake terminals** (of meer, naar keuze), ieder met eigen commands en kleur
- speelt **enorm veel geluid** af: beepjes, lasertjes, sirenes, foutgebuizen,
  hartslagen, toetsen, bitcoin-geluid — allemaal zelf gesynthetiseerd
- toont een **ransom-note**-venster, een **nep-BSOD** en **scherpe rode/zwarte flashes**
- laat een **live feed** lopen in het hoofdvenster: bestanden versleutelen,
  IP-tracing, botnet-status, countdown tot "shutdown"

**Doet niet:**
- geen enkel bestand openslaan, wijzigen of verwijderen
- geen registry aanraken
- geen netwerkverbindingen maken
- geen betaling vragen of opslurpen
- géén echte malware, géén ransomware, géén rootkit

De engine werkt volledig offline en gebruikt alleen `%TEMP%` voor de geluidsbestanden
en de tijdelijke terminal-scripts.

---

## Opstarten

**Vereisten:** Windows 10/11 en [Node.js](https://nodejs.org) 18 of nieuwer.

1. Open de folder `fakevirus/`.
2. Klik twee keer op **`FAKEVIRUS.bat`**.
3. Geniet — en sluit het hoofdvenster (of druk Ctrl+C) om alles te stoppen.

Of via de commandline:

```bat
cd fakevirus
node app.js
```

### Alle opties

| Optie | Standaard | Betekenis |
| --- | --- | --- |
| `--terminals N` | `14` | Aantal fake terminals (max 64) |
| `--countdown S` | `600` | Telt af naar "SHUTDOWN IN …" (0 = uit) |
| `--sound off` | aan | Geen geluid |
| `--overlays off` | aan | Geen ransom-note, BSOD of flash |
| `--disclaimer off` | aan | Verbergt de waarschuwing in het hoofdvenster |
| `--no-scary-note` | aan | Verwijdert de "dit is een prank"-tekst uit de ransom-note |
| `--max-seconds S` | `0` | Stopt automatisch na S seconden (handig voor testen) |
| `--stop` | — | Schakelt alle geopende vensters en de geluidsdaemon uit |
| `--self-test` | — | Draait de console-test, opent géén vensters |

Voorbeelden:

```bat
node app.js --terminals 24 --countdown 180
node app.js --sound off --overlays off      :: rustig, alleen de terminals
node app.js --max-seconds 30               :: netjes stoppen na 30 seconden
node app.js --self-test                    :: alles checken zonder vensters
```

---

## Stoppen

- **Klik op het hoofdvenster en druk Ctrl+C**, of sluit het venster.
- Of dubbelklik op **`STOP_FAKEVIRUS.bat`** — dat maakt een einde aan alle
  terminals, de geluidsdaemon en de overlays.
- Of: `node app.js --stop`

Nothing was ever on your computer.

---

## De terminals

Iedere rol is een eigen venster met eigen commando's en kleur:

| Rol | Ziet eruit als |
| --- | --- |
| `scan` | een `nmap`-scan van het netwerk |
| `ssh` | brute-force van een root-account |
| `win` | `C:\>` cmd-commando's |
| `ps` | PowerShell als administrator |
| `trace` | IP-traceroute met locatie |
| `payload` | `gcc` die een "backdoor" compileert |
| `crypto` | Bitcoin-miner |
| `wifi` | WPA2-handshake / deauth |
| `sql` | sqlmap-injectie |
| `exploit` | CVE-2026 zero-day |
| `tor` | Tor / darknet |
| `keylog` | keylogger |
| `botnet` | C2-panel |
| `tremium` | de testrijn van Tremiun |

## Geluid

Alle geluiden worden **in Node zelf gesynthetiseerd** naar échte 16-bit PCM-WAV-bestanden
in `%TEMP%\fakevirus_sounds` — 29 geluiden, geen externe bestanden. Een verstopte
PowerShell-daemon speelt ze af via `System.Media.SoundPlayer`, zodat ze over elkaar heen
kunnen lopen. Geen audio-bestanden in de repo, geen afhankelijkheden.

## Overlays

- `overlays/ransom.ps1` — fake lock-screen met het betalingsdemand
- `overlays/bsod.ps1` — nep Blue Screen of Death, 2–4 seconden
- `overlays/flash.ps1` — rode/zwarte schermflash met een melding
- `overlays/sound-daemon.ps1` — de geluidsdaemon

---

## Veiligheid en ethiek

- **Richt dit alleen in op mensen die weten dat het een grap is.** Het is een prank,
  niet een manier om iemand angst aan te jagen of geld af te patsen.
- De ransom-note en het hoofdvenster vermelden expliciet dat er niets gebeurd is.
  Schakel `--no-scary-note` **in** — dat verwijdert die tekst — alleen als je
  zeker bent van je publiek.
- Gebruik `--disclaimer off` niet op een pc waar iemand anders achter zit zonder toestemming.

## structuur

```
fakevirus/
  FAKEVIRUS.bat            Invoer: dubbelklik
  STOP_FAKEVIRUS.bat       Alles uitschakelen
  app.js                   Hoofdvenster + orkestrator
  terminal.js              Één fake terminalvenster
  lib/util.js              Random data, ANSI-kleuren, formatering
  lib/ascii.js             5x7-font voor de ASCII-logo's
  lib/scenes.js            Alle rollen en feed-teksten
  lib/sound.js             WAV-synthesizer + geluidsrequests
  lib/spawn.js             Windows-vensters openen
  overlays/*.ps1           Ransom-note, BSOD, flash, geluidsdaemon
  tests/selftest.mjs       19 checks, draait op elke machine
```

## Testen

```bash
npm test          # binnen fakevirus/
node app.js --self-test
```

De test opent géén vensters, verandert géén bestand en checkt: het font, de rollen,
alle placeholders, de WAV-headèren, alle 14 terminalrollen, en of de PowerShell- en
batch-bestanden compleet zijn.

## Een rol toevoegen

Voeg een entry toe aan `ROLES` in `lib/scenes.js`:

```js
{
  id: 'myrole',
  title: 'MY-ROLE',
  window: 'MY VENSTER',
  prompt: 'user@host:~#',
  color: 'cyan',
  intro: ['[*] eerste commando'],
  lines: ['[+] binnengekomen via {{ip}}'],
  sounds: { beep: 0.3, static: 0.1 },
  progress: [['MY BALK', 42]],
}
```

De placeholders `{{ip}}`, `{{hash}}`, `{{city}}`, `{{n}}`, `{{money}}` en alle andere
variabelen staan in `lib/util.js`.

---

**FAKEVIRUS is een les in hoe makkelijk een terminal kan ogen. Niets hiervan is echt.**
