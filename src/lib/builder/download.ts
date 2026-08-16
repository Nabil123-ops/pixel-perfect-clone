import type { BuilderFile } from "./types";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(file: BuilderFile) {
  const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, file.path.split("/").pop() || "file.txt");
}

export async function downloadProjectZip(files: BuilderFile[], projectName: string) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";
  triggerDownload(blob, `${safeName}.zip`);
}
