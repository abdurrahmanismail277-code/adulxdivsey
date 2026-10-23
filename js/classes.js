const instituteVideos = [
    { id: "vn7IMYGSZ7A", title: "Kid Classes", category: "Hifdh", thumbnail: "/images/hero-quran.jpg" },
    { id: "O2o5pqL2tI8", title: "Tajweed Class Day 2", category: "Tajweed", thumbnail: "/course-nurul-yaqeen.jpeg" },
    { id: "sfttGE9uEAA", title: "Arabiyah Lesson", category: "Arabiyah", thumbnail: "/course-arabic-lessons.jpeg" }
  ];

  (function () {
    const grid = document.getElementById("video-grid");
    const lightbox = document.getElementById("video-lightbox");
    const dialog = lightbox && lightbox.querySelector('[role="dialog"]');
    const media = document.getElementById("video-lightbox-media");
    const closeButton = lightbox && lightbox.querySelector(".video-lightbox-close");
    if (!grid || !lightbox || !dialog || !media || !closeButton) return;

    let activeTrigger = null;

    instituteVideos.forEach(function (video) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "video-card";

      const image = document.createElement("img");
      image.className = "video-thumb";
      image.src = video.thumbnail;
      image.width = 720;
      image.height = 1280;
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = "";
      image.dataset.fallbackUsed = "false";
      image.addEventListener("error", function () {
        if (image.dataset.fallbackUsed === "false") {
          image.dataset.fallbackUsed = "true";
          image.src = "https://i.ytimg.com/vi/" + encodeURIComponent(video.id) + "/hqdefault.jpg";
        } else {
          image.classList.add("video-thumb-unavailable");
        }
      });

      const play = document.createElement("span");
      play.className = "video-play";
      play.setAttribute("aria-hidden", "true");

      const caption = document.createElement("span");
      caption.className = "video-caption";
      caption.innerHTML = '<span class="video-caption-title"></span><span class="video-caption-category"></span>';
      caption.querySelector(".video-caption-title").textContent = video.title;
      caption.querySelector(".video-caption-category").textContent = video.category;

      card.append(image, play, caption);
      card.addEventListener("click", function () { openVideo(video, card); });
      grid.appendChild(card);
    });

    function openVideo(video, trigger) {
      activeTrigger = trigger;
      const frame = document.createElement("iframe");
      frame.className = "video-lightbox-frame";
      frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.id) + "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
      frame.title = video.title;
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      frame.loading = "eager";
      media.replaceChildren(frame);
      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("video-lightbox-open");
      closeButton.focus();
    }

    function closeVideo() {
      if (!lightbox.classList.contains("open")) return;
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("video-lightbox-open");
      media.replaceChildren();
      if (activeTrigger) activeTrigger.focus();
      activeTrigger = null;
    }

    closeButton.addEventListener("click", closeVideo);
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeVideo();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeVideo();
      if (event.key !== "Tab" || !lightbox.classList.contains("open")) return;
      const focusable = Array.from(dialog.querySelectorAll('button, iframe, a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function (element) { return element.getClientRects().length > 0; });
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });
  })();

  