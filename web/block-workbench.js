import { blockPosition, moveBlock, newBlock, readStack } from './block-stack.js';

const $ = (id) => document.getElementById(id);
const worker = new Worker(new URL('./vendor/block-workbench.js', import.meta.url), { type: 'module' });
const labels = { group: 'Group', opening: 'Opening', body: 'Body', finisher: 'Finisher', data: 'Data' };
const groupLabels = { seq: 'Sequence', par: 'Parallel', boot: 'Boot a copy', fork: 'Branch on scan' };
let catalog, starters, rulesets;
let tree, selected, target, moving, drag;
let requestId = 0;
let report = [];

function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function button(text, action, className = 'btn ghost') {
  const item = element('button', text, className);
  item.type = 'button';
  item.addEventListener('click', action);
  return item;
}

function message(text = '', error = false) {
  $('workbench-message').textContent = text;
  $('workbench-message').classList.toggle('error', error);
}

function buildStatus(text, tone) {
  $('build-status').textContent = text;
  $('build-status').className = `workbench-note ${tone ?? ''}`;
}

function send(type, data = {}) {
  worker.postMessage({ type, id: ++requestId, ...data });
}

function resetReport() {
  report = [];
  $('match-rows').replaceChildren();
  $('results').hidden = true;
}

function invalidateBuild() {
  $('save-redcode').disabled = true;
  $('run-benchmark').disabled = true;
  $('opponent').disabled = true;
  $('opponent').replaceChildren(new Option('All compatible opponents', ''));
  $('redcode').textContent = '; Build the current stack to generate Redcode.';
  $('field-note').textContent = 'Build a warrior to find compatible library opponents.';
  buildStatus('Build to check the stack and generate Redcode.');
  resetReport();
}

function hasRoom(parent) {
  return parent ? parent.kids.length < catalog.get(parent.id).kids[1] : !tree;
}

function chooseBlock(node) {
  selected = node;
  moving = false;
  const position = blockPosition(tree, node);
  target = node.kids && hasRoom(node) ? { parent: node, index: node.kids.length }
    : position && hasRoom(position.parent) ? { ...position, index: position.index + 1 } : null;
}

function setTree(next) {
  tree = next;
  if (next) chooseBlock(next);
  else {
    selected = null;
    moving = false;
    target = { parent: null, index: 0 };
  }
  updateStack();
}

function updateStack(focus = false) {
  invalidateBuild();
  message();
  renderStack(focus);
}

function addBlock(id, slot) {
  if (!slot || !hasRoom(slot.parent)) {
    message('Choose an open + slot, or wrap a block in a group to make room.', true);
    return;
  }
  const node = newBlock(catalog.get(id));
  if (!slot.parent) tree = node;
  else slot.parent.kids.splice(slot.index, 0, node);
  chooseBlock(node);
  updateStack(true);
}

function placeBlock(node, slot) {
  try {
    moveBlock(tree, node, slot, catalog);
    chooseBlock(node);
    updateStack(true);
  } catch (error) { message(error.message, true); }
}

function removeBlock(node) {
  const position = blockPosition(tree, node);
  if (!position) return setTree(null);
  position.parent.kids.splice(position.index, 1);
  chooseBlock(position.parent);
  updateStack(true);
}

function wrapBlock(node, id) {
  const wrapper = newBlock(catalog.get(id));
  wrapper.kids.push(node);
  const position = blockPosition(tree, node);
  if (position) position.parent.kids[position.index] = wrapper;
  else tree = wrapper;
  chooseBlock(wrapper);
  updateStack(true);
}

function dragFrom(item, payload) {
  item.draggable = true;
  item.addEventListener('dragstart', (event) => {
    drag = payload;
    event.dataTransfer.setData('text/plain', payload.id ?? payload.node.id);
    event.dataTransfer.effectAllowed = payload.node ? 'move' : 'copy';
  });
  item.addEventListener('dragend', () => { drag = null; });
}

function slotButton(parent, index) {
  const slot = { parent, index };
  const active = target?.parent === parent && target.index === index;
  const description = parent ? `Slot ${index + 1} in ${parent.id}` : 'Root slot';
  const item = button(active ? '+ Insert here' : '+', () => {
    if (moving) return placeBlock(selected, slot);
    target = slot;
    message();
    renderStack();
    $('stack').querySelector('.workbench-slot[aria-pressed="true"]')?.focus();
  }, 'workbench-slot');
  item.setAttribute('aria-label', description);
  item.setAttribute('aria-pressed', String(active));
  item.addEventListener('dragover', (event) => {
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = drag.node ? 'move' : 'copy';
    item.classList.add('drop-target');
  });
  item.addEventListener('dragleave', () => item.classList.remove('drop-target'));
  item.addEventListener('drop', (event) => {
    event.preventDefault();
    item.classList.remove('drop-target');
    if (drag?.node) placeBlock(drag.node, slot);
    else if (drag?.id) addBlock(drag.id, slot);
    drag = null;
  });
  return item;
}

function renderBlock(node) {
  const def = catalog.get(node.id);
  const wrapper = element('div');
  const card = button('', () => { chooseBlock(node); message(); renderStack(true); }, 'workbench-block');
  card.dataset.kind = def.kind;
  card.setAttribute('aria-pressed', String(node === selected));
  const summary = def.kids ? `${groupLabels[node.id] ?? 'Group'} · ${node.kids.length} members`
    : labels[def.kind];
  card.append(element('strong', node.id), element('small', summary));
  if (node !== tree) dragFrom(card, { node });
  wrapper.append(card);
  if (node.kids) {
    const kids = element('div', undefined, 'workbench-kids');
    node.kids.forEach((child, index) => kids.append(slotButton(node, index), renderBlock(child)));
    kids.append(slotButton(node, node.kids.length));
    wrapper.append(kids);
  }
  return wrapper;
}

function renderStack(focus = false) {
  $('stack').replaceChildren(tree ? renderBlock(tree) : slotButton(null, 0));
  $('export-tree').disabled = !tree;
  $('destination').textContent = moving ? `Choose where to move ${selected.id}.`
    : target?.parent ? `Adding at slot ${target.index + 1} in ${target.parent.id}.`
      : target ? 'Choose a block or group to start.' : 'Choose a + slot to add a block, or wrap the selection in a group.';
  renderInspector();
  if (focus) $('stack').querySelector('.workbench-block[aria-pressed="true"]')?.focus();
}

function renderInspector() {
  const node = selected;
  const inspector = $('inspector');
  inspector.replaceChildren();
  if (!node) { inspector.append(element('p', 'Select a block to see its settings.', 'workbench-note')); return; }
  const def = catalog.get(node.id);
  inspector.append(element('strong', node.id, 'workbench-id'), element('p', def.purpose, 'workbench-note'));
  if (def.kids) {
    const [min, max] = def.kids;
    inspector.append(element('p', `Takes ${min === max ? min : `${min}–${max}`} member blocks.`, 'small workbench-note'));
  }
  if (def.testedProfiles.length) inspector.append(element('p', `Tested with ${def.testedProfiles.join(', ')}.`, 'small workbench-note'));
  const params = element('div', undefined, 'workbench-params');
  for (const [key, [min, max]] of Object.entries(def.params)) {
    const label = element('label', key, 'field');
    const input = element('input');
    Object.assign(input, { type: 'number', min, max, step: 1, value: Object.hasOwn(node.P ?? {}, key) ? (node.P[key] ?? '') : def.defaults[key] });
    input.required = true;
    input.setAttribute('aria-invalid', String(!input.validity.valid));
    input.addEventListener('input', () => {
      node.P ??= {};
      node.P[key] = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
      input.setAttribute('aria-invalid', String(!input.validity.valid));
      invalidateBuild();
    });
    label.append(input, element('small', `${min} to ${max}${def.roles[key] ? ` · ${def.roles[key]}` : ''}`));
    params.append(label);
  }
  inspector.append(params);
  const actions = element('div', undefined, 'row');
  if (Object.keys(def.params).length) actions.append(button('Reset values', () => {
    delete node.P;
    updateStack(true);
  }));
  if (node !== tree) actions.append(button(moving ? 'Cancel move' : 'Move to slot', () => {
    moving = !moving;
    renderStack();
    $('stack').querySelector('.workbench-slot')?.focus();
  }));
  actions.append(button('Remove block', () => removeBlock(node)));
  const wrap = element('label', 'Wrap in group', 'field');
  const group = element('select');
  group.append(new Option('Choose a group…', ''));
  for (const def of catalog.values()) if (def.kids) group.append(new Option(def.id, def.id));
  group.addEventListener('change', () => { if (group.value) wrapBlock(node, group.value); });
  wrap.append(group);
  inspector.append(actions, wrap);
}

function renderPalette() {
  const query = $('block-search').value.trim().toLowerCase();
  const category = $('category').value;
  const topology = $('topology').value ? 'torus' : 'ring';
  const old = rulesets[$('rules').value].dialect === '88';
  const items = [...catalog.values()].filter((def) => (!category || def.kind === category)
    && (def.kids || def.topologies.includes(topology)) && (!old || def.dialect !== '94')
    && `${def.id} ${def.purpose}`.toLowerCase().includes(query));
  $('palette-count').textContent = `${items.length} blocks and groups shown`;
  $('palette').replaceChildren(...items.map((def) => {
    const item = button('', () => addBlock(def.id, target), 'workbench-tile');
    item.dataset.kind = def.kind;
    item.title = def.purpose;
    item.append(element('strong', def.id), element('small', `${labels[def.kind]} · ${def.purpose}`));
    dragFrom(item, { id: def.id });
    return item;
  }));
}

function setBudget(length) {
  const rules = rulesets[$('rules').value];
  const row = Number($('topology').value.split('x')[0]);
  const max = row ? Math.min(rules.maxLength, Math.floor(row / 2)) : rules.maxLength;
  $('budget').max = max;
  $('budget').value = Math.min(max, length ?? max);
}

function loadStarter() {
  const starter = starters.get($('starter').value);
  if (!starter.rules.includes($('rules').value)) $('rules').value = starter.rules[0];
  $('topology').value = '';
  setBudget(starter.length);
  $('workbench-controls').disabled = true;
  send('starter', { recipe: starter.id, rules: $('rules').value });
}

function buildWarrior() {
  try {
    const stack = readStack(tree, catalog, { complete: true });
    if (!$('budget').checkValidity() || !$('budget').value) throw new Error('Set a valid instruction budget first.');
    invalidateBuild();
    message();
    buildStatus('Linking blocks and checking behavior…');
    $('workbench-controls').disabled = true;
    send('build', { tree: stack, options: {
      rules: $('rules').value, length: $('budget').valueAsNumber, name: 'Workbench warrior',
      torus: $('topology').value || null,
    } });
  } catch (error) { buildStatus(error.message, 'error'); }
}

function runBenchmark() {
  if ([$('rounds'), $('seed')].some((input) => !input.reportValidity() || !input.value)) return;
  resetReport();
  $('workbench-controls').disabled = true;
  $('run-status').hidden = false;
  $('stop-benchmark').disabled = false;
  $('run-progress').textContent = 'Running library matches…';
  send('benchmark', { opponent: $('opponent').value, rounds: $('rounds').valueAsNumber, seed: $('seed').valueAsNumber });
}

function recordMatch({ name, w, l, t, done, total }) {
  const rounds = w + l + t;
  const points = 3 * w + t;
  report.push({ rounds, points });
  const aggregate = report.reduce((sum, result) => ({ rounds: sum.rounds + result.rounds, points: sum.points + result.points }), { rounds: 0, points: 0 });
  const row = element('tr');
  const heading = element('th', name);
  heading.scope = 'row';
  row.append(heading, ...[w, t, l, (points / rounds).toFixed(2)].map((value) => element('td', value)));
  $('match-rows').append(row);
  $('score').textContent = `${(aggregate.points / aggregate.rounds).toFixed(2)} points per round across ${aggregate.rounds} rounds`;
  $('run-progress').textContent = `Completed ${done} of ${total} matchups.`;
  $('results').hidden = false;
}

function loadCatalog(data) {
  rulesets = data.rules;
  catalog = new Map(data.blocks.sort((a, b) => a.id.localeCompare(b.id)).map((def) => [def.id, def]));
  starters = new Map(data.starters.map((starter) => [starter.id, starter]));
  $('starter').append(...data.starters.map(({ id, purpose }) => {
    const option = new Option(id, id);
    option.title = purpose;
    return option;
  }));
  $('rules').append(...Object.keys(rulesets).map((id) => new Option(id, id)));
  $('rules').value = '94nop';
  $('starter').value = 'one-shot';
  loadStarter();
}

function showField({ opponents, skipped }) {
  $('opponent').append(...opponents.map(({ file, name }) => new Option(name, file)));
  $('opponent').disabled = !opponents.length;
  $('run-benchmark').disabled = !opponents.length;
  const skippedText = skipped.length ? ` Skipped ${skipped.length} that cannot run here.` : '';
  $('field-note').textContent = `${opponents.length} compatible library opponents.${skippedText}`;
  $('field-note').title = skipped.join(', ');
  $('workbench-controls').disabled = false;
}

worker.onmessage = ({ data: { type, id, value } }) => {
  if (id !== requestId) return;
  switch (type) {
    case 'catalog': loadCatalog(value); break;
    case 'starter':
      setTree(readStack(value, catalog));
      renderPalette();
      $('workbench-controls').disabled = false;
      break;
    case 'build':
      $('redcode').textContent = value.source;
      $('save-redcode').disabled = false;
      buildStatus(`${value.total} / ${value.budget} instructions · Verification passed\n${value.scope}`, 'success');
      $('field-note').textContent = 'Checking which opponents can run here…';
      break;
    case 'field': showField(value); break;
    case 'field-error':
      $('workbench-controls').disabled = false;
      $('field-note').textContent = `${value} Build again to retry.`;
      break;
    case 'result': recordMatch(value); break;
    case 'finished':
      $('workbench-controls').disabled = false;
      $('run-status').hidden = true;
      $('field-note').textContent = value.cancelled ? 'Benchmark stopped. Completed matchups are shown.' : 'Benchmark complete.';
      break;
    case 'error':
      $('workbench-controls').disabled = !catalog;
      if (!$('run-status').hidden) {
        $('run-status').hidden = true;
        $('field-note').textContent = value;
      } else if ($('build-status').textContent.startsWith('Linking')) buildStatus(value, 'error');
      else message(value, true);
      break;
  }
};

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = element('a');
  Object.assign(link, { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('block-search').addEventListener('input', renderPalette);
$('category').addEventListener('change', renderPalette);
for (const id of ['rules', 'topology']) $(id).addEventListener('change', () => { setBudget(); renderPalette(); invalidateBuild(); });
$('budget').addEventListener('input', invalidateBuild);
$('load-starter').addEventListener('click', loadStarter);
$('new-tree').addEventListener('click', () => setTree(null));
$('build-warrior').addEventListener('click', buildWarrior);
$('run-benchmark').addEventListener('click', runBenchmark);
$('stop-benchmark').addEventListener('click', () => {
  $('stop-benchmark').disabled = true;
  $('run-progress').textContent = 'Stopping after the current simulation slice…';
  worker.postMessage({ type: 'cancel' });
});
$('save-redcode').addEventListener('click', () => download('workbench.red', $('redcode').textContent, 'text/plain'));
$('export-tree').addEventListener('click', () => download('workbench.tree.json', JSON.stringify(tree, null, 2) + '\n', 'application/json'));
$('import-tree').addEventListener('click', () => $('tree-file').click());
$('tree-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  $('workbench-controls').disabled = true;
  try {
    if (file.size > 64 * 1024) throw new Error('Choose a stack JSON file smaller than 64 KB.');
    setTree(readStack(JSON.parse(await file.text()), catalog));
  } catch (error) { message(`Could not open stack. ${error.message}`, true); }
  finally { $('workbench-controls').disabled = false; }
});

worker.onerror = () => {
  $('run-status').hidden = true;
  $('workbench-controls').disabled = true;
  message('The workbench could not start its simulator. Reload this page to try again.', true);
};
send('catalog');
