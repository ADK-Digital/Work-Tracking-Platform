/*
 * Keystone & Beam JavaScript
 *
 * Provides interactivity for the navigation, lightbox gallery, testimonial
 * carousel, contact form validation and dynamic footer year. All code is
 * encapsulated in a DOMContentLoaded event to ensure elements exist before
 * manipulating them. No external dependencies are required.
 */
(function () {
  'use strict';

  /*
   * Highlight the nav link corresponding to the section in view.
   * Uses IntersectionObserver to detect when sections enter the viewport and
   * toggles the aria-current attribute on the matching navigation link.
   */
  function kbInitActiveSection() {
    const links = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));
    if (!links.length) return;
    const map = new Map();
    links.forEach(a => {
      const id = a.getAttribute('href');
      const s = document.querySelector(id);
      if (s) map.set(s, a);
    });
    if (!map.size) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const a = map.get(e.target);
        if (!a) return;
        if (e.isIntersecting) {
          document.querySelectorAll('.nav__link[aria-current="true"]').forEach(x => x.removeAttribute('aria-current'));
          a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 });
    map.forEach((_, s) => io.observe(s));
  }

  /*
   * Enhance the mobile navigation for accessibility. Adds ESC key support
   * to close the drawer, traps focus while open and returns focus to
   * the toggle button upon closing.
   */
  function kbInitMobileNavA11y() {
    const toggle = document.querySelector('.nav__toggle');
    const drawer = document.querySelector('.nav__menu');
    if (!toggle || !drawer) return;
    function onKey(e) {
      // Close on Escape
      if (e.key === 'Escape' && drawer.classList.contains('nav__menu--open')) {
        toggle.click();
        toggle.focus();
      }
      // Trap focus within the drawer when open
      if (e.key === 'Tab' && drawer.classList.contains('nav__menu--open')) {
        const focusables = Array.from(drawer.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
    document.addEventListener('keydown', onKey);
  }

  /*
   * Provide smooth scrolling to in‑page anchors while respecting the
   * user's reduced‑motion preference. Adjusts the scroll offset to
   * account for the fixed header height.
   */
  function kbInitSmoothScroll() {
    const header = document.querySelector('.header');
    const links = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));
    if (!links.length || !header) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    links.forEach(link => {
      link.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const headerOffset = header.offsetHeight;
        const y = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        if (prefersReduced) {
          // Just jump without animation
          window.scrollTo(0, y);
        } else {
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* ===== Sticky Header / Scroll State ===== */
    const header = document.querySelector('.header');
    const onScroll = () => {
      if (window.scrollY > 60) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
    };
    window.addEventListener('scroll', onScroll);

    /* ===== Mobile Navigation ===== */
    const navToggle = document.querySelector('.nav__toggle');
    const navMenu = document.querySelector('.nav__menu');
    const navLinks = navMenu.querySelectorAll('a.nav__link');

    const toggleMenu = () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isExpanded));
      navMenu.classList.toggle('nav__menu--open');
      document.body.classList.toggle('menu-open');
    };

    navToggle.addEventListener('click', toggleMenu);

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        // close menu after selecting a link on mobile
        if (navMenu.classList.contains('nav__menu--open')) {
          toggleMenu();
        }
      });
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('nav__menu--open')) {
        toggleMenu();
      }
    });

    /* ===== Lightbox Gallery ===== */
    const projects = document.querySelectorAll('.project');
    const lightbox = document.querySelector('.lightbox');
    if (lightbox) {
      const lightboxImg = lightbox.querySelector('.lightbox__img');
      const lightboxCaption = lightbox.querySelector('.lightbox__caption');
      const btnPrev = lightbox.querySelector('.lightbox__prev');
      const btnNext = lightbox.querySelector('.lightbox__next');
      const btnClose = lightbox.querySelector('.lightbox__close');
      const overlay = lightbox.querySelector('.lightbox__overlay');

      // Build an array of gallery items
      const galleryItems = Array.from(projects).map((fig) => {
        return {
          src: fig.querySelector('img').getAttribute('src'),
          alt: fig.querySelector('img').getAttribute('alt') || '',
          title: fig.querySelector('.project__title').textContent,
          desc: fig.querySelector('.project__desc').textContent,
        };
      });

      let currentIndex = 0;

      const updateLightbox = (index) => {
        const item = galleryItems[index];
        lightboxImg.setAttribute('src', item.src);
        lightboxImg.setAttribute('alt', item.alt);
        lightboxCaption.innerHTML = `<strong>${item.title}</strong><br>${item.desc}`;
      };

      const openLightbox = (index) => {
        currentIndex = index;
        updateLightbox(currentIndex);
        lightbox.classList.add('lightbox--active');
        document.body.style.overflow = 'hidden';
      };

      const closeLightbox = () => {
        lightbox.classList.remove('lightbox--active');
        document.body.style.overflow = '';
      };

      const showNext = () => {
        currentIndex = (currentIndex + 1) % galleryItems.length;
        updateLightbox(currentIndex);
      };

      const showPrev = () => {
        currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
        updateLightbox(currentIndex);
      };

      projects.forEach((fig, idx) => {
        fig.addEventListener('click', () => openLightbox(idx));
      });

      btnClose.addEventListener('click', closeLightbox);
      overlay.addEventListener('click', closeLightbox);
      btnNext.addEventListener('click', showNext);
      btnPrev.addEventListener('click', showPrev);

      // Keyboard navigation in lightbox
      document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('lightbox--active')) return;
        switch (e.key) {
          case 'Escape':
            closeLightbox();
            break;
          case 'ArrowRight':
            showNext();
            break;
          case 'ArrowLeft':
            showPrev();
            break;
        }
      });
    }

    /* ===== Testimonials Carousel ===== */
    const testimonialEls = Array.from(document.querySelectorAll('.testimonial'));
    const btnTestPrev = document.querySelector('.testimonials__prev');
    const btnTestNext = document.querySelector('.testimonials__next');
    let testimonialIndex = 0;
    let testimonialInterval;

    const setAria = (el, active) => {
      el.setAttribute('aria-hidden', String(!active));
    };

    const showTestimonial = (index) => {
      testimonialEls.forEach((el, i) => {
        const isActive = i === index;
        el.classList.toggle('active', isActive);
        setAria(el, isActive);
      });
    };

    const startCarousel = () => {
      testimonialInterval = setInterval(() => {
        testimonialIndex = (testimonialIndex + 1) % testimonialEls.length;
        showTestimonial(testimonialIndex);
      }, 7000);
    };

    const stopCarousel = () => {
      clearInterval(testimonialInterval);
    };

    if (testimonialEls.length) {
      // Ensure exactly one active on load
      const presetIndex = testimonialEls.findIndex(el => el.classList.contains('active'));
      testimonialIndex = presetIndex >= 0 ? presetIndex : 0;
      showTestimonial(testimonialIndex);
      startCarousel();
    }

    btnTestPrev && btnTestPrev.addEventListener('click', () => {
      stopCarousel();
      testimonialIndex = (testimonialIndex - 1 + testimonialEls.length) % testimonialEls.length;
      showTestimonial(testimonialIndex);
      startCarousel();
    });

    btnTestNext && btnTestNext.addEventListener('click', () => {
      stopCarousel();
      testimonialIndex = (testimonialIndex + 1) % testimonialEls.length;
      showTestimonial(testimonialIndex);
      startCarousel();
    });

    /* ===== Contact Form Validation ===== */
    const form = document.getElementById('contact-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        let valid = true;
        const name = form.querySelector('#name');
        const email = form.querySelector('#email');
        const message = form.querySelector('#message');
        const phone = form.querySelector('#phone');
        // Helper to show error message
        const showError = (input, msg) => {
          const errorEl = input.parentElement.querySelector('.form__error');
          errorEl.textContent = msg;
        };
        const clearError = (input) => {
          const errorEl = input.parentElement.querySelector('.form__error');
          errorEl.textContent = '';
        };
        // Name validation
        if (!name.value.trim()) {
          showError(name, 'Name is required');
          valid = false;
        } else {
          clearError(name);
        }
        // Email validation (basic)
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.value.trim()) {
          showError(email, 'Email is required');
          valid = false;
        } else if (!emailPattern.test(email.value.trim())) {
          showError(email, 'Please enter a valid email');
          valid = false;
        } else {
          clearError(email);
        }
        // Message validation
        if (!message.value.trim()) {
          showError(message, 'Please include a message');
          valid = false;
        } else {
          clearError(message);
        }
        // Phone validation (optional – check numeric)
        if (phone.value.trim() && !/^[\d\s\-()+]+$/.test(phone.value.trim())) {
          showError(phone, 'Please enter a valid phone number');
          valid = false;
        } else {
          clearError(phone);
        }
        if (!valid) {
          e.preventDefault();
        }
      });
    }

    /* ===== Footer Year ===== */
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }

    // Initialise additional enhancements: active section highlighting,
    // accessible mobile navigation and smooth scrolling respecting
    // user motion preferences. Definitions live below.
    kbInitActiveSection();
    kbInitMobileNavA11y();
    kbInitSmoothScroll();
  });
})();
