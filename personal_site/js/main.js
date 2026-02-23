/*
  main.js

  This script adds basic interactivity to the personal website.  It
  provides a mobile menu toggle, smooth scrolling for internal links,
  and automatically updates the copyright year in the footer.
*/

document.addEventListener('DOMContentLoaded', () => {
  // Get references to the menu toggle button and navigation container
  const navToggle = document.querySelector('.header__toggle');
  const navMenu  = document.querySelector('.header__nav');

  /*
    Mobile menu toggle handler
    When the hamburger button is clicked on small screens, toggle a
    class on the nav element.  This class controls visibility via
    CSS.  Without JS the menu will remain visible on large screens
    and hidden on small screens, ensuring graceful degradation.
  */
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('header__nav--active');
    });
  }

  /*
    Smooth scrolling for anchor links
    Intercept clicks on navigation links to perform smooth
    scrolling to the target section.  After navigating the menu
    collapses on mobile.  This improves user experience by
    avoiding abrupt jumps and making the one‑page layout feel
    dynamic【494257633164294†L318-L324】.
  */
  const navLinks = document.querySelectorAll('.nav__link');
  navLinks.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const target   = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      // Close the mobile menu after navigation
      navMenu.classList.remove('header__nav--active');
    });
  });

  // Set the current year in the footer automatically
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});

// === Contact form: phone mask + preference validator (moved from inline) ===
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const input = document.getElementById('phone');
  const cbText = document.getElementById('pref-text');
  const cbCall = document.getElementById('pref-call');
  const err   = document.getElementById('phone-pref-error');

  function formatPhone(value){
    const d = (value || '').replace(/\D/g, '').slice(0,10);
    const p1 = d.slice(0,3), p2 = d.slice(3,6), p3 = d.slice(6,10);
    if (d.length > 6) return '(' + p1 + ') ' + p2 + '-' + p3;
    if (d.length > 3) return '(' + p1 + ') ' + p2;
    if (d.length > 0) return '(' + p1;
    return '';
  }

  if (input){
    input.addEventListener('input', () => {
      input.value = formatPhone(input.value);
    });
    input.addEventListener('blur', () => {
      if (input.value.trim() === '') { input.setCustomValidity(''); return; }
      if (!/\(\d{3}\) \d{3}-\d{4}$/.test(input.value)) {
        input.setCustomValidity('Please enter a valid 10-digit phone number.');
      } else {
        input.setCustomValidity('');
      }
    });
  }

  function validatePrefs(){
    // Only require a preference if a phone number is provided
    const hasPhone = input && input.value.trim().length > 0;
    const ok = (cbText && cbText.checked) || (cbCall && cbCall.checked) || !hasPhone;
    if (!ok) { if (err) err.textContent = 'Choose Text or Call preference.'; }
    else { if (err) err.textContent = ''; }
    return ok;
  }

  if (cbText) cbText.addEventListener('change', validatePrefs);
  if (cbCall) cbCall.addEventListener('change', validatePrefs);

  form.addEventListener('submit', (e) => {
    if (!validatePrefs()) {
      e.preventDefault();
      if (cbText) cbText.focus();
    }
  });
});
