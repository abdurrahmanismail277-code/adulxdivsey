(() => {
  const root = document.documentElement;
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const themeButton = document.querySelector(".theme-toggle");
  if (themeButton) {
    const syncThemeButton = () => {
      const dark = root.dataset.theme === "dark";
      themeButton.setAttribute("aria-pressed", String(dark));
      themeButton.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      themeButton.title = dark ? "Switch to light mode" : "Switch to dark mode";
    };
    syncThemeButton();
    themeButton.addEventListener("click", () => {
      const dark = root.dataset.theme !== "dark";
      root.dataset.theme = dark ? "dark" : "light";
      try { localStorage.setItem("apex-theme", dark ? "dark" : "light"); } catch {}
      syncThemeButton();
    });
  }

  const trigger = document.getElementById("accessibility-trigger");
  const panel = document.getElementById("accessibility-panel");
  const text = document.getElementById("text-size-toggle");
  const contrast = document.getElementById("contrast-toggle");
  const reset = document.getElementById("accessibility-reset");
  if (trigger && panel && text && contrast && reset) {
    const restore = (key, button, attribute) => {
      let enabled = false;
      try { enabled = localStorage.getItem(key) === "true"; } catch {}
      if (enabled) root.setAttribute(attribute, "true");
      button.setAttribute("aria-pressed", String(enabled));
    };
    restore("apex-large-text", text, "data-large-text");
    restore("apex-high-contrast", contrast, "data-high-contrast");
    const toggle = (key, button, attribute) => {
      const enabled = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(enabled));
      if (enabled) root.setAttribute(attribute, "true"); else root.removeAttribute(attribute);
      try { localStorage.setItem(key, String(enabled)); } catch {}
    };
    text.addEventListener("click", () => toggle("apex-large-text", text, "data-large-text"));
    contrast.addEventListener("click", () => toggle("apex-high-contrast", contrast, "data-high-contrast"));
    reset.addEventListener("click", () => {
      root.removeAttribute("data-large-text"); root.removeAttribute("data-high-contrast");
      text.setAttribute("aria-pressed", "false"); contrast.setAttribute("aria-pressed", "false");
      try { localStorage.removeItem("apex-large-text"); localStorage.removeItem("apex-high-contrast"); } catch {}
    });
    const close = () => { panel.hidden = true; trigger.setAttribute("aria-expanded", "false"); trigger.setAttribute("aria-label", "Open accessibility settings"); };
    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") !== "true";
      trigger.setAttribute("aria-expanded", String(open));
      trigger.setAttribute("aria-label", open ? "Close accessibility settings" : "Open accessibility settings");
      panel.hidden = !open;
      if (open) text.focus();
    });
    document.addEventListener("click", event => { if (!panel.hidden && !event.target.closest(".accessibility")) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) { close(); trigger.focus(); } });
  }

  const dial = document.getElementById("connect-dial");
  const toggle = document.getElementById("connect-toggle");
  if (dial && toggle) {
    const setOpen = open => {
      dial.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close social and booking options" : "Open social and booking options");
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("click", event => { if (!dial.contains(event.target) && toggle.getAttribute("aria-expanded") === "true") setOpen(false); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); } });
  }
})();
