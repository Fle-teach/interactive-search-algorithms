/* --------------------------------------------------------------------------
   Anordnung der Knoten.

   Beide Verfahren sind deterministisch: derselbe Graph ergibt immer dasselbe
   Bild. Das ist wichtig, damit Screenshots für Arbeitsblätter reproduzierbar
   sind und die Klasse dasselbe sieht wie die Lehrkraft.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

(function (ISA) {
  'use strict';

  var GRAPH_W = 860;
  var GRAPH_H = 470;

  ISA.GRAPH_W = GRAPH_W;
  ISA.GRAPH_H = GRAPH_H;

  function circle(nodes) {
    var pos = {};
    var cx = GRAPH_W / 2;
    var cy = GRAPH_H / 2;
    var r = Math.min(GRAPH_W, GRAPH_H) / 2 - 46;

    if (nodes.length === 1) {
      pos[nodes[0]] = { x: cx, y: cy };
      return pos;
    }
    nodes.forEach(function (n, i) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / nodes.length;
      pos[n] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    return pos;
  }

  /* Kräftebasierte Verfeinerung, ausgehend vom Kreis und ohne Zufall -
     dadurch stabil reproduzierbar. */
  function spring(graph) {
    var nodes = graph.nodes;
    var pos = circle(nodes);
    if (nodes.length < 3) return pos;

    var area = GRAPH_W * GRAPH_H;
    var k = Math.sqrt(area / nodes.length) * 0.75;
    var iterations = 320;
    var temp = GRAPH_W / 8;
    var cool = temp / (iterations + 1);

    var neighbourPairs = graph.edges.map(function (e) { return [e.from, e.to]; });

    for (var it = 0; it < iterations; it++) {
      var disp = {};
      nodes.forEach(function (n) { disp[n] = { x: 0, y: 0 }; });

      // Abstoßung zwischen allen Knotenpaaren
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = pos[nodes[i]];
          var b = pos[nodes[j]];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var rep = (k * k) / d;
          var ux = (dx / d) * rep;
          var uy = (dy / d) * rep;
          disp[nodes[i]].x += ux; disp[nodes[i]].y += uy;
          disp[nodes[j]].x -= ux; disp[nodes[j]].y -= uy;
        }
      }

      // Anziehung entlang der Kanten
      neighbourPairs.forEach(function (pair) {
        var a = pos[pair[0]];
        var b = pos[pair[1]];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var att = (d * d) / k;
        var ux = (dx / d) * att;
        var uy = (dy / d) * att;
        disp[pair[0]].x -= ux; disp[pair[0]].y -= uy;
        disp[pair[1]].x += ux; disp[pair[1]].y += uy;
      });

      nodes.forEach(function (n) {
        var d = disp[n];
        var len = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
        var limit = Math.min(len, temp);
        pos[n].x += (d.x / len) * limit;
        pos[n].y += (d.y / len) * limit;
      });

      temp -= cool;
    }

    return fitToCanvas(pos, nodes);
  }

  function fitToCanvas(pos, nodes) {
    var pad = 46;
    var xs = nodes.map(function (n) { return pos[n].x; });
    var ys = nodes.map(function (n) { return pos[n].y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var sx = (GRAPH_W - 2 * pad) / Math.max(maxX - minX, 1);
    var sy = (GRAPH_H - 2 * pad) / Math.max(maxY - minY, 1);
    var s = Math.min(sx, sy, 1.8);

    nodes.forEach(function (n) {
      pos[n] = {
        x: pad + (pos[n].x - minX) * s + (GRAPH_W - 2 * pad - (maxX - minX) * s) / 2,
        y: pad + (pos[n].y - minY) * s + (GRAPH_H - 2 * pad - (maxY - minY) * s) / 2
      };
    });
    return pos;
  }

  /** @param {'circle'|'spring'} mode */
  ISA.layoutGraph = function layoutGraph(graph, mode) {
    return mode === 'spring' ? spring(graph) : circle(graph.nodes);
  };

  var TREE_DX = 58;
  var TREE_DY = 74;

  ISA.TREE_DX = TREE_DX;
  ISA.TREE_DY = TREE_DY;

  /**
   * Ebenenweises Baumlayout. Es wird über den VOLLSTÄNDIGEN Baum gerechnet
   * (alle Schritte sind ja schon bekannt) und beim Abspielen nur nach und
   * nach aufgedeckt. So springen bereits gezeichnete Knoten nie umher.
   */
  ISA.layoutTree = function layoutTree(treeNodes) {
    // Waagerechter Abstand richtet sich nach der laengsten Beschriftung,
    // damit sich breite Knoten (z. B. Staedtenamen) nicht ueberlappen.
    var longest = treeNodes.reduce(function (m, n) { return Math.max(m, n.label.length); }, 1);
    var dx = Math.max(TREE_DX, longest * 8 + 20);

    var children = treeNodes.map(function () { return []; });
    treeNodes.forEach(function (n) {
      if (n.parentId !== null) children[n.parentId].push(n.id);
    });

    var pos = new Array(treeNodes.length);
    var leafCursor = 0;

    // iterativ statt rekursiv - tiefe Bäume sollen nicht den Stapel sprengen
    var stack = [{ id: 0, phase: 0 }];
    while (stack.length) {
      var frame = stack[stack.length - 1];
      var kids = children[frame.id];

      if (!kids.length) {
        pos[frame.id] = { x: leafCursor * dx, y: treeNodes[frame.id].depth * TREE_DY };
        leafCursor++;
        stack.pop();
        continue;
      }
      if (frame.phase < kids.length) {
        stack.push({ id: kids[frame.phase], phase: 0 });
        frame.phase++;
        continue;
      }
      pos[frame.id] = {
        x: (pos[kids[0]].x + pos[kids[kids.length - 1]].x) / 2,
        y: treeNodes[frame.id].depth * TREE_DY
      };
      stack.pop();
    }

    return pos;
  };

})(window.ISA);
