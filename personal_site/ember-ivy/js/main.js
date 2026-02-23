
  /* -------------------------------------------
 * ADK-style mobile nav toggle (robust + DOMContentLoaded-safe)
 * ----------------------------------------- */
(function initAdkNav(){
  function run(){
    const adkNav = document.querySelector('.header__nav');
    const adkToggle = document.querySelector('.header__toggle');
    if (!adkNav || !adkToggle) return;

    // Initialize ARIA
    if (!adkToggle.hasAttribute('aria-expanded')) {
      adkToggle.setAttribute('aria-expanded', 'false');
    }

    // Toggle panel
    adkToggle.addEventListener('click', () => {
      const nowActive = adkNav.classList.toggle('header__nav--active');
      adkToggle.setAttribute('aria-expanded', nowActive ? 'true' : 'false');
    });

    // Close after clicking a nav link (delegated)
    adkNav.addEventListener('click', (e) => {
      const a = e.target.closest('.nav__link');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        const id = href.slice(1);
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        e.preventDefault();
      }
      if (adkNav.classList.contains('header__nav--active')) {
        adkNav.classList.remove('header__nav--active');
        adkToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!adkNav.classList.contains('header__nav--active')) return;
      const inside = adkNav.contains(e.target) || adkToggle.contains(e.target);
      if (!inside) {
        adkNav.classList.remove('header__nav--active');
        adkToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

// Close panel on breakpoint switch
  

function adkResponsiveReset() {
  const adkNav = document.querySelector('.header__nav');
  const desktop = window.matchMedia('(min-width: 768px)').matches;
  if (desktop && adkNav) adkNav.classList.remove('header__nav--active');
}
window.addEventListener('resize', adkResponsiveReset);
window.addEventListener('orientationchange', adkResponsiveReset);
adkResponsiveReset();


// Support "scrolled" header class (safe, no undeclared globals)
(function () {
  const headerEl =
    document.querySelector('.header') ||
    document.getElementById('ei-header') ||
    document.querySelector('.ei-header');
  if (!headerEl) return;
  const scrolledClass = headerEl.classList.contains('header') ? 'header--scrolled' : 'ei-header--scrolled';
  function onScroll() {
    if (window.scrollY > 50) headerEl.classList.add(scrolledClass);
    else headerEl.classList.remove(scrolledClass);
  }
  onScroll();
  window.addEventListener('scroll', onScroll);
})();
/*
 * Main JavaScript for Ember & Ivy single-page experience.
 *
 * Handles smooth navigation, tabbed menu panels, responsive
 * navigation drawer (hamburger on mobile, full list on desktop),
 * lightbox gallery, modal dialogs (reservations, private dining,
 * event RSVP), parallax, and accessibility enhancements.
 */
(function () {
  'use strict';

  
  /* -------------------------------------------
   * Smooth scroll for in-page links (ADK-style compatible)
   * ----------------------------------------- */
  const unifiedNavLinks = document.querySelectorAll('.nav__link, .ei-nav__link, a[href^="#"]');
  unifiedNavLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    link.addEventListener('click', (e) => {
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
      // Close ADK-style mobile panel if open
      const adkNav = document.querySelector('.header__nav');
      if (adkNav && adkNav.classList.contains('header__nav--active')) {
        adkNav.classList.remove('header__nav--active');
      }
    });
  });

  /* -------------------------------------------
   * Header scrolled state (robust selector)
   * ----------------------------------------- */
  const header =
    document.getElementById('ei-header') || document.querySelector('.ei-header');

  function toggleHeaderClass() {
    if (!header) return;
    if (window.scrollY > 50) header.classList.add('ei-header--scrolled');
    else header.classList.remove('ei-header--scrolled');
  }
  toggleHeaderClass();
  window.addEventListener('scroll', toggleHeaderClass);

  
  /* -------------------------------------------
   * Tabbed Menu Panels
   * ----------------------------------------- */
  const tabs = document.querySelectorAll('.ei-menu__tab');
  const panels = document.querySelectorAll('.ei-menu__panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const category = tab.getAttribute('data-category');
      tabs.forEach((t) => {
        t.classList.remove('ei-menu__tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('ei-menu__tab--active');
      tab.setAttribute('aria-selected', 'true');
      panels.forEach((panel) => {
        if (panel.getAttribute('data-category') === category) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });
    });
  });

  /* -------------------------------------------
   * Modal (reservations, private dining, RSVP)
   * ----------------------------------------- */
  const modalOverlay = document.getElementById('ei-modal-overlay');
  const modalContent = document.getElementById('ei-modal-content');
  const modalCloseBtn = document.querySelector('.ei-modal__close');
  let previousFocused;

  function trapFocus(e) {
    if (e.key !== 'Tab' || !modalOverlay) return;
    const focusables = modalOverlay.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openModal(html) {
    if (!modalOverlay || !modalContent) return;
    previousFocused = document.activeElement;
    modalContent.innerHTML = html;
    modalOverlay.hidden = false;
    document.body.classList.add('ei-modal-open');

    requestAnimationFrame(() => {
      if (modalCloseBtn) {
        modalCloseBtn.focus();
        return;
      }
      const focusables = modalOverlay.querySelectorAll(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]'
      );
      if (focusables.length) focusables[0].focus();
    });

    document.addEventListener('keydown', trapFocus);
  }

  function closeModal() {
    if (!modalOverlay || !modalContent) return;
    modalOverlay.hidden = true;
    modalContent.innerHTML = '';
    document.body.classList.remove('ei-modal-open');
    document.removeEventListener('keydown', trapFocus);
    if (currentGalleryIndex !== null) {
      document.removeEventListener('keydown', handleLightboxKeydown);
      currentGalleryIndex = null;
    }
    if (previousFocused && typeof previousFocused.focus === 'function') {
      previousFocused.focus();
    }
    if (modalCloseBtn) modalCloseBtn.hidden = false;
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => closeModal());
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && !modalOverlay.hidden) {
      closeModal();
    }
  });

  // Open Reservation modal from a dedicated trigger
  const reserveBtn = document.querySelector('[data-action="open-reserve"]');
  if (reserveBtn) {
    reserveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const form = document.querySelector('.ei-reservations__form')?.cloneNode(true);
      if (!form) return;
      form.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      const html = `<h3 id="ei-modal-title">Reserve a Table</h3>` + form.outerHTML;
      openModal(html);
    });
  }

  // Open Private Dining modal
  const privateBtn = document.querySelector('[data-action="open-private"]');
  if (privateBtn) {
    privateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const html =
        `<h3 id="ei-modal-title">Private Dining Inquiry</h3>` +
        `<form class="ei-form" method="POST" action="https://formspree.io/f/YOUR_FORMSPREE_ID">` +
        `<div class="ei-form__row"><label for="pd-name" class="ei-form__label">Name</label><input id="pd-name" name="name" class="ei-form__control" required></div>` +
        `<div class="ei-form__row"><label for="pd-email" class="ei-form__label">Email</label><input type="email" id="pd-email" name="email" class="ei-form__control" required></div>` +
        `<div class="ei-form__row"><label for="pd-size" class="ei-form__label">Party Size</label><input type="number" id="pd-size" name="party-size" class="ei-form__control" min="1" max="12" required></div>` +
        `<div class="ei-form__row"><label for="pd-date" class="ei-form__label">Date</label><input type="date" id="pd-date" name="date" class="ei-form__control" required></div>` +
        `<div class="ei-form__row"><label for="pd-message" class="ei-form__label">Message</label><textarea id="pd-message" name="message" rows="3" class="ei-form__control"></textarea></div>` +
        `<button type="submit" class="ei-button ei-button--primary">Submit Inquiry</button>` +
        `</form>`;
      openModal(html);
    });
  }

  // RSVP for events
  document.querySelectorAll('[data-action="rsvp"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const card = link.closest('.ei-event');
      const eventTitle = card ? card.querySelector('.ei-event__title')?.textContent : 'Event';
      const html =
        `<h3 id="ei-modal-title">RSVP for ${eventTitle}</h3>` +
        `<p class="ei-modal__intro">We’re excited to host you. Please complete the form below and we’ll be in touch.</p>` +
        `<form class="ei-form" method="POST" action="https://formspree.io/f/YOUR_FORMSPREE_ID">` +
        `<div class="ei-form__row"><label class="ei-form__label" for="rsvp-name">Name</label><input id="rsvp-name" name="name" class="ei-form__control" required></div>` +
        `<div class="ei-form__row"><label class="ei-form__label" for="rsvp-email">Email</label><input type="email" id="rsvp-email" name="email" class="ei-form__control" required></div>` +
        `<div class="ei-form__row"><label class="ei-form__label" for="rsvp-guests">Number of Guests</label><input type="number" id="rsvp-guests" name="guests" class="ei-form__control" min="1" max="8" required></div>` +
        `<button type="submit" class="ei-button ei-button--primary">Submit</button>` +
        `</form>`;
      openModal(html);
    });
  });

  /* -------------------------------------------
   * Gallery Lightbox
   * ----------------------------------------- */
  let galleryImages = [];
  let currentGalleryIndex = null;

  const galleryGrid = document.querySelector('.ei-gallery__grid');
  if (galleryGrid) {
    const items = galleryGrid.querySelectorAll('.ei-gallery__item');
    galleryImages = Array.from(items).map((item) => {
      const picture = item.querySelector('picture');
      if (picture) return picture.outerHTML;
      const img = item.querySelector('img');
      return img ? img.outerHTML : '';
    });
    items.forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.matches('img')) {
          e.preventDefault();
          openLightbox(idx);
        }
      });
    });
  }

  function openLightbox(index) {
    if (!galleryImages || !galleryImages.length) return;
    currentGalleryIndex = index;
    openModal('');
    if (modalCloseBtn) modalCloseBtn.hidden = true;
    renderLightbox();
    document.addEventListener('keydown', handleLightboxKeydown);
  }

  function renderLightbox() {
    if (!modalContent) return;
    const pictureHTML = galleryImages[currentGalleryIndex] || '';

    // Build the markup for the close button.  The stroke colour on the SVG lines
    // uses a fixed accent hue so that the "X" always matches the warm
    // palette.  The button itself is positioned via inline styles so
    // that it always sits in the top-right corner of the viewport.
    const closeButton =
      `<button class="ei-lightbox-close" aria-label="Close image">` +
      `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
      `<line x1="6" y1="6" x2="18" y2="18" stroke="#f29f5c" stroke-width="2" stroke-linecap="round"/>` +
      `<line x1="6" y1="18" x2="18" y2="6" stroke="#f29f5c" stroke-width="2" stroke-linecap="round"/>` +
      `</svg></button>`;

    const prevButton =
      `<button class="ei-lightbox-prev" aria-label="Previous image">${getArrowSvg('prev')}</button>`;
    const nextButton =
      `<button class="ei-lightbox-next" aria-label="Next image">${getArrowSvg('next')}</button>`;

    // Inject the close button, previous/next buttons and the picture
    // markup directly into the modal content.  The buttons are styled
    // via CSS to float vertically centred in the viewport; their
    // horizontal positions are computed dynamically in JS based on the
    // width of the displayed image.
    modalContent.innerHTML = `${closeButton}${prevButton}${pictureHTML}${nextButton}`;

    // Obtain references to the newly inserted controls
    const prevEl = modalContent.querySelector('.ei-lightbox-prev');
    const nextEl = modalContent.querySelector('.ei-lightbox-next');
    const closeEl = modalContent.querySelector('.ei-lightbox-close');

    // Attach event handlers to prevent closing the modal when clicking the buttons
    if (prevEl) prevEl.addEventListener('click', (ev) => { ev.stopPropagation(); showPrevImage(); });
    if (nextEl) nextEl.addEventListener('click', (ev) => { ev.stopPropagation(); showNextImage(); });
    if (closeEl) closeEl.addEventListener('click', (ev) => { ev.stopPropagation(); closeModal(); });

    // Do not hard‑code the close button position here.  The close
    // button will be positioned dynamically in updateArrowPositions()
    // along with the previous/next arrows so that it aligns with the
    // right edge of the image on desktop.  See updateArrowPositions.

    // After injecting content, compute appropriate left/right offsets for
    // the arrow controls based on the width of the displayed image.  This
    // positions the arrows near the edges of the photo rather than
    // hugging the viewport edges.  The function runs on image load and
    // whenever the window is resized.  A minimum offset is enforced so
    // that arrows never overlap the image on very small screens.
    const imgEl = modalContent.querySelector('img') || modalContent.querySelector('picture img');
    function updateArrowPositions() {
      if (!prevEl || !nextEl) return;
      const viewportWidth = window.innerWidth;
      let imgWidth = 0;
      if (imgEl) imgWidth = imgEl.clientWidth || imgEl.naturalWidth || 0;
      // If no image width can be determined, assume a default of 640px
      if (!imgWidth) imgWidth = 640;
      // Compute the horizontal space on each side of the image
      let space = (viewportWidth - imgWidth) / 2;
      // Offset the arrows slightly outside the image bounds (60px) but never
      // closer than 12px from the viewport edge
      const offset = Math.max(space - 60, 12);
      prevEl.style.position = 'fixed';
      nextEl.style.position = 'fixed';
      prevEl.style.top = '50%';
      nextEl.style.top = '50%';
      prevEl.style.transform = 'translateY(-50%)';
      nextEl.style.transform = 'translateY(-50%)';
      prevEl.style.left = `${offset}px`;
      nextEl.style.right = `${offset}px`;

      // Dynamically position the close button near the top‑right corner of the
      // displayed image.  Compute the vertical space above the image and
      // inset the close button slightly (12px) into the image area.  This
      // prevents the button from sitting on the viewport edge and keeps it
      // aligned with the right arrow horizontally.
      if (closeEl) {
        const viewportHeight = window.innerHeight;
        let imgHeightLocal = 0;
        if (imgEl) imgHeightLocal = imgEl.clientHeight || imgEl.naturalHeight || 0;
        if (!imgHeightLocal) imgHeightLocal = 640;
        const spaceY = (viewportHeight - imgHeightLocal) / 2;
        const topOffset = Math.max(spaceY + 12, 12);
        closeEl.style.position = 'fixed';
        closeEl.style.top = `${topOffset}px`;
        // Remove any vertical centering transform from previous runs
        closeEl.style.transform = '';
        closeEl.style.right = `${offset}px`;
        closeEl.style.left = 'auto';
      }
    }
    // Run after a tick to ensure image has been laid out
    setTimeout(updateArrowPositions, 0);
    // Also update on load and resize events
    if (imgEl) imgEl.addEventListener('load', updateArrowPositions);
    window.addEventListener('resize', updateArrowPositions);
  }

  function getArrowSvg(dir) {
    if (dir === 'prev') {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 16.59L10.83 12 15.41 7.41 14 6l-6 6 6 6z" fill="#f29f5c"/></svg>';
    }
    return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8.59 7.41L10 6l6 6-6 6-1.41-1.41L13.17 12z" fill="#f29f5c"/></svg>';
  }

  function showPrevImage() {
    if (!galleryImages || !galleryImages.length) return;
    currentGalleryIndex = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;
    renderLightbox();
  }

  function showNextImage() {
    if (!galleryImages || !galleryImages.length) return;
    currentGalleryIndex = (currentGalleryIndex + 1) % galleryImages.length;
    renderLightbox();
  }

  function handleLightboxKeydown(e) {
    if (currentGalleryIndex === null) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); showPrevImage(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showNextImage(); }
  }

  /* -------------------------------------------
   * Parallax on hero (respects reduced motion)
   * ----------------------------------------- */
  const heroSection = document.querySelector('.ei-hero');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && heroSection) {
    window.addEventListener('scroll', () => {
      const offset = window.scrollY * 0.3;
      heroSection.style.setProperty('--ei-hero-bg-offset', `${offset}px`);
    });
  }

  /* -------------------------------------------
   * Footer year
   * ----------------------------------------- */
  const yearElem = document.getElementById('ei-year');
  if (yearElem) yearElem.textContent = new Date().getFullYear();

  /* -------------------------------------------
   * Active link highlighting while scrolling
   * ----------------------------------------- */
  function initActiveSection() {
    const links = Array.from(document.querySelectorAll('.ei-nav__link[href^="#"]'));
    if (!links.length) return;
    const map = new Map();
    links.forEach((a) => {
      const id = a.getAttribute('href');
      const section = document.querySelector(id);
      if (section) map.set(section, a);
    });
    if (!map.size) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const a = map.get(e.target);
        if (!a) return;
        if (e.isIntersecting) {
          document.querySelectorAll('.ei-nav__link[aria-current="true"]').forEach((el) => {
            el.removeAttribute('aria-current');
          });
          a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 });
    map.forEach((_, section) => io.observe(section));
  }

  
  initActiveSection();
})();
