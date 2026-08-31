# Suchverfahren visualisieren

Ein Werkzeug für den Unterricht: Breitensuche und Tiefensuche Schritt für Schritt
auf einem selbst eingegebenen Graphen – gleichzeitig im Graphen, im Suchbaum und
als lesbares Protokoll.

## Starten

`index.html` im Browser öffnen. Ein Server wird nicht gebraucht (kein Build, keine
Abhängigkeiten, keine ES-Module) – ein Doppelklick genügt, auch vom USB-Stick.

## Bedienung

1. **Graph** – Kantenliste eingeben, entweder in Python-Notation
   `[('A','B',5), ('A','C',3)]` oder eine Kante je Zeile (`A B 5`).
   Das Gewicht ist optional (Standard 1). `#` leitet einen Kommentar ein.
2. **Suche** – Start- und Zielknoten wählen, Verfahren wählen, Suche starten.
3. Mit den Schrittknöpfen, der Zeitleiste oder `→`/`←` durch die Suche gehen.
   `Leertaste` spielt ab, `Pos1`/`Ende` springen an den Anfang bzw. ans Ende.

Der Knopf **Vergleich** zeigt Breiten- und Tiefensuche nebeneinander, synchron
gesteuert. **Beamer** blendet die Eingabe aus und vergrößert die Schrift.
**Zyklen aus** im Kopf des Suchbaums blendet die verworfenen Zyklen aus – sie fallen
dann auch aus der Anordnung, der Baum wird also wirklich schmaler und nicht bloß
lückenhaft. An der Suche ändert das nichts: Zähler und Protokoll führen die
verworfenen Zyklen weiter mit.
Jede Zeichnung lässt sich als SVG oder PNG speichern, das Protokoll als Markdown.
**Link kopieren** legt den kompletten Aufbau in die Adresse – praktisch für
Arbeitsaufträge und QR-Codes.

## Wie gesucht wird

Die Frontier enthält **ganze Pfade**, nicht einzelne Knoten. In jedem Schritt wird
ein Pfad entnommen, auf das Ziel geprüft und – falls er nicht am Ziel endet – um
alle Nachbarn seines letzten Knotens verlängert. Verlängerungen, die einen Knoten
des Pfades wiederholen, sind Zyklen und werden verworfen; im Suchbaum erscheinen
sie als durchgestrichener Ast.

Damit ist der Suchbaum nicht nachträglich gezeichnet, sondern **ist** die
Datenstruktur, und „beste bisher gefundene Lösung“ ergibt sich von selbst.

Breiten- und Tiefensuche unterscheiden sich nur in der Entnahme:
Warteschlange (vorne, FIFO) gegen Stapel (hinten, LIFO).

### Zwei Punkte, die im Unterricht regelmäßig auffallen

* **Kürzester ≠ günstigster Weg.** Die Breitensuche findet den Weg mit den
  wenigsten Kanten, nicht den mit den geringsten Kosten. Mit der Einstellung
  „alle Pfade durchsuchen“ stehen beide Ergebnisse nebeneinander. Das Beispiel
  *BFS-Falle* führt genau darauf hin.
* **Die Reihenfolge der Nachbarn entscheidet.** Sie ist deshalb einstellbar
  (alphabetisch / Eingabereihenfolge / nach Gewicht) und wird in der Kopfzeile
  jeder Ansicht angezeigt. Zusätzlich lässt sich einstellen, ob die Tiefensuche
  die Nachbarn umgekehrt auf den Stapel legt – nur dann erkundet sie den in der
  Reihenfolge ersten Nachbarn zuerst, so wie man einen Suchbaum von Hand zeichnet.

## Aufbau des Codes

| Datei | Aufgabe |
| --- | --- |
| `js/parser.js` | Kantenliste lesen, Syntaxfehler melden |
| `js/graph.js` | Graph aufbauen, Nachbarreihenfolge festlegen |
| `js/search.js` | Suchverfahren; berechnet **alle** Schritte im Voraus |
| `js/layout.js` | Anordnung von Graph (Kreis/Kräfte) und Suchbaum |
| `js/render.js` | SVG-Ausgabe von Graph und Suchbaum, Export |
| `js/view.js` | Eine Ansicht: Zeichnungen, Schrittinfos, Protokoll |
| `js/app.js` | Oberfläche, Zustand, Abspielsteuerung |
| `js/svg-style.js` | Stil der Zeichenflächen (auch für den Export) |

`parser.js`, `graph.js` und `search.js` fassen das DOM nicht an und lassen sich
darum unabhängig von der Oberfläche prüfen.

Weil alle Schritte vorab berechnet werden, sind Zurückspringen, Zeitleiste,
Vergleichsansicht und Export ohne Zusatzaufwand möglich.

### Erweitern

Breiten- und Tiefensuche unterscheiden sich in `search.js` nur darin, an welchem
Ende der Frontier entnommen wird. Verfahren wie Uniform-Cost-Suche (Dijkstra),
Greedy-Suche oder A\* setzen an derselben Stelle an: sie wählen den nächsten Pfad
nach einem Schlüssel statt nach der Position. Alles andere – Suchbaum, Protokoll,
Zeitleiste, Vergleich – bleibt unverändert.

## Entwicklung

`.claude/launch.json` startet bei Bedarf einen lokalen Server
(`python3 -m http.server 8777`). Für den normalen Gebrauch ist er nicht nötig.
