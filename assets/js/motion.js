(() => {
  const root = document.documentElement;
  const paragraph = document.querySelector(".hero-copy > p");
  if (paragraph && !root.classList.contains("hero-motion-initialized")) {

  const originalParagraphHeight = paragraph.getBoundingClientRect().height;
  const originalText = paragraph.textContent.replace(/\s+/g, " ").trim();
  paragraph.setAttribute("aria-label", originalText);

  const words = originalText.split(" ");
  const fragment = document.createDocumentFragment();
  const wordSpans = [];
  let highlight;
  const makeWord = (word, index, parent) => {
    const span = document.createElement("span");
    span.className = "hero-word";
    span.setAttribute("aria-hidden", "true");
    span.textContent = word;
    span.style.transitionDelay = `${index * 40}ms`;
    parent.append(span);
    wordSpans.push(span);
    return span;
  };

  if (paragraph.querySelector(".circle-word")) {
    let wordIndex = 0;
    [...paragraph.childNodes].forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) {
        fragment.append(node);
        return;
      }
      const parts = node.nodeValue.match(/\s+|\S+/g) || [];
      parts.forEach(part => {
        if (/^\s+$/.test(part)) fragment.append(document.createTextNode(part));
        else makeWord(part, wordIndex++, fragment);
      });
    });
  } else {
    for (let index = 0; index < words.length; index += 1) {
      if (words[index] === "meaningful" && words[index + 1] === "moments") {
        highlight = document.createElement("span");
        highlight.className = "hero-highlight";
        fragment.append(highlight);
        makeWord(words[index], index, highlight);
        highlight.append(document.createTextNode(" "));
        makeWord(words[index + 1], index + 1, highlight);
        index += 1;
      } else {
        makeWord(words[index], index, fragment);
      }
      if (index < words.length - 1) fragment.append(document.createTextNode(" "));
    }
  }
  paragraph.replaceChildren(fragment);
  paragraph.style.minHeight = `${originalParagraphHeight}px`;
  const reserveParagraphHeight = () => {
    paragraph.style.minHeight = "";
    window.requestAnimationFrame(() => {
      paragraph.style.minHeight = `${paragraph.getBoundingClientRect().height}px`;
    });
  };
  window.addEventListener("resize", () => window.requestAnimationFrame(reserveParagraphHeight), { passive: true });

  const heroActions = paragraph.parentElement.querySelector(".hero-actions");
  const heroServiceChooser = paragraph.parentElement.querySelector(".hero-service-chooser");
  const heroButtons = [heroActions, heroServiceChooser].filter(Boolean);
  heroButtons.forEach(element => element.classList.add("hero-buttons-pending"));

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let introObserver;
  let introFallback;
  let revealTimer;
  let buttonsTimer;
  const reveal = () => wordSpans.forEach(span => span.classList.add("is-visible"));
  const drawHighlight = () => highlight?.classList.add("is-drawn");
  const revealButtons = () => heroButtons.forEach(element => element.classList.add("is-visible"));
  const scheduleButtons = () => {
    if (motionPreference.matches) {
      revealButtons();
      return;
    }
    buttonsTimer = window.setTimeout(revealButtons, 300);
  };
  const lastWord = wordSpans[wordSpans.length - 1];
  const onLastWordRevealed = event => {
    if (event.propertyName !== "opacity") return;
    drawHighlight();
    scheduleButtons();
    lastWord.removeEventListener("transitionend", onLastWordRevealed);
  };
  lastWord?.addEventListener("transitionend", onLastWordRevealed);
  const startReveal = () => {
    if (motionPreference.matches) {
      reveal();
      drawHighlight();
      revealButtons();
      return;
    }
    revealTimer = window.setTimeout(reveal, 300);
  };

  const intro = document.getElementById("intro-screen");
  if (intro && !intro.hidden && !motionPreference.matches) {
    introObserver = new MutationObserver(() => {
      if (!intro.hidden && !intro.classList.contains("intro-finished")) return;
      introObserver.disconnect();
      if (introFallback) window.clearTimeout(introFallback);
      startReveal();
    });
    introObserver.observe(intro, { attributes: true, attributeFilter: ["hidden", "class"] });
    introFallback = window.setTimeout(() => {
      introObserver.disconnect();
      startReveal();
    }, 3400);
  } else {
    startReveal();
  }

  motionPreference.addEventListener?.("change", event => {
    if (!event.matches) return;
    if (revealTimer) window.clearTimeout(revealTimer);
    if (buttonsTimer) window.clearTimeout(buttonsTimer);
    if (introObserver) introObserver.disconnect();
    if (introFallback) window.clearTimeout(introFallback);
    reveal();
    drawHighlight();
    revealButtons();
  });

    root.classList.add("hero-motion-initialized");
  }

  const flowElements = [...document.querySelectorAll("[data-flow]")];
  const flowHeights = new Map(flowElements.map(element => [element, element.getBoundingClientRect().height]));
  const flowWords = new Map();
  let animatedWordCount = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lowEndDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4);

  const accessibleText = element => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("br").forEach(lineBreak => lineBreak.replaceWith(" "));
    return clone.textContent.replace(/\s+/g, " ").trim();
  };

  const prepareFlow = element => {
    const reservedHeight = flowHeights.get(element);
    element.setAttribute("aria-label", accessibleText(element));
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let wordIndex = 0;
    textNodes.forEach(textNode => {
      const parts = textNode.nodeValue.match(/\s+|\S+/g) || [];
      if (!parts.some(part => /\S/.test(part))) return;
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (/^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const word = document.createElement("span");
        word.className = "flow-word";
        word.setAttribute("aria-hidden", "true");
        word.textContent = part;
        fragment.append(word);
        wordIndex += 1;
      });
      textNode.replaceWith(fragment);
    });

    const words = [...element.querySelectorAll(":scope > .flow-word, .flow-word")];
    const baseStagger = element.dataset.flowSpeed === "fast" ? 30 : 60;
    const stagger = words.length > 1 ? Math.min(baseStagger, 1200 / (words.length - 1)) : 0;
    words.forEach((word, index) => {
      word.style.transitionDelay = `${index * stagger}ms`;
    });
    animatedWordCount += words.length;
    flowWords.set(element, {
      words,
      highlights: [...element.querySelectorAll("mark[data-flow-highlight]")],
      duration: words.length ? 600 + stagger * (words.length - 1) : 0
    });
    element.style.minHeight = `${Math.ceil(reservedHeight)}px`;
  };
  flowElements.forEach(prepareFlow);

  if (lowEndDevice || animatedWordCount > 150) root.classList.add("flow-no-blur");

  const showFlow = element => {
    const flow = flowWords.get(element);
    if (!flow) return;
    flow.words.forEach(word => word.classList.add("is-visible"));
    if (flow.highlights.length) after(() => flow.highlights.forEach(mark => mark.classList.add("flow-highlight-drawn")), flow.duration);
  };
  const flowDuration = element => flowWords.get(element)?.duration || 0;
  const timers = new Set();
  const after = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  const supportsObserver = "IntersectionObserver" in window && !reducedMotion.matches;
  const aboutSection = document.querySelector(".why#about");
  const insightsPage = document.querySelector(".insights#insights");
  const sequenceSection = aboutSection || insightsPage;
  const eyebrow = sequenceSection?.querySelector(".flow-eyebrow");
  const line = insightsPage?.querySelector(".insight-header");
  const heading = sequenceSection?.querySelector("h1[data-flow], h2[data-flow]");
  const intro = sequenceSection?.querySelector(".section-intro[data-flow], .insight-deck[data-flow]");
  const cards = [...(sequenceSection?.querySelectorAll("[data-flow-card]") || [])];
  const managedFlow = new Set([heading, intro, ...cards.flatMap(card => [...card.querySelectorAll("[data-flow]")])].filter(Boolean));

  const revealAll = () => {
    flowElements.forEach(showFlow);
    document.querySelectorAll("[data-flow-card]").forEach(card => card.classList.add("flow-card-visible"));
    document.querySelectorAll("[data-flow-count]").forEach(counter => { counter.textContent = counter.dataset.flowCount; });
    eyebrow?.classList.add("flow-eyebrow-visible");
    line?.classList.add("flow-line-visible");
  };

  const animateFlow = element => {
    if (!element) return;
    showFlow(element);
    return flowDuration(element);
  };

  const countUp = counter => {
    const finalText = counter.dataset.flowCount;
    const target = Number(finalText);
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const step = now => {
      if (reducedMotion.matches) {
        counter.textContent = finalText;
        return;
      }
      const progress = Math.min(1, (now - start) / 1200);
      const eased = 1 - (1 - progress) ** 4;
      counter.textContent = String(Math.floor(target * eased)).padStart(finalText.length, "0");
      if (progress < 1) requestAnimationFrame(step);
      else counter.textContent = finalText;
    };
    counter.textContent = "0".repeat(finalText.length);
    requestAnimationFrame(step);
  };

  const armCards = () => {
    if (!supportsObserver) {
      cards.forEach(card => {
        card.classList.add("flow-card-visible");
        const title = card.querySelector("h3[data-flow]");
        const copy = card.querySelector("p[data-flow]");
        showFlow(title);
        showFlow(copy);
        const counter = card.querySelector("[data-flow-count]");
        if (counter) counter.textContent = counter.dataset.flowCount;
      });
      return;
    }
    const cardObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      cardObserver.unobserve(card);
      const index = cards.indexOf(card);
      after(() => {
        card.classList.add("flow-card-visible");
        const counter = card.querySelector("[data-flow-count]");
        if (counter) countUp(counter);
        after(() => {
          const textElements = [...card.querySelectorAll("[data-flow]")];
          let delay = 0;
          textElements.forEach(element => {
            after(() => animateFlow(element), delay);
            delay += flowDuration(element);
          });
        }, 600);
      }, index * 120);
    }), { threshold: 0.25 });
    cards.forEach(card => cardObserver.observe(card));
  };

  if (!supportsObserver) {
    revealAll();
  } else {
    const standaloneFlow = flowElements.filter(element => !managedFlow.has(element));
    const flowObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      flowObserver.unobserve(entry.target);
      animateFlow(entry.target);
    }), { threshold: 0.25 });
    standaloneFlow.forEach(element => flowObserver.observe(element));

    if (heading && intro && cards.length) {
      const sequenceObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        sequenceObserver.unobserve(entry.target);
        eyebrow?.classList.add("flow-eyebrow-visible");
        line?.classList.add("flow-line-visible");
        after(() => {
          animateFlow(heading);
          after(() => {
            animateFlow(intro);
            after(() => armCards(), flowDuration(intro));
          }, flowDuration(heading) + 150);
        }, 100);
      }), { threshold: 0.25 });
      sequenceObserver.observe(heading);
    } else if (cards.length) {
      armCards();
    }
  }

  reducedMotion.addEventListener?.("change", event => {
    if (!event.matches) return;
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
    revealAll();
  });

  const revealItems = [...document.querySelectorAll(".reveal")];
  if (revealItems.length) {
    if (!supportsObserver || typeof window.IntersectionObserver !== "function") {
      revealItems.forEach(item => item.classList.add("is-visible"));
    } else {
      try {
        const rowTops = revealItems.map(item => item.getBoundingClientRect().top);
        const rowIndices = revealItems.map((item, index) =>
          rowTops.slice(0, index).filter(top => Math.abs(top - rowTops[index]) < 2).length
        );
        const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const item = entry.target;
          revealObserver.unobserve(item);
          item.style.transitionDelay = `${rowIndices[revealItems.indexOf(item)] * 120}ms`;

          const clearDelay = event => {
            if (event.propertyName !== "opacity") return;
            item.style.transitionDelay = "";
            item.removeEventListener("transitionend", clearDelay);
          };
          item.addEventListener("transitionend", clearDelay);
          item.classList.add("is-visible");
        }), {
          threshold: 0.15,
          rootMargin: "0px 0px -50px 0px"
        });
        revealItems.forEach(item => revealObserver.observe(item));
      } catch (error) {
        revealItems.forEach(item => item.classList.add("is-visible"));
      }
    }
  }

  root.classList.add("js-ready");
})();
