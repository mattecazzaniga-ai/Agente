import { promises as fs } from "node:fs";
import path from "node:path";
import type { LogEvent, State } from "../types.js";
import { emptyState, type Store } from "./store.js";

/** State in `<dir>/state.json`, append-only event log in `<dir>/log/YYYY-MM-DD.jsonl`. */
export class JsonStore implements Store {
  constructor(private readonly dir: string) {}

  private get statePath(): string {
    return path.join(this.dir, "state.json");
  }

  async load(): Promise<State> {
    try {
      const raw = await fs.readFile(this.statePath, "utf8");
      const state = JSON.parse(raw) as State;
      if (state.schema_version !== 1) throw new Error(`Unsupported schema_version ${state.schema_version}`);
      return state;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyState(Number(process.env.WORLD_SEED || 20260923));
      }
      throw err;
    }
  }

  async save(state: State): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    // Write-then-rename so a crash mid-write never leaves a corrupted state file.
    const tmp = `${this.statePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
    await fs.rename(tmp, this.statePath);
  }

  async log(event: LogEvent): Promise<void> {
    const dir = path.join(this.dir, "log");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, `${event.at.slice(0, 10)}.jsonl`), JSON.stringify(event) + "\n", "utf8");
  }

  async readLog(limit: number): Promise<LogEvent[]> {
    const dir = path.join(this.dir, "log");
    let files: string[];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl")).sort();
    } catch {
      return [];
    }
    const out: LogEvent[] = [];
    for (let i = files.length - 1; i >= 0 && out.length < limit; i--) {
      const lines = (await fs.readFile(path.join(dir, files[i]!), "utf8")).trim().split("\n").filter(Boolean);
      for (let j = lines.length - 1; j >= 0 && out.length < limit; j--) out.push(JSON.parse(lines[j]!) as LogEvent);
    }
    return out.reverse();
  }
}
