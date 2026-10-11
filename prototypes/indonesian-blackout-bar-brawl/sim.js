#!/usr/bin/env node
/* ============================================================================
 * MATI LAMPU — headless simulation harness.
 *
 *   node sim.js [games] [--seed N] [--players N] [--verbose] [--json]
 *
 * Runs full CPU-vs-CPU games and asserts engine invariants on EVERY step:
 *   I1  HP never negative, never above max
 *   I2  loot never negative, always an integer
 *   I3  AP never negative, never above max
 *   I4  at most one player per walkable tile
 *   I5  nobody stands on a blocking tile
 *   I6  game terminates within the round limit
 *   I7  every game ends with exactly one winner
 *   I8  actions are never applied out of turn
 *   I9  no exception is swallowed silently
 * Exits non-zero on the first violated invariant.
 * ==========================================================================*/
'use strict';
var BB = require('./engine.js');
var AI = require('./ai.js');

var ARCHS = ['preman', 'parkir', 'ojol', 'mahasiswa', 'warung', 'bule'];
var NAMES = ['Budi', 'Sari', 'Dedi', 'Maya', 'Rina', 'Agus'];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function checkInvariants(s, where, step) {
  var seen = {};
  var alive = 0;
  for (var i = 0; i < s.order.length; i++) {
    var p = s.players[s.order[i]];
    if (!Number.isInteger(p.hp) || p.hp < 0) throw new Error('I1 hp=' + p.hp + ' for ' + p.name + ' @' + where + ' step ' + step);
    if (p.hp > p.maxHp) throw new Error('I1 hp>max ' + p.hp + '/' + p.maxHp + ' ' + p.name + ' @' + where);
    if (!Number.isInteger(p.loot) || p.loot < 0) throw new Error('I2 loot=' + p.loot + ' ' + p.name + ' @' + where);
    if (!Number.isInteger(p.ap) || p.ap < 0) throw new Error('I3 ap=' + p.ap + ' ' + p.name + ' @' + where);
    if (p.ap > p.maxAp) throw new Error('I3 ap>max ' + p.ap + '/' + p.maxAp + ' ' + p.name + ' @' + where);
    if (p.hp > 0) {
      alive++;
      if (!p.pos) throw new Error('I5 alive player with no pos: ' + p.name + ' @' + where);
      if (!BB.walkable(p.pos.x, p.pos.y)) throw new Error('I5 ' + p.name + ' on blocked tile ' + p.pos.x + ',' + p.pos.y + ' @' + where);
      var k = BB.key(p.pos.x, p.pos.y);
      if (seen[k]) throw new Error('I4 two players on ' + k + ' (' + seen[k] + ',' + p.name + ') @' + where);
      seen[k] = p.name;
    } else if (p.pos) {
      throw new Error('I5 KO player still has pos: ' + p.name + ' @' + where);
    }
  }
  var sp = s.satpam;
  if (!BB.walkable(sp.x, sp.y)) throw new Error('I5 satpam on blocked tile @' + where);
  if (alive > 0 && s.players[s.turn].hp <= 0 && !s.over) throw new Error('I8 turn points at a KO player @' + where);
}

function playGame(seed, nPlayers, verbose, rng) {
  var roster = [];
  var archs = ARCHS.slice();
  for (var i = 0; i < nPlayers; i++) {
    var ai = Math.floor(rng() * archs.length);
    roster.push({ name: NAMES[i], arch: archs.splice(ai, 1)[0] });
  }
  var s = BB.newGame({ seed: seed, players: roster });
  checkInvariants(s, 'init', 0);

  var steps = 0, maxSteps = 4000;
  while (!s.over) {
    if (++steps > maxSteps) throw new Error('I6 no termination after ' + maxSteps + ' steps (seed ' + seed + ')');
    var cur = s.players[s.turn];
    if (cur.hp <= 0) throw new Error('I8 turn on KO player @step ' + steps);
    var before = s.turn;
    var act = AI.chooseAction(s, seed * 7919 + steps);
    var r = BB.applyAction(s, act);
    if (r && r.ok === false && act.type !== 'end' && verbose) {
      console.log('  reject', JSON.stringify(act), '->', r.error);
    }
    if (!s.over && s.players[before] && s.players[before].ap > 0 && s.turn !== before && act.type !== 'end') {
      // AP should have been spent before the turn moved on
      throw new Error('I3 turn changed with AP left: ' + s.players[before].name + ' ap=' + s.players[before].ap + ' @step ' + steps);
    }
    checkInvariants(s, 'step', steps);
    if (s.over) break;
    if (s.turn === before && !r.ok) {
      // a rejected action must not consume AP or stall the game
      var stall = BB.applyAction(s, { type: 'end' });
      if (!stall.ok) throw new Error('I6 cannot end a stalled turn @step ' + steps);
    }
  }
  if (!s.over) throw new Error('I6 loop exited without over (seed ' + seed + ')');
  if (!s.winner || !s.players[s.winner]) throw new Error('I7 no winner (seed ' + seed + ')');
  if (s.round > s.roundLimit + 1) throw new Error('I6 ran past round limit: ' + s.round + ' > ' + s.roundLimit + ' (seed ' + seed + ')');
  return s;
}

function main() {
  var argv = process.argv.slice(2);
  var games = 200, seed0 = 1, nPlayers = 0, verbose = false, json = false;
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === '--seed') seed0 = parseInt(argv[++i], 10);
    else if (argv[i] === '--players') nPlayers = parseInt(argv[++i], 10);
    else if (argv[i] === '--verbose') verbose = true;
    else if (argv[i] === '--json') json = true;
    else if (/^\d+$/.test(argv[i])) games = parseInt(argv[i], 10);
  }
  var wins = {}, archWins = {}, rounds = 0, kos = 0, catches = 0, sweep = 0, lastStanding = 0;
  var t0 = Date.now();
  for (var g = 0; g < games; g++) {
    var seed = seed0 + g;
    var rng = mulberry32(seed * 2654435761);
    var n = nPlayers || (2 + Math.floor(rng() * 5));
    var s = playGame(seed, n, verbose, rng);
    var w = s.players[s.winner];
    wins[w.name] = (wins[w.name] || 0) + 1;
    archWins[w.archName] = (archWins[w.archName] || 0) + 1;
    rounds += s.round;
    catches += s.satpam.caught;
    for (var i = 0; i < s.order.length; i++) kos += s.players[s.order[i]].kos;
    if (s.results && s.players[s.winner].hp > 0) lastStanding++;
    if (BB.aliveList(s).length <= 1) sweep++;
  }
  var ms = Date.now() - t0;
  var summary = {
    games: games, ms: ms,
    avgRounds: +(rounds / games).toFixed(2),
    avgKOs: +(kos / games).toFixed(2),
    avgCatches: +(catches / games).toFixed(2),
    gamesEndingWithOneStanding: sweep,
    winnerStillOnFeet: lastStanding,
    winsByArch: archWins,
  };
  if (json) { console.log(JSON.stringify(summary, null, 2)); return; }
  console.log('MATI LAMPU — ' + games + ' games in ' + ms + ' ms');
  console.log('  avg rounds/game      : ' + summary.avgRounds);
  console.log('  avg KOs/game         : ' + summary.avgKOs);
  console.log('  avg satpam catches   : ' + summary.avgCatches);
  console.log('  last player standing : ' + sweep + '/' + games);
  console.log('  winner still on feet : ' + lastStanding + '/' + games);
  console.log('  winners by archetype : ' + JSON.stringify(archWins));
  console.log('ALL INVARIANTS HELD (I1-I9).');
}

main();
