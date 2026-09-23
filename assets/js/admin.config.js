/**
 * SpaceBlox — admin-config
 *
 * Hier staat GEEN wachtwoord, alleen een zout + SHA-256-hash. Zo staat je
 * wachtwoord niet als leesbare tekst in de broncode.
 *
 * ⚠️ Eerlijk zijn: dit is een statische site zonder server. Wie de hash heeft
 * kan offline gaan raden. Voor een echte inlog hoort een backend met bcrypt of
 * argon2. Dit bestand maakt het in elk geval niet méér lekbaar dan nodig.
 *
 * ── Wachtwoord wijzigen ──────────────────────────────────────
 * 1. Kies een nieuw wachtwoord (letters + cijfers, min. 6 tekens).
 * 2. Draai in de repo:  npm run hash -- "JouwNieuweWachtwoord"
 * 3. Plak de salt en hash hieronder.
 * 4. Commit alleen dit bestand.
 *
 * ── Admin-gebruikersnaam ─────────────────────────────────────
 * Die mag wel gewoon hier staan; een gebruikersnaam is geen geheim.
 */
(function (root) {
  'use strict';
  root.SB_ADMIN = {
    user: 'esper',
    salt: 'b3a78bd5432ddf89234c1e1431d55a06',
    hash: '739ab06b2d49b101f9365350fb4a806776daa8bfffb5194ccf0f061b68fff9f8',
  };
})(typeof self !== 'undefined' ? self : globalThis);
