/* --------------------------------------------------------------------------
   Stilangaben für die Zeichenflächen.

   Diese liegen bewusst als JS-Zeichenkette vor und nicht in style.css:
   sie werden beim Start in das Dokument eingehängt UND beim Export in die
   erzeugte SVG-Datei kopiert. So sieht ein exportiertes Bild exakt so aus
   wie auf dem Bildschirm, ohne dass die Regeln doppelt gepflegt werden.

   Die Farben sind fest (nicht themenabhängig): Graph und Suchbaum sollen
   wie ein Whiteboard wirken und direkt in Arbeitsblätter passen.
   -------------------------------------------------------------------------- */
window.ISA = window.ISA || {};

ISA.svgStyles = [
  '.isa-svg{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;user-select:none}',
  '.isa-paper{fill:#fdfdfc}',

  /* ---- Kanten ---- */
  '.isa-edge{stroke:#b6bcc9;stroke-width:2;fill:none;stroke-linecap:round}',
  '.isa-edge.is-current{stroke:#3d5afe;stroke-width:4}',
  '.isa-edge.is-new{stroke:#1b8a4b;stroke-width:3;stroke-dasharray:6 4}',
  '.isa-edge.is-cycle{stroke:#a86400;stroke-width:2.5;stroke-dasharray:2 4}',
  '.isa-halo{stroke:#f7cf5e;stroke-width:11;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.85}',
  '.isa-arrow{fill:#b6bcc9}',
  '.isa-arrow.is-current{fill:#3d5afe}',

  /* ---- Kantengewichte ---- */
  '.isa-weight{fill:#4d5568;font-size:11px;font-weight:600;text-anchor:middle;dominant-baseline:central}',
  '.isa-weight-bg{fill:#fdfdfc;stroke:#fdfdfc;stroke-width:3}',
  '.isa-weight.is-current{fill:#2c40c4;font-weight:700}',

  /* ---- Knoten im Graphen ---- */
  '.isa-node .body{fill:#ffffff;stroke:#8b92a3;stroke-width:2}',
  '.isa-node text.label{fill:#1c2029;font-size:13px;font-weight:700;text-anchor:middle;dominant-baseline:central}',
  '.isa-node.is-expanded .body{fill:#eceff5}',
  '.isa-node.is-frontier .body{stroke:#1b8a4b;stroke-width:2.5;stroke-dasharray:5 3}',
  '.isa-node.is-path .body{fill:#dde3ff;stroke:#3d5afe;stroke-width:2.5;stroke-dasharray:none}',
  '.isa-node.is-current .body{fill:#3d5afe;stroke:#1e2c8c;stroke-width:3;stroke-dasharray:none}',
  '.isa-node.is-current text.label{fill:#ffffff}',
  '.isa-node{cursor:grab}',

  /* ---- Start-/Zielmarkierung ---- */
  '.isa-marker{fill:none;stroke-width:2}',
  '.isa-marker.start{stroke:#1b8a4b;stroke-dasharray:4 3}',
  '.isa-marker.goal{stroke:#c0362c}',
  '.isa-badge{font-size:9.5px;font-weight:800;text-anchor:middle;dominant-baseline:central}',
  '.isa-badge.start{fill:#1b8a4b}',
  '.isa-badge.goal{fill:#c0362c}',

  /* ---- Knoten im Suchbaum ---- */
  '.isa-tn .body{fill:#ffffff;stroke:#8b92a3;stroke-width:2}',
  '.isa-tn text.label{fill:#1c2029;font-size:12px;font-weight:700;text-anchor:middle;dominant-baseline:central}',
  '.isa-tn.is-frontier .body{stroke:#1b8a4b;stroke-width:2.5;stroke-dasharray:5 3}',
  '.isa-tn.is-expanded .body{fill:#eceff5}',
  '.isa-tn.is-current .body{fill:#3d5afe;stroke:#1e2c8c;stroke-width:3;stroke-dasharray:none}',
  '.isa-tn.is-current text.label{fill:#ffffff}',
  '.isa-tn.is-cycle .body{fill:#fdf2dd;stroke:#a86400;stroke-width:2;stroke-dasharray:3 3}',
  '.isa-tn.is-cycle text.label{fill:#a86400}',
  '.isa-tn.is-goal .body{fill:#d5f0e2;stroke:#1b8a4b;stroke-width:3;stroke-dasharray:none}',
  '.isa-tn-cost{fill:#4d5568;font-size:9.5px;font-weight:600;text-anchor:middle;dominant-baseline:central}',
  '.isa-cross{stroke:#a86400;stroke-width:1.8;stroke-linecap:round}',

  /* ---- Hinweise auf der Fläche ---- */
  '.isa-hint{fill:#8b92a3;font-size:12px;text-anchor:middle;dominant-baseline:central}'
].join('\n');

(function injectStyles() {
  var el = document.createElement('style');
  el.id = 'isa-svg-styles';
  el.textContent = ISA.svgStyles;
  document.head.appendChild(el);
})();
