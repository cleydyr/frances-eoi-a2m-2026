const NAV_ITEMS = [
  { key: "inicio", href: "index.html", label: "Inicio" },
  { key: "calendario", href: "calendario.html", label: "Calendario" },
  { key: "resumen", href: "resumen-de-clases.html", label: "Resumen de clases" },
  { key: "archivos", href: "archivos.html", label: "Archivos" },
  { key: "avisos", href: "avisos.html", label: "Avisos" },
];

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" });

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
          <span class="logo">Francés EOI 2025</span>
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
    this.innerHTML = `
      <footer class="site-footer">
        <p>Hecho con cariño por Cleydyr de Albuquerque para la clase de francés A1 EOI Valladolid · 2025</p>
      </footer>
    `;
  }
}

customElements.define("app-footer", AppFooter);

document.addEventListener("DOMContentLoaded", () => {
  setupSummaryInteractions();
  loadNoticesFromJSON();
});

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

  const sourceUrl = main.dataset.noticeSource || "data/avisos.json";

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

