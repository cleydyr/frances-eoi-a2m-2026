import puppeteer from "puppeteer";
import axios from "axios";
import fs from "fs/promises";

// CONFIGURATION
const TARGET_URL =
  "https://www.canva.com/design/DAGS1jbtVUs/ZtauRcJI71IwuK5Afkb8fQ/view";
// IMPORTANT: You must inspect the Canva page and replace this with the actual CSS selector of the data container.
// Canva often generates random class names. If it's a real HTML table, 'table' works.
const TABLE_SELECTOR = "table";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function run() {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("TELEGRAM_TOKEN or TELEGRAM_CHAT_ID is not set");
    process.exit(1);
  }

  console.log("Starting Browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for GitHub Actions
  });

  const page = await browser.newPage();

  try {
    // 1. Navigate to Page
    console.log(`Navigating to ${TARGET_URL}...`);
    // networkidle2 waits until there are no more than 2 network connections for at least 500ms
    await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 60000 });

    // 2. Wait for the "Table" to render
    console.log("Waiting for selector...");
    await page.waitForSelector(TABLE_SELECTOR, { timeout: 15000 });

    // 3. Scrape the Data
    // This logic assumes a standard HTML table. If Canva uses divs, you must adjust this.
    const data = await page.evaluate((selector) => {
      const rows = Array.from(document.querySelectorAll(`${selector} tr`));

      return rows.map((row) => {
        const columns = row.querySelectorAll(
          "td, th",
        ) as NodeListOf<HTMLTableCellElement>;

        return Array.from(columns).map((col) => col.innerText.trim());
      });
    }, TABLE_SELECTOR);

    const currentAbsenceEntries = new Set(
      data
        .map(toAbsenceEntry)
        .filter(isFrenchA1AbsenceRow)
        .map(humanFriendlyMessage),
    );

    const pastAbsences = new Set(await readPastAbsences());

    console.log("Past absences:", pastAbsences);

    const newAbsenceEntries = currentAbsenceEntries.difference(pastAbsences);

    console.log("New absence entries:", newAbsenceEntries);

    if (newAbsenceEntries.size === 0) {
      console.log("No new absence entries found");
      return;
    }

    const message = Array.from(newAbsenceEntries).join("\n");

    await sendToTelegram(`📊 **Canva Data Scrape**\n\n${message}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
      await sendToTelegram(`⚠️ **Scraping Failed**\n\nError: ${error.message}`);
      process.exit(1);
    } else {
      console.error("Error:", error);
      await sendToTelegram(`⚠️ **Scraping Failed**\n\nError: ${error}`);
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

type AbsenceEntry = {
  idioma: string;
  grupo: string;
  fecha: string;
};

function toAbsenceEntry([idioma, grupo, fecha]: string[]): AbsenceEntry {
  return {
    idioma,
    grupo,
    fecha,
  };
}

async function sendToTelegram(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });
    console.log("Telegram message sent.");
  } catch (err) {
    if (err instanceof Error) {
      console.error("Failed to send Telegram message:", err.message);
    } else {
      console.error("Failed to send Telegram message:", err);
    }
  }
}

function isFrenchA1AbsenceRow(absenceEntry: AbsenceEntry): boolean {
  return absenceEntry.idioma === "FRANCÉS" && absenceEntry.grupo.includes("A1");
}

function humanFriendlyMessage(absenceEntry: AbsenceEntry): string {
  return `${absenceEntry.idioma} - ${absenceEntry.grupo} - ${absenceEntry.fecha}`.replace(
    "\n",
    " ",
  );
}

async function readPastAbsences(): Promise<Set<string>> {
  const absences = await fs.readFile("data/absences.json", "utf8");
  return new Set<string>(JSON.parse(absences) as string[]);
}

// runs the code
await run();
