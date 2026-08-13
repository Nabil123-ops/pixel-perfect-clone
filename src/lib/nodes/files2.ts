import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "./types";
import { getPath, main, parseJson } from "./types";

/**
 * File nodes: spreadsheets (XLSX/CSV/ODS), ZIP archives, PDF text extraction
 * and binary helpers. Heavy parsers are imported dynamically so they only load
 * on the server when the node actually runs.
 */

const toBytes = (value: Json): Uint8Array => {
  if (typeof value === "string") {
    const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
    const binary = atob(base64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error("Expected base64 string or byte array");
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const spreadsheet: NodeModule = {
  kind: "spreadsheet",
  name: "Excel / Spreadsheet",
  group: "Files",
  description: "Read XLSX, XLS, CSV and ODS into items, or write items back to a workbook.",
  icon: "microsoftexcel",
  keywords: ["excel", "xlsx", "csv", "spreadsheet", "sheet", "ods", "workbook"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "operation", label: "Operation", type: "select", options: ["read", "write"] },
    { key: "source", label: "File (base64) field or expression", type: "code", placeholder: "{{ $json.data }}" },
    { key: "sheet", label: "Sheet name (blank = first)", type: "text" },
    { key: "headerRow", label: "First row is header", type: "select", options: ["yes", "no"] },
    { key: "format", label: "Write format", type: "select", options: ["xlsx", "csv", "ods"] },
    { key: "fileName", label: "Write file name", type: "text" },
  ],
  defaults: {
    operation: "read",
    source: "{{ $json.data }}",
    sheet: "",
    headerRow: "yes",
    format: "xlsx",
    fileName: "export.xlsx",
  },
  execute: async (ctx) => {
    const XLSX = await import("xlsx");
    const operation = String(ctx.params.operation ?? "read");

    if (operation === "write") {
      const format = String(ctx.params.format ?? "xlsx") as "xlsx" | "csv" | "ods";
      const sheet = XLSX.utils.json_to_sheet(
        ctx.items.map((item) => (typeof item === "object" && item ? item : { value: item })) as object[],
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, String(ctx.params.sheet || "Sheet1"));
      const out = XLSX.write(book, { bookType: format, type: "base64" }) as string;
      ctx.log(`Wrote ${ctx.items.length} row(s) to ${format.toUpperCase()}`);
      return main([
        {
          fileName: String(ctx.params.fileName || `export.${format}`),
          mimeType:
            format === "csv"
              ? "text/csv"
              : format === "ods"
                ? "application/vnd.oasis.opendocument.spreadsheet"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          data: out,
          rows: ctx.items.length,
        },
      ]);
    }

    const rows: Json[] = [];
    for (const [index, item] of (ctx.items.length ? ctx.items : [{} as Json]).entries()) {
      const raw = ctx.expr(ctx.params.source, item, index);
      const book = XLSX.read(toBytes(raw), { type: "array" });
      const name = String(ctx.params.sheet || book.SheetNames[0] || "");
      const sheet = book.Sheets[name];
      if (!sheet) throw new Error(`Sheet "${name}" not found. Available: ${book.SheetNames.join(", ")}`);
      const parsed = XLSX.utils.sheet_to_json(sheet, {
        ...(String(ctx.params.headerRow) === "no" ? { header: 1 } : {}),
        defval: null,
      }) as Json[];
      parsed.forEach((row) => rows.push(row));
    }
    ctx.log(`Read ${rows.length} row(s)`);
    return main(rows);
  },
};

export const zipNode: NodeModule = {
  kind: "zip",
  name: "Zip / Unzip",
  group: "Files",
  description: "Create a ZIP archive from items, or extract entries from one.",
  icon: "archive",
  keywords: ["zip", "unzip", "archive", "compress", "extract", "gzip"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "operation", label: "Operation", type: "select", options: ["zip", "unzip", "gzip", "gunzip"] },
    { key: "source", label: "Archive / data field", type: "code", placeholder: "{{ $json.data }}" },
    { key: "nameField", label: "File name field (zip)", type: "text" },
    { key: "dataField", label: "File content field (zip)", type: "text" },
    { key: "fileName", label: "Archive name", type: "text" },
    { key: "asText", label: "Decode extracted files as text", type: "select", options: ["yes", "no"] },
  ],
  defaults: {
    operation: "unzip",
    source: "{{ $json.data }}",
    nameField: "fileName",
    dataField: "data",
    fileName: "archive.zip",
    asText: "yes",
  },
  execute: async (ctx) => {
    const { zipSync, unzipSync, gzipSync, gunzipSync, strToU8, strFromU8 } = await import("fflate");
    const operation = String(ctx.params.operation ?? "unzip");

    if (operation === "zip") {
      const entries: Record<string, Uint8Array> = {};
      ctx.items.forEach((item, i) => {
        const name = String(getPath(item, String(ctx.params.nameField || "fileName")) ?? `file-${i}`);
        const content = getPath(item, String(ctx.params.dataField || "data"));
        entries[name] =
          typeof content === "string" && /^[A-Za-z0-9+/=\r\n]+$/.test(content) && content.length > 32
            ? toBytes(content)
            : strToU8(typeof content === "string" ? content : JSON.stringify(content ?? null));
      });
      const archive = zipSync(entries, { level: 6 });
      ctx.log(`Zipped ${Object.keys(entries).length} file(s)`);
      return main([
        {
          fileName: String(ctx.params.fileName || "archive.zip"),
          mimeType: "application/zip",
          data: toBase64(archive),
          files: Object.keys(entries),
        },
      ]);
    }

    const out: Json[] = [];
    for (const [index, item] of (ctx.items.length ? ctx.items : [{} as Json]).entries()) {
      const bytes = toBytes(ctx.expr(ctx.params.source, item, index));
      if (operation === "gzip") {
        out.push({ data: toBase64(gzipSync(bytes)), mimeType: "application/gzip" });
        continue;
      }
      if (operation === "gunzip") {
        const plain = gunzipSync(bytes);
        out.push({ data: toBase64(plain), text: strFromU8(plain) });
        continue;
      }
      const files = unzipSync(bytes);
      for (const [name, content] of Object.entries(files)) {
        if (!content.length && name.endsWith("/")) continue;
        out.push({
          fileName: name,
          size: content.length,
          data: toBase64(content),
          ...(String(ctx.params.asText) === "yes" ? { text: strFromU8(content) } : {}),
        });
      }
    }
    ctx.log(`Extracted ${out.length} entr${out.length === 1 ? "y" : "ies"}`);
    return main(out);
  },
};

export const pdfExtract: NodeModule = {
  kind: "pdfExtract",
  name: "PDF Extract",
  group: "Files",
  description: "Extract text and page count from a PDF file.",
  icon: "file",
  keywords: ["pdf", "text", "extract", "document", "ocr"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "PDF (base64) field", type: "code", placeholder: "{{ $json.data }}" },
    { key: "mode", label: "Output", type: "select", options: ["wholeText", "perPage"] },
  ],
  defaults: { source: "{{ $json.data }}", mode: "wholeText" },
  execute: async (ctx) => {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const out: Json[] = [];
    for (const [index, item] of (ctx.items.length ? ctx.items : [{} as Json]).entries()) {
      const bytes = toBytes(ctx.expr(ctx.params.source, item, index));
      const pdf = await getDocumentProxy(bytes);
      const { totalPages, text } = await extractText(pdf, { mergePages: String(ctx.params.mode) !== "perPage" });
      if (Array.isArray(text)) text.forEach((page, i) => out.push({ page: i + 1, totalPages, text: page }));
      else out.push({ totalPages, text });
    }
    return main(out);
  },
};

export const binaryNode: NodeModule = {
  kind: "binary",
  name: "Binary / Base64",
  group: "Files",
  description: "Convert between text, base64 and data URLs, and inspect file bytes.",
  icon: "binary",
  keywords: ["base64", "binary", "encode", "decode", "buffer", "data url"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "operation",
      label: "Operation",
      type: "select",
      options: ["textToBase64", "base64ToText", "toDataUrl", "fromDataUrl", "info"],
    },
    { key: "source", label: "Source", type: "code", placeholder: "{{ $json.data }}" },
    { key: "mimeType", label: "MIME type (data URL)", type: "text" },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { operation: "info", source: "{{ $json.data }}", mimeType: "application/octet-stream", target: "result" },
  execute: (ctx) => {
    const operation = String(ctx.params.operation ?? "info");
    const target = String(ctx.params.target || "result");
    return main(
      ctx.items.map((item, index) => {
        const raw = ctx.expr(ctx.params.source, item, index);
        let value: Json;
        if (operation === "textToBase64") value = btoa(String(raw ?? ""));
        else if (operation === "base64ToText") value = atob(String(raw ?? ""));
        else if (operation === "toDataUrl") value = `data:${ctx.params.mimeType};base64,${String(raw ?? "")}`;
        else if (operation === "fromDataUrl") value = String(raw ?? "").split(",").slice(1).join(",");
        else {
          const bytes = toBytes(raw);
          const signature = [...bytes.slice(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join("");
          const kind =
            signature.startsWith("25504446") ? "application/pdf"
            : signature.startsWith("504b0304") ? "application/zip"
            : signature.startsWith("89504e47") ? "image/png"
            : signature.startsWith("ffd8ff") ? "image/jpeg"
            : signature.startsWith("47494638") ? "image/gif"
            : "application/octet-stream";
          value = { bytes: bytes.length, signature, detectedMimeType: kind };
        }
        return { ...(item as Record<string, Json>), [target]: value } as Json;
      }),
    );
  },
};

export const imageInfo: NodeModule = {
  kind: "imageInfo",
  name: "Image Info",
  group: "Files",
  description: "Read dimensions and format from PNG, JPEG, GIF and WebP bytes.",
  icon: "image",
  keywords: ["image", "dimensions", "width", "height", "format"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "source", label: "Image (base64) field", type: "code", placeholder: "{{ $json.data }}" }],
  defaults: { source: "{{ $json.data }}" },
  stub: "Reads metadata only. Resizing and re-encoding require an image service node (e.g. Cloudinary, imgix, TinyPNG).",
  execute: (ctx) =>
    main(
      ctx.items.map((item, index) => {
        const bytes = toBytes(ctx.expr(ctx.params.source, item, index));
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let width = 0;
        let height = 0;
        let format = "unknown";
        if (bytes[0] === 0x89 && bytes[1] === 0x50) {
          format = "png";
          width = view.getUint32(16);
          height = view.getUint32(20);
        } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
          format = "jpeg";
          let offset = 2;
          while (offset < bytes.length - 9) {
            if (bytes[offset] !== 0xff) { offset++; continue; }
            const marker = bytes[offset + 1]!;
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
              height = view.getUint16(offset + 5);
              width = view.getUint16(offset + 7);
              break;
            }
            offset += 2 + view.getUint16(offset + 2);
          }
        } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
          format = "gif";
          width = bytes[6]! | (bytes[7]! << 8);
          height = bytes[8]! | (bytes[9]! << 8);
        } else if (String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
          format = "webp";
          width = ((bytes[27]! << 8) | bytes[26]!) & 0x3fff;
          height = ((bytes[29]! << 8) | bytes[28]!) & 0x3fff;
        }
        return { ...(item as Record<string, Json>), image: { format, width, height, bytes: bytes.length } } as Json;
      }),
    ),
};

export const jsonFile: NodeModule = {
  kind: "jsonFile",
  name: "JSON / NDJSON File",
  group: "Files",
  description: "Parse a JSON or NDJSON file into items, or serialize items into a file.",
  icon: "braces",
  keywords: ["json", "ndjson", "jsonl", "file", "parse", "serialize"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "operation", label: "Operation", type: "select", options: ["read", "write"] },
    { key: "source", label: "Source (text or base64)", type: "code" },
    { key: "format", label: "Format", type: "select", options: ["json", "ndjson"] },
    { key: "fileName", label: "File name (write)", type: "text" },
  ],
  defaults: { operation: "read", source: "{{ $json.data }}", format: "json", fileName: "data.json" },
  execute: (ctx) => {
    const format = String(ctx.params.format ?? "json");
    if (String(ctx.params.operation) === "write") {
      const text =
        format === "ndjson"
          ? ctx.items.map((item) => JSON.stringify(item)).join("\n")
          : JSON.stringify(ctx.items, null, 2);
      return main([
        {
          fileName: String(ctx.params.fileName || `data.${format === "ndjson" ? "ndjson" : "json"}`),
          mimeType: format === "ndjson" ? "application/x-ndjson" : "application/json",
          text,
          data: btoa(unescape(encodeURIComponent(text))),
        },
      ]);
    }
    const out: Json[] = [];
    for (const [index, item] of (ctx.items.length ? ctx.items : [{} as Json]).entries()) {
      let text = String(ctx.expr(ctx.params.source, item, index) ?? "");
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
        try {
          text = decodeURIComponent(escape(atob(text)));
        } catch {
          /* not base64 — treat as plain text */
        }
      }
      if (format === "ndjson")
        text
          .split("\n")
          .filter((line) => line.trim())
          .forEach((line) => out.push(parseJson(line, null)));
      else {
        const parsed = parseJson(text, null);
        if (Array.isArray(parsed)) parsed.forEach((entry) => out.push(entry));
        else out.push(parsed);
      }
    }
    return main(out);
  },
};

export const files2Nodes: NodeModule[] = [spreadsheet, zipNode, pdfExtract, binaryNode, imageInfo, jsonFile];
