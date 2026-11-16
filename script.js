(function () {
  'use strict';
  const calc = window.KassaCalculator;
  const byId = id => document.getElementById(id);
  const baseInput = byId('pohjakassa');
  const status = byId('action-status');
  const resetDialog = byId('reset-dialog');
  const fields = new Map();
  const autoCursor = byId('automaattikursori');
  let autoTimer;
  let composing = false;
  const autoDelay = 1200;
  let currentTotal = 0;
  let statusTimer;
  let revision = 0;
  const targets = { notes: byId('notes-inputs'), coins: byId('coins-inputs'), rolls: byId('roll-inputs') };

  for (const item of calc.denominations) {
    const row = document.createElement('div');
    row.className = 'currency-row' + (item.group === 'rolls' ? ' roll-row' : '');
    const label = document.createElement('label');
    label.htmlFor = item.id;
    label.className = 'currency-label';
    if (item.group !== 'rolls') {
      const mark = document.createElement('span');
      mark.className = 'currency-mark' + (item.group === 'coins' ? ' coin' : '');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = item.group === 'notes' ? '€' : '';
      if (item.color) { mark.style.setProperty('--note', item.color); mark.style.setProperty('--tint', item.tint); }
      label.append(mark);
    }
    const value = document.createElement('span');
    value.className = 'denomination' + (item.group === 'rolls' ? ' roll-label' : '');
    value.textContent = item.label;
    if (item.contents) { const small = document.createElement('small'); small.textContent = item.contents; value.append(small); }
    label.append(value);
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.id = item.id;
    input.className = 'quantity';
    input.placeholder = '0';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', `${item.name}, kappalemäärä`);
    input.setAttribute('aria-invalid', 'false');
    input.title = 'Kokonainen kappalemäärä, 0–999 999';
    const total = document.createElement('span');
    total.className = 'row-total';
    total.textContent = calc.money(0);
    row.append(label, input, total);
    targets[item.group].append(row);
    fields.set(item.id, { input, row, total });
    input.addEventListener('input', event => { update(); scheduleAdvance(input, event); });
    input.addEventListener('focus', () => {
      cancelAdvance();
      if (calc.parseCount(input.value) === 0) input.value = '';
      highlightActiveRow();
    });
    input.addEventListener('blur', () => {
      cancelAdvance();
      row.classList.remove('auto-cursor-active');
      const value = calc.parseCount(input.value);
      if (value !== null) input.value = value === 0 ? '' : String(value);
    });
    input.addEventListener('compositionstart', () => { composing = true; cancelAdvance(); });
    input.addEventListener('compositionend', () => { composing = false; scheduleAdvance(input); });
    input.addEventListener('keydown', event => {
      cancelAdvance();
      if (event.key === 'Enter') {
        event.preventDefault();
        advanceFrom(input);
      }
    });
  }
  function cancelAdvance() {
    clearTimeout(autoTimer);
    autoTimer = undefined;
  }
  function highlightActiveRow() {
    for (const { input, row } of fields.values()) {
      row.classList.toggle('auto-cursor-active', autoCursor.checked && document.activeElement === input);
    }
  }
  function advanceFrom(input) {
    cancelAdvance();
    if (calc.parseCount(input.value) === null) { input.reportValidity(); return; }
    const inputs = Array.from(fields.values()).map(field => field.input);
    const next = inputs[inputs.indexOf(input) + 1];
    if (next) { next.focus(); next.select(); }
    else {
      byId('summary-title').focus();
      if (autoCursor.checked) announce('Kaikki raharivit käyty läpi. Laskelma on ajan tasalla.');
    }
  }
  function scheduleAdvance(input, event) {
    cancelAdvance();
    if (!autoCursor.checked || composing || event?.isComposing || document.activeElement !== input) return;
    const text = input.value.trim();
    if (!text || calc.parseCount(text) === null || event?.inputType?.startsWith('delete')) return;
    // A single zero explicitly skips a row; a zero within 10 or 100 does not.
    if (text === '0') { advanceFrom(input); return; }
    autoTimer = setTimeout(() => {
      if (autoCursor.checked && document.activeElement === input && !resetDialog.open && document.visibilityState === 'visible') advanceFrom(input);
    }, autoDelay);
  }
  autoCursor.addEventListener('change', () => {
    cancelAdvance();
    if (autoCursor.checked) {
      const firstEmpty = Array.from(fields.values()).find(({ input }) => !input.value.trim());
      (firstEmpty || fields.values().next().value).input.focus();
    }
    highlightActiveRow();
  });
  window.addEventListener('blur', cancelAdvance);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') cancelAdvance(); });
  function announce(message) {
    clearTimeout(statusTimer);
    status.textContent = message;
    statusTimer = setTimeout(() => { status.textContent = ''; }, 4500);
  }
  function update() {
    revision++;
    clearTimeout(statusTimer);
    status.textContent = '';
    const counts = {};
    let invalidCount = false;
    for (const item of calc.denominations) {
      const field = fields.get(item.id);
      const count = calc.parseCount(field.input.value);
      field.input.setAttribute('aria-invalid', String(count === null));
      field.input.setCustomValidity(count === null ? 'Syötä kokonainen kappalemäärä väliltä 0–999 999.' : '');
      field.row.classList.toggle('has-value', count > 0);
      field.total.textContent = count === null ? '—' : calc.money(count * item.cents);
      invalidCount ||= count === null;
      counts[item.id] = count || 0;
    }
    const base = calc.parseMoney(baseInput.value);
    baseInput.setAttribute('aria-invalid', String(base === null));
    baseInput.setCustomValidity(base === null ? 'Syötä euromäärä, esimerkiksi 300 tai 300,50. Enimmäissumma on 9 999 999,99 €.' : '');
    byId('base-error').hidden = base !== null;
    for (const button of document.querySelectorAll('[data-base]')) button.setAttribute('aria-pressed', String(base === Number(button.dataset.base) * 100));
    const result = calc.totals(counts, base || 0);
    for (const group of ['notes', 'coins', 'rolls']) {
      const invalid = calc.denominations.some(item => item.group === group && fields.get(item.id).input.getAttribute('aria-invalid') === 'true');
      byId(`${group}-total`).textContent = invalid ? '—' : calc.money(result.groups[group]);
    }
    currentTotal = invalidCount ? null : result.total;
    byId('yhteissumma').textContent = invalidCount ? '—' : calc.money(result.total);
    byId('base-total').textContent = base === null ? '—' : '− ' + calc.money(base);
    byId('loomikseen').textContent = invalidCount || base === null ? '—' : calc.money(result.deposit);
    byId('kopioiYhteissumma').disabled = invalidCount;
    byId('breakdown').replaceChildren();
    byId('breakdown-container').hidden = true;
    const notice = byId('result-notice');
    let message = '';
    if (invalidCount) message = 'Tarkista korostetut kappalemäärät. Käytä kokonaislukuja väliltä 0–999 999.';
    else if (base === null) message = 'Tarkista pohjakassan summa.';
    else if (result.shortage > 0) message = `Pohjakassasta puuttuu ${calc.money(result.shortage)}. Tilitettävää ei ole.`;
    else if (result.deposit > 0) {
      const breakdown = calc.depositBreakdown(counts, result.deposit);
      if (breakdown.status === 'exact') {
        byId('breakdown-container').hidden = false;
        for (const item of breakdown.items) {
          const row = document.createElement('li');
          const name = document.createElement('span');
          const amount = document.createElement('span');
          name.textContent = `${item.name} × ${item.count}`;
          amount.textContent = calc.money(item.cents * item.count);
          row.append(name, amount);
          byId('breakdown').append(row);
        }
      } else if (breakdown.status === 'impossible') message = 'Tasan tätä pohjakassaa ei voi jättää syötetyillä seteleillä, kolikoilla ja täysillä rullilla. Vaihda rahaa tai muuta pohjakassaa. Rullia ei avata erittelyssä.';
      else message = 'Summa on laskettu, mutta näin suuren summan tilityserittelyä ei voitu muodostaa. Tarkista erittely käsin.';
    }
    notice.textContent = message;
    notice.hidden = !message;
  }
  baseInput.addEventListener('input', update);
  baseInput.addEventListener('focus', () => { if (calc.parseMoney(baseInput.value) === 0) baseInput.value = ''; });
  baseInput.addEventListener('blur', () => {
    const cents = calc.parseMoney(baseInput.value);
    if (cents !== null) baseInput.value = cents === 0 ? '' : (cents / 100).toFixed(2).replace('.', ',');
  });
  for (const button of document.querySelectorAll('[data-base]')) button.addEventListener('click', () => { baseInput.value = button.dataset.base; update(); });
  byId('kopioiYhteissumma').addEventListener('click', async () => {
    if (currentTotal === null) return;
    const copyRevision = revision;
    const value = (currentTotal / 100).toFixed(2).replace('.', ',');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      if (copyRevision === revision) announce('Yhteissumma kopioitu: ' + value + ' €');
    } catch {
      if (copyRevision === revision) announce('Kopiointi ei onnistunut. Voit valita ja kopioida yhteissumman.');
    }
  });
  byId('tyhjenna').addEventListener('click', () => { cancelAdvance(); resetDialog.returnValue = ''; resetDialog.showModal(); });
  resetDialog.addEventListener('close', () => {
    if (resetDialog.returnValue !== 'reset') return;
    cancelAdvance();
    for (const { input } of fields.values()) input.value = '';
    baseInput.value = '';
    byId('lahjakortit-hoidettu').checked = false;
    update();
    fields.get('note-500').input.focus();
    announce('Laskuri tyhjennetty.');
  });
  update();
})();
