/* ============================================================================
 * MATI LAMPU — heuristic policy.
 * Shared by the headless simulator and the browser UI ("Lawan CPU").
 * Deterministic: given the same state and seed, it picks the same action.
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.BlackoutBrawlAI = factory(root.BlackoutBrawl);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BB) {
  'use strict';

  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function knownEnemies(s, me) {
    var vis = BB.visibleSet(s, me);
    var out = [];
    for (var i = 0; i < s.order.length; i++) {
      var o = s.players[s.order[i]];
      if (o.id === me.id || o.hp <= 0 || !o.pos) continue;
      if (vis[BB.key(o.pos.x, o.pos.y)]) out.push(o);
    }
    return out;
  }

  function distField(s, from) {
    var d = {}, q = [{ x: from.x, y: from.y }];
    d[BB.key(from.x, from.y)] = 0;
    while (q.length) {
      var c = q.shift(), base = d[BB.key(c.x, c.y)];
      var n = BB.neighbors(c);
      for (var i = 0; i < n.length; i++) {
        var k = BB.key(n[i].x, n[i].y);
        if (d[k] !== undefined) continue;
        d[k] = base + 1; q.push(n[i]);
      }
    }
    return d;
  }

  /* Loudest noise the actor knows about, as a hunt target. */
  function loudestNoise(s) {
    var best = null;
    for (var i = 0; i < s.noise.length; i++) if (!best || s.noise[i].loud > best.loud) best = s.noise[i];
    return best;
  }

  function chooseAction(s, seed) {
    var me = s.players[s.turn];
    if (!me || me.hp <= 0) return { type: 'end' };
    var acts = BB.enumerateActions(s, me.id);
    if (!acts.length) return { type: 'end' };

    var field = distField(s, me.pos);
    var enemies = knownEnemies(s, me);
    var myScore = BB.scoreOf(me);
    var topEnemy = null, topScore = -Infinity;
    for (var e = 0; e < enemies.length; e++) {
      var sc = BB.scoreOf(enemies[e]);
      if (sc > topScore) { topScore = sc; topEnemy = enemies[e]; }
    }
    var iAmLeader = true;
    for (var a = 0; a < s.order.length; a++) {
      var o = s.players[s.order[a]];
      if (o.id !== me.id && o.hp > 0 && BB.scoreOf(o) > myScore) iAmLeader = false;
    }
    var noise = loudestNoise(s);
    var huntTarget = topEnemy ? topEnemy.pos : (noise ? { x: noise.x, y: noise.y } : null);
    var brave = me.arch === 'preman' || me.arch === 'bule' || (me.arch === 'ojol' && me.hp >= me.maxHp);
    var lit = (s.lightsOverride || s.lights) === 'lit' || s.kedip;

    var best = null, bestVal = -Infinity;
    for (var i = 0; i < acts.length; i++) {
      var act = acts[i], val = 0;
      var at = act.to || me.pos;
      var dTo = field[BB.key(at.x, at.y)];

      if (act.type === 'attack') {
        var tgt = null;
        for (var t = 0; t < enemies.length; t++) if (enemies[t].pos.x === act.to.x && enemies[t].pos.y === act.to.y) tgt = enemies[t];
        if (tgt) {
          val = 30 + (BB.scoreOf(tgt) - myScore) * 1.5;
          if (tgt.hp <= 3) val += 14;
          if (tgt.id === (topEnemy && topEnemy.id)) val += 8;
          if (tgt.hp <= 1 && me.hp <= 2) val += 10;      // trade up when wounded
        } else {
          val = -8;
        }
      } else if (act.type === 'throw') {
        var tt = null;
        for (t = 0; t < enemies.length; t++) if (enemies[t].pos.x === act.to.x && enemies[t].pos.y === act.to.y) tt = enemies[t];
        val = tt ? 18 + (tt.hp <= 3 ? 10 : 0) : -4;
      } else if (act.type === 'search') {
        val = 14;
        if (me.inventory.length >= 7) val -= 8;
        if (me.loot > 12) val -= 5;
        if (noise && BB.cheb(noise, me.pos) <= 1) val -= 8;   // don't loot next to a fight
      } else if (act.type === 'use') {
        var it = BB.ITEMS[act.item];
        if (it.kind === 'heal') val = me.hp <= me.maxHp - it.hp ? 16 + (me.maxHp - me.hp) : -6;
        if (it.kind === 'buff') val = 9;
      } else if (act.type === 'flash') {
        val = -18;
      } else if (act.type === 'genset' || (act.type === 'tool' && act.item === 'powerbank')) {
        var mode = act.mode || 'lit';
        if (mode === 'kedip') {
          val = (iAmLeader || me.hp <= 2) ? -12 : 4 + (brave ? 8 : 0);
        } else {
          val = (mode === 'lit') === brave ? 12 : -3;
          if (mode === 'dark' && me.hiding) val += 3;
        }
      } else if (act.type === 'tool' && act.item === 'peluit') {
        val = iAmLeader ? -10 : -2;
      } else if (act.type === 'hide') {
        val = me.hp <= 3 ? 9 : (iAmLeader && !brave ? 6 : 1);
        if (lit && !me.hiding) val += 4;               // hide from a lit room
      } else if (act.type === 'move') {
        val = 0.6;
        var g = s.ground[BB.key(act.to.x, act.to.y)];
        if (g && (g.coins || g.items.length)) val += 16;
        if (huntTarget) {
          var dNow = field[BB.key(huntTarget.x, huntTarget.y)];
          var dNext = distField(s, act.to)[BB.key(huntTarget.x, huntTarget.y)];
          if (dNext !== undefined && dNow !== undefined) {
            var chase = (dNow - dNext) * (topEnemy ? 5 : (brave ? 3 : 1.5));
            if (!topEnemy && !brave) chase *= 0.4;     // cowards only half-listen to noise
            val += chase;
          }
        }
        var sat = s.satpam;
        var sdNow = field[BB.key(sat.x, sat.y)];
        var sdNext = distField(s, act.to)[BB.key(sat.x, sat.y)];
        if (sdNext !== undefined && sdNow !== undefined && sdNow <= 4) val += (sdNext - sdNow) * 7;
        for (var nz = 0; nz < s.noise.length; nz++) {
          if (s.noise[nz].x === act.to.x && s.noise[nz].y === act.to.y) val -= 4 * s.noise[nz].loud;
        }
      } else if (act.type === 'end') {
        val = -1;
      }

      val += (hash(me.id + ':' + act.type + ':' + JSON.stringify(act.to || act.item || act.mode || '') + ':' + s.round + ':' + s.turnIndex) % 100) / 500;
      if (val > bestVal) { bestVal = val; best = act; }
    }
    return best || { type: 'end' };
  }

  return { chooseAction: chooseAction, knownEnemies: knownEnemies, distField: distField, loudestNoise: loudestNoise, hash: hash };
});
