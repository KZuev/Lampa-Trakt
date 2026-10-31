const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../trakttv.js'), 'utf8');
let themed = true, account = 'first', failPage = 0, repeat = false;
const requests = [], logs = [];
const items = Array.from({length: 75}, (_, i) => ({movie: {ids: {trakt: i+1, tmdb:i+1}}}));
const context = vm.createContext({
  URLSearchParams, isTraktHalloweenEnabled: () => themed,
  buildAuthScope: () => account,
  _authLogAdd: (...args) => logs.push(args),
  fetchWithMeta: async url => {
    requests.push(url);
    const page = Number(new URL(url, 'https://api.trakt.tv').searchParams.get('page'));
    if (page === failPage) throw new Error('503');
    // Server caps requested 100 at 25, and reports an incorrect last page.
    return {data: repeat ? items.slice(0,25) : items.slice((page-1)*25,page*25), headers: {'x-pagination-page-count':'1'}};
  },
  t$2: (k,f) => f,
  createLinePayload: p => ({results:p.items, page:p.page}),
  enrichWithTmdbLocale: x => x
});
vm.runInContext(source.slice(source.indexOf('  var _completeTrendingCache ='), source.indexOf('  function isTraktHalloweenDate(')), context);
const start = source.indexOf('    trending: function trending(');
const end = source.indexOf('    upnext: function upnext(', start);
const api = vm.runInContext('({' + source.slice(start, end) + '})', context);
(async () => {
  const [first, same] = await Promise.all([api.trending({page:1}),api.trending({page:1})]);
  assert.equal(requests.length, 4); // Three nonempty pages, one terminal empty; single-flight.
  assert.equal(first.total, 75); assert.equal(first.total_pages, 1);
  assert.equal(same.total, 75);
  const second = await api.trending({page:2});
  const last = await api.trending({page:3});
  assert.equal(first.results.length, 75);
  assert.equal(second.results.length, 0);
  assert.equal(last.results.length, 0);
  assert.deepEqual([...first.results,...second.results,...last.results],items);
  assert.equal(requests.length,4); // Full cache reused across local pages.
  assert.equal(new URL(requests[0], 'https://api.trakt.tv').searchParams.get('theme'),'halloween');
  themed = false; await api.trending({page:1}); assert.equal(requests.length,8);
  assert.equal(new URL(requests[4], 'https://api.trakt.tv').searchParams.has('theme'),false);
  account = 'second'; failPage = 2;
  await assert.rejects(api.trending({page:1}), /503/);
  failPage = 0; const recovered = await api.trending({page:1});
  assert.equal(recovered.total,75); // Partial failure did not poison cache or pending promise.
  account = 'repeated'; repeat = true;
  await assert.rejects(api.trending({page:1}), /repeated/);
  assert.ok(logs.some(entry => entry[0]==='trending_loaded' && entry[1].total===75));
  console.log('Trending integration checks passed: complete API feed, complete first render, order, single-flight, cache scopes, failed-page retry and repeated-page detection');
})().catch(e => { console.error(e); process.exitCode = 1; });
