#!/usr/bin/env node
/* Contract test: every action shape the HTML UI can emit must be accepted by
 * the engine in the situation the UI offers it. Guards against the UI and
 * engine drifting apart (e.g. renamed fields, changed AP costs). */
'use strict';
var BB = require('./engine.js');
var fails = 0;
function ok(cond, msg){ console.log((cond?'  PASS  ':'  FAIL  ')+msg); if(!cond) fails++; }

/* --- 1. move to an adjacent open tile --- */
var s = BB.newGame({ seed: 7, players:[{name:'A',arch:'ojol'},{name:'B',arch:'bule'}] });
var me = s.players[s.turn];
var nb = BB.neighbors(me.pos)[0];
ok(BB.applyAction(s,{type:'move',to:nb}).ok, 'move to adjacent tile');
ok(me.ap === me.maxAp-1, 'move cost 1 AP (ap='+me.ap+')');

/* --- 2. search at the cash register ($) --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'ojol'},{name:'B',arch:'bule'}] });
me = s.players[s.turn];
me.pos = {x:3,y:8};                                  // the $ tile on the map
ok(BB.MAP[me.pos.y][me.pos.x]==='$', 'test tile really is the cash register');
ok(BB.canSearch(s,me), 'canSearch true at $');
ok(BB.applyAction(s,{type:'search'}).ok, 'search at cash register');

/* --- 3. attack with the UI's "best weapon" picker --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'preman'},{name:'B',arch:'bule'}] });
me = s.players[s.turn];
var foe = s.players[s.order[1]];
me.pos = {x:1,y:1}; foe.pos = {x:1,y:2};
var r = BB.applyAction(s,{type:'attack',to:{x:1,y:2},weapon:'golok'});
ok(r.ok, 'attack adjacent enemy with golok');
ok(r.events.some(function(e){return e.kind==='roll';}), 'attack produced a roll event');

/* --- 4. throw: pick item from inventory, click a tile within 3 --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'parkir'},{name:'B',arch:'bule'}] });
me = s.players[s.turn];
ok(me.inventory.indexOf('batu')>=0, 'parkir starts with batu to throw');
ok(BB.applyAction(s,{type:'throw',item:'batu',to:{x:me.pos.x+2,y:me.pos.y}}).ok, 'throw batu 2 tiles');

/* --- 5. whistle (parkir tool) --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'parkir'},{name:'B',arch:'bule'}] });
me = s.players[s.turn];
var whistleTarget = null;
for (var wy=0; wy<BB.H && !whistleTarget; wy++) for (var wx=0; wx<BB.W; wx++) {
  if (BB.isBlocked(wx,wy)) continue;
  if (BB.cheb({x:wx,y:wy}, me.pos) < 2 || BB.cheb({x:wx,y:wy}, me.pos) > 5) continue;
  whistleTarget = {x:wx,y:wy}; break;
}
ok(!!whistleTarget, 'found a legal whistle target');
ok(BB.applyAction(s,{type:'tool',item:'peluit',to:whistleTarget}).ok, 'whistle at a legal tile');
ok(s.noise.some(function(n){ return n.loud>=4; }), 'whistle registered loud noise');

/* --- 6. powerbank modes incl. kedip --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'mahasiswa'},{name:'B',arch:'bule'}] });
me = s.players[s.turn];
ok(BB.applyAction(s,{type:'tool',item:'powerbank',mode:'kedip'}).ok, 'powerbank kedip');
ok((s.lightsOverride||s.lights)==='lit' && s.kedip===true, 'kedip sets lit + reveals table');

/* --- 7. senter (flash) --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'ojol'},{name:'B',arch:'bule'}] });
me = s.players[s.turn]; me.inventory.push('senter');
ok(BB.applyAction(s,{type:'flash'}).ok, 'flash senter');

/* --- 8. heal + buff --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'warung'},{name:'B',arch:'bule'}] });
me = s.players[s.turn]; me.hp = 3; me.inventory.push('kopi');
var before = me.hp;
ok(BB.applyAction(s,{type:'use',item:'kopi'}).ok, 'drink kopi');
ok(me.hp === before+1, 'kopi healed 1');

/* --- 9. hide, then end --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'ojol'},{name:'B',arch:'bule'}] });
ok(BB.applyAction(s,{type:'hide'}).ok, 'hide');
ok(BB.applyAction(s,{type:'end'}).ok, 'end turn');

/* --- 10. genset from the GEN tile --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'ojol'},{name:'B',arch:'bule'}] });
me = s.players[s.turn]; me.pos = {x:4,y:8};
ok(BB.MAP[8][4]==='G', 'GEN tile is where the UI says (rows[y][x])');
ok(BB.applyAction(s,{type:'genset',mode:'lit'}).ok, 'genset -> lit');

/* --- 11. the view the UI renders has every field the UI reads --- */
var v = BB.getView(s, s.turn);
['round','roundLimit','lights','lightLabel','kedip','turn','myTurn','me','board','visible','tokens','log','over','results','winner']
  .forEach(function(k){ ok(k in v, 'view has "'+k+'"'); });
ok(v.me.inventory.every(function(it){ return 'id' in it && 'name' in it && 'kind' in it; }), 'inventory entries are {id,name,kind,...}');
ok(v.me.inventory.every(function(it){ return 'flavor' in it; }), 'inventory entries carry flavor for tooltips');
ok(typeof v.board.rows[v.me.pos.y][v.me.pos.x]==='string', 'board.rows indexes as rows[y][x]');
ok(Object.keys(v.visible).every(function(k){ return /^\d+,\d+$/.test(k); }), 'visible keys are "x,y"');

/* --- 12. an out-of-turn action is rejected, and AP is untouched --- */
s = BB.newGame({ seed: 7, players:[{name:'A',arch:'ojol'},{name:'B',arch:'bule'}] });
var other = s.order[1];
var beforeAp = s.players[other].ap;
var bad = BB.applyAction(s,{type:'end',player:other});
ok(bad.ok===false, 'out-of-turn action rejected');
ok(s.players[other].ap===beforeAp, 'rejected action cost no AP');

console.log(fails? ('\n'+fails+' CONTRACT FAILURES') : '\nALL UI/ENGINE CONTRACTS HELD');
process.exit(fails?1:0);
