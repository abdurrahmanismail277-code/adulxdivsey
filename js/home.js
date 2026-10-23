//  NEXT CLASS APPLICATION COUNTDOWN
  (function () {
    const countdown = document.querySelector(".class-countdown");
    if (!countdown) return;

    const configuredMinutes = Number(countdown.dataset.countdownMinutes);
    const totalMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0 ? configuredMinutes : 44770;
    const storageKey = "arresalahClassApplicationStartAt";
    let storedTarget = null;
    try {
      storedTarget = window.localStorage.getItem(storageKey);
    } catch (error) {
      // Continue with an in-memory deadline when this device blocks browser storage.
    }
    let targetTime = storedTarget === null ? NaN : Number(storedTarget);

    if (!Number.isFinite(targetTime) || targetTime <= 0) {
      targetTime = Date.now() + totalMinutes * 60 * 1000;
      try {
        window.localStorage.setItem(storageKey, String(targetTime));
      } catch (error) {
        // The countdown still runs for this visit if persistent storage is unavailable.
      }
    }

    const days = document.getElementById("count-days");
    const hours = document.getElementById("count-hours");
    const minutes = document.getElementById("count-minutes");
    const seconds = document.getElementById("count-seconds");
    const title = document.getElementById("countdown-title");
    let timer;
    const dateLabel = document.getElementById("countdown-date");
    if (dateLabel) dateLabel.textContent = "Applications open " + new Date(targetTime).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    function twoDigits(value) {
      return String(value).padStart(2, "0");
    }

    function renderCountdown() {
      const remaining = Math.max(0, targetTime - Date.now());
      const totalSeconds = Math.floor(remaining / 1000);
      const dayCount = Math.floor(totalSeconds / 86400);
      const hourCount = Math.floor((totalSeconds % 86400) / 3600);
      const minuteCount = Math.floor((totalSeconds % 3600) / 60);
      const secondCount = totalSeconds % 60;

      days.textContent = String(dayCount);
      hours.textContent = twoDigits(hourCount);
      minutes.textContent = twoDigits(minuteCount);
      seconds.textContent = twoDigits(secondCount);

      if (remaining <= 0) {
        title.textContent = "Applications Are Open";
        clearInterval(timer);
      }
    }

    renderCountdown();
    timer = setInterval(renderCountdown, 1000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) renderCountdown();
    });
  })();


  //  APPLICATION START NOTIFICATIONS
  (function () {
    const form = document.getElementById("countdown-notify-form");
    if (!form) return;
    const status = document.getElementById("countdown-notify-status");
    const errorMessage = document.getElementById("countdown-notify-error");
    const submitButton = document.getElementById("countdown-notify-submit");
    let widgetId = null;

    window.initializeNotifyTurnstile = function (siteKey) {
      if (!window.turnstile || widgetId !== null) return;
      widgetId = window.turnstile.render("#notify-turnstile", {
        sitekey: siteKey,
        theme: "dark",
        size: "normal",
        callback: function () {
          submitButton.disabled = false;
          errorMessage.hidden = true;
          errorMessage.textContent = "";
        },
        "expired-callback": function () { submitButton.disabled = true; },
        "error-callback": function () {
          submitButton.disabled = true;
          errorMessage.textContent = "Security verification could not load. Please refresh and try again.";
          errorMessage.hidden = false;
        }
      });
    };

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      errorMessage.hidden = true;
      errorMessage.textContent = "";
      const contact = form.elements.contact.value.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
      const digits = contact.replace(/\D/g, "");
      const isPhone = /^\+?[0-9 ()-]{7,20}$/.test(contact) && digits.length >= 7 && digits.length <= 15;
      if (!isEmail && !isPhone) {
        errorMessage.textContent = "Enter a valid email address or WhatsApp number.";
        errorMessage.hidden = false;
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        submitButton.disabled = true;
        return;
      }
      const turnstileToken = widgetId !== null ? window.turnstile.getResponse(widgetId) : "";
      if (!turnstileToken) {
        errorMessage.textContent = "Please complete the security check before continuing.";
        errorMessage.hidden = false;
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        submitButton.disabled = true;
        return;
      }

      status.textContent = "Saving your contact...";
      submitButton.disabled = true;
      try {
        const response = await fetch(window.CONTACT_API_URL || "/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "application-notification", contact, "cf-turnstile-response": turnstileToken })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not save your request. Please try again later.");
        status.textContent = result.message || "Thanks. Your contact has been saved for application updates.";
        form.reset();
      } catch (error) {
        status.textContent = "";
        errorMessage.textContent = error.message || "Could not send your request. Please try again.";
        errorMessage.hidden = false;
      } finally {
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        submitButton.disabled = true;
      }
    });
  })();

  // The public site key comes from the server config endpoint; the secret never reaches this page.
  (function initializeTurnstileWidgets() {
    const error = document.getElementById("application-error");
    const showConfigError = function () {
      const message = "Security verification is unavailable. Please try again later.";
      if (error) { error.textContent = message; error.hidden = false; }
      const notifyError = document.getElementById("countdown-notify-error");
      if (notifyError) { notifyError.textContent = message; notifyError.hidden = false; }
    };

    const contactApiUrl = window.CONTACT_API_URL || "/api/contact";
    const configApiUrl = contactApiUrl.replace(/\/api\/contact\/?$/, "/api/turnstile-config");
    fetch(configApiUrl)
      .then((response) => { if (!response.ok) throw new Error("Turnstile config unavailable"); return response.json(); })
      .then((config) => {
        if (!config.siteKey) throw new Error("Turnstile site key is missing");
        const startedAt = Date.now();
        const renderWhenReady = function () {
          if (window.turnstile) {
            window.initializeNotifyTurnstile(config.siteKey);
            const button = document.getElementById("btn-to-stage3");
            window.applicationTurnstileWidget = window.turnstile.render("#application-turnstile", {
              sitekey: config.siteKey,
              theme: "dark",
              size: "normal",
              callback: function () {
                window.applicationTurnstileToken = window.turnstile.getResponse(window.applicationTurnstileWidget);
                if (error) { error.hidden = true; error.textContent = ""; }
                updateEnrollmentSubmitState();
              },
              "expired-callback": function () { window.applicationTurnstileToken = ""; updateEnrollmentSubmitState(); },
              "error-callback": function () {
                window.applicationTurnstileToken = "";
                updateEnrollmentSubmitState();
                if (error) { error.textContent = "Security verification could not load. Please refresh and try again."; error.hidden = false; }
              }
            });
            return;
          }
          if (Date.now() - startedAt < 15000) return setTimeout(renderWhenReady, 100);
          showConfigError();
        };
        renderWhenReady();
      })
      .catch(showConfigError);
  })();

  