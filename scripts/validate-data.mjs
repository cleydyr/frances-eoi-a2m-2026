import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import ajvKeywords from "ajv-keywords";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaIdBase = "https://frances-eoi.local/schemas";

// curso, avisos, and absences are always in the repo. The others are checked when present.
const checks = [
  { file: "data/curso.json", schema: "curso.schema.json", required: true },
  { file: "data/avisos.json", schema: "avisos.schema.json", required: true },
  { file: "data/clases.json", schema: "clases.schema.json", required: false },
  { file: "data/absences.json", schema: "absences.schema.json", required: true },
  { file: "data/archivos.json", schema: "archivos.schema.json", required: false },
  { file: "data/ejemplo.json", schema: "ejemplo.schema.json", required: false },
];

const ajv = new Ajv({ allErrors: true, strict: true, verbose: true });
addFormats(ajv);
ajvKeywords(ajv);
await loadSchemas();

const errors = [];
const loaded = new Map();

for (const check of checks) {
  const result = await readDataFile(check.file);
  if (result.missing) {
    if (check.required) {
      errors.push(`${check.file} / file is missing`);
    }
    loaded.set(check.file, { status: "missing" });
    continue;
  }
  if (result.parseError) {
    errors.push(`${check.file} / invalid JSON: ${result.parseError}`);
    loaded.set(check.file, { status: "invalid" });
    continue;
  }

  const validate = ajv.getSchema(`${schemaIdBase}/${check.schema}`);
  if (!validate) {
    throw new Error(`Missing schema ${check.schema}`);
  }
  if (!validate(result.data)) {
    for (const error of validate.errors ?? []) {
      errors.push(formatAjvError(check.file, error));
    }
    loaded.set(check.file, { status: "invalid" });
    continue;
  }

  loaded.set(check.file, { status: "valid", data: result.data });
}

errors.push(...unmatchedClassFileIds(loaded));

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log("ok");

async function loadSchemas() {
  const schemaDir = path.join(root, "schemas");
  const names = (await readdir(schemaDir)).filter((name) => name.endsWith(".schema.json"));
  for (const name of names) {
    const schema = JSON.parse(await readFile(path.join(schemaDir, name), "utf8"));
    // The id lives here so schema files can omit $id and the editor can resolve $ref beside the file.
    ajv.addSchema(schema, `${schemaIdBase}/${name}`);
  }
}

async function readDataFile(relativePath) {
  try {
    const text = await readFile(path.join(root, relativePath), "utf8");
    return { data: JSON.parse(text) };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { missing: true };
    }
    if (error instanceof SyntaxError) {
      return { parseError: error.message };
    }
    throw error;
  }
}

function formatAjvError(file, error) {
  const pointer = error.instancePath || "/";
  const extra = error.params?.additionalProperty;
  let message = error.message;
  if (extra) {
    message = `must NOT have additional property ${JSON.stringify(extra)}`;
  } else if (error.keyword === "uniqueItemProperties" && Array.isArray(error.schema)) {
    message = `must have unique ${error.schema.join(", ")}`;
  }
  return `${file} ${pointer} ${message}`;
}

function unmatchedClassFileIds(files) {
  const clases = files.get("data/clases.json");
  const archivos = files.get("data/archivos.json");
  if (!clases || clases.status !== "valid") {
    return [];
  }
  if (!archivos || archivos.status === "invalid") {
    return [];
  }

  const knownIds = new Set(
    (archivos.status === "valid" ? archivos.data : []).map((file) => file.id),
  );
  const unmatched = [];

  clases.data.forEach((note, noteIndex) => {
    (note.files ?? []).forEach((id, fileIndex) => {
      if (!knownIds.has(id)) {
        unmatched.push(
          `data/clases.json /${noteIndex}/files/${fileIndex} ${JSON.stringify(id)} is not in data/archivos.json`,
        );
      }
    });
  });

  return unmatched;
}
