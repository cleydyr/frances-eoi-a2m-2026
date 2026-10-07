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
  setupSummaryInteractions();
  loadNoticesFromJSON();
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

function setupSummaryInteractions() {
  const summaryButton = document.querySelector('[data-action="add-summary"]');
  const summaryList = document.getElementById("summary-list");
  const summaryTemplate = document.getElementById("summary-template");

  if (!summaryButton || !summaryList || !summaryTemplate) {
    return;
  }

  summaryButton.addEventListener("click", () => {
    const title = prompt("Título del resumen (ej. Clase 3 · 29 enero):");
    if (!title) {
      return;
    }

    const pointsInput = prompt(
      "Escribe los puntos clave separados por comas (ej. Saludos, Números, Tarea)."
    );

    const clone = summaryTemplate.content.cloneNode(true);
    const card = clone.querySelector(".summary-card");
    const heading = card.querySelector("h2");
    const list = card.querySelector("ul");

    heading.textContent = title.trim();
    list.innerHTML = "";

    if (pointsInput) {
      pointsInput.split(",").forEach((point) => {
        const text = point.trim();
        if (!text) {
          return;
        }
        const item = document.createElement("li");
        item.textContent = text;
        list.appendChild(item);
      });
    } else {
      const item = document.createElement("li");
      item.textContent = "Escribe aquí el punto importante.";
      list.appendChild(item);
    }

    summaryList.prepend(card);
  });
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

