(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var navLinks = document.querySelector(".nav-links");

  if (toggle && navLinks) {
    toggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      toggle.classList.toggle("active", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        toggle.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Fade-in on scroll
  var fadeElements = document.querySelectorAll(".fade-in");

  function reveal(el) {
    el.classList.add("visible");
  }

  function revealElementsInView() {
    var allRevealed = true;
    fadeElements.forEach(function (el) {
      if (el.classList.contains("visible")) {
        return;
      }
      var box = el.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) {
        reveal(el);
      } else {
        allRevealed = false;
      }
    });
    if (allRevealed) {
      window.removeEventListener("scroll", revealElementsInView);
    }
  }

  if (fadeElements.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      // threshold 0: a fractional threshold can never be met by a section
      // taller than the viewport, which would leave a long case-study page
      // stuck at opacity 0. Any pixel in view is enough to reveal.
      { threshold: 0, rootMargin: "0px 0px -40px 0px" }
    );

    fadeElements.forEach(function (el) {
      observer.observe(el);
    });

    // Safety net, independent of the observer and the load event:
    // whatever is in view shortly after the script runs gets revealed,
    // and anything scrolled into view is revealed even if the observer
    // never fires, so content is never lost.
    setTimeout(revealElementsInView, 200);
    window.addEventListener("load", revealElementsInView);
    window.addEventListener("scroll", revealElementsInView, { passive: true });
  } else {
    fadeElements.forEach(reveal);
  }
})();
