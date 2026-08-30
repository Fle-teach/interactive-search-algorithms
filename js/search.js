/* --------------------------------------------------------------------------
   Kern: pfadbasierte Breiten- und Tiefensuche.

   Grundidee (Variante "Baumsuche"):
   Die Frontier enthält nicht einzelne Knoten, sondern ganze PFADE. In jedem
   Schritt wird ein Pfad entnommen, auf das Ziel geprüft und - falls er nicht
   am Ziel endet - um alle Nachbarn seines letzten Knotens verlängert.
   Verlängerungen, die einen Knoten des Pfades wiederholen, sind Zyklen und
   werden verworfen (sie erscheinen im Suchbaum als abgeschnittener Ast).

   Damit ist der Suchbaum kein nachträglich gezeichnetes Bild, sondern die
   Datenstruktur selbst, und "beste bisher gefundene Lösung" ergibt sich
   von allein.

   Breitensuche und Tiefensuche unterscheiden sich hier NUR in der Entnahme:
     - Breitensuche: vorne  (Warteschlange, FIFO)
     - Tiefensuche:  hinten (Stapel, LIFO)

   Es werden alle Schritte im Voraus berechnet und als unveränderliche
   Momentaufnahmen abgelegt. Dadurch sind Zurückspringen, Zeitleiste,
   Vergleichsansicht und Export ohne Zusatzaufwand möglich.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

(function (ISA) {
  'use strict';

  var numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  ISA.fmt = function (n) { return numberFormat.format(n); };

  ISA.pathText = function (nodes) { return nodes.join(' → '); };

  var ALGORITHMS = {
    bfs: { name: 'Breitensuche', short: 'BFS', store: 'Warteschlange', takeFrom: 'vorne' },
    dfs: { name: 'Tiefensuche', short: 'DFS', store: 'Stapel', takeFrom: 'hinten' }
  };

  ISA.ALGORITHMS = ALGORITHMS;

  /**
   * @param {object} graph  Ergebnis von ISA.buildGraph
   * @param {string} start
   * @param {string} goal
   * @param {{algorithm:'bfs'|'dfs', stopAtFirst?:boolean, dfsReverse?:boolean, maxSteps?:number}} options
   */
  ISA.runSearch = function runSearch(graph, start, goal, options) {
    var opts = options || {};
    var algorithm = opts.algorithm === 'dfs' ? 'dfs' : 'bfs';
    var meta = ALGORITHMS[algorithm];
    var stopAtFirst = opts.stopAtFirst !== false;
    var dfsReverse = opts.dfsReverse !== false;
    var maxSteps = opts.maxSteps || 4000;
    var takeFromFront = algorithm === 'bfs';

    var paths = [];   // id -> { nodes, cost, ... }
    var tree = [];    // id -> Knoten des Suchbaums (gleiche Indizes wie paths)
    var steps = [];
    var stepIndex = 0;

    function createPath(nodes, cost, parentId, edgeWeight) {
      var id = paths.length;
      var path = {
        id: id,
        nodes: nodes,
        node: nodes[nodes.length - 1],
        cost: cost,
        parentId: parentId,
        depth: nodes.length - 1
      };
      paths.push(path);
      tree.push({
        id: id,
        parentId: parentId,
        label: path.node,
        cost: cost,
        depth: path.depth,
        edgeWeight: edgeWeight,
        createdAtStep: stepIndex,
        expandedAtStep: null,
        goalAtStep: null,
        pruned: null
      });
      return path;
    }

    var stats = { expanded: 0, generated: 1, pruned: 0, maxFrontier: 1, solutions: 0 };
    var best = null;
    var firstSolution = null;

    var root = createPath([start], 0, null, null);
    var frontier = [root.id];

    steps.push({
      index: 0,
      number: 0,
      kind: 'init',
      currentId: null,
      isGoal: false,
      successors: [],
      frontierBefore: [],
      frontierAfter: [root.id],
      best: null,
      bestChanged: false,
      firstSolution: null,
      stats: Object.assign({}, stats),
      text: 'Initialisierung: Die Frontier (' + meta.store + ') enthält nur den Startpfad ' +
            start + ' mit Kosten 0.'
    });

    var aborted = false;
    var doneReason = '';

    while (frontier.length) {
      if (steps.length > maxSteps) {
        aborted = true;
        doneReason = 'Abbruch: Das Limit von ' + ISA.fmt(maxSteps) + ' Schritten ist erreicht. ' +
                     'Bei diesem Graphen gibt es sehr viele Pfade - probiere "beim ersten Zielfund anhalten" ' +
                     'oder einen kleineren Graphen.';
        break;
      }

      stepIndex = steps.length;
      var frontierBefore = frontier.slice();
      var currentId = takeFromFront ? frontier.shift() : frontier.pop();
      var current = paths[currentId];

      stats.expanded++;
      tree[currentId].expandedAtStep = stepIndex;

      var isGoal = current.node === goal;
      var successors = [];
      var bestChanged = false;
      var sentences = [];

      sentences.push(
        'Entnehme ' + ISA.pathText(current.nodes) + ' (Kosten ' + ISA.fmt(current.cost) + ') ' +
        (takeFromFront ? 'vom Anfang der Warteschlange' : 'vom oberen Ende des Stapels') + '.'
      );

      if (isGoal) {
        tree[currentId].goalAtStep = stepIndex;
        stats.solutions++;
        var solution = { id: currentId, nodes: current.nodes.slice(), cost: current.cost, step: stepIndex };
        if (!firstSolution) firstSolution = solution;

        if (!best || current.cost < best.cost) {
          best = solution;
          bestChanged = true;
        }

        sentences.push('Zieltest: ' + goal + ' ist erreicht - Lösung mit Kosten ' + ISA.fmt(current.cost) + '.');
        sentences.push(bestChanged
          ? 'Das ist die beste bisher gefundene Lösung.'
          : 'Die bisher beste Lösung (Kosten ' + ISA.fmt(best.cost) + ') bleibt besser.');
        // Ein Zielpfad wird nicht weiter verlängert.
      } else {
        sentences.push('Zieltest: ' + current.node + ' ist nicht das Ziel ' + goal + '.');

        var neighbours = graph.neighbors(current.node);
        var created = [];

        neighbours.forEach(function (n) {
          var isCycle = current.nodes.indexOf(n.to) !== -1;
          var child = createPath(current.nodes.concat(n.to), current.cost + n.weight, currentId, n.weight);

          if (isCycle) {
            tree[child.id].pruned = 'zyklus';
            stats.pruned++;
          } else {
            stats.generated++;
          }
          created.push({
            id: child.id,
            node: n.to,
            weight: n.weight,
            cost: child.cost,
            nodes: child.nodes,
            status: isCycle ? 'zyklus' : 'neu'
          });
        });

        successors = created;

        var fresh = created.filter(function (c) { return c.status === 'neu'; });
        var cycles = created.length - fresh.length;

        // Beide Verfahren hängen hinten an; nur die Entnahmeseite unterscheidet sich.
        // Beim Stapel wird optional umgekehrt eingefügt, damit der in der
        // Nachbarreihenfolge erste Knoten oben liegt und zuerst erkundet wird.
        var insertion = fresh.slice();
        if (algorithm === 'dfs' && dfsReverse) insertion.reverse();
        insertion.forEach(function (c) { frontier.push(c.id); });

        if (!created.length) {
          sentences.push('Expandiere ' + current.node + ': keine Nachbarn - Sackgasse.');
        } else {
          sentences.push(
            'Expandiere ' + current.node + ': ' +
            (fresh.length === 0 ? 'keine neuen Pfade' : fresh.length === 1 ? '1 neuer Pfad' : ISA.fmt(fresh.length) + ' neue Pfade') +
            (cycles ? ', ' + ISA.fmt(cycles) + (cycles === 1 ? ' Zyklus' : ' Zyklen') + ' verworfen' : '') +
            '.'
          );
        }
        if (insertion.length) {
          sentences.push('Die neuen Pfade werden hinten angefügt' +
            (algorithm === 'dfs' && dfsReverse && insertion.length > 1 ? ' (umgekehrte Reihenfolge)' : '') + '.');
        }
      }

      if (frontier.length > stats.maxFrontier) stats.maxFrontier = frontier.length;

      steps.push({
        index: stepIndex,
        number: stats.expanded,
        kind: 'expand',
        currentId: currentId,
        isGoal: isGoal,
        successors: successors,
        frontierBefore: frontierBefore,
        frontierAfter: frontier.slice(),
        best: best,
        bestChanged: bestChanged,
        firstSolution: firstSolution,
        stats: Object.assign({}, stats),
        text: sentences.join(' ')
      });

      if (isGoal && stopAtFirst) {
        doneReason = 'Fertig: Das Ziel wurde erreicht, die Suche hält beim ersten Zielfund an.';
        break;
      }
    }

    if (!doneReason) {
      doneReason = best
        ? 'Fertig: Die Frontier ist leer. Alle Pfade wurden untersucht, die beste Lösung kostet ' +
          ISA.fmt(best.cost) + '.'
        : 'Fertig: Die Frontier ist leer und es wurde kein Pfad zum Ziel ' + goal + ' gefunden.';
    }

    steps.push({
      index: steps.length,
      number: stats.expanded,
      kind: 'done',
      currentId: null,
      isGoal: false,
      successors: [],
      frontierBefore: frontier.slice(),
      frontierAfter: frontier.slice(),
      best: best,
      bestChanged: false,
      firstSolution: firstSolution,
      stats: Object.assign({}, stats),
      text: doneReason
    });

    return {
      algorithm: algorithm,
      meta: meta,
      graph: graph,
      start: start,
      goal: goal,
      options: { stopAtFirst: stopAtFirst, dfsReverse: dfsReverse },
      paths: paths,
      tree: tree,
      steps: steps,
      best: best,
      firstSolution: firstSolution,
      stats: stats,
      aborted: aborted
    };
  };

  /**
   * Zustand eines Suchbaumknotens zum Zeitpunkt eines Schrittes.
   * Wird nicht gespeichert, sondern aus den wenigen Zeitstempeln abgeleitet.
   */
  ISA.treeNodeState = function (node, stepIndex, currentId) {
    if (node.createdAtStep > stepIndex) return 'hidden';
    if (node.id === currentId) return 'current';
    if (node.pruned) return 'cycle';
    if (node.goalAtStep !== null && node.goalAtStep <= stepIndex) return 'goal';
    if (node.expandedAtStep !== null && node.expandedAtStep <= stepIndex) return 'expanded';
    return 'frontier';
  };

})(window.ISA);
