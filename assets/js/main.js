(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrowMq = window.matchMedia("(max-width: 720px)");

  document.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.getAttribute("data-scroll"));
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* —— Spline layout + scroll-locked draw —— */
  let drawPath = null;
  let pathLength = 0;
  let pathHeight = 0;

  const layoutSpline = () => {
    const root = document.querySelector("[data-spline]");
    if (!root) return;

    const svg = root.querySelector(".spline-svg");
    const track = root.querySelector(".spline-path--track");
    const draw = root.querySelector(".spline-path--draw");
    const nodes = [...root.querySelectorAll(".spline-node")];
    if (!svg || !track || !draw || !nodes.length) return;

    const w = root.clientWidth;
    if (w < 40) return;

    const narrow = narrowMq.matches;
    root.classList.toggle("is-narrow", narrow);

    const n = nodes.length;
    const cardW = narrow
      ? Math.min(168, Math.max(112, w * 0.34))
      : Math.min(300, Math.max(220, w * 0.3));
    const blurbW = narrow
      ? Math.min(140, Math.max(96, w * 0.28))
      : Math.min(240, Math.max(160, w * 0.24));
    const yPadTop = Math.round(cardW * (narrow ? 0.55 : 0.42) + (narrow ? 36 : 40));
    const yPadBottom = Math.round(cardW * (narrow ? 1.05 : 0.85) + (narrow ? 120 : 140));
    const slot = narrow
      ? Math.max(Math.round(cardW * 1.55), 260)
      : Math.max(Math.round(cardW * 1.25), 300);
    const h = yPadTop + yPadBottom + (n - 1) * slot;

    root.style.height = `${h}px`;
    root.style.setProperty("--card-w", `${cardW}px`);
    root.style.setProperty("--blurb-w", `${blurbW}px`);

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));

    const mediaGap = narrow ? 12 : 40;
    const padX = Math.min(
      w * (narrow ? 0.4 : 0.34),
      Math.max(cardW + mediaGap, w * (narrow ? 0.3 : 0.26))
    );
    const leftX = padX;
    const rightX = w - padX;
    const mid = (leftX + rightX) / 2;
    const amp = (rightX - leftX) / 2;

    const points = nodes.map((_, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      return {
        x: mid + amp * Math.cos(i * Math.PI),
        y: yPadTop + t * (h - yPadTop - yPadBottom),
      };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const midY = (prev.y + curr.y) / 2;
      d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
    }

    track.setAttribute("d", d);
    draw.setAttribute("d", d);

    pathLength = draw.getTotalLength();
    pathHeight = h;
    draw.style.strokeDasharray = `${pathLength}`;
    draw.style.strokeDashoffset = `${pathLength}`;
    drawPath = draw;

    nodes.forEach((node, i) => {
      const pt = points[i];
      const sideRight = pt.x >= mid;
      node.classList.remove("is-center");
      node.classList.toggle("is-right", sideRight);
      node.classList.toggle("is-left", !sideRight);
      node.style.left = `${pt.x}px`;
      node.style.top = `${pt.y}px`;
    });

    updatePathDraw();
  };

  const screenYAtLength = (len, rect) => {
    const pt = drawPath.getPointAtLength(len);
    return rect.top + (pt.y / pathHeight) * rect.height;
  };

  const updatePathDraw = () => {
    if (!drawPath || !pathLength || !pathHeight) return;
    const root = document.querySelector("[data-spline]");
    if (!root) return;

    if (reduceMotion) {
      drawPath.style.strokeDashoffset = "0";
      return;
    }

    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const tipLine = vh * 0.55;
    const startY = screenYAtLength(0, rect);
    const endY = screenYAtLength(pathLength, rect);

    const scrollMax = Math.max(0, document.documentElement.scrollHeight - vh);
    const nearPageEnd = window.scrollY >= scrollMax - 12;

    let drawn = 0;
    if (nearPageEnd) {
      drawn = pathLength;
    } else {
      const span = endY - startY;
      if (span > 1) {
        const t = Math.min(1, Math.max(0, (tipLine - startY) / span));
        drawn = t * pathLength;
      } else if (startY <= tipLine) {
        drawn = pathLength;
      }
    }

    drawPath.style.strokeDashoffset = `${pathLength - drawn}`;
  };

  layoutSpline();
  window.addEventListener("resize", () => {
    window.clearTimeout(layoutSpline._t);
    layoutSpline._t = window.setTimeout(layoutSpline, 80);
  });
  if (typeof narrowMq.addEventListener === "function") {
    narrowMq.addEventListener("change", layoutSpline);
  } else if (typeof narrowMq.addListener === "function") {
    narrowMq.addListener(layoutSpline);
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!updatePathDraw._raf) {
        updatePathDraw._raf = requestAnimationFrame(() => {
          updatePathDraw._raf = 0;
          updatePathDraw();
        });
      }
    },
    { passive: true }
  );

  /* —— Bot card tap-to-flip (touch / coarse pointers) —— */
  document.querySelectorAll(".bot-card:not(.bot-card--static)").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const play = event.target.closest(".bot-card-play");
      if (play && card.classList.contains("is-flipped")) return;
      event.preventDefault();
      document.querySelectorAll(".bot-card.is-flipped").forEach((other) => {
        if (other !== card) other.classList.remove("is-flipped");
      });
      card.classList.toggle("is-flipped");
    });
  });

  /* —— Reveal in + out on scroll —— */
  const albums = document.querySelectorAll("[data-album]");

  if (!("IntersectionObserver" in window) || reduceMotion) {
    albums.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const albumIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-in", entry.isIntersecting);
      });
    },
    {
      threshold: 0.22,
      rootMargin: "0px 0px -8% 0px",
    }
  );
  albums.forEach((el) => albumIo.observe(el));
})();
