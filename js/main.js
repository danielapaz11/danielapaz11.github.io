/* ==========================================================================
   Portafolio · Daniela Paz
   1. Render de skills.md (Markdown mínimo)
   2. Buscador y filtros de habilidades
   3. Tema, scroll, animaciones y microinteracciones
   Sin dependencias.
   ========================================================================== */

const SKILLS_URL = "skills.md";
const THEME_KEY = "daniela-tema";

/* ==========================================================================
   1. Markdown
   ========================================================================== */

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(text) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(text) {
  const codes = [];

  let out = escapeHtml(text);

  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, href) => `<a href="${href.replace(/"/g, "%22")}">${label}</a>`
  );

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

  return out.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[Number(index)]}</code>`);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function buildTable(header, rows) {
  const head = header.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Convierte Markdown a HTML.
 * @param {string} markdown
 * @param {{ demote?: number }} [options]
 * @returns {string}
 */
function markdownToHtml(markdown, options = {}) {
  const demote = options.demote ?? 0;
  let lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end !== -1) lines = lines.slice(end + 1);
  }

  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length + demote);
      const text = heading[2].trim();
      blocks.push(`<h${level} id="${slugify(text)}">${renderInline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push(buildTable(header, rows));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(`<blockquote><p>${renderInline(quoted.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      let isTaskList = false;

      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const content = lines[i].match(/^\s*[-*]\s+(.*)$/)[1];
        const task = content.match(/^\[( |x|X)\]\s+(.*)$/);

        if (task) {
          isTaskList = true;
          items.push({ html: renderInline(task[2]), done: task[1].toLowerCase() === "x" });
        } else {
          items.push({ html: renderInline(content), done: null });
        }
        i += 1;
      }

      if (isTaskList) {
        const listItems = items
          .map((item) => `<li class="${item.done ? "done" : ""}">${item.html}</li>`)
          .join("");
        blocks.push(`<ul class="task-list">${listItems}</ul>`);
      } else {
        blocks.push(`<ul>${items.map((item) => `<li>${item.html}</li>`).join("")}</ul>`);
      }
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\|/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return blocks.join("\n");
}

/* ==========================================================================
   2. Habilidades: grupos, niveles y filtros
   ========================================================================== */

const CATEGORY_RULES = [
  [/como leer/, "siempre"],
  [/frontend/, "frontend"],
  [/fundamentos/, "fundamentos"],
  [/bases de datos/, "datos"],
  [/redes/, "redes"],
  [/herramientas/, "herramientas"],
];

const LEVELS = { "🟢": 3, "🟡": 2, "🔵": 1 };

const filters = {
  query: "",
  category: "todo",
  groups: [],
  search: null,
  noResults: null,
  clear: null,
};

function categoryFor(heading) {
  const text = normalize(heading);
  const rule = CATEGORY_RULES.find(([pattern]) => pattern.test(text));
  return rule ? rule[1] : "otros";
}

function buildGroups(container) {
  const nodes = [...container.children];
  const firstHeading = nodes.findIndex((node) => node.tagName === "H3");
  if (firstHeading === -1) return [];

  const groups = [];
  let current = null;

  nodes.slice(firstHeading).forEach((node) => {
    if (node.tagName === "H3") {
      current = document.createElement("div");
      current.className = "skill-group";
      current.dataset.cat = categoryFor(node.textContent);
      container.append(current);
      groups.push(current);
    }
    if (current) current.append(node);
  });

  return groups;
}

function decorateLevels(container) {
  container.querySelectorAll("tbody tr td").forEach((cell) => {
    const match = cell.innerHTML.match(/^\s*(🟢|🟡|🔵)\s*([\s\S]*)$/);
    if (!match) return;
    const value = LEVELS[match[1]];
    if (!value) return;
    cell.innerHTML = `<span class="level level-${value}">${match[2]}</span>`;
  });
}

function setCategory(category) {
  filters.category = category;

  document.querySelectorAll(".chip[data-filter]").forEach((chip) => {
    const active = chip.dataset.filter === category;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  });

  if (category !== "todo" && filters.search?.value) {
    filters.search.value = "";
    filters.query = "";
  }

  applyFilters();
}

function applyFilters() {
  const { query, category, groups, noResults, clear } = filters;
  let anyVisible = false;

  groups.forEach((group) => {
    const sameCategory = category === "todo" || group.dataset.cat === "siempre" || group.dataset.cat === category;
    const heading = normalize(group.querySelector("h3")?.textContent ?? "");
    const table = group.querySelector("table");
    let matchesQuery = true;

    if (query) {
      if (heading.includes(query)) {
        matchesQuery = true;
        table?.querySelectorAll("tbody tr").forEach((row) => {
          row.hidden = false;
        });
      } else if (table) {
        let visibleRows = 0;
        table.querySelectorAll("tbody tr").forEach((row) => {
          const match = normalize(row.textContent).includes(query);
          row.hidden = !match;
          if (match) visibleRows += 1;
        });
        matchesQuery = visibleRows > 0;
      } else {
        matchesQuery = normalize(group.textContent).includes(query);
      }
    } else if (table) {
      table.querySelectorAll("tbody tr").forEach((row) => {
        row.hidden = false;
      });
    }

    const visible = sameCategory && matchesQuery;
    group.hidden = !visible;
    if (visible) anyVisible = true;
  });

  if (noResults) noResults.hidden = anyVisible;
  if (clear) clear.hidden = category === "todo" && query === "";

  window.SkillsGraph?.setState({ category, query });
}

function setupSkillFilters(container) {
  filters.groups = buildGroups(container);
  filters.search = document.getElementById("skill-search");
  filters.noResults = document.getElementById("no-results");
  filters.clear = document.getElementById("clear-filters");

  if (!filters.groups.length) return;

  decorateLevels(container);

  document.querySelectorAll(".chip[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => setCategory(chip.dataset.filter));
  });

  filters.search?.addEventListener("input", () => {
    filters.query = normalize(filters.search.value.trim());

    if (filters.query && filters.category !== "todo") {
      setCategory("todo");
    } else {
      applyFilters();
    }
  });

  filters.clear?.addEventListener("click", () => {
    if (filters.search) filters.search.value = "";
    filters.query = "";
    setCategory("todo");
    filters.search?.focus();
  });

  applyFilters();
}

async function loadSkills() {
  const target = document.getElementById("skills-content");
  if (!target) return;

  try {
    const response = await fetch(SKILLS_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const markdown = await response.text();
    target.innerHTML = markdownToHtml(markdown, { demote: 1 });
    setupSkillFilters(target);
    initSkillsGraph();
    setupActiveNav();
  } catch (error) {
    const localHint =
      location.protocol === "file:"
        ? " Estás abriendo el archivo con doble clic: usa un servidor local (por ejemplo la extensión Live Server de VS Code) y entra por <code>http://localhost</code>."
        : "";

    target.innerHTML =
      `<p class="status error">No se pudo cargar <code>${SKILLS_URL}</code> ` +
      `(${escapeHtml(String(error.message))}).${localHint}</p>`;
  } finally {
    target.setAttribute("aria-busy", "false");
  }
}

/* ==========================================================================
   3. Interfaz
   ========================================================================== */

/* ---------- Datos para el grafo ---------- */

function shortCategoryLabel(title) {
  if (/blandas/i.test(title)) return "Blandas";
  if (/aprendiendo/i.test(title)) return "En curso";
  if (/redes/i.test(title)) return "Redes";
  if (/fundamentos/i.test(title)) return "Fundamentos";
  if (/bases de datos/i.test(title)) return "Datos";
  return title.replace(/\s*\(.*\)\s*$/, "");
}

function collectSkillData(groups) {
  const categories = [];

  groups.forEach((group) => {
    const heading = group.querySelector("h3");
    const title = heading?.textContent.trim() ?? "";

    // La leyenda y los datos de contacto no son habilidades.
    if (!title || /c[oó]mo leer|contacto|formaci[oó]n/i.test(title)) return;

    const category = {
      label: shortCategoryLabel(title),
      title,
      cat: group.dataset.cat,
      skills: [],
    };

    // La sección «Actualmente aprendiendo» equivale al nivel Aprendiendo.
    const learning = /aprendiendo/i.test(title);

    group.querySelectorAll("table tbody tr").forEach((row) => {
      const cells = [...row.querySelectorAll("td")];
      if (!cells.length) return;

      const levelEl = cells[1]?.querySelector(".level");
      const levelMatch = levelEl?.className.match(/level-(\d)/);
      const name = cells[0].textContent.trim();

      category.skills.push({
        name,
        level: levelMatch ? Number(levelMatch[1]) : 0,
        evidence: cells[2]?.textContent.trim() ?? "",
      });
    });

    group.querySelectorAll(":scope > ul > li").forEach((item) => {
      const raw = item.textContent.trim();

      // Los huecos de contenido no se dibujan como nodos.
      if (/^⟨.*⟩$/.test(raw)) return;

      const colon = raw.indexOf(":");
      const name = colon > 0 ? raw.slice(0, colon).trim() : raw;
      const evidence = colon > 0 ? raw.slice(colon + 1).trim() : "";

      category.skills.push({ name, level: learning ? 1 : 0, evidence });
    });

    if (category.skills.length) categories.push(category);
  });

  return categories;
}

function initSkillsGraph() {
  const canvas = document.getElementById("graph-canvas");
  if (!canvas || !window.SkillsGraph) return;

  window.SkillsGraph.init({
    canvas,
    categories: collectSkillData(filters.groups),
  });

  window.SkillsGraph.setState({ category: filters.category, query: filters.query });
}

/* ---------- Vista: grafo o lista ---------- */

const VIEW_KEY = "daniela-vista";

function setView(view, options = {}) {
  const graph = document.getElementById("skills-graph");
  const list = document.getElementById("skills-content");
  if (!graph || !list) return;

  const isGraph = view === "graph";
  graph.hidden = !isGraph;
  list.hidden = isGraph;

  document.querySelectorAll(".view-btn").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (options.persist !== false) {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* sin almacenamiento: la preferencia dura la sesión */
    }
  }

  if (isGraph) {
    window.SkillsGraph?.activate();
  } else {
    window.SkillsGraph?.deactivate();
  }
}

function initialView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "map") {
      localStorage.setItem(VIEW_KEY, "graph");
      return "graph";
    }
    if (saved === "graph" || saved === "list") return saved;
  } catch {
    /* ignora */
  }
  return "graph";
}

function setupView() {
  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  setView(initialView(), { persist: false });
}

function setupFormacionLink() {
  const link = document.querySelector('.nav-list a[href="#formacion"]');
  if (!link) return;

  link.addEventListener("click", (event) => {
    const heading = document.getElementById("formacion");
    if (!heading) return;

    event.preventDefault();
    setView("list", { persist: false });
    heading.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });
}

/* ---------- Tema claro / oscuro / automático ---------- */

const THEME_ORDER = ["auto", "light", "dark"];
const THEME_LABEL = {
  auto: { icon: "◐", label: "automático", next: "claro" },
  light: { icon: "☀", label: "claro", next: "oscuro" },
  dark: { icon: "☾", label: "oscuro", next: "automático" },
};

function currentTheme() {
  const stored = document.documentElement.dataset.theme;
  return stored === "light" || stored === "dark" ? stored : "auto";
}

function applyTheme(theme) {
  if (theme === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* almacenamiento bloqueado: el tema sigue funcionando en esta sesión */
  }

  const button = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-icon");
  if (!button || !icon) return;

  const info = THEME_LABEL[theme];
  icon.textContent = info.icon;
  button.setAttribute("aria-label", `Tema ${info.label}. Cambiar a tema ${info.next}`);
  button.title = `Tema ${info.label}`;
}

function setupTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;

  applyTheme(currentTheme());

  button.addEventListener("click", () => {
    const index = THEME_ORDER.indexOf(currentTheme());
    applyTheme(THEME_ORDER[(index + 1) % THEME_ORDER.length]);
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentTheme() === "auto") applyTheme("auto");
  });
}

/* ---------- Progreso de lectura y volver arriba ---------- */

function setupScrollUi() {
  const bar = document.getElementById("progress-bar");
  const toTop = document.getElementById("to-top");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let scheduled = false;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
    toTop?.classList.toggle("is-visible", window.scrollY > 480);
    scheduled = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );

  toTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
  });

  update();
}

/* ---------- Navegación activa ---------- */

let navObserver = null;

function setupActiveNav() {
  const links = [...document.querySelectorAll(".nav-list a")];
  if (!links.length || !("IntersectionObserver" in window)) return;

  navObserver?.disconnect();

  const targets = links
    .map((link) => ({ link, target: document.getElementById(link.getAttribute("href").slice(1)) }))
    .filter((entry) => entry.target);

  const visible = new Set();

  navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });

      links.forEach((link) => {
        const target = targets.find((entry) => entry.link === link)?.target;
        link.classList.toggle("is-active", Boolean(target && visible.has(target)));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );

  targets.forEach(({ target }) => navObserver.observe(target));
}

/* ---------- Aparición al hacer scroll ---------- */

function setupReveal() {
  const items = document.querySelectorAll(".section, .cards .card");
  if (!items.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px" }
  );

  items.forEach((item) => {
    item.classList.add("reveal");
    observer.observe(item);
  });
}

/* ---------- Luz que sigue al cursor en las tarjetas ---------- */

function setupSpotlight() {
  if (!matchMedia("(hover: hover)").matches) return;

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });
}

/* ---------- Texto que se escribe solo ---------- */

function setupTypewriter() {
  const typed = document.getElementById("typed");
  if (!typed) return;

  const phrases = [
    "desarrollo web frontend",
    "interfaces accesibles",
    "HTML · CSS · JavaScript",
    "aprendiendo cada día",
  ];

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    typed.textContent = phrases[0];
    return;
  }

  let phrase = 0;
  let chars = 0;
  let deleting = false;

  const tick = () => {
    const text = phrases[phrase];
    chars += deleting ? -1 : 1;
    typed.textContent = text.slice(0, chars);

    let delay = deleting ? 40 : 80;

    if (!deleting && chars === text.length) {
      deleting = true;
      delay = 1700;
    } else if (deleting && chars === 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      delay = 320;
    }

    setTimeout(tick, delay);
  };

  tick();
}

/* ---------- Arranque ---------- */

function init() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  setupTheme();
  setupView();
  setupFormacionLink();
  setupScrollUi();
  setupReveal();
  setupSpotlight();
  setupTypewriter();
  setupActiveNav();
  loadSkills();
}

init();
