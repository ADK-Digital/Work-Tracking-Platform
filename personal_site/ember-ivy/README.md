# Ember & Ivy – Setup & Customisation Guide

Welcome to **Ember & Ivy**, a single‑page, fire‑lit restaurant template built for fast deployment on platforms like Vercel and Netlify.  The project lives entirely in the `/projects/ember-ivy/` directory and has been designed with isolation in mind, so it can be embedded under a parent site without style leakage.

## File Structure

```
ember-ivy/
├── index.html          # Single‑page site with all sections
├── css/
│   └── styles.css      # Custom BEM‑based styles scoped to .ei‑root
├── js/
│   └── main.js         # Interactivity (navigation, modals, tabs, lightbox, parallax)
├── images/
│   ├── hero.webp       # Hero background (WebP) – high‑contrast night patio
│   ├── hero.png        # Fallback PNG of the hero
│   ├── gallery1.webp   # Cocktail image
│   ├── gallery1.png
│   ├── gallery2.webp   # Gourmet dish
│   ├── gallery2.png
│   ├── gallery3.webp   # Candle‑lit interior
│   └── gallery3.png
├── assets/
│   ├── logo.svg        # Simple ember‑flame logo used in the header & footer
│   ├── favicon-16.png  # Small favicon for legacy support
│   ├── favicon-32.png  # Standard favicon
│   ├── favicon-48.png  # Apple touch icon
│   ├── phone.svg       # Inline icons used in the contact section
│   ├── location.svg
│   ├── envelope.svg
│   ├── facebook.svg
│   ├── instagram.svg
│   └── twitter.svg
└── README.md          # You’re reading it
```

## Customisation

- **Brand Name & Tagline** – Edit the `<h1>` and tagline in the hero section of `index.html`.  Update the `<title>` and meta description in the `<head>` accordingly.  You can also replace `assets/logo.svg` with your own vector lockup (just keep the filename consistent or update the references).

- **Images** – All images live in `images/`.  Replace `hero.webp`/`hero.png` with your own high‑resolution hero (ideally ≥2 000 px wide) for the patio background.  Do the same for the gallery images; ensure both a `.webp` and `.png` version exist for browser fallback.  Keep the relative filenames the same or update the `src` attributes in `index.html` accordingly.  Optimise large images before swapping them in.

- **Menu Items** – The menu is defined in the `#menu` section.  Each category lives inside its own `<div class="ei-menu__panel" data-category="…">` block with `<li>` elements containing the name, optional dietary tags (e.g. `V`, `VG`, `GF`), description and price.  Add or remove items as needed.  To add or remove categories, update the tab controls (`.ei-menu__tabs`) and replicate a matching panel.

- **Forms** – Both the reservations and contact forms, as well as modal forms for private dining and event RSVPs, post to Formspree by default.  Replace `YOUR_FORMSPREE_ID` in `index.html` and `main.js` with your own [Formspree](https://formspree.io) endpoint IDs.  Alternatively you can replace the `action` attributes with your Netlify Forms endpoint (`data-netlify="true"` + `name` attribute) if deploying to Netlify.

- **Locations & Hours** – Update the addresses, phone numbers and opening hours in the `#locations` and `#contact` sections.  The “Get directions” links are placeholders; you can change the `href` to point to your Google Maps location.

- **Events & Private Dining** – Events are defined inside `#events` as `<article class="ei-event">` elements with a title, date, description and RSVP link.  Add, remove or modify events to suit your calendar.  The “Private Dining” block below it shows a summary and a button that triggers a modal inquiry form – adjust the text to describe your private room or special offerings.

- **Social Links** – Social icons in the footer use inline SVGs.  Change the `<a href="#">` values in the footer to link to your own Instagram, Facebook, Twitter or other profiles.  Additional icons can be added by copying more SVGs into `assets/` and referencing them in `index.html`.

- **Colour Palette & Typography** – The colour scheme is defined via CSS custom properties at the top of `css/styles.css`.  Modify `--ei-color-bg`, `--ei-color-primary`, `--ei-color-secondary` and others to adjust the dark theme.  Font families (Cormorant Garamond for headings and Inter for body copy) are loaded from Google Fonts in the `<head>` of `index.html`; you can swap these for any other Google fonts by editing the `<link>` and `font-family` declarations in the CSS.

## Deployment

This is a static site – no build step is required.  To deploy to a platform like Vercel or Netlify:

1. **Upload the `ember-ivy` directory** to your hosting provider as the site root.  Ensure that the directory structure is preserved and that relative paths remain intact.  Do not rename `index.html`.
2. **Set the publish directory** to `/projects/ember-ivy/` if deploying from a monorepo.  Vercel/Netlify will automatically detect the `index.html` and serve the site.
3. **Configure your forms**.  If using Formspree, sign up for a free account, create a form and replace `YOUR_FORMSPREE_ID` in the markup and scripts.  If deploying on Netlify, you can remove the `action` attribute and instead add `data-netlify="true"` and a `name` attribute on each `<form>` element; Netlify will handle submissions for you.
4. **Embed in a parent site** by including `<iframe src="/projects/ember-ivy/index.html"></iframe>` or linking directly to `/projects/ember-ivy/`.  Because all CSS classes are scoped with the `.ei-` prefix and encapsulated under `<div class="ei-root">`, styles will not leak into the parent document.

## Image Credits

The current hero and gallery images are AI‑generated placeholders created for this template.  Replace them with your own royalty‑free photos or illustrations that reflect your brand.  If you choose to use stock photography, please respect the licences and provide attribution where required.

## Running Lighthouse

To verify performance, accessibility and SEO:

1. Open your deployed site in Chrome.
2. Press **F12** to open Developer Tools and navigate to the **Lighthouse** tab.
3. Generate a report targeting **Desktop**.  Aim for scores of 90+ across all categories.  Optimising image sizes (using WebP/AVIF), minifying CSS/JS and deferring non‑critical scripts will improve your metrics.

Enjoy crafting warm, fire‑lit evenings with Ember & Ivy!