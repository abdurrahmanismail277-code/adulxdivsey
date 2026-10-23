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
