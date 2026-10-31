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
let payload = items;
let headers = {'x-pagination-page-count': '4'};
const context = vm.createContext({
  URLSearchParams, isTraktHalloweenEnabled: () => themed,
  fetchWithMeta: async url => { requests.push(url); return {data: payload, headers}; },
  t$2: (k,f) => f,
  createLinePayload: p => ({results:p.items, page:p.page, limit:p.limit, total_pages:Number(p.headers['x-pagination-page-count']) || 1}),
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
  headers = {};
  const short = await api.trending({page:1,limit:36});
  assert.equal(short.results.length, 3);
  assert.equal(short.total_pages, 2);
  assert.ok(short.total > 36);
  const second = await api.trending({page:2,limit:36});
  assert.equal(second.total_pages, 3);
  payload = [];
  const last = await api.trending({page:3,limit:36});
  assert.equal(last.total_pages, 3);
  payload = items;
  headers = {'x-pagination-page-count': '1'};
  const explicitEnd = await api.trending({page:1,limit:36});
  assert.equal(explicitEnd.total_pages, 1);
  console.log('Trending checks passed: short pages, missing headers, empty end, explicit count, seasonal filter and order');
})().catch(e => { console.error(e); process.exitCode = 1; });
