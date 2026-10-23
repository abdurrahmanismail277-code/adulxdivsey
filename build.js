const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const sourcePath = path.join(root, 'templates', 'source.html');
if (!fs.existsSync(sourcePath)) throw new Error('Missing templates/source.html. Edit that source template, then rebuild.');
const source = fs.readFileSync(sourcePath, 'utf8');
const origin = 'https://www.arresalahinstitute.com';
const portalMarker = source.indexOf('<!-- APPLICATION PORTAL MODAL');
const markupEnd = source.indexOf('<script>', portalMarker);
const markup = source.slice(0, markupEnd < 0 ? source.length : markupEnd);

function section(id) {
  const open = new RegExp(`<section\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').exec(markup);
  if (!open) throw new Error(`Missing section #${id}`);
  const start = open.index;
  const tags = /<section\b[^>]*>|<\/section\s*>/gi;
  tags.lastIndex = start;
  let depth = 0, match;
  while ((match = tags.exec(markup))) {
    if (/^<section\b/i.test(match[0])) depth++;
    else if (--depth === 0) return markup.slice(start, tags.lastIndex);
  }
  throw new Error(`Unclosed section #${id}`);
}

function commentBlock(startLabel, endLabel) {
  const start = source.indexOf(`<!-- ${startLabel} -->`);
  const end = source.indexOf(`<!-- ${endLabel} -->`, start + 1);
  if (start < 0 || end < 0) throw new Error(`Missing source markers ${startLabel}/${endLabel}`);
  return source.slice(start, end).replace(`<!-- ${startLabel} -->`, '');
}

function balancedDiv(start) {
  const tags = /<div\b[^>]*>|<\/div\s*>/gi;
  tags.lastIndex = start;
  let depth = 0, match;
  while ((match = tags.exec(source))) {
    if (/^<div\b/i.test(match[0])) depth++;
    else if (--depth === 0) return source.slice(start, tags.lastIndex);
  }
  throw new Error('Unclosed application portal markup');
}

function rewriteLinks(html) {
  const routes = { plans: 'plans', mission: 'about', 'other-courses': 'courses', sponsor: 'sponsor', why: 'about', faq: 'faq', privacy: 'privacy', video: 'classes' };
  return html
    .replace(/href="(?:\/|\.\/|index\.html)?#(plans|mission|other-courses|sponsor|why|faq|privacy|video)"/g, (_, id) => `href="/${routes[id]}/"`)
    .replace(/href="#top"/g, 'href="/"')
    .replace(/href="\.\/images\//g, 'href="/images/')
    .replace(/src="\.\//g, 'src="/')
    .replace(/poster="\.\/images\//g, 'poster="/images/')
    .replace(/src="(logo\.jpeg|favicon\.jpeg|course-[^"]+\.jpe?g)"/g, 'src="/$1"')
    .replace(/href="#"/g, 'href="/enrollment/"')
    .replace(/href="privacy-policy\.html"/g, 'href="/privacy/"')
    .replace(/href="terms-and-conditions\.html"/g, 'href="/"');
}

const planIds = {
  "General Qur'an Class|Monthly": 'general-quran-monthly', "General Qur'an + Arabiyah|Monthly": 'general-quran-arabiyah-monthly',
  "Personalized Qur'an Class|Monthly": 'personalized-quran-monthly', "Kids Qur'an Session (Ages 5-12)|Monthly": 'kids-quran-monthly',
  "Teens Qur'an Class (Ages 13-19)|Monthly": 'teens-quran-monthly', "Muraja'ah Class|Monthly": 'murajaah-monthly',
  "Personalized Qur'an + Arabiyah|Monthly": 'personalized-quran-arabiyah-monthly', "General Qur'an Class|Termly": 'general-quran-termly',
  "General Qur'an + Arabiyah|Termly": 'general-quran-arabiyah-termly', "Personalized Qur'an Class|Termly": 'personalized-quran-termly',
  "Personalized Qur'an + Arabiyah|Termly": 'personalized-quran-arabiyah-termly'
};
function planLinks(html) {
  return html.replace(/<button (class="btn-select(?:-featured)?") onclick="openPortal\(&quot;([\s\S]*?)&quot;,\s*\d+,\s*'(Monthly|Termly)'\)">([\s\S]*?)<\/button>/g, (_, buttonClass, rawName, billing, label) => {
    const name = rawName.replace(/\\'/g, "'");
    const id = planIds[`${name}|${billing}`];
    return id ? `<a ${buttonClass} href="/enrollment/?plan=${id}">${label}</a>` : `<button ${buttonClass} disabled>${label}</button>`;
  });
}

const head = source.slice(0, source.indexOf('</head>'));
const css = (head.match(/<style>([\s\S]*?)<\/style>/i) || [])[1];
if (!css) throw new Error('Could not find source stylesheet');
const partialDir = path.join(root, 'templates', 'partials');
const headerPath = path.join(partialDir, 'header.html');
const footerPath = path.join(partialDir, 'footer.html');
fs.mkdirSync(partialDir, { recursive: true });
const headerStart = source.indexOf('<header id="top">');
const headerEnd = source.indexOf('</header>', headerStart) + '</header>'.length;
if (headerStart < 0 || headerEnd < 10) throw new Error('Could not find shared header in source template');
let header = rewriteLinks(source.slice(headerStart, headerEnd));
header = header
  .replace('<a href="/">Home</a>', '<a href="/" data-nav="/">Home</a>')
  .replace('<a href="/about/">Mission</a>', '<a href="/about/" data-nav="/about/">About</a>')
  .replace('<a href="/courses/">Courses (Other Courses)</a>', '<a href="/courses/" data-nav="/courses/">Courses</a>')
  .replace('<a href="/enrollment/">Enrollment</a>', '<a href="/enrollment/" data-nav="/enrollment/">Enrollment</a>')
  .replace('<a href="/sponsor/">Sponsor a Class</a>', '<a href="/sponsor/" data-nav="/sponsor/">Sponsor a Class</a>')
  .replace('<a href="/about/">Why Us</a>', '<a href="/about/" data-nav="/about/">About</a>')
  .replace('<a href="/faq/">FAQs</a>', '<a href="/faq/" data-nav="/faq/">FAQ</a>');
header = header.replace(/\s*<a href="\/about\/">Why Us<\/a>/, '');
header = header
  .replace('<a href="/courses/" data-nav="/courses/">Courses</a>', '<a href="/courses/" data-nav="/courses/">Courses</a><a href="/classes/" data-nav="/classes/">Classes</a>')
  .replace('<a href="/enrollment/" data-nav="/enrollment/">Enrollment</a>', '<a href="/plans/" data-nav="/plans/">Plans</a><a href="/enrollment/" data-nav="/enrollment/">Enrollment</a>')
  .replace('<a href="/sponsor/" data-nav="/sponsor/">Sponsor a Class</a>', '<a href="/sponsor/" data-nav="/sponsor/">Sponsor a Class</a><a href="/testimonials/" data-nav="/testimonials/">Testimonials</a>')
  .replace('<a href="/contact/" data-nav="/contact/">Contact</a>', '<a href="/contact/" data-nav="/contact/">Contact</a><a href="/privacy/" data-nav="/privacy/">Privacy</a>');
header = header.replace('<a href="/about/" data-nav="/about/">About</a><a href="/about/" data-nav="/about/">About</a>', '<a href="/about/" data-nav="/about/">About</a>');
header = header
  .replace('<a href="/plans/">Enrollment</a>', '<a href="/plans/" data-nav="/plans/">Plans</a><a href="/enrollment/" data-nav="/enrollment/">Enrollment</a>')
  .replace('<a href="/plans/" class="nav-action nav-enroll">Enroll</a>', '<a href="/enrollment/" data-nav="/enrollment/" class="nav-action nav-enroll">Enroll</a>');
if (!header.includes('data-nav="/contact/"')) header = header.replace('<a href="/enrollment/" class="nav-action nav-enroll">Enroll</a>', '<a href="/contact/" data-nav="/contact/">Contact</a><a href="/enrollment/" class="nav-action nav-enroll">Enroll</a>');
if (!header.includes('data-nav="/privacy/"')) header = header.replace('<a href="/contact/" data-nav="/contact/">Contact</a>', '<a href="/contact/" data-nav="/contact/">Contact</a><a href="/privacy/" data-nav="/privacy/">Privacy</a>');
if (!header.includes('class="student-login"')) header = header.replace('<a href="https://wa.me/', '<a href="/frontend/studentportal.html" class="student-login">Student Login</a><a href="https://wa.me/');
fs.writeFileSync(headerPath, header);

const footerStart = source.indexOf('<footer id="site-footer">');
const footerEnd = source.indexOf('</footer>', footerStart) + '</footer>'.length;
const contactStart = source.indexOf('<div class="contact-speed-dial"', footerEnd);
const contact = balancedDiv(contactStart);
const topStart = source.indexOf('<button class="floating-back-to-top"', contactStart + contact.length);
const topEnd = source.indexOf('</button>', topStart) + '</button>'.length;
if (footerStart < 0 || footerEnd < 10 || contactStart < 0 || topEnd < 10) throw new Error('Could not find shared footer widgets in source template');
let footer = rewriteLinks(source.slice(footerStart, footerEnd) + '\n' + contact + '\n' + source.slice(topStart, topEnd));
footer = footer
  .replace(/(<section class="footer-col" aria-label="Quick links">[\s\S]*?<div class="footer-links">)[\s\S]*?(<\/div>\s*<\/section>)/, '$1<a href="/">Home</a><a href="/about/">About</a><a href="/courses/">Courses</a><a href="/enrollment/">Enrollment</a><a href="/sponsor/">Sponsor a Class</a><a href="/classes/">Classes</a><a href="/faq/">FAQ</a><a href="/testimonials/">Testimonials</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy Policy</a>$2')
  .replace(/(<div class="footer-legal"[^>]*>)[\s\S]*?(<\/div>)/, '$1<a href="/privacy/">Privacy Policy</a><span class="footer-separator" aria-hidden="true">|</span><a href="/classes/">Classes (videos)</a>$2')
  .replace(/<a href="\/plans\/" class="footer-photo-button"/, '<a href="/enrollment/" class="footer-photo-button"');
fs.writeFileSync(footerPath, footer);

const sections = {
  hero: commentBlock('HERO', 'CLASS COUNTDOWN'),
  countdown: commentBlock('CLASS COUNTDOWN', 'STATS'),
  stats: commentBlock('STATS', 'MISSION & VISION'),
  mission: section('mission'), plans: section('plans'), sponsor: section('sponsor'),
  courses: section('other-courses'), why: section('why'), classes: section('video'),
  faq: section('faq'), testimonials: section('testimonials'), privacy: section('privacy')
};
const modalStart = source.indexOf('<div class="modal-overlay" id="modal"');
if (modalStart < 0) throw new Error('Missing Application Portal');
const application = balancedDiv(modalStart);
const applicationPage = application
  .replace(/<div class="modal-overlay" id="modal"[^>]*>/, '<div class="modal-overlay open" id="modal">')
  .replace(/\s*<button type="button" class="modal-close" onclick="closeModal\(\)"[^>]*>&times;<\/button>/, '');
const applicationInit = `
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
`;
const faqSection = sections.faq;
const payQuestion = faqSection.indexOf('How do I pay for my enrollment?');
const payFaqStart = faqSection.lastIndexOf('<div class="faq-item"', payQuestion);
const payFaqEnd = faqSection.indexOf('</div>', payQuestion) + 6;
const paymentFaq = `<section class="section faq-bg"><div class="section-inner"><span class="section-badge">FAQ</span><h2 class="section-title">How do I pay?</h2><div class="faq-list">${faqSection.slice(payFaqStart, payFaqEnd)}</div></div></section>`;

const testimonialStart = source.indexOf('<div class="t-card"');
const testimonial = testimonialStart < 0 ? '' : balancedDiv(testimonialStart);
const teaser = `<section class="section teaser-grid" aria-label="Explore Arresalah Institute"><article><h2>Mission &amp; Vision</h2><p>A clear reminder of Arresalah Institute's purpose: disciplined memorization, correct tajweed, Islamic manners, and a generation whose homes and communities reflect the guidance of the Qur'an.</p><a href="/about/">Learn more</a></article><article><h2>Enrollment Plans</h2><p>Select the plan that fits your goals. All plans include live online sessions with certified instructors.</p><a href="/plans/">Learn more</a></article><article><h2>Why Arresalah</h2><p>Everything we do is designed to help you connect deeply with the Qur'an.</p><a href="/about/">Learn more</a></article></section>`;
const testimonialTeaser = `<section class="section t-section testimonial-teaser"><h2>Words from Our <span>Students &amp; Parents</span></h2><div class="carousel-wrap">${testimonial}</div><a href="/testimonials/">Read all testimonials</a></section>`;

const pages = [
  { slug: '', title: 'Arresalah Institute | Qur’an & Arabiyah Classes', desc: 'Study Qur’an memorization, Tajweed, and Arabiyah online with qualified teachers and structured learning plans.', body: `${sections.hero}${sections.countdown}${sections.stats}${teaser}${testimonialTeaser}<section class="section final-cta"><h2>Choose Your Learning Path</h2><a class="btn-amber" href="/enrollment/">Start Enrollment</a></section>`, scripts: ['home.js', 'carousels.js'] },
  { slug: 'about', title: 'About | Arresalah Institute', desc: 'Learn about Arresalah Institute’s mission, vision, and approach to Qur’an and Arabic education.', body: `${sections.mission}${sections.why}`, scripts: ['carousels.js'] },
  { slug: 'plans', title: 'Enrollment Plans | Arresalah Institute', desc: 'Compare monthly and termly plans and select a Qur’an or Arabic program.', body: `${planLinks(sections.plans)}${paymentFaq}`, scripts: ['plans.js'] },
  { slug: 'enrollment', title: 'Enroll | Arresalah Institute', desc: 'Apply to Arresalah Institute, choose a course, and continue to secure Paystack checkout.', body: applicationPage, scripts: ['enrollment.js'], bodyClass: 'application-page' },
  { slug: 'courses', title: 'Courses | Arresalah Institute', desc: 'Explore Nurul Yaqeen, Al-Arabiyyah An-Nahwiyyah, and Arabic lessons.', body: sections.courses, scripts: [] },
  { slug: 'sponsor', title: 'Sponsor a Class | Arresalah Institute', desc: 'Support access to Qur’an and Arabic classes by sponsoring a class.', body: sections.sponsor, scripts: ['sponsor.js'] },
  { slug: 'classes', title: 'Classes | Arresalah Institute', desc: 'See how Arresalah Institute teaches Qur’an, Tajweed, and Arabic online.', body: sections.classes, scripts: ['classes.js'] },
  { slug: 'faq', title: 'FAQ | Arresalah Institute', desc: 'Answers to common questions about classes, plans, and enrollment.', body: sections.faq, scripts: ['carousels.js'] },
  { slug: 'testimonials', title: 'Testimonials | Arresalah Institute', desc: 'Read what students and families say about Arresalah Institute.', body: sections.testimonials, scripts: ['carousels.js'] },
  { slug: 'privacy', title: 'Privacy Policy | Arresalah Institute', desc: 'Read how Arresalah Institute collects, uses, and protects personal information.', body: `<article class="privacy-readable">${sections.privacy.replace(/^.*?<div class="section-inner[^>]*>/s, '').replace(/<\/div>\s*<\/div>\s*<\/section>\s*$/s, '').replace(/<p class="privacy-intro">Last updated: [^<]*<\/p>/, '')}<p class="last-updated">Last updated: October 23, 2026</p></article>`, scripts: [] },
  { slug: 'contact', title: 'Contact | Arresalah Institute', desc: 'Contact Arresalah Institute by WhatsApp, email, Instagram, or X.', body: `<section class="section contact-page"><h2>Contact Arresalah Institute</h2><p><a href="https://wa.me/2348082062525">WhatsApp: +234 808 206 2525</a></p><p><a href="mailto:support@arresalahinstitute.com">support@arresalahinstitute.com</a></p><p><a href="https://www.instagram.com/arresalah_quran_institute">Instagram</a> · <a href="https://x.com/arqm_institute">X</a></p><p>Morning, afternoon, and evening sessions are arranged across time zones.</p></section>`, scripts: [] }
];

function scriptContents() {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim() && !s.trim().startsWith('{'));
}
const scripts = scriptContents();
if (scripts.length < 3) throw new Error('Expected all three original interaction scripts');
const core = scripts[0];
const countStart = core.indexOf('//  NEXT CLASS APPLICATION COUNTDOWN');
const countEnd = core.indexOf('//  COURSES DATA', countStart);
if (countStart < 0 || countEnd < 0) throw new Error('Could not isolate countdown code');
const faqCarouselStart = core.indexOf('  function toggleFaq(button)');
if (faqCarouselStart < 0) throw new Error('Could not isolate FAQ/carousel code');
const courseCodeStart = core.indexOf('//  COURSES DATA');
const videoScript = scripts[1];
const videoStart = videoScript.indexOf('const instituteVideos =');
const heroMarker = videoScript.indexOf('const hero =');
const heroAnimationStart = videoScript.lastIndexOf('(function () {', heroMarker);
const widgetsMarker = videoScript.indexOf('Floating contact speed dial');
const commonWidgetsStart = videoScript.lastIndexOf('//', widgetsMarker);
if (courseCodeStart < 0 || videoStart < 0 || heroAnimationStart < 0 || commonWidgetsStart < 0) throw new Error('Could not split page-specific scripts');

fs.mkdirSync(partialDir, { recursive: true });
fs.mkdirSync(path.join(root, 'css'), { recursive: true });
fs.mkdirSync(path.join(root, 'js'), { recursive: true });
fs.writeFileSync(path.join(root, 'css', 'styles.css'), css.replace(/url\((['"]?)\.\/images\//g, 'url($1/images/') + `\n\n/* Multi-page layout additions */\n.inner-banner{background:var(--brown-dark);color:var(--text-white);padding:24px max(5vw,20px);}.inner-banner h1{font-family:Lora,serif;font-size:clamp(28px,4vw,42px);margin:0}.inner-banner p{margin:6px 0 0;opacity:.85}.inner-banner a{color:inherit}.teaser-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:20px}.privacy-readable{max-width:760px;margin:48px auto;padding:0 22px;font-size:17px;line-height:1.8}.privacy-readable .section-inner{padding:0}.privacy-readable h2,.privacy-readable h3{margin:24px 0 10px}.privacy-readable p{margin:12px 0}.privacy-readable .privacy-card{background:transparent;box-shadow:none;padding:0}.privacy-readable .privacy-grid{display:block}.last-updated{font-size:15px;color:var(--text-muted)}.footer-bottom{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.footer-legal{display:flex;gap:10px;flex-wrap:wrap}nav a[aria-current="page"]{color:var(--amber-light);background:rgba(212,136,30,0.10)}\n`);
fs.appendFileSync(path.join(root, 'css', 'styles.css'), '\n.application-page .modal-overlay{position:static;inset:auto;z-index:auto;display:flex;padding:28px 16px 64px;background:transparent;backdrop-filter:none}.application-page .modal{max-height:none;box-shadow:var(--shadow-card)}\n');
fs.writeFileSync(path.join(root, 'js', 'main.js'), `(function(){\nconst b=document.querySelector('.menu-toggle'),n=document.getElementById('site-nav');if(b&&n){b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');document.body.classList.toggle('menu-open',open)});n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','Open navigation menu');document.body.classList.remove('menu-open')}));document.addEventListener('keydown',e=>{if(e.key==='Escape'){b.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open')}});window.addEventListener('resize',()=>{if(innerWidth>768){b.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open')}})}\nconst year=document.getElementById('footer-current-year');if(year)year.textContent=String(new Date().getFullYear());if((location.pathname==='/'||location.pathname==='/index.html')&&location.hash){const m={plans:'plans',mission:'about','other-courses':'courses',sponsor:'sponsor',why:'about',faq:'faq',privacy:'privacy',video:'classes'};const page=m[location.hash.slice(1)];if(page)location.replace('/'+page+'/')}\n})();`);
fs.writeFileSync(path.join(root, 'js', 'home.js'), core.slice(countStart, countEnd));
fs.writeFileSync(path.join(root, 'js', 'carousels.js'), core.slice(faqCarouselStart));
fs.writeFileSync(path.join(root, 'js', 'enrollment.js'), core.slice(courseCodeStart) + applicationInit);
const planScriptStart = core.indexOf('  function switchTab(tabName');
const planScriptEnd = core.indexOf('  function toggleFaq(button)', planScriptStart);
fs.writeFileSync(path.join(root, 'js', 'plans.js'), planScriptStart >= 0 && planScriptEnd > planScriptStart ? core.slice(planScriptStart, planScriptEnd) : '');
fs.writeFileSync(path.join(root, 'js', 'footer.js'), videoScript.slice(0, videoStart) + videoScript.slice(commonWidgetsStart));
fs.writeFileSync(path.join(root, 'js', 'home-hero.js'), videoScript.slice(heroAnimationStart, commonWidgetsStart));
// Keep the class preview art local so it still appears when YouTube's image
// host is blocked or unavailable. The actual videos remain YouTube embeds.
fs.writeFileSync(path.join(root, 'js', 'classes.js'), videoScript.slice(videoStart, heroAnimationStart)
  .replaceAll('https://i.ytimg.com/vi/vn7IMYGSZ7A/hqdefault.jpg', '/images/hero-quran.jpg')
  .replaceAll('https://i.ytimg.com/vi/O2o5pqL2tI8/hqdefault.jpg', '/course-nurul-yaqeen.jpeg')
  .replaceAll('https://i.ytimg.com/vi/sfttGE9uEAA/hqdefault.jpg', '/course-arabic-lessons.jpeg')
  .replaceAll('./images/video-1.jpg', '/images/hero-quran.jpg')
  .replaceAll('./images/video-2.jpg', '/course-nurul-yaqeen.jpeg')
  .replaceAll('./images/video-3.jpg', '/course-arabic-lessons.jpeg'));
fs.writeFileSync(path.join(root, 'js', 'sponsor.js'), scripts[2].replaceAll('./videos/sponsorship.mp4', '/videos/sponsorship.mp4').replaceAll('./images/sponsorship-poster.jpg', '/images/sponsorship-poster.jpg'));

const fontLinks = (head.match(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi) || []).join('\n');
const baseCss = '<link rel="stylesheet" href="/css/styles.css">';
for (const page of pages) {
  const url = page.slug ? `/${page.slug}/` : '/';
  const canonical = origin + url;
  const title = page.title.replaceAll('&', '&amp;');
  const desc = page.desc.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const banner = page.slug ? `<div class="inner-banner"><h1>${page.title.split(' |')[0]}</h1><p><a href="/">Home</a> &gt; ${page.title.split(' |')[0]}</p></div>` : '';
  const currentHeader = header.replace(/\saria-current="page"/g, '').replace(`data-nav="${url}"`, `data-nav="${url}" aria-current="page"`);
  const body = rewriteLinks(page.body);
  const apiScripts = ['enrollment'].includes(page.slug) ? '<script src="/api-config.js"></script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>' : '';
  const requiredScripts = ['footer.js', ...page.scripts, ...(page.slug === '' ? ['home-hero.js'] : [])];
  const pageScripts = [...new Set(requiredScripts)].map(file => `<script src="/js/${file}" defer></script>`).join('\n');
  const portalScript = page.slug === 'enrollment' ? '<script src="https://js.paystack.co/v1/inline.js" async></script>' : '';
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Arresalah Institute"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/images/hero-quran.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${origin}/images/hero-quran.jpg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${fontLinks}${baseCss}</head><body${page.bodyClass ? ` class="${page.bodyClass}"` : ''}><a class="skip-link" href="#main-content">Skip to main content</a>${currentHeader}${banner}<main id="main-content">${body}</main>${footer}<script src="/js/main.js" defer></script>${apiScripts}${portalScript}${pageScripts}</body></html>`;
  const destination = page.slug ? path.join(root, page.slug) : root;
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'index.html'), html);
}

const notFound = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Arresalah Institute</title>${baseCss}</head><body><a class="skip-link" href="#main-content">Skip to main content</a>${header}<main id="main-content" class="section"><h1>We couldn't find that page</h1><p>The page may have moved or the address may be incorrect.</p><a href="/">Return home</a></main>${footer}<script src="/js/main.js" defer></script></body></html>`;
fs.writeFileSync(path.join(root, '404.html'), notFound);
const lastmod = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${origin}${p.slug ? `/${p.slug}/` : '/'}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages for GitHub Pages in ${root}`);
