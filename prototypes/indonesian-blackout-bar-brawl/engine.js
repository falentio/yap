/* ============================================================================
 * MATI LAMPU — Blackout Bar Brawl
 * Pure, deterministic, DOM-free game engine.
 * Works in Node (module.exports) and in the browser (window.BlackoutBrawl).
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BlackoutBrawl = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';

  /* ---------------------------------------------------------------- board -- */
  /* . floor   # meja/table (blocks)   B bar counter (blocks)   T toilet (blocks)
   * $ kasir/cash register (walkable, searchable)   G genset room (walkable)
   * P pintu/exit (walkable) */
  var MAP = [
    'P.......P',
    '.........',
    '..#...#..',
    '...BBB...',
    '...B.B...',
    '...BBB...',
    '..#...#..',
    '.........',
    'T..$G..$T',
  ];
  var W = MAP[0].length;
  var H = MAP.length;
  var BLOCK = { '#': 1, B: 1, T: 1 };
  var FIXTURE = { '#': 1, B: 1 };
  var SPAWNS = [[0, 0], [8, 0], [0, 7], [8, 7], [1, 8], [7, 8]];
  var LIGHT_R = { dark: 2, dim: 3, lit: 4 };
  var LIGHT_LABEL = { dark: 'GELAP TOTAL', dim: 'REDUP', lit: 'TERANG' };

  function inBounds(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  (function validateBoard() {
    for (var i = 0; i < MAP.length; i++) if (MAP[i].length !== W) throw new Error('peta tidak persegi di baris ' + i);
    for (var j = 0; j < SPAWNS.length; j++) {
      var sx = SPAWNS[j][0], sy = SPAWNS[j][1];
      if (!inBounds(sx, sy) || BLOCK[MAP[sy][sx]]) throw new Error('titik spawn ' + sx + ',' + sy + ' tidak bisa dilewati');
    }
    if (!inBounds(4, 7)) throw new Error('posisi awal Pak Satpam di luar peta');
  })();
  function isBlocked(x, y) { return !inBounds(x, y) || !!BLOCK[MAP[y][x]]; }
  function walkable(x, y) { return inBounds(x, y) && !BLOCK[MAP[y][x]]; }
  function key(x, y) { return x + ',' + y; }
  function parseKey(k) { var a = k.split(','); return { x: +a[0], y: +a[1] }; }
  function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* ------------------------------------------------------------------ rng -- */
  function nextRand(s) {
    s.rngSeed = (s.rngSeed + 0x6d2b79f5) | 0;
    var t = s.rngSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randInt(s, n) { return Math.floor(nextRand(s) * n); }
  function d6(s) { return 1 + randInt(s, 6); }
  function pickFrom(s, arr) { return arr[randInt(s, arr.length)]; }
  function shuffle(s, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(s, i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------------------------------------------------------------- items -- */
  var ITEMS = {
    kursi:    { name: 'Kursi Plastik',   kind: 'weapon', dmg: 2, ap: 2, breakOn: 5, flavor: 'Senjata nasional. Ringan, mematikan, tidak tahan lama.' },
    botol:    { name: 'Botol Bir',       kind: 'weapon', dmg: 1, ap: 2, breakOn: 4, becomes: 'pecahan', flavor: 'Sekali hantam, langsung jadi senjata baru.' },
    pecahan:  { name: 'Pecahan Botol',   kind: 'weapon', dmg: 2, ap: 2, breakOn: 7, flavor: 'Tajam. Pegang yang benar.' },
    sapu:     { name: 'Sapu Lidi',       kind: 'weapon', dmg: 1, ap: 2, breakOn: 7, reach: 2, flavor: 'Jangkauan panjang, damage kecil.' },
    golok:    { name: 'Golok',           kind: 'weapon', dmg: 3, ap: 2, breakOn: 7, flavor: 'Berat, meyakinkan, ilegal.' },
    keris:    { name: 'Keris',           kind: 'weapon', dmg: 4, ap: 2, breakOn: 2, flavor: 'Sekali tikam, habis.' },
    magiccom: { name: 'Magic Com',       kind: 'throw',  dmg: 2, ap: 2, breakOn: 3, flavor: 'Berasnya masih ada. Lempar.' },
    batu:     { name: 'Batu Koral',      kind: 'throw',  dmg: 1, ap: 2, breakOn: 7, flavor: 'Dari pot di depan bar.' },
    senter:   { name: 'Senter',          kind: 'light',  ap: 1, flavor: 'Nyalain: lihat jauh, tapi kamu jadi lampu.' },
    helm:     { name: 'Helm Ojol',       kind: 'armor',  def: 1, flavor: '+1 pertahanan. Jangan dilepas.' },
    kopi:     { name: 'Kopi Tubruk',     kind: 'heal',   hp: 1, ap: 1, flavor: 'Pulih 1. Nikmat.' },
    indomie:  { name: 'Indomie Goreng',  kind: 'heal',   hp: 2, ap: 2, flavor: 'Pulih 2, tapi butuh waktu.' },
    kretek:   { name: 'Rokok Kretek',    kind: 'buff',   ap: 1, flavor: 'Berani: serangan berikutnya +2.' },
    peluit:   { name: 'Peluit Parkir',   kind: 'tool',   ap: 1, flavor: 'Bikin suara di mana saja. Alihkan Pak Satpam.' },
    powerbank:{ name: 'Powerbank',       kind: 'tool',   ap: 1, flavor: 'Kendalikan lampu dari jauh.' },
    duit:     { name: 'Duit',            kind: 'loot',   coins: 2, flavor: 'Uang receh dari lantai.' },
  };

  var SEARCH_DECK = [
    'kursi', 'kursi', 'kursi', 'botol', 'botol', 'botol', 'botol', 'pecahan',
    'sapu', 'sapu', 'golok', 'keris', 'magiccom', 'magiccom', 'batu', 'batu',
    'senter', 'helm', 'kopi', 'kopi', 'indomie', 'kretek', 'duit', 'duit', 'duit',
  ];

  var ARCH = {
    preman:    { name: 'Preman',        hp: 6, ap: 3, atk: 1, loot: 2, start: ['golok'],              blurb: '+1 serangan. Wajahnya sudah dihafal Pak Satpam.' },
    parkir:    { name: 'Tukang Parkir', hp: 6, ap: 3, atk: 0, loot: 2, start: ['peluit', 'batu'],     blurb: 'Punya peluit: bisa bikin suara di sembarang tempat.' },
    ojol:      { name: 'Driver Ojol',   hp: 5, ap: 4, atk: 0, loot: 2, start: ['helm', 'batu'],        blurb: '4 AP per giliran. Cepat, tapi tipis.' },
    mahasiswa: { name: 'Mahasiswa',     hp: 5, ap: 3, atk: 0, loot: 3, start: ['powerbank', 'senter', 'batu'], blurb: 'Punya powerbank: kendalikan lampu dari jauh. Lari paling lincah.' },
    warung:    { name: 'Ibu Warung',    hp: 6, ap: 3, atk: 0, loot: 2, start: ['kopi', 'sapu'],        blurb: 'Kenal isi bar. Cari barang dapat dua.' },
    bule:      { name: 'Bule',          hp: 4, ap: 3, atk: 1, loot: 5, start: ['senter'],              blurb: 'Bawa duit paling banyak, tapi kaca. Semua mata ke kamu.' },
  };

  /* --------------------------------------------------------------- helpers -- */
  function logMsg(s, text, kind) {
    s.log.push({ round: s.round, text: text, kind: kind || 'info' });
    if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
  }
  function aliveList(s) {
    return s.order.map(function (id) { return s.players[id]; }).filter(function (p) { return p.hp > 0; });
  }
  function playerAt(s, x, y) {
    for (var i = 0; i < s.order.length; i++) {
      var p = s.players[s.order[i]];
      if (p.hp > 0 && p.pos && p.pos.x === x && p.pos.y === y) return p;
    }
    return null;
  }
  function groundPeek(s, x, y) { return s.ground[key(x, y)] || null; }
  function groundAt(s, x, y) {
    var k = key(x, y);
    if (!s.ground[k]) s.ground[k] = { coins: 0, items: [] };
    return s.ground[k];
  }
  function armorDef(p) {
    var d = 0;
    for (var i = 0; i < p.inventory.length; i++) if (ITEMS[p.inventory[i]].kind === 'armor') d += ITEMS[p.inventory[i]].def || 0;
    return d;
  }
  function hasKind(p, kind) {
    for (var i = 0; i < p.inventory.length; i++) if (ITEMS[p.inventory[i]].kind === kind) return p.inventory[i];
    return null;
  }
  function bestWeapon(p) {
    var best = null, bestDmg = -1;
    for (var i = 0; i < p.inventory.length; i++) {
      var it = ITEMS[p.inventory[i]];
      if (it.kind === 'weapon' && it.dmg > bestDmg) { best = p.inventory[i]; bestDmg = it.dmg; }
    }
    return best;
  }
  function reachOf(p, weaponId) {
    if (!weaponId) return 1;
    return ITEMS[weaponId].reach || 1;
  }
  function addItem(p, id) { p.inventory.push(id); }
  function removeItem(p, id) {
    var i = p.inventory.indexOf(id);
    if (i >= 0) { p.inventory.splice(i, 1); return true; }
    return false;
  }
  function hasCover(s, pos) {
    for (var i = 0; i < 4; i++) {
      var x = pos.x + DIRS[i][0], y = pos.y + DIRS[i][1];
      if (inBounds(x, y) && FIXTURE[MAP[y][x]]) return true;
    }
    return false;
  }
  function neighbors(pos) {
    var out = [];
    for (var i = 0; i < 4; i++) {
      var x = pos.x + DIRS[i][0], y = pos.y + DIRS[i][1];
      if (walkable(x, y)) out.push({ x: x, y: y });
    }
    return out;
  }
  function losClear(a, b) {
    var x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy, x = x0, y = y0, guard = 0;
    while (guard++ < 200) {
      if (x === x1 && y === y1) return true;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (!inBounds(x, y)) return false;
      if (!(x === x1 && y === y1) && BLOCK[MAP[y][x]]) return false;
    }
    return false;
  }
  function visionRadius(s, p) {
    var r = LIGHT_R[s.lightsOverride || s.lights];
    if (p.usedFlash) r = Math.max(r, 3);
    return r;
  }
  function visibleSet(s, p) {
    var set = {};
    var r = visionRadius(s, p);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (Math.max(Math.abs(x - p.pos.x), Math.abs(y - p.pos.y)) > r) continue;
      if (cheb({ x: x, y: y }, p.pos) > 1 && !losClear(p.pos, { x: x, y: y })) continue;
      set[key(x, y)] = true;
    }
    var i, a;
    for (i = 0; i < s.order.length; i++) {
      a = s.players[s.order[i]];
      if (a.hp > 0 && a.usedFlash) set[key(a.pos.x, a.pos.y)] = true;   // a torch is a beacon
    }
    if (s.kedip) {                                                    // lights flickered on
      for (i = 0; i < s.order.length; i++) { a = s.players[s.order[i]]; if (a.hp > 0) set[key(a.pos.x, a.pos.y)] = true; }
    }
    var sp = s.satpam;                                                // Pak Satpam's torch
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (Math.max(Math.abs(x - sp.x), Math.abs(y - sp.y)) > 3) continue;
      if (cheb({ x: x, y: y }, sp) > 1 && !losClear(sp, { x: x, y: y })) continue;
      set[key(x, y)] = true;
    }
    return set;
  }

  /* ----------------------------------------------------------------- init -- */
  function newGame(opts) {
    opts = opts || {};
    var roster = opts.players && opts.players.length ? opts.players : [
      { name: 'Budi', arch: 'preman' },
      { name: 'Sari', arch: 'warung' },
      { name: 'Dedi', arch: 'ojol' },
      { name: 'Maya', arch: 'mahasiswa' },
    ];
    if (roster.length < 2) throw new Error('butuh minimal 2 pemain');
    if (roster.length > 6) throw new Error('maksimal 6 pemain');

    var s = {
      version: VERSION,
      rngSeed: (opts.seed == null ? 1 : opts.seed) | 0,
      round: 1,
      roundLimit: opts.roundLimit || 12,
      turnIndex: 0,
      turn: null,
      order: [],
      players: {},
      ground: {},
      noise: [],
      satpam: { x: 4, y: 7, alert: 0, caught: 0 },
      lights: 'dim',
      lightsOverride: null,
      kedip: false,
      log: [],
      over: false,
      winner: null,
      results: null,
      lastEvents: [],
    };

    var spawns = shuffle(s, SPAWNS).slice(0, roster.length);
    for (var i = 0; i < roster.length; i++) {
      var r = roster[i];
      var a = ARCH[r.arch] || ARCH.preman;
      var id = 'p' + (i + 1);
      s.players[id] = {
        id: id,
        name: r.name || ('Pemain ' + (i + 1)),
        arch: r.arch,
        archName: a.name,
        maxHp: a.hp, hp: a.hp,
        maxAp: a.ap, ap: a.ap,
        atk: a.atk,
        loot: a.loot,
        kos: 0,
        pos: { x: spawns[i][0], y: spawns[i][1] },
        inventory: a.start.slice(),
        hiding: false,
        usedFlash: false,
        courage: 0,
        skipTurn: false,
      };
      s.order.push(id);
    }
    s.turnIndex = 0;
    s.turn = s.order[0];
    rollLights(s, true);
    logMsg(s, 'Lampu mati. Genset belum nyala. ' + s.roundLimit + ' ronde sampai lampu kembali.', 'round');
    for (var j = 0; j < s.order.length; j++) {
      var p = s.players[s.order[j]];
      logMsg(s, p.name + ' (' + p.archName + ') mulai di ' + p.pos.x + ',' + p.pos.y + '.', 'info');
    }
    s.players[s.turn].ap = s.players[s.turn].maxAp;
    return s;
  }

  function rollLights(s, first) {
    var r = randInt(s, 6);
    s.lights = r <= 2 ? 'dark' : r <= 4 ? 'dim' : 'lit';
    s.kedip = r === 6;
    if (!first) logMsg(s, 'Lampu: ' + LIGHT_LABEL[s.lights] + (s.kedip ? ' — kedip! semua kelihatan sesaat.' : ''), 'light');
  }

  /* --------------------------------------------------------------- actions -- */
  function current(s) { return s.players[s.turn]; }

  function costOf(s, p, act) {
    switch (act.type) {
      case 'move': return 1;
      case 'search': return 1;
      case 'hide': return 1;
      case 'flash': return ITEMS.senter.ap;
      case 'genset': return 1;
      case 'tool': return ITEMS[act.item] ? (ITEMS[act.item].ap || 1) : 1;
      case 'use': return ITEMS[act.item] ? (ITEMS[act.item].ap || 1) : 1;
      case 'attack': return ITEMS[act.weapon] ? (ITEMS[act.weapon].ap || 2) : 2;
      case 'throw': return ITEMS[act.item] ? (ITEMS[act.item].ap || 2) : 2;
      case 'end': return 0;
      default: return 0;
    }
  }

  function canSearch(s, p) {
    if (MAP[p.pos.y][p.pos.x] === '$') return true;
    var n = neighbors(p.pos);
    for (var i = 0; i < n.length; i++) if (FIXTURE[MAP[n[i].y][n[i].x]]) return true;
    return false;
  }

  function applyAction(s, act) {
    if (s.over) return { ok: false, error: 'game over' };
    if (!act || !act.type) return { ok: false, error: 'aksi kosong' };
    var p = act.player ? s.players[act.player] : current(s);
    if (!p) return { ok: false, error: 'pemain tidak dikenal' };
    if (p.id !== s.turn) return { ok: false, error: 'bukan giliran ' + p.name };
    if (p.hp <= 0) return { ok: false, error: 'sudah tumbang' };

    var cost = costOf(s, p, act);
    if (cost > p.ap) return { ok: false, error: 'AP tidak cukup (' + p.ap + '/' + cost + ')' };

    var res;
    switch (act.type) {
      case 'move':      res = doMove(s, p, act); break;
      case 'search':    res = doSearch(s, p, act); break;
      case 'attack':    res = doAttack(s, p, act); break;
      case 'throw':     res = doThrow(s, p, act); break;
      case 'use':       res = doUse(s, p, act); break;
      case 'flash':     res = doFlash(s, p, act); break;
      case 'genset':    res = doGenset(s, p, act); break;
      case 'tool':      res = doTool(s, p, act); break;
      case 'hide':      res = doHide(s, p, act); break;
      case 'end':       res = { ok: true, events: [] }; break;
      default: return { ok: false, error: 'aksi tidak dikenal: ' + act.type };
    }
    if (!res.ok) return res;

    p.ap -= cost;
    s.lastEvents = res.events || [];

    if (p.ap <= 0 && act.type !== 'end') {
      endTurn(s);
    } else if (act.type === 'end') {
      endTurn(s);
    }
    if (!s.over) checkEnd(s);
    return res;
  }

  function freeTileFor(s, pos, avoid) {
    var n = neighbors(pos);
    var opts = [];
    for (var i = 0; i < n.length; i++) {
      if (playerAt(s, n[i].x, n[i].y)) continue;
      if (s.satpam.x === n[i].x && s.satpam.y === n[i].y) continue;
      if (avoid && avoid.x === n[i].x && avoid.y === n[i].y) continue;
      opts.push(n[i]);
    }
    if (!opts.length) return null;
    return pickFrom(s, opts);
  }

  function doMove(s, p, act) {
    var to = act.to;
    if (!to || !walkable(to.x, to.y)) return { ok: false, error: 'tidak bisa lewat situ' };
    if (cheb(to, p.pos) !== 1) return { ok: false, error: 'harus satu petak' };
    var ev = [];
    var other = playerAt(s, to.x, to.y);
    if (other && other.id !== p.id) {
      var spot = freeTileFor(s, other.pos, p.pos);
      if (!spot) return { ok: false, error: other.name + ' mentok, tidak bisa diserobot' };
      other.pos = spot;
      other.hiding = false;
      addNoise(s, to.x, to.y, 2);
      logMsg(s, p.name + ' nyerobot ' + other.name + ' di gelap — ' + other.name + ' kedorong!', 'bump');
      ev.push({ kind: 'bump', a: p.id, b: other.id, pushedTo: spot });
      var sp2 = s.satpam;
      if (sp2.x === spot.x && sp2.y === spot.y) { catchPlayer(s, other, 'kedorong ke Pak Satpam'); ev.push({ kind: 'caught', who: other.id }); }
    }
    p.pos = { x: to.x, y: to.y };
    p.hiding = false;
    addNoise(s, to.x, to.y, 1);
    ev.push({ kind: 'move', who: p.id, to: { x: to.x, y: to.y } });
    var sp = s.satpam;
    if (sp.x === to.x && sp.y === to.y) { catchPlayer(s, p, 'nabrak Pak Satpam'); ev.push({ kind: 'caught', who: p.id }); }
    return { ok: true, events: ev };
  }

  function doSearch(s, p, act) {
    var g = groundPeek(s, p.pos.x, p.pos.y);
    if (g && g.coins > 0) {
      var got = g.coins; g.coins = 0;
      p.loot += got;
      addNoise(s, p.pos.x, p.pos.y, 2);
      logMsg(s, p.name + ' pungut ' + got + ' duit dari lantai.', 'loot');
      return { ok: true, events: [{ kind: 'coins', who: p.id, n: got }] };
    }
    if (g && g.items.length) {
      var it = g.items.shift();
      addItem(p, it);
      addNoise(s, p.pos.x, p.pos.y, 1);
      logMsg(s, p.name + ' ambil ' + ITEMS[it].name + ' dari lantai.', 'item');
      return { ok: true, events: [{ kind: 'item', who: p.id, item: it }] };
    }
    if (!canSearch(s, p)) return { ok: false, error: 'tidak ada yang bisa dicari di sini' };
    addNoise(s, p.pos.x, p.pos.y, 1);
    var draws = p.arch === 'warung' ? 2 : 1;
    var got2 = [];
    for (var i = 0; i < draws; i++) {
      var id = pickFrom(s, SEARCH_DECK);
      if (ITEMS[id].kind === 'loot') { p.loot += ITEMS[id].coins; got2.push(ITEMS[id].name); }
      else { addItem(p, id); got2.push(ITEMS[id].name); }
    }
    logMsg(s, p.name + ' menggeledah: ' + got2.join(' + ') + '.', 'item');
    return { ok: true, events: [{ kind: 'search', who: p.id, got: got2 }] };
  }

  function addNoise(s, x, y, loud) {
    s.noise.push({ x: x, y: y, loud: loud, round: s.round });
    if (s.noise.length > 24) s.noise.shift();
  }

  function resolveStrike(s, atk, def, weaponId) {
    var ev = [];
    var w = weaponId ? ITEMS[weaponId] : null;
    var wdmg = w ? w.dmg : 0;
    var aRoll = d6(s) + wdmg + atk.atk + (atk.courage > 0 ? 2 : 0);
    if (atk.courage > 0) atk.courage = 0;
    var cover = hasCover(s, def.pos) ? 1 : 0;
    var dRoll = d6(s) + armorDef(def) + (def.hiding ? 2 : 0) + cover;
    ev.push({ kind: 'roll', atk: aRoll, def: dRoll, weapon: weaponId || null, cover: cover });
    if (w) {
      var br = d6(s);
      if (br >= w.breakOn) {
        removeItem(atk, weaponId);
        var msg = w.name + ' rusak!';
        if (w.becomes) { addItem(atk, w.becomes); msg += ' Jadi ' + ITEMS[w.becomes].name + '.'; }
        logMsg(s, msg, 'break');
        ev.push({ kind: 'break', who: atk.id, weapon: weaponId, becomes: w.becomes || null });
      }
    }
    if (aRoll > dRoll) {
      var dmg = Math.min(4, aRoll - dRoll);
      def.hp = Math.max(0, def.hp - dmg);
      def.hiding = false;
      logMsg(s, atk.name + ' kena ' + def.name + ' (' + dmg + ' damage, sisa ' + def.hp + ').', 'hit');
      ev.push({ kind: 'hit', who: def.id, dmg: dmg, hp: def.hp });
      if (def.hp <= 0) {
        atk.kos += 1;
        knockOut(s, def, atk);
        ev.push({ kind: 'ko', who: def.id, by: atk.id });
      }
    } else {
      logMsg(s, atk.name + ' nyasar — ' + def.name + ' menangkis.', 'miss');
      ev.push({ kind: 'miss', who: def.id });
    }
    return ev;
  }

  function knockOut(s, p, by) {
    var g = groundAt(s, p.pos.x, p.pos.y);
    g.coins += p.loot;
    g.items = g.items.concat(p.inventory);
    logMsg(s, p.name + ' TUMBANG! Jatuhkan ' + p.loot + ' duit dan ' + p.inventory.length + ' barang di lantai.', 'ko');
    p.loot = 0;
    p.inventory = [];
    p.hiding = false;
    p.usedFlash = false;
    p.pos = null;
    if (by) logMsg(s, by.name + ' dapat 3 poin KO.', 'ko');
  }

  function doAttack(s, p, act) {
    var to = act.to;
    if (!to || !inBounds(to.x, to.y)) return { ok: false, error: 'target tidak valid' };
    var weapon = act.weapon !== undefined ? act.weapon : bestWeapon(p);
    if (weapon && !p.inventory.includes(weapon)) weapon = bestWeapon(p);
    var reach = reachOf(p, weapon);
    if (cheb(to, p.pos) > reach) return { ok: false, error: 'terlalu jauh (jangkauan ' + reach + ')' };
    if (weapon && (ITEMS[weapon].kind !== 'weapon')) return { ok: false, error: 'bukan senjata' };
    if (reach > 1 && !losClear(p.pos, to)) return { ok: false, error: 'terhalang' };
    addNoise(s, p.pos.x, p.pos.y, 3);
    var target = playerAt(s, to.x, to.y);
    if (!target) {
      logMsg(s, p.name + ' ayun ' + (weapon ? ITEMS[weapon].name : 'kepalan') + ' ke kegelapan. Kosong.', 'miss');
      return { ok: true, events: [{ kind: 'whiff', who: p.id, to: to }] };
    }
    var ev = [{ kind: 'attack', who: p.id, target: target.id, weapon: weapon || null }]
      .concat(resolveStrike(s, p, target, weapon));
    return { ok: true, events: ev };
  }

  function doThrow(s, p, act) {
    var item = act.item;
    if (!item || !p.inventory.includes(item) || ITEMS[item].kind !== 'throw') return { ok: false, error: 'tidak ada barang lempar itu' };
    var to = act.to;
    if (!to || !inBounds(to.x, to.y) || isBlocked(to.x, to.y)) return { ok: false, error: 'target tidak valid' };
    if (cheb(to, p.pos) > 3) return { ok: false, error: 'maksimal 3 petak' };
    if (!losClear(p.pos, to)) return { ok: false, error: 'terhalang' };
    removeItem(p, item);
    addNoise(s, p.pos.x, p.pos.y, 2);
    var target = playerAt(s, to.x, to.y);
    var ev = [{ kind: 'throw', who: p.id, item: item, to: to }];
    if (!target) {
      var g = groundAt(s, to.x, to.y); g.items.push(item);
      logMsg(s, p.name + ' lempar ' + ITEMS[item].name + ' — tidak kena siapa-siapa.', 'miss');
      return { ok: true, events: ev };
    }
    ev = ev.concat(resolveStrike(s, p, target, item));
    return { ok: true, events: ev };
  }

  function doUse(s, p, act) {
    var item = act.item;
    if (!item || !p.inventory.includes(item)) return { ok: false, error: 'tidak punya itu' };
    var it = ITEMS[item];
    if (it.kind === 'heal') {
      removeItem(p, item);
      var before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + it.hp);
      logMsg(s, p.name + ' minum/makan ' + it.name + ' (+' + (p.hp - before) + ' HP).', 'heal');
      return { ok: true, events: [{ kind: 'heal', who: p.id, hp: p.hp }] };
    }
    if (it.kind === 'buff') {
      removeItem(p, item);
      p.courage = 1;
      logMsg(s, p.name + ' nyalain ' + it.name + '. Serangan berikutnya +2.', 'buff');
      return { ok: true, events: [{ kind: 'buff', who: p.id }] };
    }
    if (it.kind === 'armor') return { ok: false, error: 'helm dipakai otomatis' };
    return { ok: false, error: 'barang ini tidak dipakai begitu' };
  }

  function doFlash(s, p) {
    if (!p.inventory.includes('senter')) return { ok: false, error: 'tidak punya senter' };
    p.usedFlash = true;
    addNoise(s, p.pos.x, p.pos.y, 2);
    logMsg(s, p.name + ' nyalain senter — semua orang tahu posisinya.', 'light');
    return { ok: true, events: [{ kind: 'flash', who: p.id }] };
  }

  function doGenset(s, p, act) {
    if (MAP[p.pos.y][p.pos.x] !== 'G') return { ok: false, error: 'harus di ruang genset' };
    s.lightsOverride = act.mode === 'dark' ? 'dark' : 'lit';
    s.kedip = false;
    logMsg(s, p.name + ' utak-atik genset: lampu jadi ' + LIGHT_LABEL[s.lightsOverride] + '.', 'light');
    return { ok: true, events: [{ kind: 'genset', who: p.id, mode: s.lightsOverride }] };
  }

  function doTool(s, p, act) {
    if (!act.item || !p.inventory.includes(act.item)) return { ok: false, error: 'tidak punya alat itu' };
    if (act.item === 'peluit') {
      var to = act.to;
      if (!to || !inBounds(to.x, to.y) || isBlocked(to.x, to.y)) return { ok: false, error: 'titik tidak valid' };
      if (cheb(to, p.pos) > 5) return { ok: false, error: 'maksimal 5 petak' };
      addNoise(s, to.x, to.y, 4);
      logMsg(s, p.name + ' tiup peluit ke arah ' + to.x + ',' + to.y + '. Pak Satpam menoleh.', 'tool');
      return { ok: true, events: [{ kind: 'whistle', who: p.id, to: to }] };
    }
    if (act.item === 'powerbank') {
      if (act.mode === 'kedip') {
        s.lightsOverride = 'lit';
        s.kedip = true;
        logMsg(s, p.name + ' setrum powerbank — lampu KEDIP! Semua orang kelihatan.', 'light');
        return { ok: true, events: [{ kind: 'genset', who: p.id, mode: 'kedip' }] };
      }
      s.lightsOverride = act.mode === 'dark' ? 'dark' : 'lit';
      s.kedip = false;
      logMsg(s, p.name + ' colok powerbank: lampu jadi ' + LIGHT_LABEL[s.lightsOverride] + '.', 'light');
      return { ok: true, events: [{ kind: 'genset', who: p.id, mode: s.lightsOverride }] };
    }
    return { ok: false, error: 'alat ini tidak bisa dipakai begitu' };
  }

  function doHide(s, p) {
    p.hiding = true;
    logMsg(s, p.name + ' nunduk di balik meja (+2 pertahanan sampai giliran berikutnya).', 'hide');
    return { ok: true, events: [{ kind: 'hide', who: p.id }] };
  }

  /* -------------------------------------------------------------- satpam -- */
  function bfsField(s, from) {
    var dist = {}, q = [{ x: from.x, y: from.y }];
    dist[key(from.x, from.y)] = 0;
    while (q.length) {
      var cur = q.shift();
      var d = dist[key(cur.x, cur.y)];
      for (var i = 0; i < 4; i++) {
        var nx = cur.x + DIRS[i][0], ny = cur.y + DIRS[i][1];
        if (!walkable(nx, ny)) continue;
        var k = key(nx, ny);
        if (dist[k] !== undefined) continue;
        dist[k] = d + 1;
        q.push({ x: nx, y: ny });
      }
    }
    return dist;
  }

  function satpamAct(s) {
    var sp = s.satpam;
    var target = null, best = 0, i;

    // sight first: anyone lit by the torch beam or standing in the open right next to him
    var seen = null, seenD = Infinity;
    for (i = 0; i < s.order.length; i++) {
      var pl = s.players[s.order[i]];
      if (pl.hp <= 0 || !pl.pos) continue;
      var dd = cheb(pl.pos, sp);
      if (dd > 3) continue;
      if (dd > 1 && !losClear(sp, pl.pos)) continue;
      if (pl.hiding) continue;
      if (dd < seenD) { seenD = dd; seen = pl.pos; }
    }

    for (i = 0; i < s.noise.length; i++) if (s.noise[i].loud > best) { best = s.noise[i].loud; target = s.noise[i]; }
    if (seen) target = { x: seen.x, y: seen.y, loud: 9 };
    var steps = target ? 3 : 1;
    if (target) { sp.alert = 4; } else if (sp.alert > 0) { sp.alert -= 1; }

    var field = target ? bfsField(s, target) : null;
    for (var st = 0; st < steps; st++) {
      var nbrs = neighbors(sp);
      if (!nbrs.length) break;
      var next = null;
      if (field) {
        var bestD = Infinity;
        for (var j = 0; j < nbrs.length; j++) {
          var d = field[key(nbrs[j].x, nbrs[j].y)];
          if (d === undefined) continue;
          if (d < bestD) { bestD = d; next = nbrs[j]; }
        }
      }
      if (!next) next = pickFrom(s, nbrs);
      sp.x = next.x; sp.y = next.y;
      var victim = playerAt(s, sp.x, sp.y);
      if (victim) { catchPlayer(s, victim, 'ketahuan Pak Satpam'); return; }
    }
  }

  function catchPlayer(s, p, why) {
    var loss = Math.max(1, Math.floor(p.loot / 2));
    loss = Math.min(loss, p.loot);
    p.loot -= loss;
    var g = groundAt(s, p.pos.x, p.pos.y);
    g.coins += loss;
    var door = nearestDoor(s, p.pos);
    p.pos = door;
    p.hiding = false;
    p.skipTurn = true;
    s.satpam.caught += 1;
    logMsg(s, 'DITANGKAP! ' + p.name + ' (' + why + ') — lepas ' + loss + ' duit, dilempar ke pintu, lewat 1 giliran.', 'caught');
  }

  function nearestDoor(s, pos) {
    var best = null, bd = Infinity;
    for (var i = 0; i < SPAWNS.length; i++) {
      var cand = { x: SPAWNS[i][0], y: SPAWNS[i][1] };
      if (playerAt(s, cand.x, cand.y)) continue;
      var d = Math.abs(cand.x - pos.x) + Math.abs(cand.y - pos.y);
      if (d < bd) { bd = d; best = cand; }
    }
    if (best) return best;
    var fallback = null;
    for (var y = 0; y < H && !fallback; y++) for (var x = 0; x < W; x++) {
      if (walkable(x, y) && !playerAt(s, x, y)) { fallback = { x: x, y: y }; break; }
    }
    return fallback || { x: 0, y: 0 };
  }

  /* ---------------------------------------------------------- turn cycle -- */
  function endTurn(s) {
    if (s.over) return;
    var guard = 0;
    while (true) {
      if (guard++ > 500) { finish(s, null); return; }
      s.turnIndex += 1;
      if (s.turnIndex >= s.order.length) {
        s.turnIndex = 0;
        endRound(s);
        if (s.over) return;
      }
      var p = s.players[s.order[s.turnIndex]];
      if (p.hp <= 0) continue;
      if (p.skipTurn) { p.skipTurn = false; logMsg(s, p.name + ' masih di luar, lewat giliran.', 'warn'); continue; }
      break;
    }
    var cur = current(s);
    cur.ap = cur.maxAp;
    s.turn = cur.id;
    logMsg(s, '— giliran ' + cur.name + ' (' + cur.ap + ' AP) —', 'turn');
  }

  function endRound(s) {
    satpamAct(s);
    if (s.over) return;
    s.round += 1;
    s.noise = [];
    s.lightsOverride = null;
    s.kedip = false;
    for (var i = 0; i < s.order.length; i++) {
      var p = s.players[s.order[i]];
      p.usedFlash = false;
      p.hiding = false;
    }
    if (s.round > s.roundLimit) { finish(s, null); return; }
    rollLights(s);
    logMsg(s, '=== Ronde ' + s.round + ' — lampu: ' + LIGHT_LABEL[s.lights] + ' ===', 'round');
  }

  function scoreOf(p) { return p.loot + 3 * p.kos + p.hp; }

  function scoreAll(s) {
    var out = [];
    for (var i = 0; i < s.order.length; i++) {
      var p = s.players[s.order[i]];
      out.push({
        id: p.id, name: p.name, arch: p.archName,
        loot: p.loot, kos: p.kos, hp: p.hp, score: scoreOf(p),
        standing: p.hp > 0,
      });
    }
    out.sort(function (a, b) { return b.score - a.score || b.hp - a.hp || b.loot - a.loot; });
    return out;
  }

  function finish(s, autoWinner) {
    if (s.over) return;
    s.over = true;
    s.results = scoreAll(s);
    s.winner = autoWinner ? autoWinner.id : s.results[0].id;
    var w = s.players[s.winner];
    if (autoWinner) logMsg(s, 'GAME OVER — ' + w.name + ' terakhir berdiri!', 'over');
    else logMsg(s, 'LAMPU NYALA. Polisi datang. ' + w.name + ' menang dengan ' + scoreOf(w) + ' poin.', 'over');
  }

  function checkEnd(s) {
    if (s.over) return;
    var alive = aliveList(s);
    if (alive.length <= 1) finish(s, alive[0] || null);
  }

  /* ----------------------------------------------------------------- view -- */
  function getView(s, pid) {
    var me = s.players[pid];
    if (!me) return { ok: false, error: 'pemain tidak dikenal' };
    var vis = visibleSet(s, me);
    var tokens = [];
    for (var i = 0; i < s.order.length; i++) {
      var o = s.players[s.order[i]];
      if (o.hp <= 0 || !o.pos) continue;
      if (o.id === me.id) { tokens.push({ x: o.pos.x, y: o.pos.y, kind: 'me', id: o.id, label: o.name }); continue; }
      if (vis[key(o.pos.x, o.pos.y)]) {
        tokens.push({ x: o.pos.x, y: o.pos.y, kind: 'player', id: o.id, label: o.name, arch: o.archName, hp: o.hp, maxHp: o.maxHp });
      }
    }
    var sp = s.satpam;
    if (vis[key(sp.x, sp.y)]) tokens.push({ x: sp.x, y: sp.y, kind: 'satpam', label: 'Pak Satpam' });
    for (var k in s.ground) {
      var g = s.ground[k];
      if (!g.coins && !g.items.length) continue;
      var pt = parseKey(k);
      if (!vis[k]) continue;
      tokens.push({ x: pt.x, y: pt.y, kind: g.coins ? 'coins' : 'item', n: g.coins, items: g.items.slice(), label: g.coins ? (g.coins + ' duit') : ITEMS[g.items[0]].name });
    }
    for (var n = 0; n < s.noise.length; n++) {
      var nz = s.noise[n];
      tokens.push({ x: nz.x, y: nz.y, kind: 'noise', loud: nz.loud, label: 'suara' });
    }
    return {
      ok: true,
      version: VERSION,
      round: s.round,
      roundLimit: s.roundLimit,
      lights: s.lightsOverride || s.lights,
      lightLabel: LIGHT_LABEL[s.lightsOverride || s.lights],
      kedip: s.kedip,
      turn: s.turn,
      myTurn: s.turn === me.id && !s.over,
      me: {
        id: me.id, name: me.name, arch: me.arch, archName: me.archName,
        hp: me.hp, maxHp: me.maxHp, ap: me.ap, maxAp: me.maxAp,
        loot: me.loot, kos: me.kos, pos: me.pos, hiding: me.hiding,
        usedFlash: me.usedFlash, courage: me.courage, skipTurn: me.skipTurn,
        inventory: me.inventory.map(function (id) { return { id: id, name: ITEMS[id].name, kind: ITEMS[id].kind, dmg: ITEMS[id].dmg || 0, reach: ITEMS[id].reach || 1, ap: ITEMS[id].ap || 0, flavor: ITEMS[id].flavor }; }),
      },
      board: { w: W, h: H, rows: MAP.slice() },
      visible: vis,
      tokens: tokens,
      log: s.log.slice(-60),
      over: s.over,
      results: s.results,
      winner: s.winner,
    };
  }

  /* ------------------------------------------------------------------- ai -- */
  function enumerateActions(s, pid) {
    var p = s.players[pid];
    var acts = [];
    if (!p || p.hp <= 0 || s.over) return acts;
    var nbrs = neighbors(p.pos);
    for (var i = 0; i < nbrs.length; i++) acts.push({ type: 'move', to: nbrs[i] });
    if (canSearch(s, p)) acts.push({ type: 'search' });
    var w = bestWeapon(p);
    var reach = reachOf(p, w);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var d = cheb({ x: x, y: y }, p.pos);
      if (d === 0 || d > reach) continue;
      if (d > 1 && !losClear(p.pos, { x: x, y: y })) continue;
      acts.push({ type: 'attack', to: { x: x, y: y }, weapon: w });
    }
    for (var j = 0; j < p.inventory.length; j++) {
      var id = p.inventory[j], it = ITEMS[id];
      if (it.kind === 'throw') {
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          if (isBlocked(x, y)) continue;
          if (cheb({ x: x, y: y }, p.pos) > 3) continue;
          if (!losClear(p.pos, { x: x, y: y })) continue;
          acts.push({ type: 'throw', item: id, to: { x: x, y: y } });
        }
      }
      if (it.kind === 'heal' || it.kind === 'buff') acts.push({ type: 'use', item: id });
      if (id === 'senter') acts.push({ type: 'flash' });
      if (id === 'peluit') {
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          if (isBlocked(x, y) || cheb({ x: x, y: y }, p.pos) > 5) continue;
          acts.push({ type: 'tool', item: id, to: { x: x, y: y } });
        }
      }
      if (id === 'powerbank') { acts.push({ type: 'tool', item: id, mode: 'lit' }); acts.push({ type: 'tool', item: id, mode: 'dark' }); acts.push({ type: 'tool', item: id, mode: 'kedip' }); }
    }
    if (MAP[p.pos.y][p.pos.x] === 'G') { acts.push({ type: 'genset', mode: 'lit' }); acts.push({ type: 'genset', mode: 'dark' }); }
    acts.push({ type: 'hide' });
    acts.push({ type: 'end' });
    return acts.filter(function (a) { return costOf(s, p, a) <= p.ap; });
  }

  function reachableTiles(from) {
    var seen = {}, q = [from];
    seen[key(from.x, from.y)] = true;
    while (q.length) {
      var c = q.shift();
      var n = neighbors(c);
      for (var i = 0; i < n.length; i++) {
        var k = key(n[i].x, n[i].y);
        if (seen[k]) continue;
        seen[k] = true; q.push(n[i]);
      }
    }
    return seen;
  }

  /* -------------------------------------------------------------- exports -- */
  return {
    VERSION: VERSION,
    MAP: MAP, W: W, H: H, SPAWNS: SPAWNS, ITEMS: ITEMS, ARCH: ARCH,
    LIGHT_LABEL: LIGHT_LABEL, LIGHT_R: LIGHT_R, SEARCH_DECK: SEARCH_DECK,
    newGame: newGame,
    applyAction: applyAction,
    getView: getView,
    enumerateActions: enumerateActions,
    costOf: costOf,
    canSearch: canSearch,
    aliveList: aliveList,
    scoreAll: scoreAll,
    scoreOf: scoreOf,
    walkable: walkable,
    isBlocked: isBlocked,
    neighbors: neighbors,
    reachableTiles: reachableTiles,
    losClear: losClear,
    visibleSet: visibleSet,
    key: key,
    cheb: cheb,
  };
});
