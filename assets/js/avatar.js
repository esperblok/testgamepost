/**
 * SpaceBlox — avatar
 *
 * Bouwt de blokjespop (net als een Roblox-figuur) en de winkel eromheen.
 * Puur DOM + CSS: er komen geen plaatjes aan te pas, dus het werkt offline
 * en ziet er op elk scherm scherp uit.
 *
 *   SBAvatar.renderFigure(host, store)
 *   SBAvatar.renderPanel({ skins, hats }, store, hooks)
 *   SBAvatar.renderShop(host, store, hooks)
 *
 * hooks: { onChange(), onError(bericht) }
 */
(function (root) {
  'use strict';

  const SB = root.SB;

  function skinColor(id) {
    const item = SB.itemById(id);
    if (!item || !item.color || item.color === 'rainbow') return '#ff5a4d';
    return item.color;
  }

  function hatEmoji(id) {
    const item = SB.itemById(id);
    return item && item.icon ? item.icon : '';
  }

  /**
   * De pop zelf. Zeven blokjes, net als bij Roblox: hoofd, romp, twee armen,
   * twee benen — plus het hoofddeksel erbovenop.
   */
  function figureHTML(profile) {
    const p = profile || {};
    const skin = p.skin || 'groen';
    const hat = p.hat || 'geen';
    return '' +
      '<div class="av-fig" data-skin="' + SB.esc(skin) + '" data-hat="' + SB.esc(hat) + '" ' +
        'style="--skin:' + skinColor(skin) + '">' +
        '<div class="av-hat">' + hatEmoji(hat) + '</div>' +
        '<div class="av-part av-head"><span class="av-face">◕‿◕</span></div>' +
        '<div class="av-part av-torso"></div>' +
        '<div class="av-part av-arm l"></div>' +
        '<div class="av-part av-arm r"></div>' +
        '<div class="av-part av-leg l"></div>' +
        '<div class="av-part av-leg r"></div>' +
      '</div>' +
      '<div class="av-shadow"></div>';
  }

  function renderFigure(host, store) {
    if (!host) return null;
    host.innerHTML = figureHTML(SB.getProfile(store));
    return host.querySelector('.av-fig');
  }

  /**
   * Koop- of aandoepoging. Geeft terug wat er gebeurde, zodat de aanroeper
   * zelf kan beslissen wat hij laat zien.
   */
  function acquire(store, item, hooks) {
    if (!item) return { ok: false, reason: 'onbekend' };
    if (SB.owns(store, item.type, item.id)) {
      const r = SB.equipItem(store, item.type, item.id);
      if (r.ok && hooks && hooks.onChange) hooks.onChange();
      return { ok: r.ok, equipped: true };
    }
    const bought = SB.buyItem(store, item);
    if (!bought.ok) {
      const msg = bought.reason === 'muntjes'
        ? 'Te weinig muntjes voor ' + item.name + '. Speel een spel of claim je dagelijkse beloning!'
        : 'Dat ging niet (' + bought.reason + ').';
      if (hooks && hooks.onError) hooks.onError(msg);
      return { ok: false, reason: bought.reason };
    }
    if (hooks && hooks.onChange) hooks.onChange();
    return { ok: true, bought: true, coins: bought.coins };
  }

  /** Kleurstaaltjes voor de huid. */
  function renderSkins(host, store, hooks) {
    if (!host) return;
    const p = SB.getProfile(store);
    host.innerHTML = '';
    SB.shopFor('skin').forEach((item) => {
      const has = SB.owns(store, 'skin', item.id);
      const b = document.createElement('button');
      b.className = 'av-swatch' + (p.skin === item.id ? ' on' : '') + (has ? '' : ' locked');
      b.dataset.skin = item.id;
      b.title = has ? item.name : item.name + ' — ' + item.price + ' 🪙';
      b.setAttribute('aria-label', b.title);
      if (item.color !== 'rainbow') b.style.background = item.color;
      b.innerHTML = (has ? '' : '<span class="lock">🔒</span>');
      b.onclick = () => {
        acquire(store, item, hooks);
        renderSkins(host, store, hooks);
        if (root.SBJuice) root.SBJuice.bounce(b);
      };
      host.appendChild(b);
    });
  }

  /** Tegeltjes voor de hoofddeksels. */
  function renderHats(host, store, hooks) {
    if (!host) return;
    const p = SB.getProfile(store);
    host.innerHTML = '';
    SB.shopFor('hat').forEach((item) => {
      const has = SB.owns(store, 'hat', item.id);
      const b = document.createElement('button');
      b.className = 'av-tile' + (p.hat === item.id ? ' on' : '') + (has ? '' : ' locked');
      b.dataset.hat = item.id;
      b.innerHTML =
        (has ? '' : '<span class="lock">🔒</span>') +
        '<span class="big">' + (item.icon || '🚫') + '</span>' +
        '<span class="nm">' + SB.esc(item.name) + '</span>' +
        (has || item.price === 0 ? '' : '<span class="pr">' + item.price + ' 🪙</span>');
      b.onclick = () => {
        acquire(store, item, hooks);
        renderHats(host, store, hooks);
        if (root.SBJuice) root.SBJuice.bounce(b);
      };
      host.appendChild(b);
    });
  }

  /**
   * De hele winkel: elke skin en elk hoofddeksel onder elkaar, met prijs,
   * bezit en een knop die meebeweegt met wat je al hebt.
   */
  function renderShop(host, store, hooks) {
    if (!host) return;
    const p = SB.getProfile(store);
    const coins = SB.getCoins(store);
    host.innerHTML = '';

    SB.SHOP.forEach((item) => {
      const has = SB.owns(store, item.type, item.id);
      const worn = p[item.type] === item.id;

      const card = document.createElement('div');
      card.className = 'shop-item' + (has ? ' owned' : '') + (worn ? ' equipped' : '');
      card.dataset.item = item.id;

      const thumb = document.createElement('div');
      thumb.className = 'shop-thumb';
      if (item.type === 'skin') {
        const chip = document.createElement('div');
        chip.style.cssText = 'width:56px;height:56px;border-radius:12px;position:relative;z-index:2;' +
          'box-shadow:inset 0 -8px 0 rgba(0,0,0,0.22),inset 0 4px 0 rgba(255,255,255,0.18);';
        if (item.color === 'rainbow') {
          chip.style.background = 'linear-gradient(120deg,#ff5a4d,#ffd83d,#3ecf6a,#2f9bff,#8b5cff)';
        } else {
          chip.style.background = item.color;
        }
        thumb.appendChild(chip);
      } else {
        const e = document.createElement('span');
        e.style.cssText = 'position:relative;z-index:2';
        e.textContent = item.icon || '🚫';
        thumb.appendChild(e);
      }

      const body = document.createElement('div');
      body.className = 'shop-body';
      body.innerHTML =
        '<div class="shop-type">' + (item.type === 'skin' ? 'Huidkleur' : 'Hoofddeksel') + '</div>' +
        '<div class="shop-name">' + SB.esc(item.name) + '</div>';

      const foot = document.createElement('div');
      foot.className = 'shop-foot';

      if (!has) {
        const price = document.createElement('span');
        price.className = 'shop-price';
        price.textContent = '🪙 ' + item.price;
        foot.appendChild(price);
      }

      const btn = document.createElement('button');
      btn.className = 'sb-btn ' + (has ? (worn ? 'sb-btn-ghost' : 'sb-btn-primary') : (coins >= item.price ? 'sb-btn-primary' : 'sb-btn-ghost'));
      btn.textContent = has ? (worn ? '✔ Aan' : 'Aandoen') : (coins >= item.price ? 'Kopen' : 'Te duur');
      btn.disabled = !has && coins < item.price;
      btn.onclick = () => {
        const r = acquire(store, item, hooks);
        if (r.ok) {
          if (root.SBJuice) root.SBJuice.ripple(card);
          renderShop(host, store, hooks);
          if (r.bought && root.SBJuice) {
            root.SBJuice.confetti({ count: 70, life: 1.6 });
            if (hooks && hooks.onBuy) hooks.onBuy(item, r);
          }
        }
      };
      foot.appendChild(btn);

      body.appendChild(foot);
      card.appendChild(thumb);
      card.appendChild(body);
      host.appendChild(card);
    });
  }

  const api = {
    figureHTML: figureHTML,
    renderFigure: renderFigure,
    renderSkins: renderSkins,
    renderHats: renderHats,
    renderShop: renderShop,
    acquire: acquire,
    skinColor: skinColor,
    hatEmoji: hatEmoji,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBAvatar = api;
})(typeof self !== 'undefined' ? self : globalThis);
