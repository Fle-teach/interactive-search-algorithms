/* --------------------------------------------------------------------------
   Zeichnen von Graph und Suchbaum.

   Beide Zeichenfunktionen sind zustandslos: sie bekommen den Lauf und den
   Schrittindex und bauen die SVG-Fläche komplett neu auf. Bei Graphen in
   Unterrichtsgröße ist das schnell genug und spart jede Menge Zustandslogik.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

(function (ISA) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var NODE_R = 19;
  var TREE_R = 15;

  function el(name, attrs, text) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function edgeKey(graph, a, b) {
    return graph.directed ? a + '→' + b : [a, b].sort().join('↔');
  }

  /* Knoten sind Ellipsen: schmal bei "A", breit bei "Düsseldorf". */
  function radiusFor(label, base, perChar) {
    return { rx: Math.max(base, label.length * perChar + 10), ry: base };
  }

  function grow(r, amount) {
    return { rx: r.rx + amount, ry: r.ry + amount };
  }

  /* Radius einer Ellipse in Richtung (ux, uy). */
  function radiusAt(r, ux, uy) {
    if (typeof r === 'number') return r;
    var den = Math.hypot(r.ry * ux, r.rx * uy) || 1;
    return (r.rx * r.ry) / den;
  }

  /* Endpunkte um die Knotenradien kürzen, damit Linien nicht in den Knoten kleben. */
  function segment(a, b, r1, r2) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var d = Math.hypot(dx, dy) || 1;
    var ux = dx / d;
    var uy = dy / d;
    var head = radiusAt(r1, ux, uy);
    var tail = radiusAt(r2, ux, uy);
    return {
      x1: a.x + ux * head,
      y1: a.y + uy * head,
      x2: b.x - ux * tail,
      y2: b.y - uy * tail,
      ux: ux,
      uy: uy
    };
  }

  function arrowHead(seg, cls) {
    var size = 8;
    var bx = seg.x2 - seg.ux * size;
    var by = seg.y2 - seg.uy * size;
    var px = -seg.uy * size * 0.45;
    var py = seg.ux * size * 0.45;
    return el('polygon', {
      'class': 'isa-arrow' + (cls ? ' ' + cls : ''),
      points: [seg.x2, seg.y2, bx + px, by + py, bx - px, by - py].join(' ')
    });
  }

  function weightLabel(x, y, value, isCurrent) {
    return el('text', {
      'class': 'isa-weight' + (isCurrent ? ' is-current' : ''),
      x: x, y: y,
      stroke: '#fdfdfc', 'stroke-width': 3.5, 'paint-order': 'stroke'
    }, ISA.fmt(value));
  }

  /* ------------------------------------------------------------------ Graph */

  /**
   * @param {SVGElement} svg
   * @param {{run:object, stepIndex:number, positions:object, onDrag?:Function}} ctx
   */
  ISA.renderGraph = function renderGraph(svg, ctx) {
    var run = ctx.run;
    var graph = run.graph;
    var pos = ctx.positions;
    var step = run.steps[ctx.stepIndex];

    clear(svg);
    svg.setAttribute('class', 'isa-svg');
    svg.setAttribute('viewBox', '0 0 ' + ISA.GRAPH_W + ' ' + ISA.GRAPH_H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(el('rect', { 'class': 'isa-paper', x: 0, y: 0, width: ISA.GRAPH_W, height: ISA.GRAPH_H }));

    var radii = {};
    graph.nodes.forEach(function (n) { radii[n] = radiusFor(n, NODE_R, 4.3); });

    var current = step.currentId !== null ? run.paths[step.currentId] : null;
    var currentNodes = new Set(current ? current.nodes : []);
    var currentEdges = new Set();
    if (current) {
      for (var i = 0; i + 1 < current.nodes.length; i++) {
        currentEdges.add(edgeKey(graph, current.nodes[i], current.nodes[i + 1]));
      }
    }

    // Kanten, die in diesem Schritt gerade erzeugt wurden
    var newEdges = new Map();
    step.successors.forEach(function (s) {
      newEdges.set(edgeKey(graph, current.node, s.node), s.status);
    });

    // Knoten, die bereits (mindestens einmal) expandiert wurden
    var expandedNodes = new Set();
    var frontierNodes = new Set();
    run.tree.forEach(function (t) {
      if (t.expandedAtStep !== null && t.expandedAtStep <= ctx.stepIndex) expandedNodes.add(t.label);
    });
    step.frontierAfter.forEach(function (id) { frontierNodes.add(run.paths[id].node); });

    var showBest = step.best && step.best.step <= ctx.stepIndex;

    // 1) Beste Lösung als goldene Unterlegung
    if (showBest) {
      var pts = step.best.nodes.map(function (n) { return pos[n].x + ',' + pos[n].y; }).join(' ');
      svg.appendChild(el('polyline', { 'class': 'isa-halo', points: pts }));
    }

    // 2) Kanten - hervorgehobene zuletzt, damit sie oben liegen
    var base = el('g');
    var top = el('g');
    var labels = el('g');

    graph.edges.forEach(function (e) {
      var a = pos[e.from];
      var b = pos[e.to];
      if (!a || !b) return;

      var key = edgeKey(graph, e.from, e.to);
      var onPath = currentEdges.has(key);
      var created = newEdges.get(key);
      var cls = 'isa-edge' + (onPath ? ' is-current' : created === 'neu' ? ' is-new' : created === 'zyklus' ? ' is-cycle' : '');
      var seg = segment(a, b, radii[e.from], graph.directed ? grow(radii[e.to], 4) : radii[e.to]);

      var line = el('line', { 'class': cls, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 });
      (onPath || created ? top : base).appendChild(line);

      if (graph.directed) {
        (onPath ? top : base).appendChild(arrowHead(seg, onPath ? 'is-current' : null));
      }
      labels.appendChild(weightLabel((a.x + b.x) / 2, (a.y + b.y) / 2, e.weight, onPath));
    });

    svg.appendChild(base);
    svg.appendChild(top);
    svg.appendChild(labels);

    // 3) Knoten
    var nodesGroup = el('g');
    graph.nodes.forEach(function (name) {
      var p = pos[name];
      if (!p) return;

      var state = '';
      if (current && current.node === name) state = ' is-current';
      else if (currentNodes.has(name)) state = ' is-path';
      else if (expandedNodes.has(name)) state = ' is-expanded';
      else if (frontierNodes.has(name)) state = ' is-frontier';

      var g = el('g', { 'class': 'isa-node' + state, transform: 'translate(' + p.x + ',' + p.y + ')' });
      g.dataset.node = name;

      var r = radii[name];
      if (name === run.start) {
        var s1 = grow(r, 5);
        g.appendChild(el('ellipse', { 'class': 'isa-marker start', rx: s1.rx, ry: s1.ry, cx: 0, cy: 0 }));
        g.appendChild(el('text', { 'class': 'isa-badge start', x: 0, y: -r.ry - 15 }, 'START'));
      }
      if (name === run.goal) {
        var s2 = grow(r, name === run.start ? 9 : 5);
        g.appendChild(el('ellipse', { 'class': 'isa-marker goal', rx: s2.rx, ry: s2.ry, cx: 0, cy: 0 }));
        g.appendChild(el('text', { 'class': 'isa-badge goal', x: 0, y: r.ry + (name === run.start ? 20 : 16) }, 'ZIEL'));
      }

      g.appendChild(el('ellipse', { 'class': 'body', rx: r.rx, ry: r.ry, cx: 0, cy: 0 }));
      g.appendChild(el('text', { 'class': 'label', x: 0, y: 0 }, name));
      nodesGroup.appendChild(g);
    });
    svg.appendChild(nodesGroup);

    if (ctx.onDrag) enableNodeDrag(svg, ctx.onDrag);
  };

  /* Knoten mit der Maus bzw. dem Finger verschieben. */
  function enableNodeDrag(svg, onDrag) {
    var active = null;

    function toSvg(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var ctm = svg.getScreenCTM();
      return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    }

    svg.addEventListener('pointerdown', function (evt) {
      var g = evt.target.closest('.isa-node');
      if (!g) return;
      active = g.dataset.node;
      svg.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    });

    svg.addEventListener('pointermove', function (evt) {
      if (!active) return;
      var p = toSvg(evt);
      onDrag(active, p.x, p.y);
    });

    function end(evt) {
      if (!active) return;
      active = null;
      if (svg.hasPointerCapture && svg.hasPointerCapture(evt.pointerId)) svg.releasePointerCapture(evt.pointerId);
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  /* --------------------------------------------------------------- Suchbaum */

  function chainToRoot(tree, id) {
    var chain = [];
    while (id !== null && id !== undefined) {
      chain.push(id);
      id = tree[id].parentId;
    }
    return chain.reverse();
  }

  function chainPoints(pos, chain) {
    return chain.map(function (id) { return pos[id].x + ',' + pos[id].y; }).join(' ');
  }

  /**
   * @param {SVGElement} svg
   * @param {{run:object, stepIndex:number, treePos:Array, view?:object}} ctx
   */
  ISA.renderTree = function renderTree(svg, ctx) {
    var run = ctx.run;
    var pos = ctx.treePos;
    var step = run.steps[ctx.stepIndex];

    clear(svg);
    svg.setAttribute('class', 'isa-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    var visible = run.tree.filter(function (t) { return t.createdAtStep <= ctx.stepIndex; });

    // Sichtfenster: automatisch auf die sichtbaren Knoten, sofern der Nutzer
    // nicht selbst gezoomt oder verschoben hat.
    var box = ctx.view || autoView(visible, pos);
    svg.setAttribute('viewBox', [box.x, box.y, box.w, box.h].join(' '));
    svg.appendChild(el('rect', { 'class': 'isa-paper', x: box.x, y: box.y, width: box.w, height: box.h }));

    var showBest = step.best && step.best.step <= ctx.stepIndex;
    if (showBest && step.best.id !== undefined) {
      svg.appendChild(el('polyline', { 'class': 'isa-halo', points: chainPoints(pos, chainToRoot(run.tree, step.best.id)) }));
    }

    var currentChain = new Set();
    if (step.currentId !== null) {
      var chain = chainToRoot(run.tree, step.currentId);
      for (var i = 0; i + 1 < chain.length; i++) currentChain.add(chain[i + 1]);
    }

    var edges = el('g');
    var labels = el('g');
    visible.forEach(function (t) {
      if (t.parentId === null) return;
      var a = pos[t.parentId];
      var b = pos[t.id];
      var onPath = currentChain.has(t.id);
      var seg = segment(a, b, radiusFor(run.tree[t.parentId].label, TREE_R, 3.8), radiusFor(t.label, TREE_R, 3.8));
      edges.appendChild(el('line', {
        'class': 'isa-edge' + (onPath ? ' is-current' : t.pruned ? ' is-cycle' : ''),
        x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2
      }));
      if (t.edgeWeight !== null) {
        labels.appendChild(weightLabel((a.x + b.x) / 2, (a.y + b.y) / 2, t.edgeWeight, onPath));
      }
    });
    svg.appendChild(edges);
    svg.appendChild(labels);

    var nodes = el('g');
    visible.forEach(function (t) {
      var p = pos[t.id];
      var state = ISA.treeNodeState(t, ctx.stepIndex, step.currentId);
      var g = el('g', { 'class': 'isa-tn is-' + state, transform: 'translate(' + p.x + ',' + p.y + ')' });

      var r = radiusFor(t.label, TREE_R, 3.8);
      g.appendChild(el('ellipse', { 'class': 'body', rx: r.rx, ry: r.ry, cx: 0, cy: 0 }));
      g.appendChild(el('text', { 'class': 'label', x: 0, y: 0 }, t.label));
      g.appendChild(el('text', { 'class': 'isa-tn-cost', x: 0, y: r.ry + 10 }, ISA.fmt(t.cost)));

      if (t.pruned) {
        var d = TREE_R * 0.62;
        g.appendChild(el('line', { 'class': 'isa-cross', x1: -d, y1: -d, x2: d, y2: d }));
        g.appendChild(el('line', { 'class': 'isa-cross', x1: -d, y1: d, x2: d, y2: -d }));
      }
      nodes.appendChild(g);
    });
    svg.appendChild(nodes);

    return box;
  };

  function autoView(visible, pos) {
    if (!visible.length) return { x: -160, y: -60, w: 320, h: 200 };

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    visible.forEach(function (t) {
      var p = pos[t.id];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    var pad = 42;
    var w = Math.max(maxX - minX + 2 * pad, 300);
    var h = Math.max(maxY - minY + 2 * pad + 14, 190);
    return {
      x: (minX + maxX) / 2 - w / 2,
      y: (minY + maxY) / 2 - h / 2 + 7,
      w: w,
      h: h
    };
  }

  ISA.autoTreeView = autoView;

  /* ----------------------------------------------------------------- Export */

  ISA.serializeSvg = function serializeSvg(svg) {
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);

    var box = (clone.getAttribute('viewBox') || '0 0 800 500').split(/\s+/).map(Number);
    clone.setAttribute('width', Math.round(box[2]));
    clone.setAttribute('height', Math.round(box[3]));

    var style = document.createElementNS(NS, 'style');
    style.textContent = ISA.svgStyles;
    clone.insertBefore(style, clone.firstChild);

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  };

})(window.ISA);
