/* --------------------------------------------------------------------------
   Parser für Kantenlisten.

   Zwei Schreibweisen werden akzeptiert:
     1) Tupel-Notation   beispielgraph = [('A','B',5), ('A','C',3)]
     2) Zeilen-Notation  A B 5     bzw.    A,B,5      (# leitet Kommentare ein)

   Der Parser prüft ausschließlich die Syntax. Ob eine Kante inhaltlich
   sinnvoll ist (Schlingen, Doppelkanten), hängt davon ab, ob der Graph
   gerichtet ist - das entscheidet erst graph.js.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

(function (ISA) {
  'use strict';

  var QUOTED = /^(['"])([\s\S]*)\1$/;

  function stripQuotes(s) {
    var m = QUOTED.exec(s);
    return m ? m[2].trim() : s;
  }

  function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
  }

  /* Ein Rohtripel in eine Kante umwandeln; erzeugt bei Bedarf Fehlermeldungen. */
  function makeEdge(parts, line, result) {
    var from = stripQuotes(parts[0]);
    var to = stripQuotes(parts[1]);

    if (!from || !to) {
      result.errors.push({ line: line, message: 'Zeile ' + line + ': Ein Knotenname fehlt.' });
      return null;
    }

    var weight = 1;
    if (parts.length === 3) {
      var raw = stripQuotes(parts[2]);
      weight = Number(raw);
      if (raw === '' || !isFinite(weight)) {
        result.errors.push({
          line: line,
          message: 'Zeile ' + line + ': "' + raw + '" ist keine gültige Zahl als Kantengewicht.'
        });
        return null;
      }
    }

    return { from: from, to: to, weight: weight, line: line };
  }

  function parseTuples(text, result) {
    var re = /\(([^()]*)\)/g;
    var m;

    while ((m = re.exec(text)) !== null) {
      var line = lineOf(text, m.index);
      var parts = m[1].split(',').map(function (s) { return s.trim(); });

      // abschließendes Komma erlauben: ('A','B',5,)
      while (parts.length && parts[parts.length - 1] === '') parts.pop();

      if (parts.length < 2 || parts.length > 3) {
        result.errors.push({
          line: line,
          message: 'Zeile ' + line + ': (' + m[1].trim() + ') hat ' + parts.length +
                   ' Einträge. Erwartet werden 2 (ohne Gewicht) oder 3.'
        });
        continue;
      }

      var edge = makeEdge(parts, line, result);
      if (edge) result.edges.push(edge);
    }

    if (result.edges.length === 0 && result.errors.length === 0) {
      result.errors.push({ message: "Es wurde kein Tupel der Form ('A','B',5) gefunden." });
    }

    // Text, der außerhalb der Tupel steht und keine Zuweisung/Klammer ist
    var rest = text
      .replace(/\([^()]*\)/g, ' ')
      .replace(/^\s*[A-Za-z_][A-Za-z0-9_äöüÄÖÜß]*\s*=/, ' ')
      .replace(/[[\]\s,;]/g, '');

    if (rest) {
      result.warnings.push('Der Text "' + rest.slice(0, 40) + '" steht außerhalb der Klammern und wurde ignoriert.');
    }
  }

  function parseLines(text, result) {
    text.split('\n').forEach(function (raw, i) {
      var line = i + 1;
      var clean = raw.replace(/(#|\/\/).*$/, '').trim();
      if (!clean) return;

      if (/[[\]=]/.test(clean)) {
        result.errors.push({
          line: line,
          message: 'Zeile ' + line + ': Klammern oder "=" ohne Tupel - bitte entweder ' +
                   "[('A','B',5)] oder eine Kante je Zeile (A B 5) schreiben."
        });
        return;
      }

      var parts = clean.split(/[\s,;]+/).filter(Boolean);
      if (parts.length < 2 || parts.length > 3) {
        result.errors.push({
          line: line,
          message: 'Zeile ' + line + ': "' + clean + '" hat ' + parts.length +
                   ' Angaben. Erwartet: Von Nach [Gewicht].'
        });
        return;
      }

      var edge = makeEdge(parts, line, result);
      if (edge) result.edges.push(edge);
    });

    if (result.edges.length === 0 && result.errors.length === 0) {
      result.errors.push({ message: 'Es wurde keine Kante gefunden.' });
    }
  }

  /**
   * @param {string} text Eingabe des Nutzers
   * @returns {{edges: Array, errors: Array, warnings: Array}}
   */
  ISA.parseEdgeList = function parseEdgeList(text) {
    var src = String(text == null ? '' : text);
    var result = { edges: [], errors: [], warnings: [] };

    if (!src.trim()) {
      result.errors.push({ message: 'Die Kantenliste ist leer.' });
      return result;
    }

    if (src.indexOf('(') !== -1) parseTuples(src, result);
    else parseLines(src, result);

    return result;
  };

  /** Kanten zurück in die Tupel-Notation schreiben (für Beispiele und Export). */
  ISA.formatEdgeList = function formatEdgeList(edges) {
    return '[' + edges.map(function (e) {
      return "('" + e.from + "', '" + e.to + "', " + e.weight + ')';
    }).join(', ') + ']';
  };

})(window.ISA);
