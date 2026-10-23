---
name: boletin
description: >-
  Read the teacher's weekly French-class newsletter from Gmail, upload new
  attachments to Seafile, and file them into clases, archivos, and boletines.
  Then give a Spanish WhatsApp summary and a PDF of the original letter.
  Use when the user invokes /boletin or asks to incorporate the latest
  newsletter or boletín into the site.
argument-hint: "[date or latest]"
disable-model-invocation: true
---

# Boletín

Incorporate one weekly newsletter into this site. The letter is a packing list. Do not copy it onto the site.

Invoking this skill is permission to read that newsletter in the signed-in Gmail account and to upload or delete files in the Seafile library named in `data/curso.json`. Do not send, trash, or label mail. Do not print the Seafile token or any classmate address. Do not commit unless the user asks.

If the user passes a date, use that newsletter. Otherwise use the latest one whose send date is not already `date` in `data/boletines.json`.

## 1. Read the message

Gmail tools are in the `plugin-gmail-gmail` namespace. If the namespace needs auth, call `mcp_auth`, then discover tool schemas before calling them.

Search the signed-in inbox for the weekly packing list: `has:attachment` plus a phrase from the letter, such as `activités complémentaires`, and the date constraint. Do not write the sender address, the recipient list, or message ids into the repo or the reply. Read the message as `PLAIN_TEXT` for the body and attachment names. Attachment bytes are not in that response. Fetch `RAW`, base64url-decode it, and walk the MIME parts with Python's `email` package. Write the files under `/tmp`, never in the repo.

## 2. Sort each attachment once

Read `data/clases.json` for what already happened. Put each file in exactly one place:

| The teacher sent | Where it goes |
|---|---|
| A handout or audio from a session | `archivos.json`, and that class's `files` |
| Practice she asks them to do or hand in | `homework` on that class, plus the file on that class's `files` |
| A one-off date or deadline that is not already on the calendar | `avisos.json`, with `expiresAt` |
| An optional gift that is not homework and not a session | the boletín's `files` only |

Homework is Spanish. Keep her French titles. Say what to do with the sheet; the link is the sheet. A sign-off such as "bon week-end / à mardi" is the calendar, not an aviso.

Add a boletín object: `date` is the send date, `covers` lists the class dates that week (each must exist in `clases.json`). Omit `files` when there is no gift. A file listed on a class is not also listed on the boletín; the class card already shows it, and only boletín files that are not on the class render as **Del boletín**.

## 3. Name and upload

Library filenames:

- Class material: `YYYY-MM-DD-cNN-slug.ext`, dated and numbered with that class (`c02`).
- Gift only: `YYYY-MM-DD-slug.ext`, dated with the newsletter.

ASCII slugs. `kind` is `audio` for audio, `fotocopia` for a class sheet, `pdf` for a reference that is not a handout. Titles stay in the document's language.

Share links use the token in `filesFolder` from `data/curso.json`:

`https://seafile.biblivre.app/d/<token>/files/?p=%2F<filename>`

The credential is the library API token in `$SEAFILE_TOKEN`. If it is unset, ask once. Never write it into a tracked file. Call Seafile with `curl` and `Authorization: Token $SEAFILE_TOKEN`. Python `urllib` is rejected by Cloudflare (error 1010). `/api2/repos/` does not accept this token.

```bash
# list
curl -sS -A "curl/8.7.1" -H "Authorization: Token $SEAFILE_TOKEN" \
  "https://seafile.biblivre.app/api/v2.1/via-repo-token/dir/?p=/"

# upload link, then POST the file. The response is a JSON string.
curl -sS -A "curl/8.7.1" -H "Authorization: Token $SEAFILE_TOKEN" \
  "https://seafile.biblivre.app/api/v2.1/via-repo-token/upload-link/?p=/"
curl -sS -F "file=@/tmp/file.pdf" -F "parent_dir=/" -F "replace=0" "$UPLOAD_URL"

# download uses path=, not p=
curl -sS -A "curl/8.7.1" -H "Authorization: Token $SEAFILE_TOKEN" \
  "https://seafile.biblivre.app/api/v2.1/via-repo-token/download-link/?path=%2F<filename>"
```

Skip a newsletter file that is byte-identical to one already in the library.

## 4. Drop scanned duplicates

A scan of the same sheet is a different, much larger PDF. Compare extracted text, not size. Use `pypdf` from a venv in `/tmp`, not a project dependency. One scan can contain several newsletter PDFs.

When the text is the same document, remove that archivo entry and its id from every class, then delete it:

```bash
curl -sS -A "curl/8.7.1" -X DELETE -H "Authorization: Token $SEAFILE_TOKEN" \
  "https://seafile.biblivre.app/api/v2.1/via-repo-token/file/?path=%2F<filename>"
```

Do not delete a file whose text does not match.

## 5. Check

Run `npm run validate`. File ids on a class or a boletín must exist in `data/archivos.json`. Then open Inicio, Clases, and Archivos and confirm the new links render and the removed scans do not. Search should find the new homework and the gift title.

## 6. For the WhatsApp group

Do not post the message. Do not copy the letter onto the site. After the check, give two things the user can share.

**Summary.** Spanish, short enough to paste. Same shape as this one: a dated first line, the week's documents with her French titles and the `filesFolder` link, an optional gift only when she offered one, homework as a Spanish instruction plus the French title and the link, and her sign-off turned into Spanish (`Buen fin de semana. Nos vemos el martes.` when she wrote bon week-end / à mardi). `vosotros` is fine. No addresses and no message id.

```
Boletín del 22 de octubre

Esta semana trabajamos las presentaciones. En la carpeta están:

• Les présentations (vídeo ralentizado)
• Les présentations dans la villa Marie-Claire
• Qui est-ce ?

https://seafile.biblivre.app/d/bb95955a0c7e4378a712/

Si fuisteis a La petite Casbah, podéis escribir las impresiones aquí:
https://www.menti.com/al2uvcfq4wy5

Para practicar C'est / Il est en casa:

• Quiz « C'est / Il est »
https://wordwall.net/resource/54255723?wwmethod=link

• Clasificación « C'est/Il est »
https://wordwall.net/resource/66175508?wwmethod=link

• Quiz « C'est / Ce sont / Il est / Elle est »
https://wordwall.net/resource/91705123?wwmethod=link

Buen fin de semana. Nos vemos el martes.
```

**PDF.** A PDF of the original letter: her subject and plain-text body, including her links, in her wording. Leave out the transport headers, every address, and the attachment bytes. Write the text under `/tmp`. `textutil` cannot write a PDF, and `cupsfilter` stops at an emoji and drops the rest of the letter. Render it with `fpdf2` from a venv in `/tmp`, not a project dependency, using a system font that covers the letter. If a glyph is missing, omit that glyph and keep the sentence. Save `$HOME/Downloads/YYYY-MM-DD-boletin.pdf`, dated with the send date, and put that path in the reply.
