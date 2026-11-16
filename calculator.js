/* Integer cents keep both totals and the deposit breakdown exact. */
(function (root) {
  'use strict';
  const denominations = [
    { id: 'note-500', label: '500 €', name: '500 € seteli', cents: 50000, group: 'notes', color: '#a899bd', tint: '#f3eff8' },
    { id: 'note-200', label: '200 €', name: '200 € seteli', cents: 20000, group: 'notes', color: '#bba957', tint: '#faf6e8' },
    { id: 'note-100', label: '100 €', name: '100 € seteli', cents: 10000, group: 'notes', color: '#83a786', tint: '#eef6ef' },
    { id: 'note-50', label: '50 €', name: '50 € seteli', cents: 5000, group: 'notes', color: '#c4a07a', tint: '#faf1e7' },
    { id: 'note-20', label: '20 €', name: '20 € seteli', cents: 2000, group: 'notes', color: '#87a6c0', tint: '#eef4fa' },
    { id: 'note-10', label: '10 €', name: '10 € seteli', cents: 1000, group: 'notes', color: '#c68e88', tint: '#fbefee' },
    { id: 'note-5', label: '5 €', name: '5 € seteli', cents: 500, group: 'notes', color: '#9ba5ad', tint: '#f0f3f4' },
    { id: 'coin-2', label: '2 €', name: '2 € kolikko', cents: 200, group: 'coins' },
    { id: 'coin-1', label: '1 €', name: '1 € kolikko', cents: 100, group: 'coins' },
    { id: 'coin-50', label: '50 snt', name: '50 snt kolikko', cents: 50, group: 'coins' },
    { id: 'coin-20', label: '20 snt', name: '20 snt kolikko', cents: 20, group: 'coins' },
    { id: 'coin-10', label: '10 snt', name: '10 snt kolikko', cents: 10, group: 'coins' },
    { id: 'coin-5', label: '5 snt', name: '5 snt kolikko', cents: 5, group: 'coins' },
    { id: 'roll-2', label: '2 € – rullat', name: '2 € rulla (50 €)', cents: 5000, group: 'rolls', contents: '50 € / rulla' },
    { id: 'roll-1', label: '1 € – rullat', name: '1 € rulla (25 €)', cents: 2500, group: 'rolls', contents: '25 € / rulla' },
    { id: 'roll-50', label: '50 snt – rullat', name: '50 snt rulla (20 €)', cents: 2000, group: 'rolls', contents: '20 € / rulla' },
    { id: 'roll-20', label: '20 snt – rullat', name: '20 snt rulla (8 €)', cents: 800, group: 'rolls', contents: '8 € / rulla' },
    { id: 'roll-10', label: '10 snt – rullat', name: '10 snt rulla (4 €)', cents: 400, group: 'rolls', contents: '4 € / rulla' },
    { id: 'roll-5', label: '5 snt – rullat', name: '5 snt rulla (2,50 €)', cents: 250, group: 'rolls', contents: '2,50 € / rulla' }
  ];
  const countLimit = 999999;
  const moneyLimit = 999999999; // 9 999 999,99 EUR; keeps arithmetic well within safe integers.
  function parseCount(value) {
    const text = String(value).trim();
    if (!text) return 0;
    if (!/^\d+$/.test(text)) return null;
    const number = Number(text);
    return Number.isSafeInteger(number) && number <= countLimit ? number : null;
  }
  function parseMoney(value) {
    const text = String(value).trim().replace(/\s/g, '');
    if (!text) return 0;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
    const [whole, fraction = ''] = text.split(/[.,]/);
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents <= moneyLimit ? cents : null;
  }
  const formatter = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' });
  function money(cents) { return formatter.format(cents / 100); }
  function totals(counts, base) {
    const groups = { notes: 0, coins: 0, rolls: 0 };
    for (const item of denominations) groups[item.group] += (counts[item.id] || 0) * item.cents;
    const total = groups.notes + groups.coins + groups.rolls;
    return { groups, total, deposit: Math.max(0, total - base), shortage: Math.max(0, base - total) };
  }
  function depositBreakdown(counts, target) {
    const available = denominations.filter(d => counts[d.id] > 0).slice().sort((a, b) => b.cents - a.cents);
    if (target === 0) return { status: 'exact', items: [] };
    const cashTotal = available.reduce((s, d) => s + counts[d.id] * d.cents, 0);
    if (target < 0 || target > cashTotal || target % 5 !== 0) return { status: 'impossible', items: [] };
    // Prefer larger denominations in the deposit, retaining small change for the till.
    let remaining = target;
    const greedy = [];
    for (const item of available) {
      const count = Math.min(counts[item.id], Math.floor(remaining / item.cents));
      if (count) greedy.push({ ...item, count });
      remaining -= count * item.cents;
    }
    if (remaining === 0) return { status: 'exact', items: greedy };
    // Greedy alone can miss a valid combination (e.g. 50 + 3 x 20 for a 60 EUR deposit).
    // A bounded knapsack search finds an exact combination of the entered cash.
    // Search the smaller of the deposit and retained float to keep live input fast.
    const invert = target > cashTotal - target;
    const searchCents = invert ? cashTotal - target : target;
    const goal = searchCents / 5;
    if (goal > 200000) return { status: 'limit', items: [] };
    let previous = new Int32Array(goal + 1).fill(-1);
    previous[0] = 0;
    const stages = [];
    for (const item of available) {
      const value = item.cents / 5;
      const count = counts[item.id];
      const current = new Int32Array(goal + 1).fill(-1);
      for (let sum = 0; sum <= goal; sum++) {
        if (previous[sum] >= 0) current[sum] = count;
        else if (sum >= value && current[sum - value] > 0) current[sum] = current[sum - value] - 1;
      }
      stages.push(current);
      previous = current;
    }
    if (previous[goal] < 0) return { status: 'impossible', items: [] };
    let sum = goal;
    const selected = {};
    for (let index = available.length - 1; index >= 0; index--) {
      const item = available[index];
      const used = counts[item.id] - stages[index][sum];
      selected[item.id] = invert ? counts[item.id] - used : used;
      sum -= used * item.cents / 5;
    }
    return { status: 'exact', items: available.filter(d => selected[d.id] > 0).map(d => ({ ...d, count: selected[d.id] })) };
  }
  const api = { denominations, countLimit, parseCount, parseMoney, money, totals, depositBreakdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KassaCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
