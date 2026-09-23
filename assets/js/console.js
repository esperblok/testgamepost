/**
 * SpaceBlox — admin-console
 *
 * Een 🖥️-knop die ALLÉÉN zichtbaar is voor de beheerder. Typ commando's:
 *   /help            alle commando's
 *   /give coins 100  muntjes geven
 *   /give <item-id>  skin/hoed gratis toekennen (ids zie winkel)
 *   /ban <naam>      gebruiker bannen
 *   /unban <naam>    ban opheffen
 *   /live            live statistieken
 *   /shader          extra glow/shader-aanzicht aan/uit
 *   /styl <naam>     stijl wisselen: roblox | neon | licht
 */
(function (root) {
  'use strict';

  const SB = root.SB;
  const store = root.localStorage;
  if (!SB || !SB.isAdmin(store)) return; // alleen de admin ziet iets

  const start = function () {
    const style = document.createElement('style');
    style.textContent =
      '.sbc-btn{position:fixed;right:14px;bottom:14px;z-index:998;width:46px;height:46px;border-radius:10px;border:1px solid #565b62;background:#0a0b0c;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.5)}' +
      '.sbc-panel{position:fixed;right:14px;bottom:70px;z-index:998;width:min(430px,94vw);height:320px;display:none;flex-direction:column;background:rgba(10,12,13,.97);border:1px solid #6b7076;border-radius:8px;box-shadow:0 0 0 4px rgba(0,0,0,.35);font-family:ui-monospace,monospace}' +
      '.sbc-panel.open{display:flex}' +
      '.sbc-head{padding:8px 12px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c9a253;border-bottom:1px solid #33373b}' +
      '.sbc-log{flex:1;overflow-y:auto;padding:8px 12px;font-size:12px;color:#cfd3d6;white-space:pre-wrap}' +
      '.sbc-log .err{color:#ff5d5d}.sbc-log .ok{color:#7dffc4}' +
      '.sbc-form{display:flex;border-top:1px solid #33373b}' +
      '.sbc-form input{flex:1;background:#0a0b0c;border:0;color:#7dffc4;padding:10px 12px;font:inherit;outline:none}' +
      '.sbc-form button{background:#c9a253;border:0;color:#0a0b0c;font-weight:800;padding:0 14px;cursor:pointer}';
    document.head.appendChild(style);

    // eerder bewaarde shader/stijl meteen toepassen
    const set = SB.getSettings(store);
    if (set.shader) document.body.classList.add('sb-shader');
    if (set.theme && set.theme !== 'roblox') document.body.classList.add('sb-theme-' + set.theme);

    const btn = document.createElement('button');
    btn.className = 'sbc-btn';
    btn.textContent = '🖥️';
    btn.title = 'Admin-console';
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'sbc-panel';
    panel.innerHTML =
      '<div class="sbc-head">🖥️ Admin-console — typ /help</div>' +
      '<div class="sbc-log"></div>' +
      '<form class="sbc-form"><input autocomplete="off" spellcheck="false" placeholder="/give coins 100"><button>➤</button></form>';
    document.body.appendChild(panel);

    const logEl = panel.querySelector('.sbc-log');
    const log = (t, cls) => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = t;
      logEl.appendChild(d);
      logEl.scrollTop = logEl.scrollHeight;
    };

    btn.addEventListener('click', () => panel.classList.toggle('open'));

    function run(line) {
      const parts = String(line || '').trim().split(/\s+/);
      const cmd = (parts[0] || '').toLowerCase();
      log('> ' + line);

      if (cmd === '/help') {
        log('/give coins <n> · /give <item-id> · /ban <naam> · /unban <naam> · /live · /shader · /styl roblox|neon|licht', 'ok');
        return;
      }

      if (cmd === '/give') {
        if (parts[1] === 'coins') {
          const n = Math.max(0, parseInt(parts[2], 10) || 0);
          SB.addCoins(store, n);
          log('✅ +' + n + ' muntjes (totaal ' + SB.getCoins(store) + ')', 'ok');
        } else {
          const r = SB.grantItem(store, parts[1] || '');
          log(r.ok ? '✅ ' + r.item.name + ' toegekend en te dragen in de winkel' : '❌ onbekend item-id', r.ok ? 'ok' : 'err');
        }
        return;
      }

      if (cmd === '/ban' || cmd === '/unban') {
        const name = parts.slice(1).join(' ');
        if (!name) return log('❌ geef een naam', 'err');
        const r = cmd === '/ban' ? SB.banUser(store, name) : SB.unbanUser(store, name);
        if (!r.ok) return log('❌ dat kan niet (' + r.reason + ')', 'err');
        log('✅ ' + name + ' is ' + (cmd === '/ban' ? 'geband' : 'vrij'), 'ok');
        return;
      }

      if (cmd === '/live') {
        const st = SB.getStats(store);
        log('📡 accounts: ' + Object.keys(SB.readUsers(store)).length +
            ' · plays: ' + (st.plays || 0) + ' · xp: ' + (st.xp || 0) +
            ' · bans: ' + SB.getBans(store).join(', ' || 'geen'), 'ok');
        return;
      }

      if (cmd === '/shader') {
        const on = !SB.getSettings(store).shader;
        SB.saveSettings(store, { shader: on });
        document.body.classList.toggle('sb-shader', on);
        log('✅ shader ' + (on ? 'AAN' : 'UIT'), 'ok');
        return;
      }

      if (cmd === '/styl' || cmd === '/style') {
        const t = (parts[1] || 'roblox').toLowerCase();
        if (['roblox', 'neon', 'licht'].indexOf(t) === -1) return log('❌ kies roblox | neon | licht', 'err');
        SB.saveSettings(store, { theme: t });
        document.body.classList.remove('sb-theme-neon', 'sb-theme-licht');
        if (t !== 'roblox') document.body.classList.add('sb-theme-' + t);
        log('✅ stijl: ' + t, 'ok');
        return;
      }

      log('❌ onbekend commando — typ /help', 'err');
    }

    panel.querySelector('.sbc-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = panel.querySelector('input');
      run(inp.value);
      inp.value = '';
    });

    log('🖥️ console klaar — typ /help', 'ok');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof self !== 'undefined' ? self : globalThis);
