/* --------------------------------------------------------------------------
   Graph aus einer Kantenliste aufbauen.

   Die Reihenfolge der Nachbarn ist didaktisch entscheidend: Tiefensuche und
   Breitensuche liefern je nach Reihenfolge unterschiedliche Suchbäume.
   Sie wird deshalb explizit festgelegt und in der Oberfläche angezeigt.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

(function (ISA) {
  'use strict';

  var collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

  ISA.compareNodes = function (a, b) { return collator.compare(a, b); };

  /**
   * @param {Array} edges Ergebnis von ISA.parseEdgeList
   * @param {{directed?: boolean, neighborOrder?: 'alpha'|'input'|'weight'}} options
   */
  ISA.buildGraph = function buildGraph(edges, options) {
    var opts = options || {};
    var directed = !!opts.directed;
    var order = opts.neighborOrder || 'alpha';
    var warnings = [];
    var kept = [];
    var seen = new Map();

    edges.forEach(function (e) {
      if (e.from === e.to) {
        warnings.push('Schlinge ' + e.from + '-' + e.to + ' ignoriert (für die Suche ohne Bedeutung).');
        return;
      }
      var key = directed
        ? e.from + ' → ' + e.to
        : [e.from, e.to].sort(collator.compare).join(' - ');

      if (seen.has(key)) {
        warnings.push('Doppelte Kante ' + e.from + '-' + e.to + ': Gewicht ' + e.weight +
                      ' ignoriert, es gilt ' + seen.get(key).weight + '.');
        return;
      }
      if (e.weight < 0) {
        warnings.push('Kante ' + e.from + '-' + e.to + ' hat ein negatives Gewicht (' + e.weight + ').');
      }
      seen.set(key, e);
      kept.push(e);
    });

    var nodeSet = new Set();
    kept.forEach(function (e) { nodeSet.add(e.from); nodeSet.add(e.to); });
    var nodes = Array.from(nodeSet).sort(collator.compare);

    var adj = new Map();
    nodes.forEach(function (n) { adj.set(n, []); });

    kept.forEach(function (e, i) {
      adj.get(e.from).push({ to: e.to, weight: e.weight, edge: i });
      if (!directed) {
        adj.get(e.to).push({ to: e.from, weight: e.weight, edge: i });
      }
    });

    var compare = {
      alpha: function (a, b) { return collator.compare(a.to, b.to); },
      input: function (a, b) { return a.edge - b.edge; },
      weight: function (a, b) { return a.weight - b.weight || collator.compare(a.to, b.to); }
    }[order];

    if (compare) adj.forEach(function (list) { list.sort(compare); });

    return {
      nodes: nodes,
      edges: kept,
      directed: directed,
      neighborOrder: order,
      warnings: warnings,

      neighbors: function (node) { return adj.get(node) || []; },
      has: function (node) { return adj.has(node); },

      /** Anzahl der Zusammenhangskomponenten (Kantenrichtung ignoriert). */
      componentCount: function () {
        var undirected = new Map();
        nodes.forEach(function (n) { undirected.set(n, []); });
        kept.forEach(function (e) {
          undirected.get(e.from).push(e.to);
          undirected.get(e.to).push(e.from);
        });

        var visited = new Set();
        var count = 0;
        nodes.forEach(function (start) {
          if (visited.has(start)) return;
          count++;
          var stack = [start];
          visited.add(start);
          while (stack.length) {
            undirected.get(stack.pop()).forEach(function (to) {
              if (!visited.has(to)) { visited.add(to); stack.push(to); }
            });
          }
        });
        return count;
      }
    };
  };

})(window.ISA);
