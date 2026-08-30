/* --------------------------------------------------------------------------
   Oberfläche: Eingabe, Zustand, Abspielsteuerung, Export.
   -------------------------------------------------------------------------- */
(function (ISA) {
  'use strict';

  var PRESETS = [
    {
      id: 'beispiel',
      name: 'Beispielgraph',
      start: 'A', goal: 'E',
      text: "beispielgraph = [('A', 'B', 5), ('A', 'C', 3), ('B', 'C', 6), ('C', 'D', 4), ('C', 'E', 7), ('D', 'E', 2)]"
    },
    {
      id: 'bfsfalle',
      name: 'BFS-Falle: wenige Kanten ≠ günstig',
      start: 'A', goal: 'E',
      text: "[('A', 'B', 1), ('B', 'C', 1), ('C', 'D', 1), ('D', 'E', 1), ('A', 'E', 10)]"
    },
    {
      id: 'dfsfalle',
      name: 'DFS-Falle: erst tief in den falschen Ast',
      start: 'S', goal: 'Z',
      text: "[('S', 'A', 1), ('A', 'B', 1), ('B', 'C', 1), ('C', 'D', 1), ('D', 'E', 1), ('E', 'Z', 1), ('S', 'Z', 9)]"
    },
    {
      id: 'zyklen',
      name: 'Viele Zyklen',
      start: 'A', goal: 'E',
      text: "[('A', 'B', 2), ('B', 'C', 2), ('C', 'A', 2), ('C', 'D', 3), ('D', 'B', 1), ('D', 'E', 4)]"
    },
    {
      id: 'staedte',
      name: 'Städtenetz (größeres Beispiel)',
      start: 'Aachen', goal: 'Frankfurt',
      text: "[('Aachen', 'Köln', 70), ('Aachen', 'Bonn', 91), ('Köln', 'Bonn', 27),\n ('Köln', 'Düsseldorf', 40), ('Düsseldorf', 'Dortmund', 70), ('Dortmund', 'Kassel', 167),\n ('Bonn', 'Koblenz', 63), ('Koblenz', 'Mainz', 92), ('Koblenz', 'Frankfurt', 127),\n ('Mainz', 'Frankfurt', 40), ('Kassel', 'Frankfurt', 173)]"
    },
    {
      id: 'gerichtet',
      name: 'Gerichteter Graph (Einbahnstraßen)',
      start: 'A', goal: 'F',
      directed: true,
      text: "[('A', 'B', 2), ('A', 'C', 4), ('B', 'D', 3), ('C', 'D', 1), ('D', 'E', 2), ('C', 'F', 9), ('E', 'F', 1), ('F', 'A', 5)]"
    }
  ];

  var el = {};
  ['preset', 'edgeInput', 'optDirected', 'optOrder', 'btnApply', 'messages',
    'selStart', 'selGoal', 'algoPick', 'algoRow', 'optStop', 'optDfsReverse', 'btnRun',
    'btnMd', 'btnLink', 'linkHint', 'viewMode', 'btnPresentation', 'btnHelp', 'helpDialog',
    'btnFirst', 'btnPrev', 'btnPlay', 'btnNext', 'btnLast', 'stepSlider', 'stepLabel',
    'speed', 'views'].forEach(function (id) { el[id] = document.getElementById(id); });

  var state = {
    mode: 'single',
    algorithm: 'bfs',
    layout: 'circle',
    stepIndex: 0,
    playing: false
  };

  var graph = null;
  var positions = null;
  var views = [];
  var timer = null;
  var maxStep = 0;

  /* ------------------------------------------------------------- Meldungen */
  function showMessages(items) {
    el.messages.textContent = '';
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'msg msg-' + item.kind;
      div.textContent = item.text;
      el.messages.appendChild(div);
    });
  }

  /* -------------------------------------------------------- Graph übernehmen */
  function applyGraph(keepSelection) {
    var previousStart = keepSelection ? el.selStart.value : null;
    var previousGoal = keepSelection ? el.selGoal.value : null;

    var parsed = ISA.parseEdgeList(el.edgeInput.value);
    var messages = parsed.errors.map(function (e) { return { kind: 'error', text: e.message }; });

    if (parsed.errors.length) {
      showMessages(messages);
      graph = null;
      renderPlaceholder('Der Graph konnte nicht gelesen werden.');
      return false;
    }

    graph = ISA.buildGraph(parsed.edges, {
      directed: el.optDirected.checked,
      neighborOrder: el.optOrder.value
    });

    parsed.warnings.concat(graph.warnings).forEach(function (w) {
      messages.push({ kind: 'warn', text: w });
    });

    var components = graph.componentCount();
    if (components > 1) {
      messages.push({
        kind: 'warn',
        text: 'Der Graph zerfällt in ' + components + ' unverbundene Teile - nicht jedes Ziel ist erreichbar.'
      });
    }
    if (graph.nodes.length > 40) {
      messages.push({ kind: 'warn', text: 'Sehr großer Graph: die Zeichnung wird schnell unübersichtlich.' });
    }

    messages.push({
      kind: 'ok',
      text: graph.nodes.length + ' Knoten, ' + graph.edges.length + ' Kanten übernommen.'
    });
    showMessages(messages);

    fillNodeSelect(el.selStart, previousStart || graph.nodes[0]);
    fillNodeSelect(el.selGoal, previousGoal || graph.nodes[graph.nodes.length - 1]);

    positions = ISA.layoutGraph(graph, state.layout);
    return true;
  }

  function fillNodeSelect(select, preferred) {
    select.textContent = '';
    graph.nodes.forEach(function (n) {
      var option = document.createElement('option');
      option.value = n;
      option.textContent = n;
      select.appendChild(option);
    });
    select.value = graph.nodes.indexOf(preferred) !== -1 ? preferred : graph.nodes[0];
  }

  function renderPlaceholder(text) {
    el.views.textContent = '';
    views = [];
    var div = document.createElement('div');
    div.className = 'placeholder';
    div.textContent = text;
    el.views.appendChild(div);
    maxStep = 0;
    updatePlaybar();
  }

  /* --------------------------------------------------------------- Suche */
  function start() {
    if (!graph) return;
    stopPlaying();

    var options = {
      stopAtFirst: el.optStop.value === 'first',
      dfsReverse: el.optDfsReverse.checked
    };
    var algorithms = state.mode === 'compare' ? ['bfs', 'dfs'] : [state.algorithm];

    var runs = algorithms.map(function (algorithm) {
      return ISA.runSearch(graph, el.selStart.value, el.selGoal.value,
        Object.assign({ algorithm: algorithm }, options));
    });

    var aborted = runs.filter(function (r) { return r.aborted; });
    if (aborted.length) {
      showMessages([{ kind: 'warn', text: aborted[0].steps[aborted[0].steps.length - 1].text }]);
    }

    el.views.textContent = '';
    el.views.classList.toggle('is-compare', state.mode === 'compare');

    views = runs.map(function (run) {
      var view = ISA.createView({
        onSelectStep: goTo,
        onDragNode: dragNode,
        onToggleLayout: toggleLayout
      });
      view.setRun(run, positions);
      el.views.appendChild(view.el);
      return view;
    });

    maxStep = runs.reduce(function (m, r) { return Math.max(m, r.steps.length - 1); }, 0);
    goTo(0);
    writeHash();
  }

  function goTo(index) {
    state.stepIndex = Math.max(0, Math.min(index, maxStep));
    views.forEach(function (v) { v.show(state.stepIndex); });
    updatePlaybar();
  }

  function updatePlaybar() {
    var hasRun = views.length > 0;
    el.stepSlider.max = String(maxStep);
    el.stepSlider.value = String(state.stepIndex);
    el.stepSlider.disabled = !hasRun;
    el.stepLabel.textContent = hasRun
      ? 'Schritt ' + state.stepIndex + ' / ' + maxStep
      : 'Schritt – / –';

    el.btnFirst.disabled = el.btnPrev.disabled = !hasRun || state.stepIndex === 0;
    el.btnNext.disabled = el.btnLast.disabled = !hasRun || state.stepIndex === maxStep;
    el.btnPlay.disabled = !hasRun;
    el.btnPlay.textContent = state.playing ? '⏸ Pause' : '▶ Abspielen';
  }

  /* ---------------------------------------------------------- Abspielen */
  function play() {
    if (!views.length) return;
    if (state.stepIndex >= maxStep) goTo(0);
    state.playing = true;
    timer = setInterval(function () {
      if (state.stepIndex >= maxStep) { stopPlaying(); return; }
      goTo(state.stepIndex + 1);
    }, Number(el.speed.value));
    updatePlaybar();
  }

  function stopPlaying() {
    state.playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    updatePlaybar();
  }

  function togglePlay() { state.playing ? stopPlaying() : play(); }

  /* ------------------------------------------------------------ Zeichnung */
  function dragNode(name, x, y) {
    positions[name] = {
      x: Math.max(28, Math.min(x, ISA.GRAPH_W - 28)),
      y: Math.max(28, Math.min(y, ISA.GRAPH_H - 28))
    };
    views.forEach(function (v) { v.setPositions(positions); });
  }

  function toggleLayout() {
    if (!graph) return;
    state.layout = state.layout === 'circle' ? 'spring' : 'circle';
    positions = ISA.layoutGraph(graph, state.layout);
    views.forEach(function (v) { v.setPositions(positions); });
  }

  /* ------------------------------------------------------- Export & Link */
  function stepToMarkdown(run, step) {
    var lines = ['### ' + (step.kind === 'init' ? 'Initialisierung'
      : step.kind === 'done' ? 'Ende' : 'Schritt ' + step.number)];
    lines.push('', step.text, '');

    lines.push('- **Frontier (' + (run.algorithm === 'bfs' ? 'Warteschlange' : 'Stapel') + '):** ' +
      (step.frontierAfter.length
        ? step.frontierAfter.map(function (id) {
            var p = run.paths[id];
            return ISA.pathText(p.nodes) + ' (' + ISA.fmt(p.cost) + ')';
          }).join(' | ')
        : 'leer'));

    if (step.successors.length) {
      lines.push('- **Nachfolger:** ' + step.successors.map(function (s) {
        return ISA.pathText(s.nodes) + ' (' + ISA.fmt(s.cost) + ', ' +
          (s.status === 'neu' ? 'in Frontier' : 'Zyklus verworfen') + ')';
      }).join(' | '));
    }

    lines.push('- **Beste Lösung bisher:** ' +
      (step.best ? ISA.pathText(step.best.nodes) + ' mit Kosten ' + ISA.fmt(step.best.cost) : 'noch keine'));
    lines.push('- **Zähler:** ' + step.stats.expanded + ' expandiert, ' + step.stats.generated +
      ' Pfade erzeugt, ' + step.stats.pruned + ' Zyklen verworfen, größte Frontier ' + step.stats.maxFrontier);
    lines.push('');
    return lines.join('\n');
  }

  function exportMarkdown() {
    if (!views.length) return;
    var parts = [];

    views.forEach(function (v) {
      var run = v.getRun();
      parts.push('# ' + run.meta.name + ': ' + run.start + ' → ' + run.goal, '');
      parts.push('- Kantenliste: `' + ISA.formatEdgeList(run.graph.edges) + '`');
      parts.push('- Graph: ' + (run.graph.directed ? 'gerichtet' : 'ungerichtet') +
        ', Nachbarreihenfolge: ' + run.graph.neighborOrder);
      parts.push('- Abbruch: ' + (run.options.stopAtFirst ? 'beim ersten Zielfund' : 'alle Pfade durchsuchen'));
      parts.push('');
      run.steps.forEach(function (step) { parts.push(stepToMarkdown(run, step)); });
      parts.push('## Ergebnis', '');
      parts.push('- Zuerst gefunden: ' + (run.firstSolution
        ? ISA.pathText(run.firstSolution.nodes) + ' (Kosten ' + ISA.fmt(run.firstSolution.cost) + ')'
        : 'keine Lösung'));
      parts.push('- Beste Lösung: ' + (run.best
        ? ISA.pathText(run.best.nodes) + ' (Kosten ' + ISA.fmt(run.best.cost) + ')'
        : 'keine Lösung'));
      parts.push('- Expandierte Pfade: ' + run.stats.expanded +
        ', erzeugte Pfade: ' + run.stats.generated +
        ', verworfene Zyklen: ' + run.stats.pruned +
        ', größte Frontier: ' + run.stats.maxFrontier);
      parts.push('', '---', '');
    });

    var first = views[0].getRun();
    ISA.download('protokoll-' + first.start + '-' + first.goal + '.md',
      new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  }

  function writeHash() {
    var params = new URLSearchParams();
    params.set('g', el.edgeInput.value);
    params.set('s', el.selStart.value);
    params.set('z', el.selGoal.value);
    params.set('a', state.algorithm);
    params.set('m', el.optStop.value);
    params.set('o', el.optOrder.value);
    if (el.optDirected.checked) params.set('d', '1');
    if (!el.optDfsReverse.checked) params.set('r', '0');
    if (state.mode === 'compare') params.set('v', 'c');
    var hash = '#' + params.toString();
    try {
      // Unter file:// verbietet der Browser die History-API - dann direkt den Fragmentteil setzen.
      history.replaceState(null, '', hash);
    } catch (err) {
      location.hash = hash;
    }
  }

  function readHash() {
    if (!location.hash || location.hash.length < 2) return false;
    var params = new URLSearchParams(location.hash.slice(1));
    if (!params.get('g')) return false;

    el.edgeInput.value = params.get('g');
    el.optDirected.checked = params.get('d') === '1';
    el.optDfsReverse.checked = params.get('r') !== '0';
    if (params.get('o')) el.optOrder.value = params.get('o');
    if (params.get('m')) el.optStop.value = params.get('m');
    setAlgorithm(params.get('a') === 'dfs' ? 'dfs' : 'bfs');
    setMode(params.get('v') === 'c' ? 'compare' : 'single');

    if (!applyGraph(false)) return true;
    if (params.get('s')) el.selStart.value = params.get('s');
    if (params.get('z')) el.selGoal.value = params.get('z');
    start();
    return true;
  }

  function copyLink() {
    writeHash();
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        el.linkHint.textContent = 'Link kopiert – er enthält den kompletten Aufbau.';
      }, function () {
        el.linkHint.textContent = 'Kopieren nicht erlaubt – der Link steht jetzt in der Adresszeile.';
      });
    } else {
      el.linkHint.textContent = 'Der Link steht jetzt in der Adresszeile.';
    }
  }

  /* ----------------------------------------------------------- Umschalter */
  function setAlgorithm(algorithm) {
    state.algorithm = algorithm;
    Array.prototype.forEach.call(el.algoPick.children, function (b) {
      b.classList.toggle('is-active', b.dataset.algo === algorithm);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    Array.prototype.forEach.call(el.viewMode.children, function (b) {
      b.classList.toggle('is-active', b.dataset.mode === mode);
    });
    el.algoRow.style.display = mode === 'compare' ? 'none' : '';
  }

  /* ------------------------------------------------------------ Verdrahtung */
  PRESETS.forEach(function (p) {
    var option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    el.preset.appendChild(option);
  });

  function loadPreset(id) {
    var preset = PRESETS.filter(function (p) { return p.id === id; })[0];
    if (!preset) return;
    el.edgeInput.value = preset.text;
    el.optDirected.checked = !!preset.directed;
    if (applyGraph(false)) {
      el.selStart.value = preset.start;
      el.selGoal.value = preset.goal;
      start();
    }
  }

  el.preset.addEventListener('change', function () { loadPreset(el.preset.value); });
  el.btnApply.addEventListener('click', function () { if (applyGraph(true)) start(); });
  el.btnRun.addEventListener('click', start);

  [el.selStart, el.selGoal, el.optStop].forEach(function (control) {
    control.addEventListener('change', start);
  });
  el.optDfsReverse.addEventListener('change', start);
  el.optOrder.addEventListener('change', function () { if (applyGraph(true)) start(); });
  el.optDirected.addEventListener('change', function () { if (applyGraph(true)) start(); });

  el.algoPick.addEventListener('click', function (evt) {
    var button = evt.target.closest('button');
    if (!button) return;
    setAlgorithm(button.dataset.algo);
    start();
  });

  el.viewMode.addEventListener('click', function (evt) {
    var button = evt.target.closest('button');
    if (!button) return;
    setMode(button.dataset.mode);
    start();
  });

  el.btnFirst.addEventListener('click', function () { stopPlaying(); goTo(0); });
  el.btnPrev.addEventListener('click', function () { stopPlaying(); goTo(state.stepIndex - 1); });
  el.btnNext.addEventListener('click', function () { stopPlaying(); goTo(state.stepIndex + 1); });
  el.btnLast.addEventListener('click', function () { stopPlaying(); goTo(maxStep); });
  el.btnPlay.addEventListener('click', togglePlay);
  el.stepSlider.addEventListener('input', function () { stopPlaying(); goTo(Number(el.stepSlider.value)); });
  el.speed.addEventListener('change', function () { if (state.playing) { stopPlaying(); play(); } });

  el.btnMd.addEventListener('click', exportMarkdown);
  el.btnLink.addEventListener('click', copyLink);
  el.btnHelp.addEventListener('click', function () { el.helpDialog.showModal(); });
  el.btnPresentation.addEventListener('click', function () {
    var on = document.body.classList.toggle('presentation');
    el.btnPresentation.classList.toggle('is-active', on);
  });

  document.addEventListener('keydown', function (evt) {
    var tag = (evt.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input' || tag === 'select' || el.helpDialog.open) return;

    if (evt.key === 'ArrowRight') { stopPlaying(); goTo(state.stepIndex + 1); evt.preventDefault(); }
    else if (evt.key === 'ArrowLeft') { stopPlaying(); goTo(state.stepIndex - 1); evt.preventDefault(); }
    else if (evt.key === 'Home') { stopPlaying(); goTo(0); evt.preventDefault(); }
    else if (evt.key === 'End') { stopPlaying(); goTo(maxStep); evt.preventDefault(); }
    else if (evt.key === ' ') { togglePlay(); evt.preventDefault(); }
  });

  /* ------------------------------------------------------------- Start */
  if (!readHash()) {
    el.preset.value = PRESETS[0].id;
    loadPreset(PRESETS[0].id);
  }

})(window.ISA);
