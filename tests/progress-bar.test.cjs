const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../trakttv.js'), 'utf8');
function extract(name, next) {
  return source.slice(source.indexOf('  function ' + name + '('), source.indexOf('  function ' + next + '('));
}
class Element {
  constructor() { this.children = []; this.style = {}; }
  appendChild(child) { this.children.push(child); }
  insertBefore(child) { this.children.unshift(child); }
  querySelector(selector) {
    const name = selector.slice(1);
    for (const child of this.children) {
      if ((child.className || '').split(' ').includes(name)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}
const context = vm.createContext({ document: { createElement: () => new Element() } });
vm.runInContext(extract('resolveUpnextProgress', 'renderUpnextProgressBadge') +
  extract('renderProgressBar', 'renderWatchedBadge'), context);
context._watchedCache = {
  movies: new Set(['1']), completedShows: new Set(['2']),
  moviesProgressPct: new Map([['1', 48], ['3', 100]]),
  showsProgressPct: new Map([['2', 100]])
};
function card(data) {
  const root = new Element(), view = new Element();
  view.className = 'card__view'; root.appendChild(view);
  return { data, render: () => root, view };
}
function width(c) {
  return c.view.querySelector('.trakt-progress-bar__fill')?.style.width;
}
// A rewatch stays visible both from playback cache and after poster recreation.
for (let i = 0; i < 2; i++) {
  const c = card({ id: 1, method: 'movie' });
  context.renderProgressBar(c); assert.equal(width(c), '48%');
}
// Up Next wins over a completed-show cache; repeat renders update without duplicates.
const c = card({ id: 2, method: 'tv', trakt_upnext_watched: 3, trakt_upnext_total: 10 });
context.renderProgressBar(c); assert.equal(width(c), '30%');
c.data.trakt_upnext_watched = 4;
context.renderProgressBar(c); assert.equal(width(c), '40%');
assert.equal(c.view.children.length, 1);
// Completed content and History still have no general progress bar.
const done = card({ id: 3, method: 'movie' });
context.renderProgressBar(done); assert.equal(width(done), undefined);
const history = card({ id: 1, method: 'movie' }); history._trakt_no_progress_bar = true;
context.renderProgressBar(history); assert.equal(width(history), undefined);
console.log('Progress bar regression checks passed');
