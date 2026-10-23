//  COURSES DATA
  const courses = {
    Monthly: [
      { name: "General Qur'an Class", price: 10000 },
      { name: "General Qur'an + Arabiyah", price: 15000 },
      { name: "Personalized Qur'an Class", price: 15000 },
      { name: "Kids Qur'an Session (Ages 5-12)", price: 15000 },
      { name: "Teens Qur'an Class (Ages 13-19)", price: 15000 },
      { name: "Muraja'ah Class", price: 10000 },
      { name: "Personalized Qur'an + Arabiyah", price: 25000 },
    ],
    Termly: [
      { name: "General Qur'an Class", price: 27000 },
      { name: "General Qur'an + Arabiyah", price: 40000 },
      { name: "Personalized Qur'an Class", price: 40000 },
      { name: "Personalized Qur'an + Arabiyah", price: 70000 },
    ]
  };

  const courseCatalog = [
    { name: "General Qur'an Class", type: "General", monthly: 10000, termly: 27000 },
    { name: "General Qur'an + Arabiyah", type: "General", monthly: 15000, termly: 40000 },
    { name: "Personalized Qur'an Class", type: "Personalized", monthly: 15000, termly: 40000 },
    { name: "Kids Qur'an Session (Ages 5-12)", type: "Age Group", monthly: 15000, termly: null },
    { name: "Teens Qur'an Class (Ages 13-19)", type: "Age Group", monthly: 15000, termly: null },
    { name: "Muraja'ah Class", type: "Revision", monthly: 10000, termly: null },
    { name: "Personalized Qur'an + Arabiyah", type: "Personalized", monthly: 25000, termly: 70000 }
  ];

  const PAYSTACK_PAYMENT_URLS = {
    "General Qur'an Class|Monthly": "https://paystack.shop/pay/z6bhxnht19",
    "General Qur'an + Arabiyah|Monthly": "https://paystack.shop/pay/generalclassarqm",
    "Personalized Qur'an Class|Monthly": "https://paystack.shop/pay/ysyyutggra",
    "Kids Qur'an Session (Ages 5-12)|Monthly": "https://paystack.shop/pay/kidclassarqm",
    "Teens Qur'an Class (Ages 13-19)|Monthly": "https://paystack.shop/pay/ujnklkevv-",
    "Muraja'ah Class|Monthly": "",
    "Personalized Qur'an + Arabiyah|Monthly": "https://paystack.shop/pay/b79ia5pmhw",
    "General Qur'an Class|Termly": "https://paystack.shop/pay/c023459b83",
    "General Qur'an + Arabiyah|Termly": "https://paystack.shop/pay/kdr-qcer81",
    "Personalized Qur'an Class|Termly": "https://paystack.shop/pay/1restyv97a",
    "Personalized Qur'an + Arabiyah|Termly": "https://paystack.shop/pay/1af-rxurmj"
  };

  let selectedCourse = null;

  function getPaystackUrl(course) {
    if (!course) return "#";
    return PAYSTACK_PAYMENT_URLS[`${course.name}|${course.billing}`] || "";
  }

  function formatNaira(amount) {
    return "\uD83C\uDDF3\uD83C\uDDEC " + Number(amount).toLocaleString();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
  }

  function isValidPhone(phone) {
    const cleanedPhone = String(phone).trim();
    const digitsOnly = cleanedPhone.replace(/\D/g, "");

    return (
      digitsOnly.length >= 7 &&
      digitsOnly.length <= 15 &&
      /^\+?[0-9][0-9\s().-]*$/.test(cleanedPhone)
    );
  }

  function validateApplicantDetails() {
    const nameInput = document.getElementById("field-name");
    const phoneInput = document.getElementById("field-phone");
    const emailInput = document.getElementById("field-email");
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();

    if (!name || !phone || !email) {
      alert("Please fill in your name, phone number, and email address.");
      if (!name) nameInput.focus();
      else if (!phone) phoneInput.focus();
      else emailInput.focus();
      return false;
    }

    if (!isValidPhone(phone)) {
      alert("Invalid phone number. Please enter a correct phone number.");
      phoneInput.focus();
      return false;
    }

    if (!isValidEmail(email)) {
      alert("Invalid email address. Please enter a correct email address.");
      emailInput.focus();
      return false;
    }

    return true;
  }

  function showStage(stageNumber) {
    document.querySelectorAll(".stage-panel").forEach((panel) => panel.classList.remove("active"));
    document.getElementById(`stage-${stageNumber}`).classList.add("active");
    const stageTitle = document.getElementById(`stage-title-${stageNumber}`);
    document.getElementById("modal").setAttribute("aria-labelledby", stageTitle.id);

    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById(`dot-${i}`);
      dot.classList.toggle("active", i === stageNumber);
      dot.classList.toggle("done", i < stageNumber);
    }

    document.getElementById("line-1").classList.toggle("done", stageNumber > 1);
    document.getElementById("line-2").classList.toggle("done", stageNumber > 2);
    stageTitle.focus();
  }

  let modalReturnFocus = null;
  function openPortal(courseName, amount, billing) {
    selectedCourse = { name: courseName, amount, billing };
    modalReturnFocus = document.activeElement;
    document.getElementById("modal").classList.add("open");
    renderSelectedCourse();
    showStage(1);
  }

  function closeModal() {
    document.getElementById("modal").classList.remove("open");
    if (modalReturnFocus && typeof modalReturnFocus.focus === "function") modalReturnFocus.focus();
  }

  document.addEventListener("keydown", function (event) {
    const modal = document.getElementById("modal");
    if (!modal || !modal.classList.contains("open")) return;
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  function handleOverlayClick(event) {
    if (event.target.id === "modal") closeModal();
  }

  function renderSelectedCourse() {
    const grid = document.getElementById("course-grid");

    if (!selectedCourse) {
      grid.innerHTML = "";
      updateEnrollmentSubmitState();
      return;
    }

    grid.innerHTML = `
      <div class="course-card selected">
        <div class="course-card-name">${selectedCourse.name}</div>
        <div class="course-card-price">${formatNaira(selectedCourse.amount)} ${selectedCourse.billing}</div>
      </div>
    `;

    updateEnrollmentSubmitState();
  }

  let applicationSubmitting = false;
  window.applicationTurnstileToken = "";

  function updateEnrollmentSubmitState() {
    const button = document.getElementById("btn-to-stage3");
    if (button) button.disabled = applicationSubmitting || !selectedCourse || !window.applicationTurnstileToken;
  }

  function resetApplicationTurnstile() {
    window.applicationTurnstileToken = "";
    const widget = window.applicationTurnstileWidget;
    if (window.turnstile && widget !== undefined) window.turnstile.reset(widget);
    updateEnrollmentSubmitState();
  }

  function goStage1() {
    showStage(1);
  }

  function goStage2() {
    if (!validateApplicantDetails()) {
      return;
    }

    renderSelectedCourse();
    showStage(2);
  }

  function buildApplicationReference(application) {
    const initials = application.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "AI";
    const stamp = Date.now().toString(36).toUpperCase();
    return `ENR-${initials}-${stamp}`;
  }

  async function goStage3() {
    const errorMessage = document.getElementById("application-error");
    errorMessage.hidden = true;
    errorMessage.textContent = "";

    if (!selectedCourse) {
      errorMessage.textContent = "Please select a course first.";
      errorMessage.hidden = false;
      resetApplicationTurnstile();
      return;
    }

    if (!validateApplicantDetails()) {
      resetApplicationTurnstile();
      return;
    }

    const turnstileToken = window.applicationTurnstileToken;
    if (!turnstileToken) {
      errorMessage.textContent = "Please complete the security check before continuing.";
      errorMessage.hidden = false;
      resetApplicationTurnstile();
      return;
    }

    const application = {
      name: document.getElementById("field-name").value.trim(),
      phone: document.getElementById("field-phone").value.trim(),
      email: document.getElementById("field-email").value.trim(),
      course: selectedCourse.name,
      billing: selectedCourse.billing,
      amount: selectedCourse.amount
    };

    applicationSubmitting = true;
    updateEnrollmentSubmitState();
    try {
      const response = await fetch(window.CONTACT_API_URL || "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...application, source: "application-enrollment", "cf-turnstile-response": turnstileToken })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "We could not submit your application. Please try again.");
    } catch (error) {
      errorMessage.textContent = error.message || "We could not submit your application. Please try again.";
      errorMessage.hidden = false;
      resetApplicationTurnstile();
      applicationSubmitting = false;
      updateEnrollmentSubmitState();
      return;
    }
    resetApplicationTurnstile();
    applicationSubmitting = false;

    const applicationId = buildApplicationReference(application);
    const paystackUrl = getPaystackUrl(selectedCourse);
    const paystackButton = document.getElementById("btn-paystack-final");
    const paymentNote = document.getElementById("payment-note");

    document.getElementById("sum-name").textContent = application.name;
    document.getElementById("sum-phone").textContent = application.phone;
    document.getElementById("sum-email").textContent = application.email;
    document.getElementById("sum-course").textContent = application.course;
    document.getElementById("sum-billing").textContent = application.billing;
    document.getElementById("sum-application-id").textContent = applicationId;
    document.getElementById("sum-amount").textContent = formatNaira(application.amount);
    document.getElementById("pay-amount").textContent = formatNaira(application.amount);
    document.getElementById("pay-course").textContent = application.course;

    if (paystackUrl) {
      paystackButton.href = paystackUrl;
      paystackButton.removeAttribute("aria-disabled");
      paystackButton.textContent = "Continue to Paystack";
      paymentNote.classList.remove("warning");
      paymentNote.textContent = "You will be taken to Paystack to complete payment with card, transfer, or any available checkout option.";
    } else {
      paystackButton.href = "https://wa.me/2348082062525?text=Assalamualaikum%20Waramatullahi%20Wabarakatu%20I%20want%20to%20enroll%20for%20Muraja'ah%20Class.";
      paystackButton.textContent = "Request Payment Link";
      paystackButton.setAttribute("aria-disabled", "true");
      paymentNote.classList.add("warning");
      paymentNote.textContent = "The Paystack payment link for this class needs to be added. Please request the payment link on WhatsApp.";
    }

    showStage(3);
    updateEnrollmentSubmitState();
    if (paystackUrl) {
      window.location.href = paystackUrl;
    }
  }

  function switchTab(tabName, button) {
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.remove("active"));
    document.querySelectorAll(".plans-group").forEach((group) => group.classList.remove("active"));

    const tabButton = button || document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
    const tabPanel = document.getElementById(`tab-${tabName}`);

    if (tabButton) tabButton.classList.add("active");
    if (tabPanel) tabPanel.classList.add("active");
  }

  function switchTabFooter(tabName) {
    switchTab(tabName);
  }

  function toggleFaq(button) {
    const item = button.closest(".faq-item");
    const open = !item.classList.contains("open");
    item.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    item.querySelector(".faq-a").setAttribute("aria-hidden", String(!open));
  }

  //  LOGO / MISSION / VISION CAROUSEL
  (function () {
    const track = document.getElementById("mission-track");
    if (!track) return;

    const slides = Array.from(track.querySelectorAll(".mission-card"));
    const dots = Array.from(document.querySelectorAll("#mission-dots .mission-dot"));
    const prev = document.getElementById("mission-prev");
    const next = document.getElementById("mission-next");
    let current = 0;
    let autoTimer;

    function render() {
      track.style.transform = "translateX(-" + current * 100 + "%)";
      dots.forEach(function (dot, index) {
        dot.classList.toggle("active", index === current);
      });
    }

    function goTo(index) {
      current = (index + slides.length) % slides.length;
      render();
      resetAuto();
    }

    function resetAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(function () {
        goTo(current + 1);
      }, 5000);
    }

    dots.forEach(function (dot, index) {
      dot.addEventListener("click", function () {
        goTo(index);
      });
    });

    prev.addEventListener("click", function () {
      goTo(current - 1);
    });

    next.addEventListener("click", function () {
      goTo(current + 1);
    });

    render();
    resetAuto();
  })();

  //  TESTIMONIALS CAROUSEL
  (function () {
    const track = document.getElementById('t-track');
    if (!track) return;
    const cards = Array.from(track.querySelectorAll('.t-card'));
    const dots = Array.from(document.querySelectorAll('#t-dots .dot'));
    const total = cards.length;
    let current = 2;
    let autoTimer;

    function cardWidth() {
      return cards[0].offsetWidth + 20;
    }

    function offset() {
      const wrapW = track.parentElement.offsetWidth;
      const cw = cardWidth();
      return wrapW / 2 - cw / 2 - current * cw;
    }

    function render(animate) {
      track.style.transition = animate ? 'transform 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
      track.style.transform = 'translateX(' + offset() + 'px)';

      cards.forEach(function (card, i) {
        card.classList.remove('active', 'near-active');
        var diff = Math.abs(i - current);
        if (diff === 0) card.classList.add('active');
        else if (diff === 1) card.classList.add('near-active');
      });

      dots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === current);
      });
    }

    function goTo(index) {
      current = (index + total) % total;
      render(true);
      resetAuto();
    }

    function resetAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(function () { goTo(current + 1); }, 4500);
    }

    cards.forEach(function (card, i) {
      card.addEventListener('click', function () { if (i !== current) goTo(i); });
    });

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); });
    });

    document.getElementById('t-prev').addEventListener('click', function () { goTo(current - 1); });
    document.getElementById('t-next').addEventListener('click', function () { goTo(current + 1); });

    window.addEventListener('resize', function () { render(false); });

    render(false);
    setTimeout(function () { render(false); }, 60);
    resetAuto();
  })();

const enrollmentPlans = {
  "general-quran-monthly": ["General Qur'an Class", 10000, "Monthly"],
  "general-quran-arabiyah-monthly": ["General Qur'an + Arabiyah", 15000, "Monthly"],
  "personalized-quran-monthly": ["Personalized Qur'an Class", 15000, "Monthly"],
  "kids-quran-monthly": ["Kids Qur'an Session (Ages 5-12)", 15000, "Monthly"],
  "teens-quran-monthly": ["Teens Qur'an Class (Ages 13-19)", 15000, "Monthly"],
  "murajaah-monthly": ["Muraja'ah Class", 10000, "Monthly"],
  "personalized-quran-arabiyah-monthly": ["Personalized Qur'an + Arabiyah", 25000, "Monthly"],
  "general-quran-termly": ["General Qur'an Class", 27000, "Termly"],
  "general-quran-arabiyah-termly": ["General Qur'an + Arabiyah", 40000, "Termly"],
  "personalized-quran-termly": ["Personalized Qur'an Class", 40000, "Termly"],
  "personalized-quran-arabiyah-termly": ["Personalized Qur'an + Arabiyah", 70000, "Termly"]
};
const selectedPlan = enrollmentPlans[new URLSearchParams(location.search).get("plan")] || enrollmentPlans["general-quran-monthly"];
openPortal(...selectedPlan);
