#!/usr/bin/env node
/* Verify every relative markdown link in the files this task touched actually
 * resolves on disk. */
'use strict';
var fs = require('fs'), path = require('path');
var root = '/home/kevin/Repositories/yap';
var files = [
  'research/reference/indonesian-blackout-bar-brawl.md',
  'research/reference/README.md',
  'prototypes/indonesian-blackout-bar-brawl/README.md',
  'README.md',
];
var bad = 0, checked = 0;
files.forEach(function (rel) {
  var abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { console.log('MISSING FILE ' + rel); bad++; return; }
  var txt = fs.readFileSync(abs, 'utf8');
  var re = /\]\(([^)]+)\)/g, m;
  while ((m = re.exec(txt))) {
    var target = m[1];
    if (/^https?:/.test(target) || target.startsWith('#')) continue;
    var clean = target.split('#')[0];
    if (!clean) continue;
    var resolved = path.resolve(path.dirname(abs), clean);
    checked++;
    if (!fs.existsSync(resolved)) { console.log('BROKEN  ' + rel + '  ->  ' + target); bad++; }
  }
});
console.log('\nchecked ' + checked + ' relative links, ' + bad + ' broken');
process.exit(bad ? 1 : 0);
