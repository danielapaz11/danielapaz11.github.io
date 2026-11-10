/* ==========================================================================
   Mapa mental de habilidades
   Radial, generado desde skills.md, sin dependencias.
   Expone window.SkillsMap = { init, setState, layout, reset }
   ========================================================================== */

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#5b3df5", "#0ea5a5", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];
  const LEVEL_NAME = { 1: "Aprendiendo", 2: "Práctico", 3: "Cómodo" };

  const state = {
    initialized: false,
    categories: [],
    category: "todo",
    query: "",
    k: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    selected: null,
    onCategory: null,
    onReset: null,
    els: {},
  };

  /* ---------- Utilidades ---------- */

  function normalize(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svg(tag) {
    return document.createElementNS(SVG_NS, tag);
  }

  function curve(x1, y1, x2, y2, cx, cy) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const px = mx + (cx - mx) * 0.14;
    const py = my + (cy - my) * 0.14;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${px.toFixed(1)} ${py.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /* ---------- Construcción ---------- */

  function build() {
    const { nodes, links } = state.els;
    nodes.replaceChildren();
    links.replaceChildren();

    const center = make("button", "map-center");
    center.type = "button";
    center.setAttribute("aria-label", "Daniela Paz Habilidades. Quitar filtros y volver al inicio");
    center.append(make("strong", null, "Daniela Paz"), make("span", "map-center-role", "Habilidades"));
    center.addEventListener("click", () => {
      clearSelection();
      state.onReset?.();
      showEmpty();
    });
    nodes.append(center);
    state.els.center = center;

    state.categories.forEach((cat, index) => {
      cat.color = PALETTE[index % PALETTE.length];

      const catLink = svg("path");
      catLink.setAttribute("class", "map-link map-link-cat");
      catLink.style.setProperty("--cat", cat.color);
      links.append(catLink);
      cat.linkEl = catLink;

      const catNode = make("button", "map-cat");
      catNode.type = "button";
      catNode.title = cat.title;
      catNode.style.setProperty("--cat", cat.color);
      catNode.dataset.cat = cat.cat;

      const count = make("span", "map-count", String(cat.skills.length));
      catNode.append(make("span", "map-dot"), make("span", "map-label", cat.label), count);

      catNode.addEventListener("click", () => {
        clearSelection();
        state.onCategory?.(cat.cat);
        showCategory(cat);
      });

      nodes.append(catNode);
      cat.node = catNode;
      cat.countEl = count;

      cat.skills.forEach((skill) => {
        const skillLink = svg("path");
        skillLink.setAttribute("class", "map-link map-link-skill");
        skillLink.style.setProperty("--cat", cat.color);
        links.append(skillLink);
        skill.linkEl = skillLink;

        const node = make("button", "map-node");
        node.type = "button";
        node.style.setProperty("--cat", cat.color);
        node.title = skill.evidence ? `${skill.name} — ${skill.evidence}` : skill.name;

        const dot = make("span", "map-dot");
        if (skill.level) dot.classList.add(`lvl-${skill.level}`);

        node.append(dot, make("span", "map-label", skill.label));
        node.addEventListener("click", () => showSkill(cat, skill));

        nodes.append(node);
        skill.node = node;
      });
    });
  }

  /* ---------- Posiciones ---------- */

  function layout() {
    const canvas = state.els.canvas;
    if (!canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 40 || h < 40) return;

    const cx = w / 2;
    const cy = h / 2;
    const rx1 = w * 0.22;
    const ry1 = h * 0.23;
    const branch = Math.min(w, h) * 0.16;
    const spacing = 34;

    state.els.center.style.left = `${cx}px`;
    state.els.center.style.top = `${cy}px`;

    const total = state.categories.reduce((sum, cat) => sum + cat.skills.length + 1.4, 0);
    let angle = -Math.PI / 2;

    state.categories.forEach((cat, catIndex) => {
      const weight = cat.skills.length + 1.4;
      const slice = (Math.PI * 2 * weight) / total;
      const catAngle = angle + slice / 2;
      const catScale = catIndex % 2 === 0 ? 1 : 1.12;

      const x1 = cx + Math.cos(catAngle) * rx1 * catScale;
      const y1 = cy + Math.sin(catAngle) * ry1 * catScale;

      cat.node.style.left = `${x1}px`;
      cat.node.style.top = `${y1}px`;
      cat.linkEl.setAttribute("d", curve(cx, cy, x1, y1, cx, cy));

      const outX = Math.cos(catAngle);
      const outY = Math.sin(catAngle);
      const baseX = x1 + outX * branch;
      const baseY = y1 + outY * branch;
      const perpX = -outY;
      const perpY = outX;
      const degrees = (catAngle * 180) / Math.PI;
      const isLeft = outX < 0;
      const count = cat.skills.length;

      cat.skills.forEach((skill, index) => {
        const offset = (index - (count - 1) / 2) * spacing;
        const x2 = baseX + perpX * offset;
        const y2 = baseY + perpY * offset;

        skill.node.classList.toggle("left", isLeft);
        skill.node.style.left = `${x2}px`;
        skill.node.style.top = `${y2}px`;
        skill.node.style.transform = isLeft
          ? `translate(-100%, -50%) rotate(${degrees + 180}deg)`
          : `translate(0, -50%) rotate(${degrees}deg)`;

        skill.linkEl.setAttribute("d", curve(x1, y1, x2, y2, cx, cy));
      });

      angle += slice;
    });
  }

  /* ---------- Filtros ---------- */

  function updateStates() {
    const query = normalize(state.query);
    const filtered = state.category !== "todo";

    state.categories.forEach((cat) => {
      const categoryOk = !filtered || cat.cat === state.category;
      const headingMatch = Boolean(query) && normalize(cat.title).includes(query);

      const results = cat.skills.map((skill) => {
        if (!categoryOk) return false;
        if (!query) return true;
        return headingMatch || normalize(`${skill.name} ${skill.evidence ?? ""}`).includes(query);
      });

      const anyResult = results.some(Boolean);
      const open = categoryOk && anyResult && (Boolean(query) || filtered);

      cat.node.classList.toggle("is-open", open);
      cat.node.classList.toggle("is-dim", Boolean(query) && !anyResult);
      cat.linkEl.classList.toggle("is-dim", Boolean(query) && !anyResult);

      let visibleCount = 0;

      cat.skills.forEach((skill, index) => {
        const visible = open && results[index];
        if (visible) visibleCount += 1;
        skill.node.classList.toggle("is-hidden", !visible);
        skill.linkEl.classList.toggle("is-hidden", !visible);
      });

      if (cat.countEl) {
        cat.countEl.textContent = String(query ? visibleCount : cat.skills.length);
        cat.countEl.hidden = Boolean(query) && visibleCount === 0;
      }
    });
  }

  /* ---------- Detalle ---------- */

  function clearSelection() {
    document.querySelectorAll(".map-node.is-selected").forEach((node) => node.classList.remove("is-selected"));
    document.querySelectorAll(".map-link.is-highlighted").forEach((link) => link.classList.remove("is-highlighted"));
    state.selected = null;
  }

  function showEmpty() {
    const detail = state.els.detail;
    if (!detail) return;
    detail.replaceChildren(make("p", "map-detail-empty", "Haz clic en una categoría para abrirla, o en una habilidad para ver su detalle."));
  }

  function showSkill(cat, skill) {
    const detail = state.els.detail;
    if (!detail) return;

    clearSelection();
    skill.node.classList.add("is-selected");
    skill.linkEl.classList.add("is-highlighted");
    state.selected = skill;

    const meta = make("p", "map-detail-meta");
    const category = make("span", "detail-cat", cat.title);
    category.style.setProperty("--cat", cat.color);
    meta.append(category);

    if (skill.level) meta.append(make("span", `level level-${skill.level}`, LEVEL_NAME[skill.level]));

    const body = make("div", "map-detail-body");
    body.append(meta, make("h3", "map-detail-title", skill.name));

    if (skill.evidence) body.append(make("p", "map-detail-text", skill.evidence));

    detail.replaceChildren(body);
  }

  function showCategory(cat) {
    const detail = state.els.detail;
    if (!detail) return;

    const meta = make("p", "map-detail-meta");
    const label = make("span", "detail-cat", "Categoría");
    label.style.setProperty("--cat", cat.color);
    meta.append(label);

    const body = make("div", "map-detail-body");
    body.append(meta, make("h3", "map-detail-title", cat.title));

    const names = cat.skills.map((skill) => skill.name).join(" · ");
    body.append(make("p", "map-detail-text", `${cat.skills.length} habilidades: ${names}`));

    detail.replaceChildren(body);
  }

  /* ---------- Zoom y arrastre ---------- */

  function applyTransform() {
    const world = state.els.world;
    if (!world) return;
    world.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.k})`;
  }

  function zoomAt(px, py, factor) {
    const next = clamp(state.k * factor, state.minK ?? 0.4, state.maxK ?? 3);
    const ratio = next / state.k;
    state.panX = px - (px - state.panX) * ratio;
    state.panY = py - (py - state.panY) * ratio;
    state.k = next;
    applyTransform();
  }

  function zoomCenter(factor) {
    const canvas = state.els.canvas;
    if (!canvas) return;
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor);
  }

  function resetView() {
    const canvas = state.els.canvas;
    if (!canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 40 || h < 40) return;

    state.k = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();

    const canvasRect = canvas.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    state.els.nodes.querySelectorAll(".map-node:not(.is-hidden), .map-cat, .map-center").forEach((el) => {
      const rect = el.getBoundingClientRect();
      minX = Math.min(minX, rect.left - canvasRect.left);
      minY = Math.min(minY, rect.top - canvasRect.top);
      maxX = Math.max(maxX, rect.right - canvasRect.left);
      maxY = Math.max(maxY, rect.bottom - canvasRect.top);
    });

    if (!Number.isFinite(minX)) return;

    const padding = 16;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = Math.min(1, (w - padding * 2) / contentW, (h - padding * 2) / contentH);

    state.k = scale;
    state.minK = Math.min(0.35, scale * 0.7);
    state.maxK = Math.max(2.4, scale * 3);
    state.panX = w / 2 - ((minX + maxX) / 2) * scale;
    state.panY = h / 2 - ((minY + maxY) / 2) * scale;
    applyTransform();
  }

  function bind() {
    const canvas = state.els.canvas;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      if (event.target.closest("button")) return;

      state.dragging = true;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.startPanX = state.panX;
      state.startPanY = state.panY;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.dragging || event.pointerId !== state.pointerId) return;
      state.panX = state.startPanX + (event.clientX - state.startX);
      state.panY = state.startPanY + (event.clientY - state.startY);
      applyTransform();
    });

    const endDrag = (event) => {
      if (event.pointerId !== state.pointerId) return;
      state.dragging = false;
      state.pointerId = null;
      canvas.classList.remove("is-dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        zoomAt(
          event.clientX - rect.left,
          event.clientY - rect.top,
          event.deltaY < 0 ? 1.12 : 0.89
        );
      },
      { passive: false }
    );

    canvas.addEventListener("dblclick", (event) => {
      if (!event.target.closest("button")) resetView();
    });

    document.getElementById("map-zoom-in")?.addEventListener("click", () => zoomCenter(1.25));
    document.getElementById("map-zoom-out")?.addEventListener("click", () => zoomCenter(0.8));
    document.getElementById("map-reset")?.addEventListener("click", resetView);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.selected) {
        clearSelection();
        showEmpty();
      }
    });
  }

  /* ---------- API ---------- */

  function init(options) {
    const { canvas, categories, onCategory, onReset } = options;
    if (!canvas) return;

    state.els.canvas = canvas;
    state.els.world = document.getElementById("map-world");
    state.els.nodes = document.getElementById("map-nodes");
    state.els.links = document.getElementById("map-links");
    state.els.detail = document.getElementById("map-detail");
    state.categories = categories ?? [];
    state.onCategory = onCategory ?? null;
    state.onReset = onReset ?? null;
    state.initialized = true;

    build();
    bind();
    layout();
    updateStates();
    showEmpty();
    resetView();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(() => {
        layout();
        resetView();
      });
      observer.observe(canvas);
    } else {
      window.addEventListener("resize", () => {
        layout();
        resetView();
      });
    }
  }

  function setState(next) {
    if (!state.initialized) return;

    const category = next.category ?? "todo";
    const categoryChanged = category !== state.category;

    state.category = category;
    state.query = next.query ?? "";
    updateStates();

    if (categoryChanged) {
      resetView();
    }
  }

  window.SkillsMap = { init, setState, layout, reset: resetView };
})();
