(() => {
  let controller;
  let frameId = 0;

  const initialize = () => {
    controller?.abort();
    if (frameId) window.cancelAnimationFrame(frameId);

    const button = document.getElementById("back-to-top");
    if (!button) return;

    const progress = button.querySelector(".scroll-progress-value");
    const radius = 22.5;
    const circumference = 2 * Math.PI * radius;
    let framePending = false;
    controller = new AbortController();
    const { signal } = controller;

    const update = () => {
      framePending = false;
      frameId = 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const amount = maxScroll ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      if (progress) {
        progress.style.strokeDasharray = String(circumference);
        progress.style.strokeDashoffset = String(circumference * (1 - amount));
      }
      button.classList.toggle("is-visible", window.scrollY > 300);
    };

    const requestUpdate = () => {
      if (framePending) return;
      framePending = true;
      frameId = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true, signal });
    window.addEventListener("resize", requestUpdate, { passive: true, signal });
    button.addEventListener("click", () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
    }, { signal });
    window.addEventListener("pagehide", () => {
      controller.abort();
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    }, { once: true });

    update();
  };

  initialize();
  window.addEventListener("pageshow", event => {
    if (event.persisted) initialize();
  });
})();
