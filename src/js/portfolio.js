(function () {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Typed terminal intro
  var SCRIPT = [
    { cmd: "whoami", out: "" },
    { cmd: null, html: "h1" },
    { cmd: "cat role.txt", out: "IT Administrator · Network Architect · Linux · Salesforce / Apex · C++ Game Dev" },
    { cmd: "ls ~/open-source | wc -l", out: "free & open source projects, published on GitHub" },
    { cmd: "./status.sh", out: "[ OK ] all systems nominal" },
  ];

  function runTerminal() {
    var term = document.getElementById("term");
    term.textContent = "";
    var reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    var cursor = el("span", "cursor");
    cursor.setAttribute("aria-hidden", "true");

    function promptLine(cmd) {
      var l = el("span", "ln");
      l.appendChild(el("span", "prompt", "gavin"));
      l.appendChild(el("span", "dim", "@"));
      l.appendChild(el("span", "path", "portfolio"));
      l.appendChild(el("span", "dim", ":~$ "));
      var t = el("span", "out");
      l.appendChild(t);
      term.appendChild(l);
      return { line: l, text: t, cmd: cmd };
    }

    function outLine(text, cls) {
      var o = el("span", "ln " + (cls || "out"));
      term.appendChild(o);
      return o;
    }

    function finalName() {
      var h = el("h1");
      h.appendChild(document.createTextNode("Gavin "));
      h.appendChild(el("em", null, "Norwood"));
      term.appendChild(h);
    }

    var i = 0;
    function step() {
      if (i >= SCRIPT.length) {
        var last = promptLine("");
        last.line.appendChild(cursor);
        return;
      }
      var s = SCRIPT[i++];
      if (!s.cmd) {
        finalName();
        return step();
      }
      var p = promptLine(s.cmd);
      var n = 0;
      function type() {
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        p.text.textContent = s.cmd.slice(0, n);
        p.line.appendChild(cursor);
        if (n < s.cmd.length) {
          n++;
          setTimeout(type, reduce ? 0 : 38);
        } else {
          setTimeout(function () {
            if (s.out) {
              var cls = s.out.indexOf("[ OK ]") === 0 ? "ok" : "out";
              outLine(s.out, cls).textContent = s.out;
            }
            step();
          }, reduce ? 0 : 220);
        }
      }
      type();
    }
    step();
  }

  document.getElementById("yr").textContent = new Date().getFullYear();
  runTerminal();
})();
