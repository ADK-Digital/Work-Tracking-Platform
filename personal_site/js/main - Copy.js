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