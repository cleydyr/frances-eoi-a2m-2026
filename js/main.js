const NAV_ITEMS = [
  { key: "inicio", href: "/", label: "Inicio" },
  { key: "calendario", href: "/calendario/", label: "Calendario" },
  { key: "clases", href: "/clases/", label: "Clases" },
  { key: "archivos", href: "/archivos/", label: "Archivos" },
  { key: "avisos", href: "/avisos/", label: "Avisos" },
];

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" });
const CURSO_URL = "/data/curso.json";

let cursoData = null;

function logoText() {
  return cursoData ? `Francés EOI ${cursoData.year}` : "Francés EOI 2026";
}

function footerText() {
  if (!cursoData) {
    return "Sitio de la clase de francés A2M, EOI Valladolid, 2026. No es la web oficial de la EOI. Lo mantiene Cleydyr. Para una corrección, escribe por el grupo de WhatsApp.";
  }

  return `Sitio de la clase de francés ${cursoData.level}, ${cursoData.school}, ${cursoData.year}. No es la web oficial de la EOI. Lo mantiene Cleydyr. Para una corrección, escribe por el grupo de WhatsApp.`;
}

function introText() {
  if (!cursoData) {
    return "Este es el sitio de compañeros de Francés A2M en EOI Valladolid, 2026, para avisos, notas de clase, archivos y el calendario.";
  }

  return `Este es el sitio de compañeros de Francés ${cursoData.level} en ${cursoData.school}, ${cursoData.year}, para avisos, notas de clase, archivos y el calendario.`;
}

class AppHeader extends HTMLElement {
  static get observedAttributes() {
    return ["active"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.render();
    }
  }

  render() {
    const active = this.getAttribute("active") || "inicio";
    const navLinks = NAV_ITEMS.map((item) => {
      const aria = item.key === active ? ' aria-current="page"' : "";
      return `<li><a href="${item.href}"${aria}>${item.label}</a></li>`;
    }).join("\n");

    this.innerHTML = `
      <header class="site-header">
        <div class="logo-area">
          <span class="logo">${logoText()}</span>
          <button class="menu-toggle" aria-expanded="false" aria-controls="main-nav">
            <span class="sr-only">Abrir menú</span>
            ☰
          </button>
        </div>
        <nav id="main-nav" class="site-nav">
          <ul>
            ${navLinks}
          </ul>
        </nav>
      </header>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const menuToggle = this.querySelector(".menu-toggle");
    const nav = this.querySelector(".site-nav");

    if (!menuToggle || !nav) {
      return;
    }

    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
}

customElements.define("app-header", AppHeader);

class AppFooter extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <footer class="site-footer">
        <p>${footerText()}</p>
      </footer>
    `;
  }
}

customElements.define("app-footer", AppFooter);

document.addEventListener("DOMContentLoaded", () => {
  loadNoticesFromJSON();
  loadClassesFromJSON();
  loadCurso();
});

async function loadCurso() {
  try {
    const response = await fetch(CURSO_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Estado HTTP ${response.status}`);
    }

    const payload = await response.json();
    const curso = normalizeCurso(payload);
    if (!curso) {
      throw new Error("data/curso.json no tiene año, nivel y escuela");
    }

    cursoData = curso;

    if (curso.language) {
      document.documentElement.lang = curso.language;
    }

    document.title = document.title.replace(/\b20\d{2}\b/, String(curso.year));
    document.querySelectorAll("app-header").forEach((header) => header.render());
    document.querySelectorAll("app-footer").forEach((footer) => footer.render());

    const intro = document.querySelector("[data-curso-intro]");
    if (intro) {
      intro.textContent = introText();
    }

    renderCalendar(curso);
    renderFilesFolder(curso);
  } catch (error) {
    console.error("[Curso] No se pudo cargar el curso", error);
  }
}

function normalizeCurso(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const year = Number(input.year);
  const level = typeof input.level === "string" ? input.level.trim() : "";
  const school = typeof input.school === "string" ? input.school.trim() : "";

  if (!Number.isInteger(year) || !level || !school) {
    return null;
  }

  const text = (value) => (typeof value === "string" ? value.trim() : "");

  return {
    year,
    level,
    school,
    language: text(input.language) || "es",
    calendarEmbed: text(input.calendarEmbed),
    calendarWeek: text(input.calendarWeek),
    calendarMonth: text(input.calendarMonth),
    calendarAdd: text(input.calendarAdd),
    filesFolder: text(input.filesFolder),
    filesNote: text(input.filesNote),
  };
}

function renderCalendar(curso) {
  const mount = document.getElementById("calendario");
  if (!mount || !curso.calendarEmbed || mount.querySelector("iframe")) {
    return;
  }

  const section = document.createElement("section");
  section.className = "calendar-frame";
  const iframe = document.createElement("iframe");
  iframe.title = "Calendario de la clase";
  iframe.src = curso.calendarEmbed;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "no-referrer";
  section.append(iframe);
  mount.append(section);
}

function renderFilesFolder(curso) {
  const mount = document.getElementById("archivos");
  if (!mount || !curso.filesFolder || mount.querySelector(".file-link")) {
    return;
  }

  const section = document.createElement("section");
  section.className = "file-link";
  const link = document.createElement("a");
  link.className = "btn";
  link.href = curso.filesFolder;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir carpeta compartida";
  section.append(link);

  if (curso.filesNote) {
    const note = document.createElement("p");
    note.className = "helper-text";
    note.textContent = curso.filesNote;
    section.append(note);
  }

  mount.append(section);
}

async function loadClassesFromJSON() {
  const mount = document.getElementById("clases");
  if (!mount) {
    return;
  }

  try {
    const response = await fetch("/data/clases.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Estado HTTP ${response.status}`);
    }

    const payload = await response.json();
    const notes = normalizeClasses(payload);
    const files = await loadClassFiles(notes);
    renderClasses(mount, notes, files);
  } catch (error) {
    console.error("[Clases] No se pudieron cargar las clases", error);
    mount.replaceChildren(createEmptyState("No se pudieron cargar las clases."));
  }
}

function normalizeClasses(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const byDate = new Map();

  items.forEach((item) => {
    const note = normalizeClass(item);
    if (note) {
      byDate.set(note.isoDate, note);
    }
  });

  return [...byDate.values()].sort((a, b) => b.date - a.date);
}

function normalizeClass(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const parsedDate = parseIsoDate(input.date);
  const did = stringList(input.did);

  if (!parsedDate || !did.length) {
    return null;
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";

  return {
    isoDate: parsedDate.iso,
    date: parsedDate.date,
    number: positiveInteger(input.number),
    title,
    did,
    homework: stringList(input.homework),
    vocab: stringList(input.vocab),
    files: uniqueStrings(stringList(input.files)),
  };
}

function parseIsoDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return { iso: match[0], date };
}

function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
}

function positiveInteger(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }

  return value;
}

function classHeading(note) {
  const parts = [];

  if (note.number) {
    parts.push(`Clase ${note.number}`);
  }

  parts.push(formatNoticeDate(note.date));

  if (note.title) {
    parts.push(note.title);
  }

  return parts.join(" · ");
}

async function loadClassFiles(notes) {
  if (!notes.some((note) => note.files.length)) {
    return new Map();
  }

  try {
    const response = await fetch("/data/archivos.json", { cache: "no-store" });
    if (!response.ok) {
      return new Map();
    }

    const payload = await response.json();
    return indexFiles(payload);
  } catch (error) {
    console.error("[Clases] No se pudieron cargar los archivos", error);
    return new Map();
  }
}

function indexFiles(items) {
  const files = new Map();

  if (!Array.isArray(items)) {
    return files;
  }

  items.forEach((item) => {
    const file = normalizeLinkedFile(item);
    if (file) {
      files.set(file.id, file);
    }
  });

  return files;
}

function normalizeLinkedFile(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const href = typeof input.href === "string" ? input.href.trim() : "";

  if (!id || !title || !href || !parseIsoDate(input.date)) {
    return null;
  }

  return { id, title, href };
}

function renderClasses(mount, notes, files) {
  mount.replaceChildren();

  if (!notes.length) {
    mount.append(createEmptyState("Todavía no hay notas de clase."));
    return;
  }

  const search = document.createElement("form");
  search.className = "class-search";
  search.setAttribute("role", "search");
  search.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  const label = document.createElement("label");
  label.htmlFor = "class-search";
  label.textContent = "Buscar en las clases";

  const input = document.createElement("input");
  input.id = "class-search";
  input.type = "search";
  input.setAttribute("aria-controls", "class-list");

  const list = document.createElement("div");
  list.id = "class-list";
  list.className = "summaries";

  const cards = notes.map((note) => createClassCard(note, files));
  cards.forEach((card) => list.append(card));

  const noMatch = createEmptyState("Ninguna clase coincide con la búsqueda.");
  noMatch.hidden = true;

  search.append(label, input);
  mount.append(search, list, noMatch);

  input.addEventListener("input", () => {
    const query = foldSearch(input.value.trim());
    let visible = 0;

    cards.forEach((card) => {
      const match = !query || card.dataset.search.includes(query);
      card.hidden = !match;
      if (match) {
        visible += 1;
      }
    });

    noMatch.hidden = visible !== 0;
  });

  openHashedClass();
}

function createClassCard(note, files) {
  const article = document.createElement("article");
  article.className = "summary-card";
  article.id = note.isoDate;
  article.dataset.search = foldSearch(
    [note.title, ...note.did, ...note.homework, ...note.vocab].join("\n")
  );

  const heading = document.createElement("h2");
  heading.className = "class-heading";

  const link = document.createElement("a");
  link.href = `#${note.isoDate}`;
  link.textContent = classHeading(note);
  heading.append(link);

  article.append(heading, createItemList(note.did));

  if (note.homework.length) {
    article.append(createLabeledList("Deberes", note.homework));
  }

  if (note.vocab.length) {
    article.append(createLabeledList("Vocabulario", note.vocab));
  }

  const linked = note.files.map((id) => files.get(id)).filter(Boolean);
  if (linked.length) {
    article.append(createFileList(linked));
  }

  return article;
}

function createLabeledList(label, items) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = label;
  section.append(heading, createItemList(items));
  return section;
}

function createItemList(items) {
  const list = document.createElement("ul");

  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.append(item);
  });

  return list;
}

function createFileList(files) {
  const list = document.createElement("ul");
  list.className = "class-files";

  files.forEach((file) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = file.href;
    link.textContent = file.title;

    if (/^https?:\/\//i.test(file.href)) {
      link.target = "_blank";
      link.rel = "noopener";
    }

    item.append(link);
    list.append(item);
  });

  return list;
}

function foldSearch(value) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");
}

function openHashedClass() {
  const hash = window.location.hash;
  if (hash.length < 2) {
    return;
  }

  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch (_error) {
    return;
  }

  document.getElementById(id)?.scrollIntoView();
}

async function loadNoticesFromJSON() {
  const main = document.querySelector("main[data-notice-source]");
  const currentContainer = document.getElementById("notice-current");
  const expiredContainer = document.getElementById("notice-expired");
  const template = document.getElementById("notice-template");

  if (!main || !currentContainer || !expiredContainer || !template) {
    return;
  }

  const sourceUrl = main.dataset.noticeSource || "/data/avisos.json";

  try {
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Estado HTTP ${response.status}`);
    }

    const payload = await response.json();
    const { current, expired } = splitNotices(payload);

    renderNoticeList(
      currentContainer,
      current,
      template,
      currentContainer.dataset.empty || "No hay avisos activos por ahora."
    );

    renderNoticeList(
      expiredContainer,
      expired,
      template,
      expiredContainer.dataset.empty || "Todavía no hay avisos caducados."
    );
  } catch (error) {
    console.error("[Avisos] No se pudieron cargar los avisos", error);
    renderNoticeError(currentContainer, "No se pudieron cargar los avisos.");
    renderNoticeError(expiredContainer, "No se pudieron cargar los avisos.");
  }
}

function splitNotices(items) {
  if (!Array.isArray(items)) {
    return { current: [], expired: [] };
  }

  const now = new Date();
  const normalized = items
    .map(normalizeNotice)
    .filter(Boolean)
    .map((notice) => ({ ...notice, expired: notice.expiresAt < now }))
    .sort((a, b) => a.expiresAt - b.expiresAt);

  return {
    current: normalized.filter((notice) => !notice.expired),
    expired: normalized.filter((notice) => notice.expired),
  };
}

function normalizeNotice(input) {
  if (!input) {
    return null;
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const rawDate =
    input.expiresAt || input.expirationDate || input.expiration_date || input.expira;

  if (!title || !body || !rawDate) {
    return null;
  }

  let normalizedDate = rawDate;

  if (typeof normalizedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    normalizedDate = `${normalizedDate}T23:59:59`;
  }

  const expiresAt = new Date(normalizedDate);

  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  return { title, body, expiresAt };
}

function renderNoticeList(container, items, template, emptyMessage) {
  container.innerHTML = "";

  if (!items.length) {
    container.appendChild(createEmptyState(emptyMessage));
    return;
  }

  items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".notice-card");
    const titleEl = fragment.querySelector(".notice-title");
    const bodyEl = fragment.querySelector(".notice-body");
    const timeEl = fragment.querySelector(".notice-expiration time");

    if (!card || !titleEl || !bodyEl || !timeEl) {
      return;
    }

    titleEl.textContent = item.title;
    bodyEl.textContent = item.body;
    timeEl.dateTime = item.expiresAt.toISOString();
    timeEl.textContent = formatNoticeDate(item.expiresAt);
    card.classList.toggle("expired", item.expired);

    container.appendChild(fragment);
  });
}

function renderNoticeError(container, message) {
  container.innerHTML = "";
  container.appendChild(createEmptyState(message));
}

function createEmptyState(message) {
  const paragraph = document.createElement("p");
  paragraph.className = "empty-state";
  paragraph.textContent = message;
  return paragraph;
}

function formatNoticeDate(date) {
  try {
    return DATE_FORMATTER.format(date);
  } catch (_error) {
    return date.toLocaleDateString();
  }
}

