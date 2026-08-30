/* --------------------------------------------------------------------------
   Eine Ansicht = ein Suchlauf (Graph, Suchbaum, Schrittinformationen, Protokoll).

   Die Vergleichsansicht erzeugt einfach zwei davon nebeneinander; die
   Schrittsteuerung bleibt gemeinsam.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

(function (ISA) {
  'use strict';

  var ORDER_LABEL = {
    alpha: 'Nachbarn alphabetisch',
    input: 'Nachbarn in Eingabereihenfolge',
    weight: 'Nachbarn nach Kantengewicht'
  };

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function download(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  ISA.download = download;

  function exportSvg(svg, filename) {
    download(filename + '.svg', new Blob([ISA.serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  }

  function exportPng(svg, filename) {
    var source = ISA.serializeSvg(svg);
    var box = (svg.getAttribute('viewBox') || '0 0 800 500').split(/\s+/).map(Number);
    var scale = 2;
    var img = new Image();

    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(box[2] * scale);
      canvas.height = Math.round(box[3] * scale);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fdfdfc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        canvas.toBlob(function (blob) {
          if (blob) download(filename + '.png', blob);
          else exportSvg(svg, filename);
        }, 'image/png');
      } catch (err) {
        exportSvg(svg, filename);
      }
    };
    img.onerror = function () { exportSvg(svg, filename); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  }

  var GRAPH_LEGEND = [
    ['#3d5afe', 'aktueller Knoten'],
    ['#dde3ff', 'auf dem aktuellen Pfad'],
    ['#eceff5', 'schon expandiert'],
    ['#ffffff', 'in der Frontier (gestrichelt)'],
    ['#f7cf5e', 'beste Lösung']
  ];

  var TREE_LEGEND = [
    ['#3d5afe', 'aktuell entnommen'],
    ['#eceff5', 'expandiert'],
    ['#ffffff', 'in der Frontier (gestrichelt)'],
    ['#fdf2dd', 'Zyklus verworfen'],
    ['#d5f0e2', 'Ziel erreicht']
  ];

  function legend(items) {
    var box = h('div', 'legend');
    items.forEach(function (item) {
      var span = h('span');
      var dot = h('i');
      dot.style.background = item[0];
      span.appendChild(dot);
      span.appendChild(document.createTextNode(item[1]));
      box.appendChild(span);
    });
    return box;
  }

  function panel(title, buttons) {
    var p = h('div', 'panel');
    var head = h('div', 'panel-head');
    head.appendChild(h('h3', null, title));
    buttons.forEach(function (b) {
      var btn = h('button', 'mini', b.label);
      btn.type = 'button';
      btn.title = b.title || '';
      btn.addEventListener('click', b.onClick);
      head.appendChild(btn);
    });
    var wrap = h('div', 'svg-wrap');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.appendChild(svg);
    p.appendChild(head);
    p.appendChild(wrap);
    return { el: p, svg: svg, head: head };
  }

  /**
   * @param {{onSelectStep:Function, onDragNode:Function, onToggleLayout:Function}} hooks
   */
  ISA.createView = function createView(hooks) {
    var run = null;
    var positions = null;
    var treePos = null;
    var treeView = null;     // vom Nutzer gewähltes Sichtfenster, sonst automatisch
    var stepIndex = 0;

    var root = h('section', 'view');

    var head = h('div', 'view-head');
    var title = h('h2', null, '—');
    var tag = h('span', 'tag', '');
    head.appendChild(title);
    head.appendChild(tag);

    var graphPanel = panel('Graph', [
      { label: 'Anordnung', title: 'Zwischen Kreis- und Kräfteanordnung wechseln', onClick: function () { hooks.onToggleLayout(); } },
      { label: 'SVG', onClick: function () { exportSvg(graphPanel.svg, fileName('graph')); } },
      { label: 'PNG', onClick: function () { exportPng(graphPanel.svg, fileName('graph')); } }
    ]);
    graphPanel.el.appendChild(legend(GRAPH_LEGEND));

    var treePanel = panel('Suchbaum', [
      { label: 'Ansicht', title: 'Zoom und Verschiebung zurücksetzen', onClick: function () { treeView = null; render(); } },
      { label: 'SVG', onClick: function () { exportSvg(treePanel.svg, fileName('suchbaum')); } },
      { label: 'PNG', onClick: function () { exportPng(treePanel.svg, fileName('suchbaum')); } }
    ]);
    treePanel.el.appendChild(legend(TREE_LEGEND));

    var panels = h('div', 'panels');
    panels.appendChild(graphPanel.el);
    panels.appendChild(treePanel.el);

    var info = h('div', 'info');

    var logBox = h('div', 'log');
    var logHead = h('div', 'log-head');
    logHead.appendChild(h('h3', null, 'Protokoll'));
    var logList = h('ol', 'log-list');
    logBox.appendChild(logHead);
    logBox.appendChild(logList);

    root.appendChild(head);
    root.appendChild(panels);
    root.appendChild(info);
    root.appendChild(logBox);

    enableTreeNavigation();

    function fileName(kind) {
      if (!run) return kind;
      return [kind, run.meta.short.toLowerCase(), run.start, run.goal, 'schritt' + stepIndex].join('-');
    }

    /* ------------------------------------------------------- Baum: Zoom/Pan */
    function enableTreeNavigation() {
      var svg = treePanel.svg;
      var dragging = null;

      svg.addEventListener('wheel', function (evt) {
        if (!run) return;
        evt.preventDefault();
        var box = treeView || ISA.autoTreeView(visibleTreeNodes(), treePos);
        var rect = svg.getBoundingClientRect();
        var fx = (evt.clientX - rect.left) / rect.width;
        var fy = (evt.clientY - rect.top) / rect.height;
        var factor = evt.deltaY > 0 ? 1.15 : 1 / 1.15;
        var w = Math.min(Math.max(box.w * factor, 120), 20000);
        var hgt = box.h * (w / box.w);
        treeView = { x: box.x + (box.w - w) * fx, y: box.y + (box.h - hgt) * fy, w: w, h: hgt };
        render();
      }, { passive: false });

      svg.addEventListener('pointerdown', function (evt) {
        if (!run) return;
        var box = treeView || ISA.autoTreeView(visibleTreeNodes(), treePos);
        dragging = { x: evt.clientX, y: evt.clientY, box: box, rect: svg.getBoundingClientRect() };
        svg.setPointerCapture(evt.pointerId);
      });

      svg.addEventListener('pointermove', function (evt) {
        if (!dragging) return;
        var dx = (evt.clientX - dragging.x) / dragging.rect.width * dragging.box.w;
        var dy = (evt.clientY - dragging.y) / dragging.rect.height * dragging.box.h;
        treeView = { x: dragging.box.x - dx, y: dragging.box.y - dy, w: dragging.box.w, h: dragging.box.h };
        render();
      });

      function end() { dragging = null; }
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }

    function visibleTreeNodes() {
      return run.tree.filter(function (t) { return t.createdAtStep <= stepIndex; });
    }

    /* ------------------------------------------------------------ Protokoll */
    function buildLog() {
      logList.textContent = '';
      run.steps.forEach(function (step, i) {
        var li = h('li');
        li.appendChild(h('span', 'n', step.kind === 'init' ? '·' : step.kind === 'done' ? '✓' : step.number));
        var t = h('span', 't', step.text);
        if (step.isGoal) {
          var mk = document.createElement('mark');
          mk.textContent = ' ✓ Lösung';
          t.appendChild(mk);
        }
        li.appendChild(t);
        li.addEventListener('click', function () { hooks.onSelectStep(i); });
        logList.appendChild(li);
      });
    }

    function updateLog() {
      Array.prototype.forEach.call(logList.children, function (li, i) {
        li.classList.toggle('is-active', i === stepIndex);
        li.classList.toggle('is-future', i > stepIndex);
      });
      var active = logList.children[stepIndex];
      if (active) {
        var top = active.offsetTop - logList.clientHeight / 2 + active.clientHeight / 2;
        logList.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
      }
    }

    /* --------------------------------------------- Schrittinformationen */
    function chip(path, cls) {
      var c = h('div', 'chip' + (cls ? ' ' + cls : ''));
      var b = document.createElement('b');
      b.textContent = ISA.pathText(path.nodes);
      c.appendChild(b);
      c.appendChild(h('span', 'cost', ' · ' + ISA.fmt(path.cost)));
      return c;
    }

    function frontierBlock(step) {
      var block = h('div', 'block');
      var label = h('div', 'block-label',
        (run.algorithm === 'bfs' ? 'Frontier – Warteschlange (FIFO)' : 'Frontier – Stapel (LIFO)') +
        ' · ' + step.frontierAfter.length + ' Pfade');
      block.appendChild(label);

      var strip = h('div', 'frontier');
      var isBfs = run.algorithm === 'bfs';

      var left = h('div', 'frontier-end');
      left.appendChild(h('div', null, isBfs ? 'vorne' : 'unten'));
      left.appendChild(h('div', null, isBfs ? '↓ Entnahme' : ''));
      strip.appendChild(left);

      if (!step.frontierAfter.length) {
        strip.appendChild(h('div', 'chip is-empty', 'leer'));
      } else {
        var nextId = isBfs ? step.frontierAfter[0] : step.frontierAfter[step.frontierAfter.length - 1];
        var justAdded = new Set(step.successors.filter(function (s) { return s.status === 'neu'; })
          .map(function (s) { return s.id; }));

        var ids = step.frontierAfter;
        var limit = 40;
        var shown = ids.length > limit
          ? (isBfs ? ids.slice(0, limit) : ids.slice(-limit))
          : ids;

        if (ids.length > limit && !isBfs) {
          strip.appendChild(h('div', 'chip is-empty', '+' + (ids.length - limit) + ' weitere'));
        }
        shown.forEach(function (id) {
          strip.appendChild(chip(run.paths[id],
            id === nextId ? 'is-next' : justAdded.has(id) ? 'is-new' : ''));
        });
        if (ids.length > limit && isBfs) {
          strip.appendChild(h('div', 'chip is-empty', '+' + (ids.length - limit) + ' weitere'));
        }
      }

      var right = h('div', 'frontier-end');
      right.appendChild(h('div', null, isBfs ? 'hinten' : 'oben'));
      right.appendChild(h('div', null, isBfs ? '↑ Einfügen' : '↕ Einfügen/Entnahme'));
      strip.appendChild(right);

      block.appendChild(strip);
      return block;
    }

    function successorBlock(step) {
      var block = h('div', 'block');
      block.appendChild(h('div', 'block-label', 'Erzeugte Nachfolger'));

      var table = h('table', 'succ');
      var thead = document.createElement('thead');
      var tr = document.createElement('tr');
      ['Nachbar', 'Kante', 'Neuer Pfad', 'Kosten', 'Status'].forEach(function (t) {
        tr.appendChild(h('th', null, t));
      });
      thead.appendChild(tr);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      step.successors.forEach(function (s) {
        var row = document.createElement('tr');
        if (s.status === 'zyklus') row.className = 'is-cycle';
        row.appendChild(h('td', null, s.node));
        row.appendChild(h('td', null, '+' + ISA.fmt(s.weight)));
        row.appendChild(h('td', 'path', ISA.pathText(s.nodes)));
        row.appendChild(h('td', null, ISA.fmt(s.cost)));

        var status = h('td');
        status.appendChild(h('span', s.status === 'neu' ? 'pill pill-new' : 'pill pill-cycle',
          s.status === 'neu' ? 'in Frontier' : 'Zyklus'));
        row.appendChild(status);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      block.appendChild(table);
      return block;
    }

    function resultCard(label, value, extra, isBest) {
      var card = h('div', 'result' + (isBest ? ' is-best' : ''));
      card.appendChild(h('div', 'k', label));
      var v = h('div', 'v');
      if (value === null) v.appendChild(h('em', null, extra || 'noch keine'));
      else {
        v.textContent = value;
        if (extra) v.appendChild(h('em', null, ' ' + extra));
      }
      card.appendChild(v);
      return card;
    }

    function buildInfo(step) {
      info.textContent = '';

      var titleRow = h('div', 'info-title');
      titleRow.appendChild(document.createTextNode(
        step.kind === 'init' ? 'Initialisierung'
          : step.kind === 'done' ? 'Ende der Suche'
            : 'Schritt ' + step.number
      ));
      titleRow.appendChild(h('span', 'kicker', '  ·  Position ' + stepIndex + ' von ' + (run.steps.length - 1)));
      info.appendChild(titleRow);

      info.appendChild(h('div', 'info-sentence', step.text));

      info.appendChild(frontierBlock(step));
      if (step.successors.length) info.appendChild(successorBlock(step));

      var results = h('div', 'result-row');
      var current = step.currentId !== null ? run.paths[step.currentId] : null;
      results.appendChild(resultCard('Aktueller Pfad',
        current ? ISA.pathText(current.nodes) : null,
        current ? '(Kosten ' + ISA.fmt(current.cost) + ')' : '–'));

      var first = step.firstSolution;
      results.appendChild(resultCard('Zuerst gefundene Lösung',
        first ? ISA.pathText(first.nodes) : null,
        first ? '(Kosten ' + ISA.fmt(first.cost) + ')' : null));

      var best = step.best;
      results.appendChild(resultCard('Beste Lösung bisher',
        best ? ISA.pathText(best.nodes) : null,
        best ? '(Kosten ' + ISA.fmt(best.cost) + ')' : null,
        !!best));
      info.appendChild(results);

      var s = step.stats;
      var stats = h('div', 'stats');
      [
        ['expandiert', s.expanded],
        ['erzeugte Pfade', s.generated],
        ['verworfene Zyklen', s.pruned],
        ['größte Frontier', s.maxFrontier],
        ['gefundene Lösungen', s.solutions]
      ].forEach(function (pair) {
        var span = h('span');
        var b = document.createElement('b');
        b.textContent = ISA.fmt(pair[1]);
        span.appendChild(b);
        span.appendChild(document.createTextNode(' ' + pair[0]));
        stats.appendChild(span);
      });
      info.appendChild(stats);
    }

    /* ----------------------------------------------------------- Zeichnen */
    function render() {
      if (!run) return;
      ISA.renderGraph(graphPanel.svg, {
        run: run,
        stepIndex: stepIndex,
        positions: positions,
        onDrag: hooks.onDragNode
      });
      ISA.renderTree(treePanel.svg, {
        run: run,
        stepIndex: stepIndex,
        treePos: treePos,
        view: treeView
      });
    }

    return {
      el: root,

      setRun: function (nextRun, nextPositions) {
        run = nextRun;
        positions = nextPositions;
        treePos = ISA.layoutTree(run.tree);
        treeView = null;
        stepIndex = 0;

        title.textContent = run.meta.name;
        tag.textContent = [
          run.algorithm === 'bfs' ? 'Warteschlange (FIFO)' : 'Stapel (LIFO)',
          run.options.stopAtFirst ? 'Abbruch beim ersten Fund' : 'alle Pfade',
          ORDER_LABEL[run.graph.neighborOrder]
        ].join(' · ');

        buildLog();
      },

      setPositions: function (nextPositions) {
        positions = nextPositions;
        render();
      },

      show: function (index) {
        if (!run) return;
        stepIndex = Math.max(0, Math.min(index, run.steps.length - 1));
        render();
        buildInfo(run.steps[stepIndex]);
        updateLog();
      },

      getRun: function () { return run; }
    };
  };

})(window.ISA);
