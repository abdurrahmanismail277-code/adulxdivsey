
  (() => {
    const player = document.getElementById("sponsorship-player");
    const poster = document.getElementById("sponsorship-play");
    const video = document.getElementById("sponsorship-video");
    const hint = document.getElementById("sponsorship-hint");
    const error = document.getElementById("sponsorship-error");
    if (!player || !poster || !video || !error) return;

    let activated = false;
    const posterPath = "/images/sponsorship-poster.jpg"; // Replace with the final poster path.

    poster.addEventListener("click", () => {
      if (activated) { video.play().catch(() => {}); return; }
      activated = true;
      poster.hidden = true;
      if (hint) hint.hidden = true;
      video.preload = "metadata";
      video.poster = posterPath;
      video.hidden = false;
      video.addEventListener("error", () => {
        video.pause();
        player.dataset.state = "error";
        error.hidden = false;
      }, { once:true });

      // If captions are added, include a <track kind="captions"> element here.
      video.load();
      player.dataset.state = "playing";
      video.play().catch(() => {});

      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].intersectionRatio < 0.25) video.pause();
        }, { threshold:[0,0.25] });
        observer.observe(player);
      }
    });

    document.addEventListener("play", (event) => {
      if (event.target instanceof HTMLVideoElement && event.target !== video) event.target.pause();
    }, true);
  })();
