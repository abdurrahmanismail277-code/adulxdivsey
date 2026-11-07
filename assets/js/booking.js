
    import { SETTINGS, SERVICES, calculatePrice, getService, readServiceIdsFromUrl } from "../../services.js?v=20261029";
    import { initBookingInputs } from "./booking-inputs.js?v=20261029";
    const PAYMENT_REFERENCE_KEY = "apex-house-booking-reference";
    const PAYMENT_STEP_KEY = "apex-house-payment-step";
    try {
      localStorage.removeItem("apex-house-booking-draft");
      sessionStorage.removeItem("apex-house-pending-payment");
    } catch {}
    const PAYMENT_CONFIG = Object.freeze({ whatsappNumber: "2348038326349" });
    const bookingDraft = {};
    const naira = amount => `${String.fromCharCode(0x20A6)}${Number(amount).toLocaleString("en-NG")}`;
    const serviceOptions = document.getElementById("booking-service");
    const offerOptions = document.getElementById("booking-package");
    const bookingForm = document.getElementById("booking-form");
    const bookingStatus = document.getElementById("booking-status");
    const RECAPTCHA_SITE_KEY = "6LdErQkuAAAAAI8gaXBFE8381xCeGBTCt1hGwOPf";
    const BOOKING_API_URL = "https://apex-house-site.abdurrahmanismail277.workers.dev/api/book";
    const steps = [...bookingForm.querySelectorAll(".booking-step")];
    const progress = [...bookingForm.querySelectorAll(".booking-progress span")];
    let currentStep = 0;
    let bookingInputs;
    let recaptchaWidgetId = null;
    let recaptchaPromise;
    let recaptchaError;
    let bookingIdempotencyKey = "";
    function loadRecaptcha() {
      if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
      if (recaptchaPromise) return recaptchaPromise;
      recaptchaPromise = new Promise((resolve, reject) => {
        window.apexRecaptchaLoaded = () => resolve(window.grecaptcha);
        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js?onload=apexRecaptchaLoaded&render=explicit";
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          script.remove();
          recaptchaPromise = null;
          reject(new Error("reCAPTCHA could not be loaded."));
        };
        document.head.append(script);
      });
      return recaptchaPromise;
    }
    function prepareRecaptcha() {
      if (recaptchaWidgetId !== null) return;
      const reviewStep = steps[3];
      let container = document.getElementById("booking-recaptcha");
      if (!container) {
        container = document.createElement("div");
        container.id = "booking-recaptcha";
        container.setAttribute("aria-label", "reCAPTCHA verification");
        container.style.marginTop = "20px";
        recaptchaError = document.createElement("p");
        recaptchaError.className = "field-error";
        recaptchaError.setAttribute("role", "status");
        recaptchaError.setAttribute("aria-live", "polite");
        reviewStep.append(container, recaptchaError);
      }
      loadRecaptcha().then(grecaptcha => {
        if (recaptchaWidgetId !== null) return;
        recaptchaWidgetId = grecaptcha.render(container, {
          sitekey: RECAPTCHA_SITE_KEY,
          callback: () => { if (recaptchaError) recaptchaError.textContent = ""; },
          "expired-callback": () => { if (recaptchaError) recaptchaError.textContent = "Please complete the reCAPTCHA check again."; },
          "error-callback": () => { if (recaptchaError) recaptchaError.textContent = "reCAPTCHA could not load. Check your connection and try again."; },
        });
      }).catch(() => {
        if (recaptchaError) recaptchaError.textContent = "reCAPTCHA could not load. Check your connection and try again.";
      });
    }
    function priceLabel(amount) { return `${naira(amount)} NGN`; }
    serviceOptions.innerHTML = `<option value="">Choose a service</option>${Object.entries(SERVICES).map(([, group]) => `<optgroup label="${group.label}">${group.services.map(service => `<option value="${service.id}">${service.name}</option>`).join("")}</optgroup>`).join("")}`;
    serviceOptions.classList.remove("booking-services-loading");
    bookingInputs = initBookingInputs({ draft: bookingDraft });
    document.getElementById("phone-dial-country-iso").value = "NG";
    const allServiceIds = new Set(Object.values(SERVICES).flatMap(group => group.services.map(service => service.id)));
    const validUrlSelections = readServiceIdsFromUrl(window.location.search);
    let storedSelections = [];
    try { storedSelections = JSON.parse(sessionStorage.getItem("apex-house-selected-services") || "[]"); } catch {}
    const initialSelections = validUrlSelections.length ? [...new Set(validUrlSelections)] : [...new Set(storedSelections)].filter(id => allServiceIds.has(id));
    if (initialSelections.length) {
      serviceOptions.value = initialSelections[0];
      const choiceList = document.createElement("div");
      choiceList.className = "booking-package-prefill";
      choiceList.setAttribute("role", "group");
      choiceList.setAttribute("aria-label", "Services selected in your package. Choose a service to book.");
      choiceList.innerHTML = `<span>Services in your package</span>${initialSelections.map(id => `<button type="button" data-prefill-service="${id}" aria-pressed="true" aria-current="${id === initialSelections[0] ? "true" : "false"}">${getService(id).name}</button>`).join("")}${initialSelections.length > 1 ? "<small>The booking form submits one service at a time. Choose which service to book now.</small>" : ""}`;
      bookingForm.querySelector(".booking-fields").prepend(choiceList);
      choiceList.addEventListener("click", event => {
        const option = event.target.closest("[data-prefill-service]");
        if (!option) return;
        serviceOptions.value = option.dataset.prefillService;
        choiceList.querySelectorAll("[data-prefill-service]").forEach(button => button.setAttribute("aria-pressed", String(button === option)));
        updateOffers();
      });
    }
    function selectedMode() { return bookingForm.elements.mode.value; }
    function selectedService() { return getService(serviceOptions.value); }
    function localDateString(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    const conditionalTimers = new WeakMap();
    function setConditionalField(wrapper, visible) {
      if (!wrapper) return;
      window.clearTimeout(conditionalTimers.get(wrapper));
      const controls = [...wrapper.querySelectorAll("input,select,textarea")];
      if (visible) {
        wrapper.hidden = false;
        wrapper.inert = false;
        wrapper.setAttribute("aria-hidden", "false");
        controls.forEach(control => { control.disabled = false; });
        requestAnimationFrame(() => wrapper.classList.remove("is-collapsing"));
      } else {
        wrapper.inert = true;
        wrapper.setAttribute("aria-hidden", "true");
        controls.forEach(control => { control.disabled = true; });
        wrapper.classList.add("is-collapsing");
        conditionalTimers.set(wrapper, window.setTimeout(() => { if (wrapper.inert) wrapper.hidden = true; }, 180));
      }
    }
    function updateOffers() {
      const service = selectedService();
      if (service) getPaymentNarrationCode();
      const modeRadios = [...bookingForm.querySelectorAll('input[name="mode"]')];
      modeRadios.forEach(radio => { radio.disabled = !service || !service.offers.some(offer => offer.mode === radio.value); });
      if (service && !service.offers.some(offer => offer.mode === selectedMode())) {
        const firstMode = service.offers[0].mode;
        modeRadios.find(radio => radio.value === firstMode).checked = true;
      }
      const mode = selectedMode();
      const isVirtual = mode === "virtual";
      const venueField = document.getElementById("venue-field");
      const venueInput = venueField.querySelector("input");
      setConditionalField(venueField, !isVirtual);
      venueInput.required = !isVirtual;
      venueInput.setAttribute("aria-required", String(!isVirtual));
      venueField.querySelector(".required-mark").hidden = isVirtual;
      setConditionalField(document.getElementById("platform-field"), isVirtual);
      setConditionalField(document.getElementById("timezone-field"), isVirtual);
      const offers = service ? service.offers.filter(offer => offer.mode === mode) : [];
      offerOptions.innerHTML = offers.length ? offers.map(offer => `<option value="${offer.id}">${offer.label} / ${priceLabel(offer.amount)} per ${offer.unit}</option>`).join("") : '<option value="">Choose a service first</option>';
      const offer = offers[0];
      const units = { hour: "hours", day: "days", package: "packages", content: "content pieces", block: "blocks" };
      document.getElementById("quantity-label").textContent = `Number of ${units[offer?.unit] || "items"}`;
      document.getElementById("quantity-unit").textContent = offer ? `Price is per ${offer.unit}.` : "Choose a service to see the unit.";
      const extraHoursField = document.getElementById("extra-hours-field");
      setConditionalField(extraHoursField, Boolean(service?.extraHoursAllowed));
      updateEstimate();
    }
    function animatePrice(target, text) {
      if (target.textContent === text) return;
      target.textContent = text;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof target.animate !== "function") return;
      target.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], {
        duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none",
      });
    }
    function updateEstimate() {
      const service = selectedService();
      const offerId = offerOptions.value;
      const quantity = Number(document.getElementById("booking-quantity").value);
      const extraHours = Number(document.getElementById("booking-extra-hours").value || 0);
      const quote = calculatePrice(serviceOptions.value, selectedMode(), offerId, quantity, extraHours);
      const totalText = quote ? naira(quote.amount) : "Select a service and package";
      animatePrice(document.getElementById("booking-price-live"), totalText);
      animatePrice(document.getElementById("booking-price"), totalText);
      const notes = ["Prices and payments are in Nigerian naira (NGN)."];
      if (selectedMode() === "physical") notes.push("Transport fare is not included.");
      if (service?.extraHoursAllowed) notes.push(SETTINGS.launchExtraHourRateNGN == null ? "Additional hours are confirmed after review." : `Additional hours: ${priceLabel(SETTINGS.launchExtraHourRateNGN)} per hour, confirmed after review.`);
      const note = quote ? notes.join(" ") : "Choose a service and package to see the NGN price.";
      const extraNotes = quote ? notes.filter(item => item !== "Prices and payments are in Nigerian naira (NGN)").join(" ") : "";
      const estimateNote = document.getElementById("estimate-note");
      estimateNote.textContent = extraNotes;
      estimateNote.hidden = !extraNotes;
      document.getElementById("estimate-note-live").textContent = note;
    }
    serviceOptions.addEventListener("change", updateOffers);
    offerOptions.addEventListener("change", updateEstimate);

    document.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener("change", updateOffers));
    document.getElementById("booking-quantity").addEventListener("input", updateEstimate);
    document.getElementById("booking-extra-hours").addEventListener("input", updateEstimate);
    const platformPreference = document.getElementById("platform-preference");
    const platformOther = document.getElementById("platform-other");
    const updatePlatformOther = () => {
      platformOther.hidden = platformPreference.value !== "Other";
      if (platformOther.hidden) platformOther.value = "";
    };
    platformPreference.addEventListener("change", updatePlatformOther);
    updatePlatformOther();
    document.querySelectorAll("[data-stepper]").forEach(button => button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.stepper);
      const min = Number(input.min || 0), max = Number(input.max || 1000), step = Number(input.step || 1);
      input.value = String(Math.min(max, Math.max(min, Number(input.value || 0) + Number(button.dataset.delta) * step)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }));
    const notesInput = document.getElementById("additional-notes");
    const notesCount = document.getElementById("notes-count");
    const updateNotesCount = () => { notesCount.textContent = String(notesInput.value.length); };
    notesInput.addEventListener("input", updateNotesCount);
    updateNotesCount();
    const priceDetails = document.getElementById("booking-estimate-live");
    const compactPriceQuery = window.matchMedia("(max-width: 760px)");
    const setPriceSummaryMode = () => { priceDetails.open = !compactPriceQuery.matches; };
    setPriceSummaryMode();
    compactPriceQuery.addEventListener?.("change", setPriceSummaryMode);

    function validateField(field) {
      if (field.disabled || field.type === "hidden" || field.closest("[hidden]") || field.closest(".booking-honeypot")) return true;
      let message = "";
      field.setCustomValidity("");
      if (field.id === "country-search" && !bookingInputs.country) message = "Please choose your country from the list.";
      else if (field.id === "phone-dial-search" && !bookingInputs.dialCountry) message = "Please choose a country calling code from the list.";
      else if (field.id === "timezone-search" && selectedMode() === "virtual" && !bookingInputs.timeZone) message = "Please choose a time zone from the list.";
      else if (field.id === "whatsapp-national") {
        const phone = bookingInputs.phone;
        if (!phone.e164) message = "Please enter your phone or WhatsApp number.";
        else if (!phone.valid) message = "Please check the number length for the selected country code.";
      } else if (field.name === "email" && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) message = "Please enter a valid email address.";
      else if ((field.name === "eventDate" || field.name === "alternateDate") && field.value && field.value < localDateString()) message = field.name === "eventDate" ? "Preferred date cannot be in the past." : "Second-choice date cannot be in the past.";
      else if (field.name === "alternateDate" && field.value && field.value === bookingForm.elements.eventDate.value) message = "Second-choice date must differ from your preferred date.";
      else if (field.required && !String(field.value || "").trim()) {
        const messages = { eventName: "Please enter your event name.", eventType: "Please choose your event type.", eventDate: "Please choose your preferred date.", name: "Please enter your name.", email: "Please enter your email address.", audienceSize: "Please enter the audience size.", serviceId: "Please choose a service.", offerId: "Please choose a package.", whatsappNational: "Please enter your phone or WhatsApp number." };
        message = messages[field.name] || "Please complete this field.";
      } else if (!field.checkValidity()) message = field.validationMessage || "Please check this field.";
      field.setCustomValidity(message);
      const wrapper = field.closest(".booking-field");
      if (wrapper) {
        wrapper.classList.toggle("is-invalid", Boolean(message));
        const error = wrapper.querySelector(".field-error");
        if (error) error.textContent = message;
        field.setAttribute("aria-invalid", String(Boolean(message)));
      }
      return !message;
    }
    function validateStep(step) {
      const fields = [...step.querySelectorAll("input,select,textarea")].filter(field => !field.disabled && field.type !== "radio" && field.type !== "hidden" && !field.closest(".booking-honeypot") && !field.closest("[hidden]"));
      const invalid = fields.filter(field => !validateField(field));
      if (invalid.length) {
        invalid[0].focus({ preventScroll: true });
        invalid[0].scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
        return false;
      }
      return true;
    }
    bookingForm.addEventListener("blur", event => { if (event.target.matches("input,select,textarea") && event.target.required) validateField(event.target); }, true);
    document.getElementById("booking-next").addEventListener("click", () => {
      if (!validateStep(steps[currentStep])) return;
      if (currentStep < 3) currentStep++;
      renderStep();
    });
    document.getElementById("booking-back").addEventListener("click", () => { currentStep = Math.max(0, currentStep - 1); renderStep(); });
    function renderStep() {
      steps.forEach((step, index) => step.hidden = index !== currentStep);
      bookingForm.classList.toggle("is-reviewing", currentStep === 3);
      document.getElementById("booking-back").hidden = currentStep === 0;
      document.getElementById("booking-next").hidden = currentStep === 3;
      document.getElementById("booking-submit").hidden = currentStep !== 3;
      progress.forEach((bar, index) => bar.setAttribute("aria-current", index === currentStep ? "step" : "false"));
      const phase = currentStep === 0 ? 0 : currentStep < 3 ? 1 : 2;
      document.querySelectorAll("[data-booking-phase]").forEach((label, index) => {
        if (index === phase) label.setAttribute("aria-current", "step"); else label.removeAttribute("aria-current");
      });
      bookingForm.querySelector(".booking-progress").setAttribute("aria-label", `Step ${currentStep + 1} of 4`);
      if (currentStep === 3) {
        prepareRecaptcha();
        const data = new FormData(bookingForm);
        const service = selectedService();
        const offer = service?.offers.find(item => item.id === data.get("offerId") && item.mode === data.get("mode"));
        const quote = calculatePrice(data.get("serviceId"), data.get("mode"), data.get("offerId"), Number(data.get("quantity")), Number(data.get("extraHours") || 0));
        const country = bookingInputs.country;
      const setSummaryRow = (key, value) => {
        const row = document.querySelector(`[data-summary-row="${key}"]`);
        const target = document.getElementById(`booking-summary-${key}`);
        const text = String(value || "").trim();
        row.hidden = !text;
        target.textContent = text;
      };
      const quantity = Number(data.get("quantity"));
      const unit = String(offer?.unit || "unit").replace(/\(s\)$/, "");
      const quantityText = `${quantity} ${unit}${quantity === 1 ? "" : "s"}`;
      const eventDate = String(data.get("eventDate") || "");
      const eventTime = String(data.get("eventTime") || "");
      let dateText = "";
      if (eventDate) {
        const eventDateTime = new Date(`${eventDate}T${eventTime || "00:00"}:00+01:00`);
        if (!Number.isNaN(eventDateTime.valueOf())) {
          const datePart = new Intl.DateTimeFormat("en-GB", {
            weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos",
          }).format(eventDateTime);
          if (eventTime) {
            const timeParts = new Intl.DateTimeFormat("en-GB", {
              hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
            }).formatToParts(eventDateTime);
            const timePart = timeParts.map(part => part.type === "dayPeriod" ? part.value.toUpperCase() : part.value).join("");
            dateText = `${datePart} · ${timePart} (WAT)`;
          } else dateText = datePart;
        }
      }
      document.getElementById("booking-summary-service").textContent = service?.name || "";
      document.getElementById("booking-summary-package").textContent = offer?.label || "";
      document.getElementById("booking-summary-package").hidden = !offer?.label;
      document.getElementById("booking-summary-quantity").textContent = quantityText;
      setSummaryRow("event", data.get("eventName"));
      setSummaryRow("date", dateText);
      setSummaryRow("name", data.get("name"));
      setSummaryRow("email", data.get("email"));
      setSummaryRow("country", country?.name);
      setSummaryRow("timezone", data.get("mode") === "virtual" ? bookingInputs.timeZone : "");
      animatePrice(document.getElementById("booking-price"), quote ? naira(quote.amount) : "Quote unavailable");
      }
    }
    const paymentScreen = document.getElementById("booking-payment");
    const paymentTitle = document.getElementById("payment-title");
    const paymentPanels = [...document.querySelectorAll("[data-payment-panel]")];
    let currentBooking = null;
    let currentPaymentStep = 1;
    let statusPollTimer = 0;
    let expiryTimer = 0;

    function savePaymentReference(reference, step = currentPaymentStep) {
      try {
        sessionStorage.setItem(PAYMENT_REFERENCE_KEY, reference);
        sessionStorage.setItem(PAYMENT_STEP_KEY, String(step));
      } catch {}
    }

    function setPaymentStep(step, moveFocus = true) {
      currentPaymentStep = Math.min(3, Math.max(1, Number(step) || 1));
      paymentPanels.forEach(panel => { panel.hidden = Number(panel.dataset.paymentPanel) !== currentPaymentStep; });
      document.querySelectorAll("[data-payment-step]").forEach(item => {
        if (Number(item.dataset.paymentStep) === currentPaymentStep) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
      if (currentBooking) savePaymentReference(currentBooking.reference, currentPaymentStep);
      if (moveFocus) {
        const heading = paymentScreen.querySelector(`[data-payment-panel="${currentPaymentStep}"] h3`);
        requestAnimationFrame(() => {
          paymentScreen.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
          (heading || paymentTitle).focus({ preventScroll: true });
        });
      }
      renderPaymentStatus();
    }

    function renderPaymentStatus() {
      if (!currentBooking) return;
      const status = currentBooking.status || "pending_payment";
      const terminal = document.getElementById("payment-terminal");
      const terminalTitle = document.getElementById("payment-terminal-title");
      const terminalMessage = document.getElementById("payment-terminal-message");
      const proofForm = document.getElementById("payment-proof-form");
      const whatsappProof = document.querySelector(".payment-whatsapp-proof");
      const confirmActions = document.getElementById("payment-confirm-actions");
      const statusPanel = document.getElementById("payment-status-panel");
      const statusBadge = document.getElementById("payment-status-badge");
      const isTerminal = ["expired", "cancelled"].includes(status);
      terminal.hidden = !isTerminal;
      paymentPanels.forEach(panel => { panel.hidden = isTerminal || Number(panel.dataset.paymentPanel) !== currentPaymentStep; });
      if (isTerminal) {
        confirmActions.hidden = true;
        terminalTitle.textContent = status === "expired" ? "Payment window expired" : "Booking cancelled";
        terminalMessage.textContent = status === "expired" ? "This booking is no longer active. Start a new booking to continue." : "This booking was cancelled. Start a new booking if you still need the service.";
        document.body.classList.add("booking-payment-open");
        return;
      }
      if (status === "confirmed") {
        currentPaymentStep = 3;
        paymentPanels.forEach(panel => { panel.hidden = Number(panel.dataset.paymentPanel) !== 3; });
        document.querySelectorAll("[data-payment-step]").forEach(item => {
          if (Number(item.dataset.paymentStep) === 3) item.setAttribute("aria-current", "step");
          else item.removeAttribute("aria-current");
        });
        proofForm.hidden = true;
        whatsappProof.hidden = true;
        confirmActions.hidden = true;
        statusPanel.hidden = false;
        statusPanel.textContent = "Booking confirmed after payment verification.";
        statusBadge.textContent = "Confirmed";
        document.getElementById("payment-status-refresh").textContent = "Our team verified the transfer.";
        document.body.classList.add("booking-payment-open");
        return;
      }
      const awaiting = status === "awaiting_confirmation";
      statusBadge.textContent = awaiting ? "Awaiting confirmation" : "Pending payment";
      proofForm.hidden = awaiting;
      whatsappProof.hidden = awaiting;
      confirmActions.hidden = awaiting;
      statusPanel.hidden = !awaiting;
      statusPanel.textContent = awaiting ? "Payment awaiting confirmation. We’ll email you when verification is complete." : "";
      document.getElementById("payment-status-refresh").textContent = awaiting ? "Your booking is confirmed only after we verify your payment." : "";
      document.body.classList.add("booking-payment-open");
    }

    function displayBookingPayment(booking, options = {}) {
      currentBooking = {
        ...booking,
        emailStatus: options.emailStatus || booking.emailStatus || "sent",
        paymentDetails: options.paymentDetails || booking.paymentDetails || null,
      };
      const emailWarning = document.getElementById("booking-email-warning");
      emailWarning.hidden = currentBooking.emailStatus === "sent";
      emailWarning.textContent = currentBooking.emailStatus === "failed"
        ? "Your booking is saved, but the email could not be sent. Keep your reference and continue here."
        : "Your booking is saved. The email is still processing; keep your reference and continue here.";
      const amountKnown = currentBooking.amountKnown === true && Number.isFinite(Number(currentBooking.amount));
      const amountText = amountKnown ? naira(Number(currentBooking.amount)) : "To be confirmed";
      const amountPlain = amountKnown ? String(Number(currentBooking.amount)) : "";
      const narration = currentBooking.narration || currentBooking.reference;
      document.getElementById("payment-reference-summary").textContent = currentBooking.reference;
      document.getElementById("payment-reference-pay").textContent = currentBooking.reference;
      document.getElementById("payment-name").textContent = currentBooking.name;
      document.getElementById("payment-service").textContent = currentBooking.service;
      document.getElementById("payment-mode").textContent = currentBooking.mode === "physical" ? "Physical" : "Virtual";
      document.getElementById("payment-package").textContent = currentBooking.package;
      document.getElementById("payment-quantity").textContent = `${currentBooking.quantity} ${currentBooking.unit}${Number(currentBooking.quantity) === 1 ? "" : "s"}`;
      document.getElementById("payment-event-name").textContent = currentBooking.eventName || "Not provided";
      const eventDate = currentBooking.eventDate ? new Date(`${currentBooking.eventDate}T12:00:00`) : null;
      const dateText = eventDate && !Number.isNaN(eventDate.valueOf()) ? eventDate.toLocaleDateString(navigator.language || "en", { day: "numeric", month: "long", year: "numeric" }) : "Not provided";
      document.getElementById("payment-event-date").textContent = `${dateText}${currentBooking.eventTime ? ` at ${currentBooking.eventTime}` : ""}`;
      document.getElementById("payment-country").textContent = `${currentBooking.country || "Not provided"}${currentBooking.countryISO ? ` (${currentBooking.countryISO})` : ""}`;
      document.getElementById("payment-total").textContent = amountText;
      const account = currentBooking.paymentDetails || {};
      document.getElementById("payment-bank").textContent = account.bankName || "";
      document.getElementById("payment-account-name").textContent = account.accountName || "";
      document.getElementById("payment-account-number").textContent = account.accountNumber || "";
      document.getElementById("payment-amount").textContent = amountText;
      document.getElementById("payment-narration").textContent = narration;
      document.getElementById("payment-amount-guidance").hidden = amountKnown;
      const allDetails = `Bank: ${account.bankName || ""}\nAccount Name: ${account.accountName || ""}\nAccount Number: ${account.accountNumber || ""}\nAmount: ${amountText}\nNarration: ${narration}`;
      const copyValues = { bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber, amount: amountPlain, narration, all: allDetails };
      document.querySelectorAll(".payment-copy").forEach(button => { button.dataset.copyValue = copyValues[button.dataset.copy] || ""; });
      const whatsappUrl = currentBooking.whatsappUrl || `https://wa.me/${PAYMENT_CONFIG.whatsappNumber}`;
      document.getElementById("payment-proof-whatsapp").href = whatsappUrl;
      document.querySelectorAll("[data-payment-help]").forEach(link => { link.href = `https://wa.me/${PAYMENT_CONFIG.whatsappNumber}`; });
      const expiresAt = Date.parse(currentBooking.expiresAt || "");
      const expiryNote = document.getElementById("payment-expiry-note");
      if (Number.isFinite(expiresAt)) {
        expiryNote.textContent = `Payment is due by ${new Date(expiresAt).toLocaleString(navigator.language || "en", { dateStyle: "medium", timeStyle: "short" })}.`;
        window.clearTimeout(expiryTimer);
        if (currentBooking.status === "pending_payment" && expiresAt > Date.now()) expiryTimer = window.setTimeout(refreshBookingStatus, expiresAt - Date.now() + 500);
      } else expiryNote.textContent = "";
      bookingForm.hidden = true;
      document.getElementById("booking-recovery").hidden = true;
      paymentScreen.hidden = false;
      document.body.classList.add("booking-payment-open");
      document.querySelectorAll("[data-booking-phase]").forEach((label, index) => { if (index === 3) label.setAttribute("aria-current", "step"); else label.removeAttribute("aria-current"); });
      history.replaceState({}, "", "#booking-payment");
      savePaymentReference(currentBooking.reference, options.step || currentPaymentStep || 1);
      setPaymentStep(options.step || currentPaymentStep || 1, false);
      renderPaymentStatus();
      if (options.focus !== false) requestAnimationFrame(() => paymentTitle.focus({ preventScroll: true }));
    }

    async function retrieveBooking(reference, email) {
      const response = await fetch(BOOKING_API_URL.replace("/api/book", "/api/booking/retrieve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || "We could not retrieve that booking.");
      return result;
    }

    async function refreshBookingStatus() {
      if (!currentBooking?.reference || !currentBooking?.email) return;
      try {
        const result = await retrieveBooking(currentBooking.reference, currentBooking.email);
        displayBookingPayment(result.booking, { paymentDetails: result.paymentDetails, emailStatus: result.emailStatus, step: currentPaymentStep, focus: false });
      } catch (error) {
        document.getElementById("payment-status-refresh").textContent = "We could not refresh the payment status. Try again shortly.";
      }
      if (currentBooking?.status === "awaiting_confirmation") {
        window.clearInterval(statusPollTimer);
        statusPollTimer = window.setInterval(refreshBookingStatus, 30_000);
      } else window.clearInterval(statusPollTimer);
    }
    bookingForm.addEventListener("submit", async event => {
      event.preventDefault();
      const status = document.getElementById("booking-status");
      if (!validateStep(steps[currentStep])) return;
      if (recaptchaWidgetId === null || !window.grecaptcha) {
        status.textContent = "Please wait for the reCAPTCHA check to load, then try again.";
        return;
      }
      const recaptchaToken = window.grecaptcha.getResponse(recaptchaWidgetId) || "";
      if (!recaptchaToken) {
        status.textContent = "Please complete the reCAPTCHA check before continuing.";
        return;
      }
      const submitButton = document.getElementById("booking-submit");
      status.textContent = "Submitting your booking securely...";
      const data = Object.fromEntries(new FormData(bookingForm));
      const service = selectedService();
      const offer = service?.offers.find(item => item.id === data.offerId && item.mode === data.mode);
      const quote = calculatePrice(data.serviceId, data.mode, data.offerId, Number(data.quantity), Number(data.extraHours || 0));
      if (!service || !offer || !quote) {
        status.textContent = "Please check the service, package, and quantity before continuing.";
        return;
      }
      const selectedCountry = bookingInputs.country;
      const selectedPhone = bookingInputs.phone;
      if (!selectedCountry || selectedCountry.isoCode !== "NG" || !selectedPhone.valid) {
        status.textContent = "Bookings are currently available in Nigeria only. Please check the phone number.";
        return;
      }
      if (String(data.website || "").trim()) return;
      const platform = data.mode === "virtual" ? (data.platformPreference === "Other" ? String(data.platformOther || "").trim() : String(data.platformPreference || "")) : "";
      if (!bookingIdempotencyKey) {
        const bytes = new Uint8Array(18);
        window.crypto.getRandomValues(bytes);
        bookingIdempotencyKey = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
      }
      const payload = {
        ...data,
        token: recaptchaToken,
        country: selectedCountry.name,
        countryISO: selectedCountry.isoCode,
        whatsapp: selectedPhone.e164,
        mode: data.mode,
        quantity: Number(data.quantity),
        extraHours: Number(data.extraHours || 0),
        eventDate: data.eventDate,
        eventTimezone: data.mode === "virtual" ? bookingInputs.timeZone : "",
        platform: platform,
      };
      submitButton.disabled = true;
      let result;
      try {
        const response = await fetch(BOOKING_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": bookingIdempotencyKey },
          body: JSON.stringify(payload),
        });
        const responseBody = await response.text();
        try { result = JSON.parse(responseBody); } catch { result = {}; }
        if (!response.ok || result.ok !== true) {
          console.error("Booking API response", { status: response.status, body: responseBody });
          const serverError = new Error(result.error || (response.status >= 500
            ? "The booking server encountered an error. Please retry in a moment."
            : `The booking request was rejected (${response.status}). Please review your details and retry.`));
          serverError.status = response.status;
          serverError.code = result.code || "BOOKING_REQUEST_FAILED";
          throw serverError;
        }
      } catch (error) {
        window.grecaptcha.reset(recaptchaWidgetId);
        console.error("Booking submission failed", { status: error.status || "network", code: error.code || "NETWORK_ERROR", error: error.message || "Unknown error" });
        status.textContent = error instanceof TypeError
          ? "We could not reach the booking server. Check your connection and retry."
          : error.message || "The booking could not be completed. Please retry.";
        let retry = document.getElementById("booking-retry");
        if (!retry) {
          retry = document.createElement("button");
          retry.type = "button";
          retry.id = "booking-retry";
          retry.className = "payment-copy";
          retry.textContent = "Retry booking";
          status.insertAdjacentElement("afterend", retry);
          retry.addEventListener("click", () => {
            retry.remove();
            bookingForm.requestSubmit();
          });
        }
        let fallback = document.getElementById("booking-whatsapp-fallback");
        if (!fallback) {
          fallback = document.createElement("a");
          fallback.id = "booking-whatsapp-fallback";
          fallback.href = "https://wa.me/2348038326349";
          fallback.target = "_blank";
          fallback.rel = "noopener noreferrer";
          fallback.textContent = "Contact Apex House on WhatsApp";
          fallback.style.marginLeft = "12px";
          status.insertAdjacentElement("afterend", fallback);
        }
        return;
      } finally {
        submitButton.disabled = false;
      }

        const booking = result.booking;
        if (!booking || booking.reference !== result.reference) {
          status.textContent = "The booking was saved, but we could not load its secure payment details. Use your email reference to recover it.";
          return;
        }
        booking.emailStatus = result.emailStatus || "sent";
        status.textContent = "Booking received. Review your service details to continue.";
        displayBookingPayment(booking, { paymentDetails: result.paymentDetails, emailStatus: result.emailStatus, step: 1 });
    });
    document.querySelectorAll(".payment-copy").forEach(button => button.addEventListener("click", async () => {
      const value = button.dataset.copyValue;
      if (!value) return;
      const label = button.querySelector("[data-copy-label]");
      const originalText = label?.textContent || "Copy";
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
          copied = true;
        }
      } catch {}
      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.focus(); textarea.select(); textarea.setSelectionRange(0, textarea.value.length);
        try { copied = document.execCommand("copy"); } catch { copied = false; }
        textarea.remove();
        button.focus({ preventScroll: true });
      }
      const announcement = document.getElementById("copy-announcement");
      if (button._copyTimer) window.clearTimeout(button._copyTimer);
      if (label) label.textContent = copied ? "Copied ✓" : "Copy failed";
      announcement.textContent = copied ? `${originalText.replace(/^Copy /, "")} copied.` : "Copy was not available on this browser.";
      button._copyTimer = window.setTimeout(() => { if (label) label.textContent = originalText; announcement.textContent = ""; }, 2000);
    }));

    document.getElementById("payment-edit-details").addEventListener("click", () => {
      window.clearInterval(statusPollTimer);
      window.clearTimeout(expiryTimer);
      currentBooking = null;
      bookingIdempotencyKey = "";
      try { sessionStorage.removeItem(PAYMENT_REFERENCE_KEY); sessionStorage.removeItem(PAYMENT_STEP_KEY); } catch {}
      paymentScreen.hidden = true;
      document.body.classList.remove("booking-payment-open");
      bookingForm.hidden = false;
      currentStep = 3;
      renderStep();
      history.replaceState({}, "", "#book");
      document.getElementById("booking-title").focus({ preventScroll: true });
    });
    document.getElementById("payment-continue-pay").addEventListener("click", () => setPaymentStep(2));
    document.getElementById("payment-back-review").addEventListener("click", () => setPaymentStep(1));
    document.getElementById("payment-made-transfer").addEventListener("click", () => setPaymentStep(3));
    document.getElementById("payment-back-pay").addEventListener("click", () => setPaymentStep(2));

    async function sendPaymentProof(method = "form") {
      const status = document.getElementById("payment-proof-status");
      const submit = document.getElementById("payment-submit-proof");
      const whatsappSent = document.getElementById("payment-whatsapp-sent");
      if (!currentBooking?.reference || !currentBooking?.email) {
        status.textContent = "Retrieve your booking with its reference and email before submitting proof.";
        return;
      }
      let body;
      const headers = {};
      if (method === "whatsapp") {
        body = JSON.stringify({ reference: currentBooking.reference, email: currentBooking.email, method: "whatsapp" });
        headers["Content-Type"] = "application/json";
        whatsappSent.disabled = true;
      } else {
        const fileInput = document.getElementById("proof-receipt");
        const file = fileInput.files?.[0];
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (file && (!allowedTypes.includes(file.type) || file.size > 4 * 1024 * 1024)) {
          status.textContent = "Choose a JPEG, PNG, WebP, or PDF receipt no larger than 4 MB.";
          return;
        }
        const senderName = document.getElementById("proof-sender-name").value.trim();
        const transferTime = document.getElementById("proof-transfer-time").value;
        if (!file && (!senderName || !transferTime)) {
          status.textContent = "Upload a receipt or enter both the sender name and transfer time.";
          return;
        }
        body = new FormData();
        body.append("reference", currentBooking.reference);
        body.append("email", currentBooking.email);
        body.append("method", "form");
        body.append("senderName", senderName);
        body.append("transferTime", transferTime);
        if (file) body.append("receipt", file, file.name);
        submit.disabled = true;
      }
      status.textContent = "Submitting your proof securely…";
      try {
        const response = await fetch(BOOKING_API_URL.replace("/api/book", "/api/booking/proof"), { method: "POST", headers, body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) throw new Error(result.error || "We could not submit your proof. Please try again.");
        currentBooking.status = result.status;
        document.getElementById("payment-proof-form").reset();
        status.textContent = result.emailStatus === "failed"
          ? "Payment awaiting confirmation. Your proof is saved, but the email notice could not be sent."
          : "Payment awaiting confirmation. We’ll email you after we verify the transfer.";
        renderPaymentStatus();
        window.clearInterval(statusPollTimer);
        statusPollTimer = window.setInterval(refreshBookingStatus, 30_000);
      } catch (error) {
        status.textContent = error.message || "We could not submit your proof. Please try again or use WhatsApp.";
      } finally {
        submit.disabled = false;
        whatsappSent.disabled = false;
      }
    }

    document.getElementById("payment-proof-form").addEventListener("submit", event => {
      event.preventDefault();
      sendPaymentProof("form");
    });
    document.getElementById("payment-whatsapp-sent").addEventListener("click", () => sendPaymentProof("whatsapp"));

    document.getElementById("payment-restart").addEventListener("click", restartBooking);
    document.getElementById("new-booking").addEventListener("click", restartBooking);
    function restartBooking() {
      window.clearInterval(statusPollTimer);
      window.clearTimeout(expiryTimer);
      currentBooking = null;
      bookingIdempotencyKey = "";
      currentPaymentStep = 1;
      try { sessionStorage.removeItem(PAYMENT_REFERENCE_KEY); sessionStorage.removeItem(PAYMENT_STEP_KEY); } catch {}
      paymentScreen.hidden = true;
      document.getElementById("booking-recovery").hidden = true;
      document.body.classList.remove("booking-payment-open");
      bookingForm.hidden = false;
      bookingForm.reset();
      bookingInputs.reset();
      updatePlatformOther(); updateNotesCount();
      currentStep = 0;
      history.replaceState({}, "", "#book");
      updateOffers(); renderStep();
      document.getElementById("booking-title").focus({ preventScroll: true });
    }

    const paymentRecovery = document.getElementById("booking-recovery");
    const recoveryReference = (() => { try { return sessionStorage.getItem(PAYMENT_REFERENCE_KEY) || ""; } catch { return ""; } })();
    if (/^APX-[A-F0-9]{24}$/.test(recoveryReference)) {
      paymentRecovery.hidden = false;
      document.getElementById("booking-recovery-reference").textContent = recoveryReference;
    }
    document.getElementById("booking-recovery-form").addEventListener("submit", async event => {
      event.preventDefault();
      const status = document.getElementById("booking-recovery-status");
      const button = document.getElementById("booking-recovery-submit");
      const email = document.getElementById("booking-recovery-email").value.trim();
      if (!recoveryReference || !email) { status.textContent = "Enter the email address used for this booking."; return; }
      button.disabled = true;
      status.textContent = "Retrieving your booking…";
      try {
        const result = await retrieveBooking(recoveryReference, email);
        const step = Number(sessionStorage.getItem(PAYMENT_STEP_KEY)) || 1;
        displayBookingPayment({ ...result.booking, email }, { paymentDetails: result.paymentDetails, emailStatus: result.emailStatus, step });
      } catch (error) {
        status.textContent = error.message || "We could not retrieve that booking.";
      } finally { button.disabled = false; }
    });

    document.querySelectorAll('input[name="eventDate"],input[name="alternateDate"]').forEach(input => input.min = localDateString());
    updateOffers();
    renderStep();
    document.getElementById("payment-bank").textContent = "";
    document.getElementById("payment-account-name").textContent = "";
    document.getElementById("payment-account-number").textContent = "";
