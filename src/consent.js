// Cookie consent + analytics loader, shared by every page.
//
// Microsoft Clarity (analytics / session replay, sets third-party cookies) is
// only loaded after the visitor clicks Accept. A browser Global Privacy
// Control or Do Not Track signal counts as Decline and shows no banner.
// The choice is kept in localStorage; any element with [data-cookie-settings]
// reopens the banner so it can be changed later.
(function () {
  var KEY = "wh-consent";
  var CLARITY_ID = "r99n3cjmzk";

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function write(value) {
    try {
      localStorage.setItem(KEY, value);
    } catch (e) {
      /* storage unavailable: the choice just won't persist */
    }
  }

  function optedOutBySignal() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  }

  function loadClarity() {
    if (window.__clarityLoaded) return;
    window.__clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
  }

  function revokeClarity() {
    if (typeof window.clarity === "function") {
      window.clarity("consent", false); // clears Clarity's cookies
    }
  }

  var banner = null;

  function closeBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function choose(value) {
    write(value);
    closeBanner();
    if (value === "granted") loadClarity();
    else revokeClarity();
  }

  function addStyles() {
    if (document.getElementById("wh-consent-style")) return;
    var s = document.createElement("style");
    s.id = "wh-consent-style";
    s.textContent =
      ".wh-consent{position:fixed;left:1rem;bottom:1rem;z-index:2147483000;max-width:26rem;" +
      "background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,.35);border-radius:10px;" +
      "padding:1rem 1.1rem;box-shadow:0 10px 40px rgba(0,0,0,.5);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
      ".wh-consent p{margin:0 0 .8rem}.wh-consent a{color:#7dd3fc;text-decoration:underline}" +
      ".wh-consent-actions{display:flex;gap:.6rem;flex-wrap:wrap}" +
      ".wh-consent button{font:inherit;font-weight:600;border-radius:6px;padding:.5rem 1rem;cursor:pointer;" +
      "border:1px solid #38bdf8;background:#38bdf8;color:#04121f}" +
      ".wh-consent button.wh-secondary{background:transparent;color:#e2e8f0;border-color:rgba(148,163,184,.6)}" +
      ".wh-consent button:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}" +
      "@media(max-width:520px){.wh-consent{left:.5rem;right:.5rem;bottom:.5rem;max-width:none}}";
    document.head.appendChild(s);
  }

  function showBanner() {
    if (banner) return;
    addStyles();
    banner = document.createElement("div");
    banner.className = "wh-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie preferences");

    var p = document.createElement("p");
    p.appendChild(
      document.createTextNode(
        "We use Microsoft Clarity analytics (cookies) to see how visitors use the site. It only runs if you accept. ",
      ),
    );
    var link = document.createElement("a");
    link.href = "privacy.html";
    link.textContent = "Privacy policy";
    p.appendChild(link);
    banner.appendChild(p);

    var actions = document.createElement("div");
    actions.className = "wh-consent-actions";
    var accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept analytics";
    accept.addEventListener("click", function () {
      choose("granted");
    });
    var decline = document.createElement("button");
    decline.type = "button";
    decline.className = "wh-secondary";
    decline.textContent = "Decline";
    decline.addEventListener("click", function () {
      choose("denied");
    });
    actions.appendChild(accept);
    actions.appendChild(decline);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-cookie-settings]");
    if (t) {
      e.preventDefault();
      showBanner();
    }
  });

  function init() {
    var saved = read();
    if (saved === "granted") {
      loadClarity();
    } else if (saved !== "denied" && !optedOutBySignal()) {
      showBanner();
    }
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
