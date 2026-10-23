
  (function () {
    const year = document.getElementById("footer-current-year");
    if (year) year.textContent = String(new Date().getFullYear());

    const photoBand = document.querySelector(".footer-photo-band");
    const photo = document.querySelector(".footer-photo-image");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 769px)");
    if (!photoBand || !photo) return;

    let scheduled = false;
    function updateParallax() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        if (!desktop.matches || reduceMotion.matches) {
          photo.style.removeProperty("--footer-parallax-y");
          scheduled = false;
          return;
        }
        const bounds = photoBand.getBoundingClientRect();
        const progress = (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height);
        const offset = Math.max(-8, Math.min(8, (progress - 0.5) * 16));
        photo.style.setProperty("--footer-parallax-y", offset.toFixed(1) + "px");
        scheduled = false;
      });
    }
    window.addEventListener("scroll", updateParallax, { passive: true });
    window.addEventListener("resize", updateParallax);
    updateParallax();
  })();

  // Student privacy: use only videos where faces are blurred or a parent/guardian has given consent.
  // Floating contact speed dial
  (function () {
    const dial = document.getElementById("contact-speed-dial");
    const toggle = dial && dial.querySelector(".contact-speed-dial-main");
    const items = document.getElementById("contact-speed-dial-items");
    if (!dial || !toggle || !items) return;

    function setOpen(open) {
      dial.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      items.setAttribute("aria-hidden", String(!open));
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    items.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("pointerdown", function (event) {
      if (toggle.getAttribute("aria-expanded") === "true" && !dial.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  })();

  // Quick return to the top, shown once the visitor has scrolled down.
  function setupBackToTop() {
    const button = document.getElementById("backToTop");
    if (!button) return;

    let updatePending = false;
    function updateVisibility() {
      if (updatePending) return;
      updatePending = true;
      requestAnimationFrame(function () {
        button.classList.toggle("is-visible", window.scrollY > 400);
        updatePending = false;
      });
    }

    window.addEventListener("scroll", updateVisibility, { passive: true });
    button.addEventListener("click", function () {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      try {
        window.scrollTo({ top: 0, behavior: behavior });
      } catch (error) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    });
    updateVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBackToTop, { once: true });
  } else {
    setupBackToTop();
  }
