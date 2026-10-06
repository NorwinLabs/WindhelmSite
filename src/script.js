/* --- Page scripts (moved from index.html) --- */
// Smooth scroll - no pop-in animations
document.addEventListener("DOMContentLoaded", function () {
  // Sections are now always visible for smoother experience
  const animatedSections = document.querySelectorAll(".section-animate");
  animatedSections.forEach((section) => {
    section.classList.add("visible");
  });
});
// Dynamically update copyright year
document.getElementById("copyright-year").textContent =
  new Date().getFullYear();

// Dynamically update demo update date (last day of current quarter)
(function () {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  let quarter;
  if (month <= 2) quarter = 1;
  else if (month <= 5) quarter = 2;
  else if (month <= 8) quarter = 3;
  else quarter = 4;

  // Last day of each quarter: Mar 31, Jun 30, Sep 30, Dec 31
  const quarterEndDates = {
    1: { month: 2, day: 31 },
    2: { month: 5, day: 30 },
    3: { month: 8, day: 30 },
    4: { month: 11, day: 31 },
  };

  const end = quarterEndDates[quarter];
  const quarterEnd = new Date(year, end.month, end.day);
  const formattedDate = quarterEnd.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const releaseDateElement = document.getElementById("release-date");
  if (releaseDateElement) {
    releaseDateElement.textContent = `Demo Update Coming End of Q${quarter} ${year} — ${formattedDate}`;
  }
})();

// Fetch and display site version
(async function () {
  try {
    const response = await fetch("version.json");
    const data = await response.json();
    const versionElement = document.getElementById("site-version");
    if (versionElement && data.version) {
      versionElement.textContent = `v${data.version}`;
      versionElement.title = `Build ${data.build} - Last updated ${new Date(data.lastUpdated).toLocaleString()}`;
    }
  } catch (error) {
    
  }
})();
// Hero background video — shuffled playlist, starts as soon as the page loads.
// Only skipped when the browser's Data Saver mode is on.
(function () {
  var HERO_VIDEOS = ["media/BGVideo.mp4", "media/HeroVideoWorld.mp4"];
  var video = document.getElementById("hero-video");
  if (!video) return;

  var conn =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && conn.saveData) return;

  // Shuffled playlist: every video plays once per round, and the first video
  // of a new round is never the one that just played.
  var queue = [];
  var last = null;
  function nextVideo() {
    if (!queue.length) {
      queue = HERO_VIDEOS.slice();
      for (var i = queue.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = queue[i];
        queue[i] = queue[j];
        queue[j] = t;
      }
      if (queue.length > 1 && queue[0] === last) queue.push(queue.shift());
    }
    last = queue.shift();
    return last;
  }

  video.src = nextVideo();
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.loop = HERO_VIDEOS.length < 2;
  video.preload = "auto";
  video.load();

  function tryPlay() {
    var p = video.play();
    if (p !== undefined) {
      p.catch(function () {
        // Autoplay blocked: retry once on the first user interaction.
        ["click", "touchstart", "keydown"].forEach(function (evt) {
          document.addEventListener(
            evt,
            function () {
              video.play().catch(function () {});
            },
            { once: true, passive: true },
          );
        });
      });
    }
  }

  video.addEventListener("ended", function () {
    video.src = nextVideo();
    video.play().catch(function () {});
  });

  tryPlay();
})();

// Removed delayed font loading to avoid FOUT/pop

// Image loading optimization
function optimizeImages() {
  // Preload visible images
  const images = document.querySelectorAll('img[loading="lazy"]');
  const imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.complete) {
            img.style.opacity = "1";
          } else {
            img.onload = function () {
              this.style.opacity = "1";
            };
          }

          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: "50px",
    },
  );

  images.forEach((img) => imageObserver.observe(img));

  // Prefetch next section images on scroll
  let prefetched = new Set();
  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Prefetch team images when halfway down
    if (scrolled > documentHeight * 0.5 && !prefetched.has("team")) {
      const teamImages = ["media/Gavin1.jpg", "media/Kirstenjpg1.jpg"];
      teamImages.forEach((src) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = src;
        document.head.appendChild(link);
      });
      prefetched.add("team");
    }
  });
}

// Initialize image optimization
if ("IntersectionObserver" in window) {
  document.addEventListener("DOMContentLoaded", optimizeImages);
}
// ===== MOBILE NAVIGATION =====
const navToggle = document.getElementById("nav-toggle");
const navMenu = document.getElementById("nav-menu");
const navOverlay = document.getElementById("nav-overlay");

function closeMobileMenu() {
  if (navToggle) navToggle.classList.remove("active");
  if (navMenu) navMenu.classList.remove("active");
  if (navOverlay) navOverlay.classList.remove("active");
  if (navToggle) navToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", function () {
    const isOpening = !navMenu.classList.contains("active");
    navToggle.classList.toggle("active");
    navMenu.classList.toggle("active");
    if (navOverlay) navOverlay.classList.toggle("active");
    navToggle.setAttribute(
      "aria-expanded",
      navMenu.classList.contains("active"),
    );
    document.body.style.overflow =
      isOpening && window.innerWidth <= 768 ? "hidden" : "";
  });

  if (navOverlay) {
    navOverlay.addEventListener("click", closeMobileMenu);
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) closeMobileMenu();
  });
}

// ===== SWIPE TO CLOSE MOBILE NAV =====
(function () {
  var touchStartX = 0;
  var touchStartY = 0;
  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    function (e) {
      if (!navMenu || !navMenu.classList.contains("active")) return;
      var deltaX = e.changedTouches[0].screenX - touchStartX;
      var deltaY = Math.abs(e.changedTouches[0].screenY - touchStartY);
      // Swipe left (deltaX < -50) with mostly horizontal motion to close menu
      if (deltaX < -50 && deltaY < 100) {
        closeMobileMenu();
      }
    },
    { passive: true },
  );
})();

// ===== EXPANDABLE FEATURE CARDS =====
function initializeExpandableFeatures() {
  const featureCards = document.querySelectorAll(".feature-card-overlay");

  featureCards.forEach((card) => {
    card.addEventListener("click", function (e) {
      e.preventDefault();

      // Close other expanded cards first
      featureCards.forEach((otherCard) => {
        if (otherCard !== card && otherCard.classList.contains("expanded")) {
          otherCard.classList.remove("expanded");
          otherCard.setAttribute("aria-expanded", "false");
        }
      });

      // Toggle current card
      this.classList.toggle("expanded");
      this.setAttribute("aria-expanded", this.classList.contains("expanded"));

      // Add extra leaves when expanding
      if (this.classList.contains("expanded")) {
        const rect = this.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Create extra celebration leaves
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            createLeaf(centerX, centerY, true);
          }, i * 100);
        }
      }
    });

    // Keyboard support
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });

    // Accessibility
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-expanded", "false");

    const title = card.querySelector("h3");
    if (title) {
      card.setAttribute(
        "aria-label",
        `Expand details for ${title.textContent}`,
      );
    }
  });
}

// ===== SMOOTH SCROLLING =====
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// ===== ACTIVE NAVIGATION HIGHLIGHTING =====
function setActiveNav() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  let current = "";
  sections.forEach((section) => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    if (scrollY >= sectionTop - 200) {
      current = section.getAttribute("id");
    }
  });

  navLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("href") === "#" + current) {
      link.classList.add("active");
    }
  });
}

window.addEventListener("scroll", setActiveNav);

// ===== EMAIL TOGGLE =====
const toggleEmail = document.getElementById("toggle-email");
if (toggleEmail) {
  toggleEmail.addEventListener("click", function () {
    const collapse = document.getElementById("email-collapse");
    if (collapse) {
      collapse.style.display =
        collapse.style.display === "none" ? "block" : "none";
    }
  });
}

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", function () {
  
  initializeExpandableFeatures();
  setActiveNav();
  
});

// Initialize immediately if DOM already loaded
if (document.readyState !== "loading") {
  
  initializeExpandableFeatures();
  setActiveNav();
  
}

// ===== DISCORD WIDGET HANDLING =====
function handleDiscordLoad() {
  
  const loading = document.getElementById("discord-loading");
  const widget = document.getElementById("discord-widget");
  const fallback = document.getElementById("discord-fallback");

  if (loading) loading.style.display = "none";
  if (widget) widget.style.display = "block";
  if (fallback) fallback.style.display = "none";
}

function handleDiscordError() {
  
  const loading = document.getElementById("discord-loading");
  const widget = document.getElementById("discord-widget");
  const fallback = document.getElementById("discord-fallback");

  if (loading) loading.style.display = "none";
  if (widget) widget.style.display = "none";
  if (fallback) fallback.style.display = "flex";
}

// Timeout fallback in case iframe never triggers load/error events
setTimeout(() => {
  const loading = document.getElementById("discord-loading");
  const widget = document.getElementById("discord-widget");
  const fallback = document.getElementById("discord-fallback");

  if (loading && loading.style.display !== "none") {
    
    loading.style.display = "none";
    if (fallback) fallback.style.display = "flex";
  }
}, 10000); // 10 second timeout

// ===== STEAM UPDATES SYSTEM (Steam News API) =====
// The blog section's HTML is generated at build time by
// scripts/update-blog.js (see .github/workflows/update-blog.yml), which
// fetches the Steam News API server-side on a schedule — no browser CORS
// proxy or Cloudflare Worker involved, so there's nothing to load or fail
// here at runtime. The markup already in index.html is the content.

// ===== HERO SUBHEADER (Random, Pulsing) =====
(function initHeroSubheader() {
  const phrases = [
    "Every biome, every enemy, every choice matters",
    "Experience a true adventure",
    "Every step, we take forward",
    "Craft weapons and destinies",
    "From desert ruins to ancient forests",
    "Your ancestors wrought the world — now shape its future",
    "Dungeons uncharted. Enemies unknown.",
    "Ally with townsfolk — or not...",
    "The world of Windhelm does not forgive weakness",
    "Forge your legend in the fires of Windhelm",
    "A world of beauty, danger, and mystery awaits",
    "Discover hidden secrets and ancient lore",
    "Will you be a hero? Or something else entirely...",
  ];
  const el = document.getElementById("hero-subheader-text");
  if (!el) return;
  const idx = Math.floor(Math.random() * phrases.length);
  el.textContent = phrases[idx];
})();

(function () {
  const STEAM_APP_ID = "2171040";
  const CACHE_KEY = "gamalytic_stats_cache";
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  const wishlistElement = document.getElementById("wishlist-count");

  // Fetch game stats from Gamalytic API
  async function fetchGamalyticStats() {
    try {
      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { wishlistCount, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          animateWishlistValue(wishlistElement, 0, wishlistCount, 2000);
          return;
        }
      }

      // Using Gamalytic API to get game statistics
      const response = await fetch(
        `https://gamalytic.com/api/game/${STEAM_APP_ID}`,
      );
      const data = await response.json();

      if (data && data.appid) {
        // Gamalytic provides comprehensive game metrics including:
        // - wishlist: actual wishlist count
        // - followers: Steam followers
        // - reviews: review data
        // - players: player counts

        let wishlistCount = 1000; // Default fallback

        // Use the wishlist count directly if available
        if (data.wishlist && typeof data.wishlist === "number") {
          wishlistCount = data.wishlist;
        } else if (data.wishlists && typeof data.wishlists === "number") {
          wishlistCount = data.wishlists;
        } else if (data.followers && typeof data.followers === "number") {
          // Followers can be a good proxy for wishlists
          wishlistCount = data.followers;
        } else if (data.stats && data.stats.wishlist) {
          wishlistCount = data.stats.wishlist;
        }

        // Cache the result
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            wishlistCount: wishlistCount,
            timestamp: Date.now(),
          }),
        );

        if (wishlistElement) {
          wishlistElement.setAttribute("data-target", wishlistCount);
          wishlistElement.textContent = "0+";

          // Trigger animation
          setTimeout(() => {
            animateWishlistValue(wishlistElement, 0, wishlistCount, 2000);
          }, 500);
        }
      }
    } catch (error) {
      
      // Fallback to estimated value
      if (wishlistElement) {
        const fallbackValue = 1000;
        wishlistElement.setAttribute("data-target", fallbackValue);
        wishlistElement.textContent = fallbackValue.toLocaleString() + "+";
      }
    }
  }

  function animateWishlistValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        element.textContent = Math.floor(end).toLocaleString() + "+";
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current).toLocaleString() + "+";
      }
    }, 16);
  }

  // Fetch on page load (deferred for performance)
  if (wishlistElement) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => fetchGamalyticStats());
    } else {
      setTimeout(fetchGamalyticStats, 100);
    }
  }
})();
(function () {
  const observerOptions = {
    threshold: 0.5,
    rootMargin: "0px",
  };

  const animateValue = (element, start, end, duration, suffix = "") => {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        element.textContent = end + suffix;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current) + suffix;
      }
    }, 16);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const statValue = entry.target;
        const target = parseInt(statValue.getAttribute("data-target"));
        const text = statValue.textContent;
        const suffix = text.includes("%") ? "%" : text.includes("+") ? "+" : "";

        if (!statValue.classList.contains("animated")) {
          statValue.classList.add("animated");
          if (text.includes("∞")) {
            return;
          }
          animateValue(statValue, 0, target, 2000, suffix);
        }
      }
    });
  }, observerOptions);

  document.querySelectorAll(".stat-value").forEach((stat) => {
    observer.observe(stat);
  });
})();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        
      })
      .catch((err) => {
        
      });
  });
}
(function () {
  var btn = document.getElementById("back-to-top");
  var wishlistBtn = document.getElementById("sticky-wishlist");
  window.addEventListener(
    "scroll",
    function () {
      if (window.scrollY > 400) {
        btn.classList.add("visible");
        if (wishlistBtn) wishlistBtn.classList.add("visible");
      } else {
        btn.classList.remove("visible");
        if (wishlistBtn) wishlistBtn.classList.remove("visible");
      }
    },
    { passive: true },
  );
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
// ===== NEWSLETTER FORM =====
// Posts signups to Buttondown (https://buttondown.com/NorwinLabs). The host
// must stay in the connect-src list of the CSP meta tag in index.html.
(function () {
  const NEWSLETTER_ENDPOINT =
    "https://buttondown.com/api/emails/embed-subscribe/NorwinLabs";

  const form = document.getElementById("newsletter-form");
  const emailInput = document.getElementById("newsletter-email");
  const messageDiv = document.getElementById("newsletter-message");

  if (!(form && emailInput && messageDiv)) return;

  function show(text, ok) {
    messageDiv.style.display = "block";
    messageDiv.style.background = ok ? "#10b981" : "#ef4444";
    messageDiv.style.color = "white";
    messageDiv.textContent = text;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Subscribing...";
    submitBtn.disabled = true;

    try {
      const body = new URLSearchParams({ email: email, embed: "1" });
      // no-cors: the response is opaque, so a resolved request means it was
      // delivered; only network failures reject.
      await fetch(NEWSLETTER_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: body,
      });
      show("Thanks for subscribing! Check your email to confirm.", true);
      emailInput.value = "";
    } catch (err) {
      show("Something went wrong. Please try again in a moment.", false);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      setTimeout(function () {
        messageDiv.style.display = "none";
      }, 6000);
    }
  });
})();

// ===== MOBILE OPTIMIZATIONS =====
(function () {
  // Detect mobile device
  var isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  if (!isMobile) return;

  

  // 1. Prevent zoom on input focus for iOS
  var inputs = document.querySelectorAll("input, textarea, select");
  inputs.forEach(function (input) {
    input.addEventListener("focus", function () {
      if (parseFloat(window.getComputedStyle(this).fontSize) < 16) {
        this.style.fontSize = "16px";
      }
    });
  });

  // 2. Add touch feedback to interactive elements
  var touchElements = document.querySelectorAll(
    "button, .cta-button, .nav-link, .social-link, .feature-card, a[href]",
  );
  touchElements.forEach(function (el) {
    el.addEventListener(
      "touchstart",
      function () {
        this.style.opacity = "0.7";
      },
      { passive: true },
    );

    el.addEventListener(
      "touchend",
      function () {
        var self = this;
        setTimeout(function () {
          self.style.opacity = "";
        }, 100);
      },
      { passive: true },
    );
  });

  // 3. Optimize scroll performance
  var lastScrollTime = 0;
  var scrollThrottle = 100;

  window.addEventListener(
    "scroll",
    function () {
      var now = Date.now();
      if (now - lastScrollTime < scrollThrottle) return;
      lastScrollTime = now;
    },
    { passive: true },
  );

  // 4. Lazy load images more aggressively on mobile
  if ("IntersectionObserver" in window) {
    var imageObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute("data-src");
              imageObserver.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: "50px",
      },
    );

    document.querySelectorAll("img[data-src]").forEach(function (img) {
      imageObserver.observe(img);
    });
  }

  // 5. Prevent text selection on double-tap for buttons
  var preventDoubleTapZoom = document.querySelectorAll(
    'button, .cta-button, a:not([href*="http"])',
  );
  preventDoubleTapZoom.forEach(function (el) {
    el.addEventListener(
      "touchend",
      function (e) {
        e.preventDefault();
        this.click();
      },
      { passive: false },
    );
  });

  // 6. Handle orientation change
  window.addEventListener("orientationchange", function () {
    setTimeout(function () {
      window.scrollTo(0, window.pageYOffset);
    }, 200);
  });

  // 7. Improve form UX on mobile
  var forms = document.querySelectorAll("form");
  forms.forEach(function (form) {
    form.addEventListener("submit", function () {
      // Blur active element to hide keyboard
      if (document.activeElement) {
        document.activeElement.blur();
      }
    });
  });

  // 8. Add mobile class to body for additional styling hooks
  document.body.classList.add("mobile-device");

  
})();

// ===== LIVE DISCORD STATS =====
(function () {
  // Counts come from the public invite endpoint, which needs no server
  // settings. The widget endpoint (needs Server Settings > Widget enabled)
  // is only a fallback.
  var DISCORD_INVITE = "PgGA8Zsj4g";
  var DISCORD_SERVER_ID = "974051907058405467";

  var membersElement = document.getElementById("discord-members");
  var onlineElement = document.getElementById("discord-online");

  if (!membersElement || !onlineElement) return;

  // Counters stay hidden until a request succeeds.
  var statsContainer = document.getElementById("discord-stats");
  if (statsContainer) statsContainer.style.display = "none";

  function show(members, online) {
    membersElement.textContent = members.toLocaleString();
    onlineElement.textContent = online.toLocaleString();
    if (statsContainer) statsContainer.style.display = "";
  }

  function getJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Discord API error: " + response.status);
      return response.json();
    });
  }

  function fetchDiscordStats() {
    getJson(
      "https://discord.com/api/v9/invites/" + DISCORD_INVITE + "?with_counts=true",
    )
      .then(function (data) {
        if (typeof data.approximate_member_count !== "number") {
          throw new Error("No counts in invite response");
        }
        show(data.approximate_member_count, data.approximate_presence_count || 0);
      })
      .catch(function () {
        return getJson(
          "https://discord.com/api/guilds/" + DISCORD_SERVER_ID + "/widget.json",
        ).then(function (data) {
          var online = data.presence_count || 0;
          show(data.members ? data.members.length : online, online);
        });
      })
      .catch(function () {
        // Both endpoints failed: keep the counters hidden.
        if (statsContainer) statsContainer.style.display = "none";
      });
  }

  fetchDiscordStats();

  // Refresh every 5 minutes
  setInterval(fetchDiscordStats, 5 * 60 * 1000);
})();
