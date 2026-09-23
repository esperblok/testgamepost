/**
 * SpaceBlox — tests
 *
 * Draait de échte modules (assets/js/store.js, auth.js, games.js) tegen een
 * namaak-localStorage. Geen mocks van de logica zelf: wat hier faalt, faalt
 * ook in de browser.
 *
 *   npm test
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { suite, test, assert, eq, ok, fakeStorage, report } from './helpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// De modules zijn UMD: in de browser hangen ze aan window, in Node aan
// globalThis. Ze als side-effect importeren is dus genoeg — en het is
// precies dezelfde code die de browser draait.
await import('file://' + join(root, 'assets/js/store.js'));
await import('file://' + join(root, 'assets/js/games.js'));
await import('file://' + join(root, 'assets/js/auth.js'));

const SB = globalThis.SB;
const SBAuth = globalThis.SBAuth;
const Lib = globalThis.SBLib;

/* ═══════════════════════ muntjes ═══════════════════════ */

suite('Muntjes');

await test('begin op 0', () => {
  eq(SB.getCoins(fakeStorage()), 0);
});

await test('addCoins telt op', () => {
  const s = fakeStorage();
  eq(SB.addCoins(s, 100), 100);
  eq(SB.addCoins(s, 25), 125);
  eq(SB.getCoins(s), 125);
});

await test('addCoins weigert 0, negatief en NaN', () => {
  const s = fakeStorage();
  SB.addCoins(s, 50);
  eq(SB.addCoins(s, 0), 50, 'nul mag niets doen');
  eq(SB.addCoins(s, -999), 50, 'negatief mag het saldo niet wissen');
  eq(SB.addCoins(s, NaN), 50, 'NaN mag niets doen');
  eq(SB.getCoins(s), 50);
});

await test('spendCoins faalt bij te weinig saldo', () => {
  const s = fakeStorage();
  SB.addCoins(s, 30);
  const r = SB.spendCoins(s, 50);
  eq(r.ok, false);
  eq(r.coins, 30, 'saldo moet onveranderd blijven');
});

await test('spendCoins lukt bij voldoende saldo', () => {
  const s = fakeStorage();
  SB.addCoins(s, 100);
  const r = SB.spendCoins(s, 40);
  eq(r.ok, true);
  eq(r.coins, 60);
  eq(SB.getCoins(s), 60);
});

await test('een kapotte waarde in storage geeft 0, geen crash', () => {
  const s = fakeStorage({ 'sbx.coins': 'niet-json' });
  eq(SB.getCoins(s), 0);
});

await test('formatCoins: 999 blijft 999, 1500 wordt 1,5K', () => {
  eq(SB.formatCoins(999), '999');
  eq(SB.formatCoins(1500), '1,5K');
  eq(SB.formatCoins(25000), '25K');
});

/* ═══════════════════ dagelijkse beloning ═══════════════════ */

suite('Dagelijkse beloning');

const DAY = 86400000;
const t0 = new Date(2026, 8, 23, 12, 0, 0).getTime(); // 23 sep 2026, middag

await test('eerste claim geeft 10 muntjes, reeks 1', () => {
  const s = fakeStorage();
  const r = SB.claimDaily(s, t0);
  eq(r.claimed, true);
  eq(r.coins, 10);
  eq(r.streak, 1);
  eq(r.total, 10);
});

await test('tweede keer op dezelfde dag geeft niets', () => {
  const s = fakeStorage();
  SB.claimDaily(s, t0);
  const r = SB.claimDaily(s, t0 + 3600000);
  eq(r.claimed, false);
  eq(r.coins, 0);
  eq(SB.getCoins(s), 10, 'saldo mag niet twee keer groeien');
});

await test('drie dagen op rij laat de reeks oplopen', () => {
  const s = fakeStorage();
  eq(SB.claimDaily(s, t0).coins, 10);
  eq(SB.claimDaily(s, t0 + DAY).coins, 20);
  const third = SB.claimDaily(s, t0 + DAY * 2);
  eq(third.coins, 30);
  eq(third.streak, 3);
  eq(SB.getCoins(s), 60);
});

await test('een dag overslaan zet de reeks terug op 1', () => {
  const s = fakeStorage();
  SB.claimDaily(s, t0);
  SB.claimDaily(s, t0 + DAY);
  const after = SB.claimDaily(s, t0 + DAY * 5);
  eq(after.streak, 1, 'reeks hoort te breken');
  eq(after.coins, 10);
});

await test('de reeks stopt bij 7 en blijft op 75', () => {
  const s = fakeStorage();
  let last = 0;
  for (let i = 0; i < 10; i++) last = SB.claimDaily(s, t0 + DAY * i).coins;
  eq(last, 75);
});

/* ═══════════════════════ scores ═══════════════════════ */

suite('Scores en records');

await test('een eerste score is altijd een verbetering', () => {
  const s = fakeStorage();
  const r = SB.submitScore(s, 'snake', 12, 'Kaan');
  eq(r.improved, true);
  eq(r.best, 12);
  eq(SB.getBest(s, 'snake').value, 12);
  eq(SB.getBest(s, 'snake').name, 'Kaan');
});

await test('een lagere score vervangt het record niet', () => {
  const s = fakeStorage();
  SB.submitScore(s, 'snake', 20, 'Kaan');
  const r = SB.submitScore(s, 'snake', 5, 'Kaan');
  eq(r.improved, false);
  eq(SB.getBest(s, 'snake').value, 20);
});

await test('het scorebord sortert aflopend en houdt maximaal 8', () => {
  const s = fakeStorage();
  for (let i = 1; i <= 12; i++) SB.submitScore(s, 'pong', i, 'Speler' + i);
  const board = SB.getBoard(s, 'pong');
  eq(board.length, 8, 'meer dan 8 moet afvallen');
  eq(board[0].value, 12);
  eq(board[7].value, 5);
});

await test('een onbekende game geeft een leeg record, geen undefined', () => {
  const s = fakeStorage();
  eq(SB.getBest(s, 'bestaatniet').value, 0);
  eq(SB.getBoard(s, 'bestaatniet').length, 0);
});

await test('een oude losse "42" uit localStorage wordt netjes gelezen', () => {
  const s = fakeStorage({ 'sbx.scores.dino.best': '42' });
  eq(SB.getBest(s, 'dino').value, 42);
});

await test('munten voor een score lopen op en kennen een plafond', () => {
  eq(SB.coinsForScore(0), 0);
  eq(SB.coinsForScore(24), 0, 'onder de drempel');
  eq(SB.coinsForScore(50), 2);
  eq(SB.coinsForScore(100000), 60, 'plafond moet gelden');
});

/* ═══════════════════════ level / XP ═══════════════════════ */

suite('Level en XP');

await test('start op level 1', () => {
  const l = SB.getLevel(fakeStorage());
  eq(l.level, 1);
  eq(l.pct, 0);
});

await test('100 XP is level 2', () => {
  const s = fakeStorage();
  SB.bumpStat(s, 'xp', 100);
  eq(SB.getLevel(s).level, 2);
});

await test('bumpStat telt op en begint bij 0', () => {
  const s = fakeStorage();
  eq(SB.bumpStat(s, 'plays', 1), 1);
  eq(SB.bumpStat(s, 'plays', 1), 2);
  eq(SB.bumpStat(s, 'plays', 3), 5);
});

/* ═══════════════════════ profiel & winkel ═══════════════════════ */

suite('Profiel en winkel');

await test('profiel heeft standaardwaarden', () => {
  const p = SB.getProfile(fakeStorage());
  eq(p.name, 'Speler');
  eq(p.emoji, '🧑');
  assert(p.owned.skin.includes('groen'), 'standaardskin moet bezit zijn');
});

await test('kopen zonder muntjes mislukt en laat het saldo heel', () => {
  const s = fakeStorage();
  const r = SB.buyItem(s, { id: 'rood', type: 'skin', price: 200 });
  eq(r.ok, false);
  eq(r.reason, 'muntjes');
  eq(SB.getCoins(s), 0);
});

await test('kopen met muntjes geeft het item en trekt af', () => {
  const s = fakeStorage();
  SB.addCoins(s, 500);
  const r = SB.buyItem(s, { id: 'rood', type: 'skin', price: 200 });
  eq(r.ok, true);
  eq(SB.getCoins(s), 300);
  eq(SB.getProfile(s).skin, 'rood', 'nieuw item wordt meteen gedragen');
  assert(SB.getProfile(s).owned.skin.includes('rood'));
});

await test('hetzelfde item twee keer kopen kan niet', () => {
  const s = fakeStorage();
  SB.addCoins(s, 1000);
  SB.buyItem(s, { id: 'rood', type: 'skin', price: 100 });
  eq(SB.getCoins(s), 900);
  const again = SB.buyItem(s, { id: 'rood', type: 'skin', price: 100 });
  eq(again.ok, false);
  eq(again.reason, 'bezit');
  eq(SB.getCoins(s), 900, 'er mag niet nog eens afgeschreven worden');
});

await test('een aankoop verandert de standaardwaarden niet', () => {
  // Regressietest: getProfile() kloonde `owned` niet, dus buyItem() muteerde
  // DEFAULT_PROFILE. Elk volgend profiel "bezat" dat item dan al.
  const before = JSON.stringify(SB.DEFAULT_PROFILE);
  const s = fakeStorage();
  SB.addCoins(s, 1000);
  SB.buyItem(s, { id: 'rood', type: 'skin', price: 100 });
  eq(JSON.stringify(SB.DEFAULT_PROFILE), before,
    'DEFAULT_PROFILE mag door een aankoop niet veranderen');

  // En een tweede, los profiel moet nog gewoon kunnen kopen.
  const s2 = fakeStorage();
  SB.addCoins(s2, 1000);
  eq(SB.buyItem(s2, { id: 'rood', type: 'skin', price: 100 }).ok, true,
    'een vers profiel mag hetzelfde item wél kunnen kopen');
});

/* ═══════════════════════ vrienden ═══════════════════════ */

suite('Avatar en catalogus');

await test('de catalogus heeft skins en hoeden, allemaal met een uniek id', () => {
  const ids = SB.SHOP.map((i) => i.id);
  eq(new Set(ids).size, ids.length, 'geen dubbele item-ids');
  assert(SB.SHOP.some((i) => i.type === 'skin'), 'er moeten huidkleuren zijn');
  assert(SB.SHOP.some((i) => i.type === 'hat'), 'er moeten hoofddeksels zijn');
  SB.SHOP.forEach((i) => {
    assert(i.type === 'skin' || i.type === 'hat', i.id + ' heeft een onbekend type');
    assert(typeof i.price === 'number' && i.price >= 0, i.id + ' heeft geen eerlijke prijs');
    ok(i.name, i.id + ' heeft geen naam');
  });
});

await test('shopFor geeft alleen items van dat type', () => {
  const skins = SB.shopFor('skin');
  const hats = SB.shopFor('hat');
  assert(skins.length > 0 && hats.length > 0);
  eq(skins.length + hats.length, SB.SHOP.length);
  skins.forEach((i) => eq(i.type, 'skin'));
});

await test('een nieuw profiel bezit precies de gratis items', () => {
  const s = fakeStorage();
  eq(SB.owns(s, 'skin', 'groen'), true);
  eq(SB.owns(s, 'hat', 'geen'), true);
  eq(SB.owns(s, 'skin', 'goud'), false);
  eq(SB.owns(s, 'hat', 'kroon'), false);
});

await test('iets aandoen dat je niet bezit wordt geweigerd', () => {
  const s = fakeStorage();
  const r = SB.equipItem(s, 'hat', 'kroon');
  eq(r.ok, false);
  eq(r.reason, 'niet in bezit');
  eq(SB.getProfile(s).hat, 'geen', 'het profiel mag niet stiekem wijzigen');
});

await test('kopen en daarna aandoen werkt, en wisselen terug ook', () => {
  const s = fakeStorage();
  SB.addCoins(s, 500);
  const bought = SB.buyItem(s, SB.itemById('kroon'));
  eq(bought.ok, true);
  eq(SB.getCoins(s), 200, 'kroon kost 300');
  eq(SB.getProfile(s).hat, 'kroon', 'aankoop wordt meteen gedragen');

  eq(SB.equipItem(s, 'hat', 'geen').ok, true);
  eq(SB.getProfile(s).hat, 'geen');
  eq(SB.equipItem(s, 'hat', 'kroon').ok, true);
  eq(SB.getProfile(s).hat, 'kroon');
});

await test('een onbekend item of type kan het profiel niet in de war schoppen', () => {
  const s = fakeStorage();
  eq(SB.equipItem(s, 'hat', 'bestaatniet').ok, false);
  eq(SB.equipItem(s, 'schoenen', 'groen').ok, false);
  // een skin als hoed aandragen moet ook mislukken
  eq(SB.equipItem(s, 'hat', 'groen').ok, false);
  eq(SB.getProfile(s).hat, 'geen');
  eq(SB.getProfile(s).skin, 'groen');
});

await test('itemById vindt elk item uit de catalogus terug', () => {
  SB.SHOP.forEach((i) => eq(SB.itemById(i.id).name, i.name));
  eq(SB.itemById('nep'), null);
});

suite('Vrienden');

await test('er staat een startlijst zodat de pagina niet leeg is', () => {
  eq(SB.getFriends(fakeStorage()).length, SB.SEED_FRIENDS.length);
});

await test('een vriend toevoegen werkt', () => {
  const s = fakeStorage();
  const r = SB.addFriend(s, 'Fenne', '🦊');
  eq(r.ok, true);
  assert(r.friends.some((f) => f.name === 'Fenne'));
});

await test('dezelfde naam twee keer kan niet', () => {
  const s = fakeStorage();
  SB.addFriend(s, 'Fenne', '🦊');
  eq(SB.addFriend(s, 'fenne', '🦊').ok, false, 'hoofdletterongevoelig');
});

await test('een lege naam wordt geweigerd', () => {
  const s = fakeStorage();
  eq(SB.addFriend(s, '   ').ok, false);
});

await test('verwijderen haalt precies die vriend weg', () => {
  const s = fakeStorage();
  SB.addFriend(s, 'Fenne', '🦊');
  const left = SB.removeFriend(s, 'Fenne');
  assert(!left.some((f) => f.name === 'Fenne'));
});

/* ═══════════════════════ wissen ═══════════════════════ */

suite('Gegevens wissen');

await test('wipe haalt SpaceBlox-data weg en laat andere keys staan', () => {
  const s = fakeStorage({ 'andere-site': 'blijft', 'sbx.coins': '500' });
  SB.addCoins(s, 10);
  SB.submitScore(s, 'snake', 9, 'X');
  SB.wipe(s);
  eq(SB.getCoins(s), 0);
  eq(SB.getBest(s, 'snake').value, 0, 'score-keys moeten ook weg zijn');
  eq(s.getItem('andere-site'), 'blijft', 'andere sites mogen niet geraakt worden');
});

/* ═══════════════════════ hashing ═══════════════════════ */

suite('Wachtwoord-hashing');

await test('onze SHA-256 is identiek aan die van node:crypto', async () => {
  const samples = ['', 'a', 'abc', 'Blokjes2026!', 'x'.repeat(200), 'één twee drie 🎮'];
  for (const input of samples) {
    const mine = SBAuth.sha256(input);
    const theirs = createHash('sha256').update(input, 'utf8').digest('hex');
    eq(mine, theirs, 'sha256 van ' + JSON.stringify(input.slice(0, 20)));
  }
});

await test('hashPassword gebruikt het zout', async () => {
  const a = await SBAuth.hashPassword('wachtwoord1', 'zout-a');
  const b = await SBAuth.hashPassword('wachtwoord1', 'zout-b');
  assert(a !== b, 'zelfde wachtwoord met ander zout moet verschillen');
});

await test('hashen van emoji en accenten komt overeen met node:crypto', async () => {
  // Regressietest: een handgeschreven UTF-8-loop brak op surrogeerparen.
  const pw = '🎮Kaanéén';
  const mine = await SBAuth.hashPassword(pw, 'zout');
  const theirs = createHash('sha256').update('zout::' + pw, 'utf8').digest('hex');
  eq(mine, theirs);
});

await test('safeEqual is alleen true bij gelijke strings', () => {
  eq(SBAuth.safeEqual('abc', 'abc'), true);
  eq(SBAuth.safeEqual('abc', 'abd'), false);
  eq(SBAuth.safeEqual('abc', 'abcd'), false);
  eq(SBAuth.safeEqual(null, 'abc'), false);
});

/* ═══════════════════════ accounts ═══════════════════════ */

suite('Accounts');

globalThis.SB_ADMIN = { user: 'esper', salt: 'testzout', hash: await SBAuth.hashPassword('Test1234', 'testzout') };

await test('registreren slaat een hash op, nooit het wachtwoord', async () => {
  const s = fakeStorage();
  const r = await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim1');
  eq(r.ok, true);
  const dump = JSON.stringify(s._dump());
  assert(!dump.includes('geheim1'), 'het wachtwoord mag nergens in storage staan');
  ok(dump.includes('hash'), 'er moet wel een hash staan');
});

await test('een te kort wachtwoord wordt geweigerd', async () => {
  const s = fakeStorage();
  eq((await SBAuth.register(s, 'Kaan', 'abc', 'abc')).ok, false);
});

await test('een wachtwoord zonder cijfers wordt geweigerd', async () => {
  const s = fakeStorage();
  eq((await SBAuth.register(s, 'Kaan', 'alleenletters', 'alleenletters')).ok, false);
});

await test('twee verschillende bevestigingen worden geweigerd', async () => {
  const s = fakeStorage();
  eq((await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim2')).ok, false);
});

await test('dezelfde naam twee keer kan niet', async () => {
  const s = fakeStorage();
  await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim1');
  eq((await SBAuth.register(s, 'kaan', 'geheim1', 'geheim1')).ok, false);
});

await test('inloggen met goede gegevens lukt', async () => {
  const s = fakeStorage();
  await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim1');
  const r = await SBAuth.login(s, 'Kaan', 'geheim1');
  eq(r.ok, true);
  eq(r.name, 'Kaan');
  eq(r.admin, false);
});

await test('inloggen met een fout wachtwoord mislukt', async () => {
  const s = fakeStorage();
  await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim1');
  eq((await SBAuth.login(s, 'Kaan', 'verkeerd1')).ok, false);
});

await test('een onbekende gebruiker geeft dezelfde foutmelding als een fout wachtwoord', async () => {
  const s = fakeStorage();
  const a = await SBAuth.login(s, 'Niemand', 'wachtwoord1');
  await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim1');
  const b = await SBAuth.login(s, 'Kaan', 'verkeerd1');
  eq(a.error, b.error, 'mag niet verklappen of de naam bestaat');
});

await test('de admin-naam kan niet als gewoon account geregistreerd worden', async () => {
  const s = fakeStorage();
  eq((await SBAuth.register(s, 'esper', 'geheim1', 'geheim1')).ok, false);
});

await test('de admin logt in via de config-hash', async () => {
  const s = fakeStorage();
  const r = await SBAuth.login(s, 'esper', 'Test1234');
  eq(r.ok, true);
  eq(r.admin, true);
});

await test('de admin met een fout wachtwoord komt er niet in', async () => {
  const s = fakeStorage();
  eq((await SBAuth.login(s, 'esper', 'Test1235')).ok, false);
});

await test('wachtwoord wijzigen vereist het oude', async () => {
  const s = fakeStorage();
  await SBAuth.register(s, 'Kaan', 'geheim1', 'geheim1');
  eq((await SBAuth.changePassword(s, 'Kaan', 'fout1', 'nieuw1', 'nieuw1')).ok, false);
  eq((await SBAuth.changePassword(s, 'Kaan', 'geheim1', 'nieuw1', 'nieuw1')).ok, true);
  eq((await SBAuth.login(s, 'Kaan', 'nieuw1')).ok, true, 'het nieuwe moet werken');
  eq((await SBAuth.login(s, 'Kaan', 'geheim1')).ok, false, 'het oude niet meer');
});

await test('voor de admin verwijst wijzigen naar het configbestand', async () => {
  const s = fakeStorage();
  const r = await SBAuth.changePassword(s, 'esper', 'Test1234', 'Nieuw123', 'Nieuw123');
  eq(r.ok, false);
  eq(r.admin, true);
  ok(r.error.includes('admin.config.js'), 'moet uitleggen waar het wél kan');
});

await test('de sessie overleeft een herladen en kan uitloggen', async () => {
  const s = fakeStorage();
  SB.setSession(s, 'Kaan');
  eq(SBAuth.currentUser(s).name, 'Kaan');
  SBAuth.logout(s);
  eq(SBAuth.currentUser(s), null);
});

await test('cleanName knipt gevaarlijke tekens weg', () => {
  eq(SBAuth.cleanName('<script>Kaan</script>'), 'scriptKaan/script'.replace('/', ''),
    'script-tags moeten onschadelijk worden');
  assert(!SBAuth.cleanName('"><img>').includes('<'));
  assert(SBAuth.cleanName('x'.repeat(99)).length <= 16, 'lengte moet afgekapt worden');
});

/* ═══════════════════════ gamebibliotheek ═══════════════════════ */

suite('Gamebibliotheek');

await test('er zijn precies 12 games', () => {
  eq(Lib.GAMES.length, 12);
});

await test('elke game heeft alle velden die de shell nodig heeft', () => {
  Lib.GAMES.forEach((g) => {
    ok(g.id, 'id');
    ok(g.name, 'name van ' + g.id);
    ok(g.icon, 'icon van ' + g.id);
    ok(g.tagline, 'tagline van ' + g.id);
    ok(g.desc, 'desc van ' + g.id);
    assert(Array.isArray(g.grad) && g.grad.length === 2, 'grad van ' + g.id);
    assert(['highest', 'lowest'].includes(g.best), 'best van ' + g.id);
    ok(g.unit, 'unit van ' + g.id);
    assert(Lib.CATEGORIES.some((c) => c.id === g.cat), 'onbekende categorie bij ' + g.id);
  });
});

await test('game-ids zijn uniek', () => {
  const ids = Lib.GAMES.map((g) => g.id);
  eq(new Set(ids).size, ids.length, 'dubbele ids breken de highscores');
});

await test('canvas-games hebben een formaat', () => {
  Lib.GAMES.filter((g) => g.render === 'canvas').forEach((g) => {
    assert(g.width > 0 && g.height > 0, 'width/height van ' + g.id);
  });
});

await test('byId, byCategory en search werken', () => {
  eq(Lib.byId('snake').name, 'Neon Snake');
  eq(Lib.byId('bestaatniet'), null);
  assert(Lib.byCategory('race').every((g) => g.cat === 'race'));
  eq(Lib.byCategory('alle').length, 12);
  assert(Lib.search('snake').length >= 1);
  eq(Lib.search('onzinxyz').length, 0);
});

await test('uitgelicht is een deelverzameling van alle games', () => {
  const feat = Lib.featured();
  assert(feat.length >= 3, 'minimaal 3 uitgelichte games');
  feat.forEach((g) => assert(g.featured === true));
});


/* ═══════════════════════ Admin-console ═══════════════════════ */

suite('Admin-console (bans & toekennen)');

await test('gebande gebruiker kan niet inloggen of registreren', async () => {
  const s = fakeStorage();
  ok((await SBAuth.register(s, 'boefje', 'Wacht123', 'Wacht123')).ok);
  ok((await SBAuth.login(s, 'boefje', 'Wacht123')).ok);
  ok(SB.banUser(s, 'boefje').ok);
  eq((await SBAuth.login(s, 'boefje', 'Wacht123')).ok, false);
  eq((await SBAuth.register(s, 'boefje', 'Wacht123', 'Wacht123')).ok, false);
  SB.unbanUser(s, 'boefje');
  ok((await SBAuth.login(s, 'boefje', 'Wacht123')).ok);
});

await test('de admin kan niet geband worden', () => {
  eq(SB.banUser(fakeStorage(), 'esper').ok, false);
});

await test('grantItem geeft winkelitems gratis', () => {
  const s = fakeStorage();
  ok(SB.grantItem(s, 'pet').ok);
  ok(SB.owns(s, 'hat', 'pet'));
  eq(SB.grantItem(s, 'bestaat-niet').ok, false);
});

report();
