// Files the agent produces. Everything lives under the data directory, which on GitHub Actions is
// the `agent-state` branch: products are versioned, and <dataDir>/site is what GitHub Pages serves.

import { promises as fs } from "node:fs";
import path from "node:path";

export function productDir(dataDir: string, productId: string): string {
  return path.join(dataDir, "workspace", productId);
}

export function siteDir(dataDir: string): string {
  return path.join(dataDir, "site");
}

export async function writeFileSafe(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

export async function readFileSafe(file: string): Promise<string> {
  return fs.readFile(file, "utf8");
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "prodotto"
  );
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
