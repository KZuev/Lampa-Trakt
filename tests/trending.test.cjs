const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../trakttv.js'), 'utf8');
const start = source.indexOf('    trending: function trending(');
const end = source.indexOf('    upnext: function upnext(', start);
const requests = [];
let themed = true;
const items = [{id: 31}, {id: 8}, {id: 19}];
const context = vm.createContext({
  URLSearchParams, isTraktHalloweenEnabled: () => themed,
  fetchWithMeta: async url => { requests.push(url); return {data: items, headers: {pages: 4}}; },
  t$2: (k,f) => f,
  createLinePayload: p => ({results:p.items, page:p.page, limit:p.limit, total_pages:p.headers.pages}),
  enrichWithTmdbLocale: x => x
});
const api = vm.runInContext('({' + source.slice(start, end) + '})', context);
(async () => {
  const data = await api.trending({page:2,limit:36});
  const url = new URL(requests[0], 'https://api.trakt.tv');
  assert.equal(url.pathname, '/media/trending');
  assert.equal(url.searchParams.get('theme'), 'halloween');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(data.total_pages, 4);
  assert.deepEqual(data.results, items);
  themed = false;
  await api.trending({page:1});
  assert.equal(new URL(requests[1], 'https://api.trakt.tv').searchParams.has('theme'), false);
  console.log('Trending checks passed: seasonal filter, pagination, API order, normal mode');
})().catch(e => { console.error(e); process.exitCode = 1; });
