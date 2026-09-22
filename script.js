// ============================================
// Villa Rustica — small helper script
// A few independent bits of behaviour, each in
// its own block below. Every block checks for
// the element it needs first, so a page missing
// that element just skips it — nothing breaks.
// ============================================

// The header's real height, kept in a CSS variable instead of
// hardcoded elsewhere (the hero's height and the anchor-scroll
// offset both used to hardcode a guessed header height, and
// drifted out of sync with it whenever the nav's own size
// changed — e.g. a green sliver of the next section showing
// under the hero, or a section landing partly under the header
// after clicking a nav link). Re-measured on resize since the
// header can wrap differently at some widths.
function updateHeaderHeightVar() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  document.documentElement.style.setProperty(
    "--header-height",
    header.offsetHeight + "px"
  );
}

updateHeaderHeightVar();
window.addEventListener("resize", updateHeaderHeightVar);

document.addEventListener("DOMContentLoaded", function () {
  updateHeaderHeightVar();

  const timeline = document.getElementById("timeline");
  if (!timeline) return; // not on this page, stop here

  const progressBar = document.getElementById("timeline-progress");
  const items = timeline.querySelectorAll(".timeline-item");

  // 1) Fade each milestone in as it scrolls into view.
  //    IntersectionObserver watches elements and tells us
  //    when they enter the visible part of the screen.
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.25 } // trigger once 25% of the card is visible
  );

  items.forEach(function (item) {
    observer.observe(item);
  });

  // 2) Grow the line as the user scrolls through the
  //    timeline, so it feels like it's "drawing itself".
  //
  //    This tracks the vertical center of the screen (roughly
  //    where you're actually looking, especially with cards
  //    this tall) against the timeline's own height, so the
  //    fill lines up with whichever dot is at that height.
  //    Two earlier versions got this wrong: one measured
  //    progress across the timeline's whole trip through the
  //    viewport (padded by a full extra screen at both ends),
  //    which fell behind near the end of a long list; the next
  //    used a fixed line just below the header, which stayed
  //    stuck near the top since these cards are tall enough
  //    that a dot doesn't reach that high until its whole card
  //    has scrolled by.
  function updateProgressLine() {
    const centerLine = window.innerHeight / 2;

    const rect = timeline.getBoundingClientRect();
    let percent = ((centerLine - rect.top) / rect.height) * 100;

    // keep it within 0-100
    percent = Math.max(0, Math.min(100, percent));

    progressBar.style.height = percent + "%";
  }

  window.addEventListener("scroll", updateProgressLine);
  window.addEventListener("resize", updateProgressLine);
  updateProgressLine(); // run once on load too
});

// ============================================
// Reveal-on-scroll, everywhere on the site
// Adds a fade-up effect to headings, quotes and
// groups of cards/list items as they scroll into
// view. Nothing needs a ".reveal" class by hand —
// this finds them itself from the selectors below.
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Elements that fade in on their own.
  const singles = document.querySelectorAll(
    ".section h1, .section h2, .section h3, .spec-list, .person-card"
  );

  // Containers whose direct children should fade in
  // one after another (a little delay between each).
  const groups = document.querySelectorAll(
    ".stat-row, .link-row, .plain-list, .product-grid"
  );

  const targets = [];

  singles.forEach(function (el) {
    el.classList.add("reveal");
    targets.push(el);
  });

  groups.forEach(function (group) {
    Array.from(group.children).forEach(function (child, i) {
      child.classList.add("reveal");
      child.style.transitionDelay = i * 90 + "ms";
      targets.push(child);
    });
  });

  if (prefersReducedMotion) {
    // Respect the user's OS setting: show everything
    // immediately instead of animating it in.
    targets.forEach(function (el) {
      el.classList.add("visible");
    });
    return;
  }

  const revealObserver = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("visible");

        // If this element contains one of the big
        // "35 ha" / "2,000 t" numbers, count up to it
        // instead of just having it appear.
        const number = entry.target.querySelector(".stat-number");
        if (number) animateCount(number);

        obs.unobserve(entry.target); // only animate once
      });
    },
    { threshold: 0.2 }
  );

  targets.forEach(function (el) {
    revealObserver.observe(el);
  });
});

// Counts a number up from 0 to its target value.
// Understands "35 ha", "2,000 t", "2.000 t" and plain "2013"
// — it keeps whatever text comes after the digits, and if the
// original used a comma or period as a thousands separator,
// re-applies that same character while counting up.
function animateCount(el) {
  const raw = el.textContent.trim();
  const match = raw.match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return; // not a number, leave it alone

  const separator = match[1].indexOf(",") !== -1 ? "," : match[1].indexOf(".") !== -1 ? "." : "";
  const target = parseInt(match[1].replace(/[.,]/g, ""), 10);
  const suffix = match[2] ? " " + match[2] : "";
  const duration = 1000;
  const start = performance.now();

  function withSeparator(n) {
    if (!separator) return String(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  }

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    const current = Math.round(target * eased);
    const shown = withSeparator(current);
    el.textContent = shown + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// ============================================
// Europe export map (Markets page)
// The map itself (a real map, with each country
// tagged by its ISO id — "de", "at"...) is embedded
// directly in markets.html inside #europe-map, copied
// from assets/europe-map.svg. It's embedded rather than
// loaded with fetch() so the page still works when
// opened straight from a file, with no web server.
//
// This just finds that already-present map and draws a
// line + a small travelling arrow from Moldova to each
// market on top of it.
//
// To add a new export market: add its ISO code, name
// and map position to the "markets" list below, find
// that country's <path id="..."> inside #europe-map in
// markets.html, and add class="market" to it (copy how
// the existing ones look, e.g. id="fr" for France).
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const mount = document.getElementById("europe-map");
  if (!mount) return; // not on this page

  const svg = mount.querySelector("svg");
  if (svg) drawExportRoutes(svg);
});

function drawExportRoutes(svg) {
  const svgNS = "http://www.w3.org/2000/svg";
  const xlinkNS = "http://www.w3.org/1999/xlink";

  // Moldova's position, and each market's position, in
  // the map's own coordinate space (its viewBox units —
  // found by checking each country shape's real center).
  const origin = { x: 462, y: 357 };
  const markets = [
    { name: "Germany", x: 312, y: 325 },
    { name: "Austria", x: 336, y: 366 },
    { name: "Netherlands", x: 272, y: 312 },
    { name: "Poland", x: 379, y: 309 },
    { name: "Romania", x: 438, y: 375 },
    { name: "Hungary", x: 388, y: 368 },
    { name: "Croatia", x: 365, y: 404 },
    { name: "Latvia", x: 408, y: 243 },
  ];

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const group = document.createElementNS(svgNS, "g");
  group.setAttribute("id", "export-routes");
  svg.appendChild(group); // attach now so getTotalLength() below works

  markets.forEach(function (market, i) {
    const pathId = "route-" + i;

    // An arched line instead of a straight one: bow the
    // midpoint out to one side, perpendicular to the line,
    // by an amount proportional to its length.
    const midX = (origin.x + market.x) / 2;
    const midY = (origin.y + market.y) / 2;
    const dx = market.x - origin.x;
    const dy = market.y - origin.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const bow = length * 0.18;
    const curveX = midX + (-dy / length) * bow;
    const curveY = midY + (dx / length) * bow;

    // The line itself — always drawn, moving or not, so
    // the route is visible even without the animation.
    const line = document.createElementNS(svgNS, "path");
    line.setAttribute("id", pathId);
    line.setAttribute("class", "route-line");
    line.setAttribute(
      "d",
      "M " +
        origin.x +
        " " +
        origin.y +
        " Q " +
        curveX +
        " " +
        curveY +
        " " +
        market.x +
        " " +
        market.y
    );
    group.appendChild(line);

    // Reduced motion: leave the line solid and fully drawn,
    // skip the arrow and the drawing animation entirely.
    if (prefersReducedMotion) return;

    // The line starts invisible and "draws itself" as the
    // arrow travels out, then draws itself back out (erases)
    // as the arrow returns — so the line moves with the
    // arrow instead of just sitting there fully drawn.
    const pathLength = line.getTotalLength();
    line.style.strokeDasharray = String(pathLength);
    line.style.strokeDashoffset = String(pathLength);

    // A one-way trip, not a back-and-forth: travel takes the
    // first ~78% of "dur", then it holds at the destination
    // for the rest, before the whole thing loops from Moldova
    // again (repeatCount restarts both of these from scratch).
    const dur = "4.5s";
    const begin = i * 0.4 + "s"; // stagger so routes don't all move in sync

    const lineAnim = document.createElementNS(svgNS, "animate");
    lineAnim.setAttribute("attributeName", "stroke-dashoffset");
    lineAnim.setAttribute("values", pathLength + ";0;0");
    lineAnim.setAttribute("keyTimes", "0;0.78;1");
    lineAnim.setAttribute("dur", dur);
    lineAnim.setAttribute("repeatCount", "indefinite");
    lineAnim.setAttribute("begin", begin);
    line.appendChild(lineAnim);

    // A small triangle that travels out to the market, stops,
    // then jumps back to Moldova to start the next loop —
    // rotated to point the way it's moving while travelling.
    const arrow = document.createElementNS(svgNS, "path");
    arrow.setAttribute("class", "route-arrow");
    arrow.setAttribute("d", "M -4 -3 L 4 0 L -4 3 Z");

    const motion = document.createElementNS(svgNS, "animateMotion");
    motion.setAttribute("dur", dur);
    motion.setAttribute("repeatCount", "indefinite");
    motion.setAttribute("rotate", "auto");
    motion.setAttribute("calcMode", "linear");
    motion.setAttribute("keyPoints", "0;1;1");
    motion.setAttribute("keyTimes", "0;0.78;1");
    motion.setAttribute("begin", begin);

    const mpath = document.createElementNS(svgNS, "mpath");
    mpath.setAttributeNS(xlinkNS, "xlink:href", "#" + pathId);
    motion.appendChild(mpath);
    arrow.appendChild(motion);
    group.appendChild(arrow);
  });
}

// ============================================
// Nav scroll-spy
// This is now one long page instead of separate
// pages, so the nav no longer has a fixed "current
// page" — instead, highlight whichever section's
// link the user has scrolled down to.
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const navLinks = document.querySelectorAll(".nav-links a");
  if (!navLinks.length) return;

  // Pair each nav link with the section its href points to.
  const targets = Array.from(navLinks)
    .map(function (link) {
      const id = link.getAttribute("href").replace("#", "");
      const section = document.getElementById(id);
      return section ? { link: link, section: section } : null;
    })
    .filter(Boolean);

  if (!targets.length) return;

  function updateActiveLink() {
    const scrollPos = window.scrollY + 150; // a bit below the sticky nav

    // The active link is the last one whose section we've
    // scrolled past — so "Home" stays active through the
    // story/timeline in between, until "Products" starts.
    let current = targets[0];
    targets.forEach(function (t) {
      if (t.section.offsetTop <= scrollPos) current = t;
    });

    targets.forEach(function (t) {
      t.link.classList.toggle("active", t === current);
    });
  }

  window.addEventListener("scroll", updateActiveLink);
  updateActiveLink();
});

// ============================================
// Header shadow on scroll
// A plain flat bar at the very top, a floating one
// with a shadow once there's content under it.
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const header = document.querySelector(".site-header");
  if (!header) return;

  function updateHeaderShadow() {
    header.classList.toggle("scrolled", window.scrollY > 40);
  }

  window.addEventListener("scroll", updateHeaderShadow);
  updateHeaderShadow();
});

// ============================================
// Custom-paced smooth scrolling for "#" links
// The browser's own smooth scroll covers this whole
// page's length too quickly to feel nice, so this
// animates it manually with an easing curve and a
// duration based on how far it's travelling.
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach(function (link) {
    const id = link.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return; // not an in-page link (or points nowhere)

    link.addEventListener("click", function (event) {
      event.preventDefault();

      // Clear the sticky header, using its real measured height
      // instead of a guessed constant, plus a bit of breathing
      // room so every section lands the same visual distance
      // below the header regardless of the header's own size.
      const header = document.querySelector(".site-header");
      const headerOffset = (header ? header.offsetHeight : 100) + 8;

      const startY = window.scrollY;
      const endY = target.getBoundingClientRect().top + startY - headerOffset;
      const distance = endY - startY;

      if (prefersReducedMotion) {
        window.scrollTo(0, endY);
        return;
      }

      // Longer trips take a bit longer, but capped so it
      // never drags — and a floor so short hops still ease.
      const duration = Math.min(1500, Math.max(600, Math.abs(distance) * 0.5));
      const start = performance.now();

      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        // ease-in-out cubic
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo(0, startY + distance * eased);
        if (progress < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    });
  });
});

// ============================================
// Language dropdown — navigates to the chosen
// page on selection.
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const langSelect = document.querySelector(".lang-select");
  if (!langSelect) return;

  langSelect.addEventListener("change", function () {
    window.location.href = langSelect.value;
  });
});
