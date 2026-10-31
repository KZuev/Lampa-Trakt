const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../trakttv.js'), 'utf8');
let mode = 'auto';
const props = {}, classes = new Set();
const context = vm.createContext({
  Lampa: { Storage: { field: () => mode } },
  document: { documentElement: {
    style: { setProperty: (k,v) => props[k]=v, removeProperty: k => delete props[k] },
    classList: { add: k => classes.add(k), remove: k => classes.delete(k) }
  } }
});
vm.runInContext(source.slice(source.indexOf('  function isTraktHalloweenDate('), source.indexOf('  function initTraktSeasonalTheme(')), context);
for (const [date, expected] of [
  ['2026-10-30T19:59:59', false], ['2026-10-30T20:00:00', true],
  ['2026-10-31T12:00:00', true], ['2026-11-02T23:59:59', true],
  ['2026-11-03T00:00:00', false], ['2026-12-31T12:00:00', false],
  ['2027-10-31T12:00:00', true]
]) assert.equal(context.isTraktHalloweenDate(new Date(date)), expected, date);
mode = 'halloween'; context.applyTraktSeasonalTheme();
assert.equal(props['--trakt-accent'], '#c24a00');
assert.ok(classes.has('trakt-halloween'));
mode = 'off'; context.applyTraktSeasonalTheme();
assert.equal(props['--trakt-accent'], undefined);
assert.equal(props['--trakt-accent-rgb'], undefined);
assert.equal(classes.size, 0);
assert.ok(source.includes('rgba(var(--trakt-accent-rgb,100,56,208),.18)'));
assert.ok(source.includes('color:var(--trakt-accent,#6438d0)'));
console.log('Seasonal theme checks passed');
