
    (() => {
      const dial = document.getElementById('connect-dial');
      const toggle = document.getElementById('connect-toggle');
      if (!dial || !toggle) return;
      const setOpen = open => {
        dial.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close social and booking options' : 'Open social and booking options');
      };
      toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
      document.addEventListener('click', event => {
        if (!dial.contains(event.target) && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          setOpen(false);
          toggle.focus();
        }
      });
    })();



    const INSTAGRAM_URL = "https://instagram.com/the.apex.house";
    const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61595060085783";
    // Mobile navigation and gentle reveal; respects reduced-motion preferences.
    const introScreen=document.getElementById('intro-screen');
    const dismissIntro=()=>{if(!introScreen||introScreen.hidden)return;introScreen.hidden=true};
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)introScreen.hidden=true;
    document.getElementById('intro-skip').addEventListener('click',dismissIntro);document.getElementById('intro-enter').addEventListener('click',dismissIntro);
    const finishIntro=()=>{if(!introScreen||introScreen.hidden)return;introScreen.classList.add('intro-finished');introScreen.inert=true;introScreen.setAttribute('aria-hidden','true')};
    window.setTimeout(finishIntro,3100);
    const themeButton=document.querySelector('.theme-toggle');
    const themeRoot=document.documentElement;
    const accessibilityTrigger=document.getElementById('accessibility-trigger');
    const accessibilityPanel=document.getElementById('accessibility-panel');
    const textSizeToggle=document.getElementById('text-size-toggle');
    const contrastToggle=document.getElementById('contrast-toggle');
    const accessibilityReset=document.getElementById('accessibility-reset');
    const setAccessibilityOption=(key,button,attribute)=>{let enabled=false;try{enabled=localStorage.getItem(key)==='true'}catch(e){}if(enabled)themeRoot.setAttribute(attribute,'true');button.setAttribute('aria-pressed',String(enabled))};
    setAccessibilityOption('apex-large-text',textSizeToggle,'data-large-text');
    setAccessibilityOption('apex-high-contrast',contrastToggle,'data-high-contrast');
    const updateAccessibilityOption=(key,button,attribute)=>{const enabled=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(enabled));if(enabled)themeRoot.setAttribute(attribute,'true');else themeRoot.removeAttribute(attribute);try{localStorage.setItem(key,String(enabled))}catch(e){}};
    textSizeToggle.addEventListener('click',()=>updateAccessibilityOption('apex-large-text',textSizeToggle,'data-large-text'));
    contrastToggle.addEventListener('click',()=>updateAccessibilityOption('apex-high-contrast',contrastToggle,'data-high-contrast'));
    accessibilityReset.addEventListener('click',()=>{themeRoot.removeAttribute('data-large-text');themeRoot.removeAttribute('data-high-contrast');textSizeToggle.setAttribute('aria-pressed','false');contrastToggle.setAttribute('aria-pressed','false');try{localStorage.removeItem('apex-large-text');localStorage.removeItem('apex-high-contrast')}catch(e){}});
    accessibilityTrigger.addEventListener('click',()=>{const open=accessibilityTrigger.getAttribute('aria-expanded')!=='true';accessibilityTrigger.setAttribute('aria-expanded',String(open));accessibilityTrigger.setAttribute('aria-label',open?'Close accessibility settings':'Open accessibility settings');accessibilityPanel.hidden=!open;if(open)textSizeToggle.focus()});
    document.addEventListener('click',event=>{if(!accessibilityPanel.hidden&&!event.target.closest('.accessibility')){accessibilityPanel.hidden=true;accessibilityTrigger.setAttribute('aria-expanded','false');accessibilityTrigger.setAttribute('aria-label','Open accessibility settings')}});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!accessibilityPanel.hidden){accessibilityPanel.hidden=true;accessibilityTrigger.setAttribute('aria-expanded','false');accessibilityTrigger.setAttribute('aria-label','Open accessibility settings');accessibilityTrigger.focus()}});
    const syncThemeButton=()=>{const dark=themeRoot.dataset.theme==='dark';themeButton.dataset.activeTheme=dark?'dark':'light';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');themeButton.title=dark?'Switch to light mode':'Switch to dark mode'};
    syncThemeButton();
    themeButton.addEventListener('click',()=>{const dark=themeRoot.dataset.theme!=='dark';themeRoot.dataset.theme=dark?'dark':'light';try{localStorage.setItem('apex-theme',dark?'dark':'light')}catch(e){}syncThemeButton()});
    const testimonialCarousel=document.querySelector('.testimonial-carousel');
    if(testimonialCarousel){
      const testimonialTrack=document.getElementById('testimonial-track');
      const testimonialSlides=[...testimonialTrack.querySelectorAll('.testimonial-slide')];
      testimonialSlides.forEach(slide=>{const image=slide.querySelector('img');image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label',`${image.alt}. Open full-size image in a new tab`);const enlarge=()=>window.open(image.currentSrc||image.src,'_blank','noopener');image.addEventListener('click',enlarge);image.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();enlarge()}})});
      const testimonialStatus=document.getElementById('testimonial-status');
      const testimonialProgress=document.getElementById('testimonial-progress-fill');
      const testimonialProgressTrack=testimonialProgress.parentElement;
      let activeTestimonial=0;
      const showTestimonial=index=>{
        activeTestimonial=(index+testimonialSlides.length)%testimonialSlides.length;
        testimonialTrack.style.transform=`translateX(-${activeTestimonial*100}%)`;
        testimonialSlides.forEach((slide,slideIndex)=>{slide.setAttribute('aria-hidden',String(slideIndex!==activeTestimonial));slide.setAttribute('aria-label',`${slideIndex+1} of ${testimonialSlides.length}`);slide.querySelector('img').tabIndex=slideIndex===activeTestimonial?0:-1});
        testimonialProgress.style.width=`${((activeTestimonial+1)/testimonialSlides.length)*100}%`;
        testimonialProgressTrack.setAttribute('aria-valuemax',String(testimonialSlides.length));
        testimonialProgressTrack.setAttribute('aria-valuenow',String(activeTestimonial+1));
        testimonialStatus.textContent=`${activeTestimonial+1} — ${testimonialSlides.length}`;
      };
      document.getElementById('testimonial-prev').addEventListener('click',()=>showTestimonial(activeTestimonial-1));
      document.getElementById('testimonial-next').addEventListener('click',()=>showTestimonial(activeTestimonial+1));
      testimonialCarousel.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();showTestimonial(activeTestimonial-1)}else if(event.key==='ArrowRight'){event.preventDefault();showTestimonial(activeTestimonial+1)}});
      let testimonialTouchStart=0;
      testimonialCarousel.addEventListener('touchstart',event=>{testimonialTouchStart=event.changedTouches[0].clientX},{passive:true});
      testimonialCarousel.addEventListener('touchend',event=>{const swipeDistance=event.changedTouches[0].clientX-testimonialTouchStart;if(Math.abs(swipeDistance)>45)showTestimonial(activeTestimonial+(swipeDistance<0?1:-1))},{passive:true});
      showTestimonial(0);
    }
    document.getElementById('year').textContent=new Date().getFullYear();
    document.documentElement.classList.add('js-ready');if('IntersectionObserver' in window&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});document.querySelectorAll('.fade-up').forEach(item=>observer.observe(item))}else{document.querySelectorAll('.fade-up').forEach(item=>item.classList.add('visible'))}
