import { promises as fs } from "fs";
import path from "path";
import type { HomologationRun } from "@/app/lib/homologation/types";

const DIR = path.join(process.cwd(), "reports", "homologation");

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

export async function saveHomologationRun(run: HomologationRun): Promise<string> {
  await ensureDir();
  const file = path.join(DIR, `${run.runId}.json`);
  await fs.writeFile(file, JSON.stringify(run, null, 2), "utf8");
  await fs.writeFile(path.join(DIR, "latest.json"), JSON.stringify(run, null, 2), "utf8");
  return file;
}

export async function loadHomologationRun(runId: string): Promise<HomologationRun | null> {
  try {
    const raw = await fs.readFile(path.join(DIR, `${runId}.json`), "utf8");
    return JSON.parse(raw) as HomologationRun;
  } catch {
    return null;
  }
}

export async function loadLatestHomologationRun(): Promise<HomologationRun | null> {
  try {
    const raw = await fs.readFile(path.join(DIR, "latest.json"), "utf8");
    return JSON.parse(raw) as HomologationRun;
  } catch {
    return null;
  }
}

export async function listHomologationRuns(limit = 20): Promise<HomologationRun[]> {
  await ensureDir();
  const files = (await fs.readdir(DIR))
    .filter((f) => f.endsWith(".json") && f !== "latest.json")
    .sort()
    .reverse()
    .slice(0, limit);
  const runs: HomologationRun[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(DIR, f), "utf8");
      runs.push(JSON.parse(raw) as HomologationRun);
    } catch {
      /* skip */
    }
  }
  return runs;
}
