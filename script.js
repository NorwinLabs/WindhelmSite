// Modern Windhelm Site JavaScript

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize all components
  initializeNavigation();
  initializeSmoothScrolling();
  initializeFormHandling();
  initializeAnimations();
  initializePerformanceOptimizations();
});

// Navigation functionality
function initializeNavigation() {
  const navToggle = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");
  const header = document.querySelector(".header");

  // Mobile menu toggle
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      navMenu.classList.toggle("active");
      navToggle.classList.toggle("active");

      // Toggle aria-expanded for accessibility
      const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", !isExpanded);
    });

    // Close mobile menu when clicking nav links
    const navLinks = navMenu.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", function () {
        navMenu.classList.remove("active");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Mobile menu toggle with overlay and accessibility
  const navOverlay = document.getElementById("nav-overlay");
  if (navToggle && navMenu && navOverlay) {
    function openMenu() {
      navMenu.classList.add("active");
      navToggle.classList.add("active");
      navOverlay.classList.add("active");
      navOverlay.setAttribute("aria-hidden", "false");
      navToggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    function closeMenu() {
      navMenu.classList.remove("active");
      navToggle.classList.remove("active");
      navOverlay.classList.remove("active");
      navOverlay.setAttribute("aria-hidden", "true");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    navToggle.addEventListener("click", function () {
      if (navMenu.classList.contains("active")) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    navOverlay.addEventListener("click", closeMenu);
    // Close mobile menu when clicking nav links
    const navLinks = navMenu.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
    // ESC key closes menu
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navMenu.classList.contains("active")) {
        closeMenu();
      }
    });
  }

  // Header scroll effect
  let lastScrollY = window.scrollY;

  function updateHeader() {
    const currentScrollY = window.scrollY;

    if (currentScrollY > 100) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    // Hide header on scroll down, show on scroll up
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      header.style.transform = "translateY(-100%)";
    } else {
      header.style.transform = "translateY(0)";
    }

    lastScrollY = currentScrollY;
  }

  // Throttle scroll events for better performance
  let ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
      setTimeout(() => (ticking = false), 10);
    }
  });
}

// Smooth scrolling for anchor links
function initializeSmoothScrolling() {
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach((link) => {
    link.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      // Skip if href is just "#"
      if (href === "#") return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();

        const headerHeight = document.querySelector(".header").offsetHeight;
        const targetPosition = target.offsetTop - headerHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });

        // Update URL without triggering scroll
        history.pushState(null, null, href);
      }
    });
  });
}

// Form handling with improved UX
function initializeFormHandling() {
  const contactForm = document.getElementById("contact-form");
  const formMessages = document.getElementById("form-messages");
  const formSuccess = document.getElementById("form-success");
  const formError = document.getElementById("form-error");

  if (!contactForm) return;

  // Add real-time validation
  const inputs = contactForm.querySelectorAll("input, textarea");
  inputs.forEach((input) => {
    input.addEventListener("blur", validateField);
    input.addEventListener("input", clearFieldError);
  });

  // Handle form submission
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Validate all fields
    let isValid = true;
    inputs.forEach((input) => {
      if (!validateField.call(input)) {
        isValid = false;
      }
    });

    if (!isValid) {
      showFormMessage("Please correct the errors and try again.", "error");
      return;
    }

    // Show loading state
    const submitButton = contactForm.querySelector(".submit-button");
    const originalText = submitButton.textContent;
    submitButton.textContent = "Sending...";
    submitButton.disabled = true;

    try {
      // Prepare form data
      const formData = new FormData(contactForm);

      // Add reCAPTCHA token if available
      if (window.recaptchaObject) {
        await new Promise((resolve) => {
          window.recaptchaObject.executeContact(resolve);
        });
      }

      // Submit form
      const response = await fetch(contactForm.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        showFormMessage(
          "Thank you! Your message has been sent successfully.",
          "success"
        );
        contactForm.reset();
        clearAllFieldErrors();
      } else {
        throw new Error("Network response was not ok");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      showFormMessage(
        "Sorry, there was an error sending your message. Please try again.",
        "error"
      );
    } finally {
      // Reset button state
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });

  function validateField() {
    const field = this;
    const value = field.value.trim();
    let isValid = true;

    // Remove existing error styling
    field.classList.remove("error");
    removeFieldError(field);

    // Required field validation
    if (field.hasAttribute("required") && !value) {
      showFieldError(field, "This field is required.");
      isValid = false;
    }

    // Email validation
    if (field.type === "email" && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        showFieldError(field, "Please enter a valid email address.");
        isValid = false;
      }
    }

    // Name validation
    if (field.name === "name" && value && value.length < 2) {
      showFieldError(field, "Name must be at least 2 characters long.");
      isValid = false;
    }

    // Message validation
    if (field.name === "message" && value && value.length < 10) {
      showFieldError(field, "Message must be at least 10 characters long.");
      isValid = false;
    }

    return isValid;
  }

  function clearFieldError() {
    this.classList.remove("error");
    removeFieldError(this);
  }

  function showFieldError(field, message) {
    field.classList.add("error");

    let errorElement = field.parentNode.querySelector(".field-error");
    if (!errorElement) {
      errorElement = document.createElement("div");
      errorElement.className = "field-error";
      field.parentNode.appendChild(errorElement);
    }
    errorElement.textContent = message;
  }

  function removeFieldError(field) {
    const errorElement = field.parentNode.querySelector(".field-error");
    if (errorElement) {
      errorElement.remove();
    }
  }

  function clearAllFieldErrors() {
    const errorElements = contactForm.querySelectorAll(".field-error");
    errorElements.forEach((element) => element.remove());

    inputs.forEach((input) => input.classList.remove("error"));
  }

  function showFormMessage(message, type) {
    if (!formMessages) return;

    const messageElement = type === "success" ? formSuccess : formError;
    messageElement.textContent = message;

    formMessages.style.display = "block";
    messageElement.style.display = "block";

    // Hide the other message type
    const otherElement = type === "success" ? formError : formSuccess;
    otherElement.style.display = "none";

    // Auto-hide after 5 seconds
    setTimeout(() => {
      formMessages.style.display = "none";
    }, 5000);

    // Scroll to form if error
    if (type === "error") {
      contactForm.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

// Intersection Observer for animations
function initializeAnimations() {
  // Check if user prefers reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-in");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Elements to animate
  const animateElements = document.querySelectorAll(
    [
      ".feature-card",
      ".team-member",
      ".section-header",
      ".contact-form",
      ".contact-social",
    ].join(", ")
  );

  animateElements.forEach((element) => {
    element.classList.add("animate-ready");
    observer.observe(element);
  });
}

// Performance optimizations
function initializePerformanceOptimizations() {
  // Lazy load images with Intersection Observer
  const images = document.querySelectorAll('img[loading="lazy"]');

  if ("IntersectionObserver" in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;

          // Add loading state
          img.style.opacity = "0.5";

          img.addEventListener("load", () => {
            img.style.opacity = "1";
            img.style.transition = "opacity 0.3s ease";
          });

          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach((img) => imageObserver.observe(img));
  }

  // Preload critical resources
  const criticalResources = [
    "/images/Logo.png",
    "/images/1920x622CenteredLogo.jpg",
  ];

  criticalResources.forEach((resource) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = resource;
    document.head.appendChild(link);
  });

  // Service Worker registration for caching
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("Service Worker registration failed:", err);
    });
  }
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Expose useful functions globally
window.WindhelmSite = {
  showFormMessage: function (message, type) {
    // This can be called from external scripts
    const event = new CustomEvent("showFormMessage", {
      detail: { message, type },
    });
    document.dispatchEvent(event);
  },
};

// Handle external form message events
document.addEventListener("showFormMessage", function (event) {
  const { message, type } = event.detail;
  const formMessages = document.getElementById("form-messages");
  const formSuccess = document.getElementById("form-success");
  const formError = document.getElementById("form-error");

  if (!formMessages) return;

  const messageElement = type === "success" ? formSuccess : formError;
  messageElement.textContent = message;

  formMessages.style.display = "block";
  messageElement.style.display = "block";

  const otherElement = type === "success" ? formError : formSuccess;
  otherElement.style.display = "none";

  setTimeout(() => {
    formMessages.style.display = "none";
  }, 5000);
});

// Analytics and tracking (privacy-focused)
function initializeAnalytics() {
  // Only track if user hasn't opted out
  if (localStorage.getItem("analytics-opt-out") === "true") {
    return;
  }

  // Track page views
  const trackPageView = () => {
    // Simple, privacy-focused analytics
    console.log("Page view tracked:", window.location.pathname);
  };

  // Track interactions
  const trackInteraction = (action, element) => {
    console.log("Interaction tracked:", action, element);
  };

  // Track CTA clicks
  document.querySelectorAll(".cta-button").forEach((button) => {
    button.addEventListener("click", () => {
      trackInteraction("cta_click", button.textContent);
    });
  });

  // Track social link clicks
  document
    .querySelectorAll(".social-link, .social-link-large")
    .forEach((link) => {
      link.addEventListener("click", () => {
        const platform = link.getAttribute("aria-label") || "unknown";
        trackInteraction("social_click", platform);
      });
    });

  trackPageView();
}

// Initialize analytics after a delay to not impact performance
setTimeout(initializeAnalytics, 2000);

// Error handling
window.addEventListener("error", function (event) {
  console.error("JavaScript error:", event.error);

  // Don't let JavaScript errors break the site
  return true;
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", function (event) {
  console.error("Unhandled promise rejection:", event.reason);
  event.preventDefault();
});
