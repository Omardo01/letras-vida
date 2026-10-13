import { zip, type Zippable } from "fflate";

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Empaqueta sin recomprimir (PNG y MP4 ya vienen comprimidos). */
export async function zipFiles(files: Record<string, Blob | string>): Promise<Blob> {
  const entries: Zippable = {};
  for (const [name, content] of Object.entries(files)) {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(await content.arrayBuffer());
    entries[name] = [bytes, { level: typeof content === "string" ? 6 : 0 }];
  }
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(new Blob([data as BlobPart], { type: "application/zip" }))));
  });
}
