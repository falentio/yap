#!/usr/bin/env node
/* A/B measurement of the two board layouts with ONE harness and ONE AI, so the
 * numbers quoted in the design doc are apples-to-apples.
 *   node measure.js [games]
 * Mutates BB.MAP in place (BB.MAP is the engine's own array) to swap layouts.
 */
'use strict';
var BB = require('./engine.js');
var AI = require('./ai.js');

var BAR = [
  'P.......P', '.........', '..#...#..', '...BBB...', '...B.B...',
  '...BBB...', '..#...#..', '.........', 'T..$G..$T',
];
var MAZE = [
  'PP.#..#$.', '...#..#..', '#....G..T', '..BBBB..T', '..B..B...',
  '$..B..B..', '#.BBBB..#', '.........', 'P..#.#..P',
];
var SPAWNS = [[0, 0], [8, 0], [0, 7], [8, 7], [1, 8], [7, 8]];

function setMap(layout) { for (var y = 0; y < layout.length; y++) BB.MAP[y] = layout[y]; }
function setLightR(r) { BB.LIGHT_R.dark = r[0]; BB.LIGHT_R.dim = r[1]; BB.LIGHT_R.lit = r[2]; }

function mulberry32(a){return function(){a|=0;a=a+0x6d2b79f5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function run(games, seed0) {
  var visS = 0, visH = 0, attacks = 0, catches = 0, kos = 0, koEnd = 0, rounds = 0;
  for (var g = 0; g < games; g++) {
    var seed = seed0 + g, rng = mulberry32(seed * 2654435761);
    var n = 2 + Math.floor(rng() * 5);
    var archs = ['preman', 'parkir', 'ojol', 'mahasiswa', 'warung', 'bule'], roster = [];
    for (var i = 0; i < n; i++) roster.push({ name: 'P' + i, arch: archs.splice(Math.floor(rng() * archs.length), 1)[0] });
    var s = BB.newGame({ seed: seed, players: roster });
    var steps = 0;
    while (!s.over && steps++ < 4000) {
      var me = s.players[s.turn];
      var vis = BB.visibleSet(s, me);
      for (var j = 0; j < s.order.length; j++) {
        var o = s.players[s.order[j]];
        if (o.id === me.id || o.hp <= 0 || !o.pos) continue;
        visS++; if (vis[BB.key(o.pos.x, o.pos.y)]) visH++;
      }
      var act = AI.chooseAction(s, seed * 7919 + steps);
      if (act.type === 'attack' || act.type === 'throw') attacks++;
      var r = BB.applyAction(s, act);
      if (!r.ok) BB.applyAction(s, { type: 'end' });
    }
    catches += s.satpam.caught; rounds += s.round;
    for (i = 0; i < s.order.length; i++) kos += s.players[s.order[i]].kos;
    if (BB.aliveList(s).length <= 1) koEnd++;
  }
  return {
    visibilityPct: +(100 * visH / visS).toFixed(1),
    attacksPerGame: +(attacks / games).toFixed(1),
    catchesPerGame: +(catches / games).toFixed(2),
    kosPerGame: +(kos / games).toFixed(2),
    koEndingPct: +(100 * koEnd / games).toFixed(1),
    avgRounds: +(rounds / games).toFixed(2),
  };
}

var games = parseInt(process.argv[2], 10) || 200;
var NARROW = [1, 2, 3];   // the original light radii
var WIDE = [2, 3, 4];     // the shipped light radii
var cells = {};
[['maze', MAZE], ['bar', BAR]].forEach(function (mp) {
  [['narrow', NARROW], ['wide', WIDE]].forEach(function (lr) {
    setMap(mp[1]); setLightR(lr[1]);
    cells[mp[0] + '/' + lr[0]] = run(games, 1);
  });
});
console.log(JSON.stringify(cells, null, 2));
console.log('\ncell'.padEnd(16) + 'vis%'.padEnd(8) + 'atk/g'.padEnd(8) + 'catch/g'.padEnd(9) + 'ko/g'.padEnd(7) + 'koEnd%');
Object.keys(cells).forEach(function (k) {
  var c = cells[k];
  console.log(k.padEnd(16) + String(c.visibilityPct).padEnd(8) + String(c.attacksPerGame).padEnd(8) +
    String(c.catchesPerGame).padEnd(9) + String(c.kosPerGame).padEnd(7) + c.koEndingPct);
});
