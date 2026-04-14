function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function setYear() {
  const el = qs("#year");
  if (el) el.textContent = String(new Date().getFullYear());
}

function setupReveal() {
  const els = qsa("[data-reveal]");
  if (els.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("revealed");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  for (const el of els) io.observe(el);
}

function setupLightbox() {
  const lightbox = qs("#lightbox");
  const img = qs("#lightboxImg");
  if (!lightbox || !img) return;

  function open(src) {
    img.src = src;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    img.removeAttribute("src");
    document.body.style.overflow = "";
  }

  qsa("[data-lightbox]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-src");
      if (src) open(src);
    });
  });

  qsa("[data-lightbox-close]", lightbox).forEach((el) => {
    el.addEventListener("click", close);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) close();
  });
}

function setupAccordion() {
  const accRoot = qs("[data-accordion]");
  if (!accRoot) return;

  const details = qsa("details.acc", accRoot);
  for (const d of details) {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      for (const other of details) {
        if (other !== d) other.open = false;
      }
    });
  }
}

function setupMobileNav() {
  const burger = qs("#burger");
  const mobileNav = qs("#mobileNav");
  if (!burger || !mobileNav) return;

  function setOpen(next) {
    burger.setAttribute("aria-expanded", String(next));
    mobileNav.hidden = !next;
  }

  burger.addEventListener("click", () => {
    const isOpen = burger.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  qsa("a[href^='#']", mobileNav).forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

function init() {
  setYear();
  setupReveal();
  setupLightbox();
  setupAccordion();
  setupMobileNav();
}

init();
