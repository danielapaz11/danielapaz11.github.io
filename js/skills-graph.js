/* ==========================================================================
   Grafo interactivo de habilidades
   Fuerza dirigida, sin dependencias.
   Expone window.SkillsGraph = { init, activate, deactivate, setState, fit }
   ========================================================================== */

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#5b3df5", "#0f766e", "#2563eb", "#7c3aed", "#b45309", "#be185d", "#0d9488"];
  const LEVEL_NAME = { 1: "Aprendiendo", 2: "Práctico", 3: "Cómodo" };
  const RADIUS = { 0: 9, 1: 9, 2: 11, 3: 13 };

  // Relaciones reales entre habilidades: [origen, destino].
  const LINK_RULES = [
    ["html", "css"],
    ["html", "responsive"],
    ["css", "responsive"],
    ["css", "figma"],
    ["responsive", "wcag"],
    ["responsive", "figma"],
    ["js", "api"],
    ["js", "testing"],
    ["js", "typescript"],
    ["js", "wcag"],
    ["api", "postman"],
    ["api", "vision"],
    ["java", "estructuras"],
    ["python", "estructuras"],
    ["csharp", "estructuras"],
    ["cpp", "estructuras"],
    ["java", "uml"],
    ["uml", "agile"],
    ["sql", "modelado"],
    ["sql", "nosql"],
    ["redes", "linux"],
    ["redes", "vision"],
    ["linux", "git"],
    ["git", "pages"],
    ["git", "vscode"],
    ["pages", "actions"],
    ["git", "actions"],
    ["agile", "equipo"],
    ["equipo", "comunicacion"],
    ["comunicacion", "vision"],
    ["vision", "sql"],
    ["aprendizaje", "testing"],
    ["aprendizaje", "typescript"],
    ["aprendizaje", "wcag"],
    ["problemas", "estructuras"],
    ["problemas", "testing"],
  ];

  // Prefijos normalizados para reconocer una habilidad del markdown.
  const KEY_RULES = [
    ["html5", "html"],
    ["css3", "css"],
    ["diseno responsive", "responsive"],
    ["javascript", "js"],
    ["consumo de apis", "api"],
    ["java (poo)", "java"],
    ["python", "python"],
    ["c#", "csharp"],
    ["c / c++", "cpp"],
    ["estructuras de datos", "estructuras"],
    ["sql (", "sql"],
    ["modelado entidad", "modelado"],
    ["mongodb", "nosql"],
    ["redes (", "redes"],
    ["linux", "linux"],
    ["analisis y diseno", "uml"],
    ["metodologias agiles", "agile"],
    ["git y github", "git"],
    ["vs code", "vscode"],
    ["github pages", "pages"],
    ["postman", "postman"],
    ["figma", "figma"],
    ["trabajo en equipo", "equipo"],
    ["comunicacion", "comunicacion"],
    ["aprendizaje continuo", "aprendizaje"],
    ["resolucion de problemas", "problemas"],
    ["vision de sistema", "vision"],
    ["testing", "testing"],
    ["typescript", "typescript"],
    ["accesibilidad (wcag", "wcag"],
    ["despliegue con github", "actions"],
  ];

  const state = {
    initialized: false,
    active: false,
    categories: [],
    nodes: [],
    links: [],
    byKey: new Map(),
    category: "todo",
    query: "",
    selected: null,
    hovered: null,
    roving: null,
    showTags: false,
    width: 0,
    height: 0,
    k: 1,
    panX: 0,
    panY: 0,
    alpha: 0,
    raf: 0,
    lastTime: 0,
    seeded: false,
    seed: 1,
    spin: 0,
    drag: null,
    pan: null,
    reduceMotion: false,
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function skillKey(name) {
    const text = normalize(name);
    const rule = KEY_RULES.find(([prefix]) => text.startsWith(prefix));
    return rule ? rule[1] : null;
  }

  /* ---------- Construcción ---------- */

  function build() {
    const { nodesLayer, linksLayer, legend, detail, tip } = state.els;

    nodesLayer.replaceChildren();
    linksLayer.replaceChildren();
    legend.replaceChildren();
    detail.hidden = true;
    detail.replaceChildren();
    tip.hidden = true;

    state.nodes = [];
    state.links = [];
    state.byKey = new Map();

    state.categories.forEach((cat, catIndex) => {
      cat.color = PALETTE[catIndex % PALETTE.length];
      cat.nodes = [];

      cat.skills.forEach((skill, skillIndex) => {
        const level = skill.level || 0;
        const radius = RADIUS[level] ?? RADIUS[0];
        const node = {
          id: `g${catIndex}-${skillIndex}`,
          cat,
          skill,
          level,
          r: radius,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          fixed: false,
          ghost: false,
          lastDragEnd: 0,
        };

        const el = make("button", "graph-node");
        el.type = "button";
        el.dataset.level = String(level);
        el.style.setProperty("--cat", cat.color);
        el.style.width = `${radius * 2}px`;
        el.style.height = `${radius * 2}px`;
        el.setAttribute(
          "aria-label",
          `${skill.name}. ${cat.label}${level ? `. ${LEVEL_NAME[level]}` : ""}`
        );

        const tag = make("span", "graph-node-tag", skill.name);
        tag.setAttribute("aria-hidden", "true");
        el.append(tag);

        el.addEventListener("pointerenter", (event) => {
          if (event.pointerType === "touch" || state.drag) return;
          setHover(node);
        });

        el.addEventListener("pointerleave", () => {
          if (state.drag || document.activeElement === el) return;
          if (state.hovered === node) setHover(null);
        });

        el.addEventListener("focus", () => {
          state.roving = node;
          setHover(node);
          updateHighlight();
        });

        el.addEventListener("blur", () => {
          if (state.hovered === node) setHover(null);
        });

        el.addEventListener("pointerdown", (event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.stopPropagation();

          state.drag = {
            node,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          };
          state.roving = node;
          node.fixed = true;
          el.classList.add("is-dragging");
          state.els.canvas.classList.add("is-node-drag");
          hideTip();
          el.focus({ preventScroll: true });

          if (state.raf) {
            cancelAnimationFrame(state.raf);
            state.raf = 0;
          }

          try {
            el.setPointerCapture(event.pointerId);
          } catch {
            /* sin captura: el arrastre sigue funcionando dentro del lienzo */
          }
        });

        el.addEventListener("click", () => {
          if (performance.now() - node.lastDragEnd < 320) return;
          selectNode(node);
        });

        el.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectNode(node);
            return;
          }

          const directions = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          };
          const direction = directions[event.key];
          if (!direction) return;

          event.preventDefault();
          const next = nearestNode(node, direction[0], direction[1]);
          if (!next) return;

          state.roving = next;
          updateHighlight();
          next.el.focus({ preventScroll: true });
        });

        nodesLayer.append(el);
        node.el = el;
        cat.nodes.push(node);
        state.nodes.push(node);

        const key = skillKey(skill.name);
        if (key && !state.byKey.has(key)) state.byKey.set(key, node);
      });

      buildLegendItem(cat);
    });

    buildLinks();
    state.roving = state.nodes[0] ?? null;
  }

  function buildLegendItem(cat) {
    const item = make("li", "graph-legend-item");
    const dot = make("span", "graph-legend-dot");
    dot.style.setProperty("--cat", cat.color);

    item.append(
      dot,
      make("span", null, cat.label),
      make("span", "graph-legend-count", String(cat.skills.length))
    );

    state.els.legend.append(item);
    cat.legendEl = item;
  }

  function buildLinks() {
    const seen = new Set();

    const add = (a, b) => {
      if (!a || !b || a === b) return;

      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);

      const line = svg("line");
      line.setAttribute("class", "graph-link");
      line.style.setProperty("--cat", a.cat.color);
      state.els.linksLayer.append(line);

      state.links.push({
        a,
        b,
        el: line,
        ideal: a.cat === b.cat ? 74 : 104,
      });
    };

    LINK_RULES.forEach(([from, to]) => add(state.byKey.get(from), state.byKey.get(to)));

    // Ninguna habilidad queda aislada, aunque cambie el contenido.
    const degree = new Map();
    state.links.forEach((link) => {
      degree.set(link.a, (degree.get(link.a) ?? 0) + 1);
      degree.set(link.b, (degree.get(link.b) ?? 0) + 1);
    });

    state.categories.forEach((cat) => {
      cat.nodes.forEach((node, index) => {
        if ((degree.get(node) ?? 0) > 0) return;
        const other = cat.nodes[index - 1] ?? cat.nodes[index + 1];
        if (other) add(node, other);
      });
    });
  }

  /* ---------- Cámara y geometría ---------- */

  function applyCamera() {
    if (!state.els.world) return;
    state.els.world.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.k})`;
    if (state.hovered && !state.showTags) positionTip(state.hovered);
  }

  function zoomAt(px, py, factor) {
    const next = clamp(state.k * factor, 0.5, 2.6);
    const ratio = next / state.k;
    state.panX = px - (px - state.panX) * ratio;
    state.panY = py - (py - state.panY) * ratio;
    state.k = next;
    applyCamera();
  }

  function zoomCenter(factor) {
    const canvas = state.els.canvas;
    if (!canvas) return;
    hideTip();
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor);
    if (state.hovered && !state.showTags) showTip(state.hovered);
  }

  function fitToVisible() {
    const canvas = state.els.canvas;
    if (!canvas) return;

    const visible = state.nodes.filter((node) => !node.ghost);
    if (!visible.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    visible.forEach((node) => {
      minX = Math.min(minX, node.x - node.r);
      minY = Math.min(minY, node.y - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      maxY = Math.max(maxY, node.y + node.r);
    });

    const padX = Math.min(64, state.width * 0.12);
    const padY = Math.min(64, state.height * 0.12);
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = clamp(
      Math.min(
        (state.width - padX * 2) / contentW,
        (state.height - padY * 2) / contentH
      ),
      0.55,
      1.85
    );

    state.k = scale;
    state.panX = state.width / 2 - ((minX + maxX) / 2) * scale;
    state.panY = state.height / 2 - ((minY + maxY) / 2) * scale;
    applyCamera();
  }

  function measure() {
    const canvas = state.els.canvas;
    if (!canvas) return false;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 40 || height < 40) return false;

    const prevWidth = state.width;
    const prevHeight = state.height;
    state.width = width;
    state.height = height;

    if (state.seeded && prevWidth > 20 && prevHeight > 20) {
      const scaleX = width / prevWidth;
      const scaleY = height / prevHeight;
      if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
        state.nodes.forEach((node) => {
          node.x *= scaleX;
          node.y *= scaleY;
          node.vx = 0;
          node.vy = 0;
        });
      }
    }

    computeAnchors();
    return true;
  }

  function computeAnchors() {
    if (!state.categories.length) return;

    const count = state.categories.length;
    const cx = state.width / 2;
    const cy = state.height / 2;
    const rx = state.width * (state.width < 520 ? 0.3 : 0.33);
    const ry = state.height * 0.31;
    const offset = state.spin - Math.PI / 2;

    state.categories.forEach((cat, index) => {
      const angle = offset + (index / count) * Math.PI * 2;
      cat.anchor = {
        x: clamp(cx + Math.cos(angle) * rx, 50, state.width - 50),
        y: clamp(cy + Math.sin(angle) * ry, 44, state.height - 44),
      };
    });
  }

  function seedPositions() {
    computeAnchors();

    const random = mulberry32((state.seed * 2654435761) >>> 0);

    state.categories.forEach((cat, catIndex) => {
      cat.nodes.forEach((node, index) => {
        const angle = index * 2.399963 + catIndex * 0.83 + (random() - 0.5) * 0.5;
        const distance = 14 + Math.sqrt(index) * 34 + random() * 26;

        node.x = cat.anchor.x + Math.cos(angle) * distance;
        node.y = cat.anchor.y + Math.sin(angle) * distance;
        node.vx = 0;
        node.vy = 0;
        node.fixed = false;
      });
    });

    clampAll();
  }

  function clampAll() {
    state.nodes.forEach((node) => {
      const minX = node.r + 14;
      const minY = node.r + 14;
      node.x = clamp(node.x, minX, Math.max(minX, state.width - minX));
      node.y = clamp(node.y, minY, Math.max(minY, state.height - minY));
    });
  }

  /* ---------- Física ---------- */

  function simulate(step, alpha) {
    const nodes = state.nodes;
    const links = state.links;

    if (!nodes.length || alpha <= 0) return;

    // Cohesión suave alrededor del centro de cada categoría.
    nodes.forEach((node) => {
      if (node.fixed) return;
      node.vx += (node.cat.anchor.x - node.x) * 0.0016 * alpha * step;
      node.vy += (node.cat.anchor.y - node.y) * 0.0016 * alpha * step;
    });

    // Repulsión entre nodos.
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq < 0.01) {
          dx = (i + 1) * 0.5;
          dy = (j + 1) * 0.5;
          distanceSq = dx * dx + dy * dy;
        }

        const distance = Math.sqrt(distanceSq);
        if (distance > 240) continue;

        const force = (1500 / distanceSq) * alpha * step;
        const ux = dx / distance;
        const uy = dy / distance;

        if (!a.fixed) {
          a.vx -= ux * force;
          a.vy -= uy * force;
        }
        if (!b.fixed) {
          b.vx += ux * force;
          b.vy += uy * force;
        }
      }
    }

    // Resortes de las relaciones.
    links.forEach((link) => {
      const dx = link.b.x - link.a.x;
      const dy = link.b.y - link.a.y;
      const distance = Math.hypot(dx, dy) || 1;
      const force = (distance - link.ideal) * 0.006 * alpha * step;
      const ux = dx / distance;
      const uy = dy / distance;

      if (!link.a.fixed) {
        link.a.vx += ux * force;
        link.a.vy += uy * force;
      }
      if (!link.b.fixed) {
        link.b.vx -= ux * force;
        link.b.vy -= uy * force;
      }
    });

    // Integración con amortiguación.
    nodes.forEach((node) => {
      if (node.fixed) return;

      node.vx *= 0.84;
      node.vy *= 0.84;

      const speed = Math.hypot(node.vx, node.vy);
      if (speed > 9) {
        node.vx = (node.vx / speed) * 9;
        node.vy = (node.vy / speed) * 9;
      }

      node.x += node.vx * step;
      node.y += node.vy * step;
    });

    // Separación por colisión (varias pasadas para evitar solapes).
    for (let pass = 0; pass < 3; pass += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          const minDistance = a.r + b.r + 7;

          if (distance >= minDistance) continue;

          if (distance < 0.01) {
            dx = (i + 1) * 0.5;
            dy = (j + 1) * 0.5;
            distance = Math.hypot(dx, dy);
          }

          const push = (minDistance - distance) / 2;
          const ux = dx / distance;
          const uy = dy / distance;

          if (!a.fixed && !b.fixed) {
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          } else if (!a.fixed) {
            a.x -= ux * push * 2;
            a.y -= uy * push * 2;
          } else if (!b.fixed) {
            b.x += ux * push * 2;
            b.y += uy * push * 2;
          }
        }
      }
    }

    // Paredes del lienzo.
    nodes.forEach((node) => {
      const minX = node.r + 14;
      const minY = node.r + 14;
      const maxX = Math.max(minX, state.width - minX);
      const maxY = Math.max(minY, state.height - minY);

      if (node.x < minX) {
        node.x = minX;
        node.vx = 0;
      } else if (node.x > maxX) {
        node.x = maxX;
        node.vx = 0;
      }

      if (node.y < minY) {
        node.y = minY;
        node.vy = 0;
      } else if (node.y > maxY) {
        node.y = maxY;
        node.vy = 0;
      }
    });
  }

  function preSettle(iterations) {
    for (let i = 0; i < iterations; i += 1) simulate(1, 1);
    clampAll();
  }

  /* ---------- Animación ---------- */

  function render() {
    state.nodes.forEach((node) => {
      node.el.style.transform = `translate3d(${(node.x - node.r).toFixed(2)}px, ${(node.y - node.r).toFixed(2)}px, 0)`;
    });

    state.links.forEach((link) => {
      link.el.setAttribute("x1", link.a.x.toFixed(2));
      link.el.setAttribute("y1", link.a.y.toFixed(2));
      link.el.setAttribute("x2", link.b.x.toFixed(2));
      link.el.setAttribute("y2", link.b.y.toFixed(2));
    });

    applyCamera();
  }

  function tick(now) {
    state.raf = 0;
    if (!state.active) return;

    if (!state.lastTime) state.lastTime = now;
    const delta = clamp((now - state.lastTime) / 16.667, 0.4, 2);
    state.lastTime = now;

    simulate(delta, state.alpha);
    state.alpha *= Math.pow(0.975, delta);
    render();

    if (state.alpha < 0.02) {
      state.alpha = 0;
      return;
    }

    state.raf = requestAnimationFrame(tick);
  }

  function start(alpha) {
    if (state.reduceMotion) {
      state.alpha = 0;
      render();
      return;
    }

    state.alpha = Math.max(state.alpha, alpha);
    if (state.raf) return;

    state.lastTime = 0;
    state.raf = requestAnimationFrame(tick);
  }

  /* ---------- Filtros y estados ---------- */

  function applyFilter() {
    const query = normalize(state.query);
    const categoryFiltered = state.category !== "todo";
    state.showTags = Boolean(query) || categoryFiltered;

    state.categories.forEach((cat) => {
      cat.visibleCount = 0;

      (cat.nodes ?? []).forEach((node) => {
        const categoryOk = !categoryFiltered || cat.cat === state.category;
        const text = normalize(`${node.skill.name} ${node.skill.evidence ?? ""} ${cat.title}`);
        const match = categoryOk && (!query || text.includes(query));

        node.ghost = !match;
        if (match) cat.visibleCount += 1;
      });

      cat.legendEl?.classList.toggle("is-dim", categoryFiltered && cat.cat !== state.category);
    });

    if (state.selected?.ghost) clearSelection();
    if (state.hovered?.ghost) {
      state.hovered = null;
      hideTip();
    }

    const visible = state.nodes.filter((node) => !node.ghost);
    if (!visible.includes(state.roving)) state.roving = visible[0] ?? null;

    updateHighlight();
  }

  function updateHighlight() {
    const active = state.hovered || state.selected;
    const litNodes = new Set();
    const litLinks = new Set();

    if (active) {
      litNodes.add(active);
      state.links.forEach((link) => {
        if (link.a === active || link.b === active) {
          litNodes.add(link.a);
          litNodes.add(link.b);
          litLinks.add(link);
        }
      });
    }

    if (!state.roving || state.roving.ghost) {
      state.roving = state.nodes.find((node) => !node.ghost) ?? null;
    }

    state.nodes.forEach((node) => {
      const ghost = node.ghost;
      const el = node.el;

      el.classList.toggle("is-ghost", ghost);
      el.classList.toggle("is-active", Boolean(active) && active === node && !ghost);
      el.classList.toggle("is-neighbor", Boolean(active) && active !== node && litNodes.has(node) && !ghost);
      el.classList.toggle("is-muted", Boolean(active) && !litNodes.has(node) && !ghost);
      el.classList.toggle("is-selected", state.selected === node);
      el.classList.toggle("show-tag", state.showTags && !ghost);
      el.tabIndex = state.roving === node && !ghost ? 0 : -1;

      if (ghost) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
    });

    state.links.forEach((link) => {
      const ghost = link.a.ghost || link.b.ghost;
      link.el.classList.toggle("is-ghost", ghost);
      link.el.classList.toggle("is-lit", Boolean(active) && litLinks.has(link) && !ghost);
      link.el.classList.toggle("is-muted", Boolean(active) && !litLinks.has(link) && !ghost);
    });
  }

  function setState(next) {
    if (!state.initialized) return;

    state.category = next.category ?? "todo";
    state.query = next.query ?? "";
    applyFilter();

    if (state.active) {
      fitToVisible();
      render();
    }
  }

  /* ---------- Detalle, tooltip y selección ---------- */

  function showTip(node) {
    if (state.showTags) return;

    const tip = state.els.tip;
    if (!tip) return;

    tip.textContent = node.skill.label;
    tip.hidden = false;
    positionTip(node);
  }

  function hideTip() {
    const tip = state.els.tip;
    if (!tip) return;
    tip.hidden = true;
  }

  function positionTip(node) {
    const tip = state.els.tip;
    if (!tip) return;

    const screenX = state.panX + node.x * state.k;
    const screenY = state.panY + node.y * state.k;
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    const left = clamp(
      screenX - tipWidth / 2,
      6,
      Math.max(6, state.width - tipWidth - 6)
    );
    const above = screenY - node.r * state.k - 8 - tipHeight;
    const top = above >= 6 ? above : screenY + node.r * state.k + 8;

    tip.style.transform = `translate(${left}px, ${top}px)`;
  }

  function setHover(node) {
    if (state.hovered === node) return;

    state.hovered = node;
    if (node && !state.showTags) showTip(node);
    else hideTip();
    updateHighlight();
  }

  function showDetail(node) {
    const detail = state.els.detail;
    if (!detail) return;

    detail.replaceChildren();

    const head = make("div", "graph-detail-head");
    const category = make("span", "graph-cat-tag", node.cat.label);
    category.style.setProperty("--cat", node.cat.color);
    head.append(category);

    if (node.level) {
      head.append(make("span", `level level-${node.level}`, LEVEL_NAME[node.level]));
    }

    const close = make("button", "graph-detail-close");
    close.type = "button";
    close.setAttribute("aria-label", "Cerrar detalle");
    const cross = make("span", null, "×");
    cross.setAttribute("aria-hidden", "true");
    close.append(cross);
    close.addEventListener("click", () => clearSelection(true));
    head.append(close);

    const body = make("div", "graph-detail-body");
    body.append(make("h3", "graph-detail-title", node.skill.name));

    if (node.skill.evidence) {
      const text = make("p", "graph-detail-text", node.skill.evidence);
      text.title = node.skill.evidence;
      body.append(text);
    }

    detail.append(head, body);
    detail.hidden = false;
  }

  function hideDetail() {
    const detail = state.els.detail;
    if (!detail) return;
    detail.hidden = true;
    detail.replaceChildren();
  }

  function selectNode(node) {
    if (!node || node.ghost) return;

    if (state.selected === node) {
      clearSelection(true);
      return;
    }

    if (state.selected) state.selected.el.classList.remove("is-selected");

    state.selected = node;
    state.roving = node;
    node.el.classList.add("is-selected");
    showDetail(node);
    updateHighlight();
  }

  function clearSelection(focusNode = false) {
    const previous = state.selected;
    state.selected = null;
    hideDetail();

    if (previous) previous.el.classList.remove("is-selected");
    updateHighlight();

    if (focusNode && previous && !previous.ghost) {
      state.roving = previous;
      previous.el.focus({ preventScroll: true });
    }
  }

  /* ---------- Navegación con teclado ---------- */

  function nearestNode(from, dx, dy) {
    let best = null;
    let bestScore = Infinity;

    state.nodes.forEach((node) => {
      if (node === from || node.ghost) return;

      const vx = node.x - from.x;
      const vy = node.y - from.y;
      const forward = vx * dx + vy * dy;
      if (forward <= 4) return;

      const distance = Math.hypot(vx, vy);
      const perpendicular = Math.abs(vx * dy - vy * dx);
      const score = distance + perpendicular * 2.2;

      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    });

    return best;
  }

  /* ---------- Eventos ---------- */

  function onPointerMove(event) {
    if (state.drag) {
      const drag = state.drag;
      if (event.pointerId !== drag.pointerId) return;

      const rect = state.els.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - state.panX) / state.k;
      const y = (event.clientY - rect.top - state.panY) / state.k;

      if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3) {
        drag.moved = true;
      }

      const node = drag.node;
      const minX = node.r + 12;
      const minY = node.r + 12;
      node.x = clamp(x, minX, Math.max(minX, state.width - minX));
      node.y = clamp(y, minY, Math.max(minY, state.height - minY));
      render();
      return;
    }

    if (!state.pan) return;

    const pan = state.pan;
    if (event.pointerId !== pan.pointerId) return;

    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;

    if (Math.abs(dx) + Math.abs(dy) > 4) pan.moved = true;

    state.panX = pan.panX + dx;
    state.panY = pan.panY + dy;
    applyCamera();
  }

  function onPointerUp(event) {
    if (state.drag) {
      const drag = state.drag;
      if (event.pointerId !== drag.pointerId) return;

      drag.node.el.classList.remove("is-dragging");
      state.els.canvas.classList.remove("is-node-drag");

      if (drag.moved) {
        drag.node.lastDragEnd = performance.now();
      } else {
        drag.node.fixed = false;
      }

      state.drag = null;

      try {
        drag.node.el.releasePointerCapture(drag.pointerId);
      } catch {
        /* ya liberado */
      }

      if (drag.moved) start(0.45);
      return;
    }

    if (!state.pan) return;

    const pan = state.pan;
    if (event.pointerId !== pan.pointerId) return;

    state.pan = null;
    state.els.canvas.classList.remove("is-panning");

    try {
      state.els.canvas.releasePointerCapture(pan.pointerId);
    } catch {
      /* ya liberado */
    }

    if (!pan.moved) clearSelection();
  }

  function bind() {
    const canvas = state.els.canvas;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest(".graph-node, .graph-controls, .graph-detail")) return;

      state.pan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: state.panX,
        panY: state.panY,
        moved: false,
      };

      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-panning");
      hideTip();
    });

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    canvas.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        hideTip();
        zoomAt(
          event.clientX - rect.left,
          event.clientY - rect.top,
          event.deltaY < 0 ? 1.12 : 0.9
        );

        if (state.hovered && !state.showTags) showTip(state.hovered);
      },
      { passive: false }
    );

    canvas.addEventListener("dblclick", (event) => {
      if (event.target.closest(".graph-node, .graph-controls, .graph-detail")) return;
      fitToVisible();
    });

    document.getElementById("graph-zoom-in")?.addEventListener("click", () => zoomCenter(1.2));
    document.getElementById("graph-zoom-out")?.addEventListener("click", () => zoomCenter(0.84));
    document.getElementById("graph-fit")?.addEventListener("click", () => fitToVisible());
    document.getElementById("graph-shuffle")?.addEventListener("click", () => {
      state.spin += 0.9;
      state.seed += 1;
      state.selected = null;
      hideDetail();
      seedPositions();
      state.alpha = 1;
      preSettle(200);
      fitToVisible();
      render();
      start(0.7);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!state.selected && !state.hovered) return;

      clearSelection();
      setHover(null);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = 0;
        return;
      }

      if (state.active && state.alpha > 0.02) {
        state.lastTime = 0;
        state.raf = requestAnimationFrame(tick);
      }
    });
  }

  function observeResize() {
    let timer = 0;

    const handle = () => {
      if (!state.active) return;

      const canvas = state.els.canvas;
      if (Math.abs(canvas.clientWidth - state.width) < 2 && Math.abs(canvas.clientHeight - state.height) < 2) {
        return;
      }

      if (!measure()) return;
      clampAll();
      preSettle(90);
      fitToVisible();
      render();
      start(0.4);
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(handle, 120);
    };

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(state.els.canvas);
    } else {
      window.addEventListener("resize", schedule);
    }
  }

  /* ---------- API ---------- */

  function activate() {
    if (!state.initialized || !state.els.canvas) return;
    if (state.active) {
      render();
      return;
    }

    state.active = true;

    if (!measure()) {
      state.active = false;
      return;
    }

    if (!state.seeded) {
      seedPositions();
      state.seeded = true;
      preSettle(220);
      fitToVisible();
      render();
      start(0.55);
      return;
    }

    clampAll();
    fitToVisible();
    render();
    start(0.35);
  }

  function deactivate() {
    state.active = false;

    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    hideTip();
  }

  function init(options) {
    if (state.initialized) return;

    const { canvas, categories } = options;
    if (!canvas) return;

    state.els = {
      canvas,
      world: document.getElementById("graph-world"),
      nodesLayer: document.getElementById("graph-nodes"),
      linksLayer: document.getElementById("graph-links"),
      tip: document.getElementById("graph-tip"),
      legend: document.getElementById("graph-legend"),
      detail: document.getElementById("graph-detail"),
    };
    state.categories = categories ?? [];
    state.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    state.initialized = true;

    build();
    bind();
    updateHighlight();

    if (canvas.clientWidth > 40) activate();
    observeResize();
  }

  window.SkillsGraph = {
    init,
    activate,
    deactivate,
    setState,
    fit: fitToVisible,
  };
})();
