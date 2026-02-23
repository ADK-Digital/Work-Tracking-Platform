/*
  Everleaf Law interactive scripts
  This file handles smooth scrolling, sticky header effects, mobile navigation,
  accordion functionality, simple form validation, and dynamic year display.
*/

(() => {
  // Helpers to detect reduced motion preference
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /**
   * Smoothly scroll to a target element when clicking anchor links.
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        // Only handle page internal links (exclude external or just '#')
        if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          if (prefersReducedMotion) {
            target.scrollIntoView();
          } else {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  /**
   * Toggle header style on scroll to add a border/shadow.
   */
  function initStickyHeader() {
    const header = document.getElementById('header');
    const toggleClass = () => {
      if (window.scrollY > 10) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
    };
    toggleClass();
    window.addEventListener('scroll', toggleClass);
  }

  /**
   * Mobile navigation toggle and focus trap
   */
  function initMobileNav() {
    const nav = document.querySelector('.nav');
    const toggleBtn = nav.querySelector('.nav__toggle');
    const navList = nav.querySelector('.nav__list');
    let lastFocusedElement;

    const focusableSelectors =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]';

    function trapFocus(e) {
      const focusable = navList.querySelectorAll(focusableSelectors);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
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
      if (e.key === 'Escape') {
        closeMenu();
      }
    }

    function openMenu() {
      lastFocusedElement = document.activeElement;
      nav.classList.add('nav--open');
      navList.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      navList.addEventListener('keydown', trapFocus);
      // focus first link
      const firstLink = navList.querySelector('a');
      firstLink && firstLink.focus();
    }

    function closeMenu() {
      nav.classList.remove('nav--open');
      navList.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      navList.removeEventListener('keydown', trapFocus);
      if (lastFocusedElement) {
        lastFocusedElement.focus();
      }
    }

    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        closeMenu();
      } else {
        openMenu();
      }
    
// Close menu when clicking the explicit close button
const closeBtn = nav.querySelector('.nav__close');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    closeMenu();
  });
}

// Close menu when any nav link is activated
navList.addEventListener('click', (e) => {
  const link = e.target.closest('.nav__link');
  if (link) {
    closeMenu();
  }
});
});
    // Close menu on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && nav.classList.contains('nav--open')) {
        closeMenu();
      }
    });
  }

  /**
   * Initialize accordion widgets.
   */
  function initAccordions() {
    document.querySelectorAll('.accordion').forEach((accordion) => {
      accordion.addEventListener('click', (e) => {
        const toggle = e.target.closest('.accordion__toggle');
        if (!toggle) return;
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        const panelId = toggle.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        if (!panel) return;
        toggle.setAttribute('aria-expanded', String(!expanded));
        if (expanded) {
          panel.setAttribute('hidden', '');
        } else {
          panel.removeAttribute('hidden');
        }
      });
    });
  }

  /**
   * Simple form validation for the contact form.
   */
  function initFormValidation() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      let valid = true;
      // Clear previous errors
      form.querySelectorAll('.form__error').forEach((el) => {
        el.textContent = '';
      });
      // Name
      const name = form.querySelector('#name');
      if (!name.value.trim()) {
        valid = false;
        form.querySelector('#error-name').textContent = 'Please enter your name.';
      }
      // Email
      const email = form.querySelector('#email');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.value.trim() || !emailRegex.test(email.value.trim())) {
        valid = false;
        form.querySelector('#error-email').textContent = 'Please enter a valid email.';
      }
      // Matter type
      const matter = form.querySelector('#matter');
      if (!matter.value) {
        valid = false;
        form.querySelector('#error-matter').textContent = 'Please select a matter type.';
      }
      // Summary
      const summary = form.querySelector('#summary');
      if (!summary.value.trim()) {
        valid = false;
        form.querySelector('#error-summary').textContent = 'Please provide a brief summary.';
      }
      // Consent
      const consent = form.querySelector('#consent');
      if (!consent.checked) {
        valid = false;
        form.querySelector('#error-consent').textContent = 'Consent is required.';
      }
      if (!valid) {
        e.preventDefault();
      }
    });
  }

  /**
   * Update footer year automatically.
   */
  function updateYear() {
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  // Initialise everything when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initStickyHeader();
    initMobileNav();
    initAccordions();
    initFormValidation();
    updateYear();
  });
})();