# Personal Website – Setup & Customization Guide

Thank you for choosing this template to showcase your web design, development and hosting services.  The files in this folder constitute a fully static website ready for deployment on Vercel, Netlify or any other static hosting platform.

## Contents

```
personal_site/
├── index.html           # Main single‑page site with all sections
├── css/
│   └── styles.css       # Global styles (uses BEM class naming)
├── js/
│   └── main.js          # JavaScript for menu toggle and smooth scrolling
├── images/
│   ├── portrait.png     # Placeholder portrait used in hero and about
│   ├── project1.png     # First portfolio mock‑up
│   ├── project2.png     # Second portfolio mock‑up
│   ├── project3.png     # Third portfolio mock‑up
│   └── favicon.png      # Site favicon
└── assets/              # Empty folder reserved for extra assets (icons, PDFs, etc.)
```

## Customization

The template is designed to be easy to update.  Open **index.html** in a text editor and look for the following placeholders:

- **Your Name** – replace every instance with your actual name or business name.  This appears in the logo, hero headline, testimonials and footer.
- **Email & Phone** – update the email (`info@example.com`) and phone number (`(123) 456‑7890`) in the footer to your contact details.
- **Formspree ID** – in the contact form action attribute, replace `your-form-id` with the ID provided by [Formspree](https://formspree.io/) or another static form service.  This enables form submissions without a backend.
- **Images** – replace the files in the `images/` folder with your own photos, screenshots or client work.  Maintain the same filenames (e.g. `portrait.png`, `project1.png`) or update the `<img>` `src` attributes accordingly.
- **Portfolio Items & Testimonials** – modify the titles, descriptions and testimonial quotes in the **Portfolio** and **Testimonials** sections to reflect your real projects and client feedback.
- **Social Links** – update the `href` attributes in the footer’s social icons to point to your actual profiles (LinkedIn, GitHub, etc.).

## Styling & Layout

The look and feel of the site are controlled entirely by `css/styles.css`.  Colours and fonts are defined as CSS variables at the top of the file for quick adjustments.  Responsive breakpoints at 768 px and 1024 px ensure the layout adapts gracefully to mobile and tablet screens, following mobile‑first best practices recommended by industry sources【494257633164294†L264-L269】.  All classes follow the Block–Element–Modifier (BEM) methodology for clarity and scalability.

## Scripts

`js/main.js` provides minimal JavaScript to:

1. Toggle the mobile navigation menu via the hamburger icon.
2. Smoothly scroll to different sections when navigation links are clicked.
3. Inject the current year into the footer.

These functions are self‑contained and commented for easy editing.

## Deployment

To deploy the site:

1. Zip the contents of the `personal_site/` folder or push it to a Git repository.
2. Import the project into [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).  Both services automatically detect static sites.
3. Optionally configure a custom domain through your hosting provider.  This template is ready to serve immediately—no additional build steps are required.

## Accessibility & SEO

Semantic HTML5 tags, descriptive `alt` attributes and proper heading hierarchy ensure good accessibility.  A unique `<title>` and `<meta description>` help search engines understand your content.  All images are served in modern formats and sized appropriately to keep loading times low.

For more guidance on responsive design and small business websites, consult authoritative resources that emphasise a mobile‑first approach, flexible grids and performance optimisation【494257633164294†L264-L269】【643727002214931†L94-L114】.

Enjoy building your online presence!