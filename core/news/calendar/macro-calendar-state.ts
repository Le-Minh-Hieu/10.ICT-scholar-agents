import fs from "fs/promises";
import path from "path";
import { MacroCalendarState } from "../../../types/macro.js";
import { log } from "../../../shared/utils/logger.js";

const CACHE_DIR = path.join(process.cwd(), "data", "calendar_cache");

export class MacroCalendarStore {
  static async ensureDir() {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (err) {
      // ignore
    }
  }

  static async save(state: MacroCalendarState) {
    await this.ensureDir();
    const file = path.join(CACHE_DIR, `${encodeURIComponent(state.week_start)}.json`);
    await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
    return file;
  }

  static async load(weekStartIso: string): Promise<MacroCalendarState | null> {
    const file = path.join(CACHE_DIR, `${encodeURIComponent(weekStartIso)}.json`);
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as MacroCalendarState;
      log({ stage: 'MACRO_STORE_TRACE', message: 'Loaded cached week', data: { weekStart: weekStartIso, loaded: true, events_count: Array.isArray(parsed?.events) ? parsed.events.length : undefined } });
      return parsed;
    } catch (err) {
      log({ stage: 'MACRO_STORE_TRACE', message: 'Failed to load cached week', data: { weekStart: weekStartIso, loaded: false, error: String(err) } });
      return null;
    }
  }

  static async listCachedWeeks(): Promise<string[]> {
    await this.ensureDir();
    try {
      const entries = await fs.readdir(CACHE_DIR);
      const weeks = entries.filter((n) => n.endsWith('.json')).map((n) => decodeURIComponent(n.replace(/\.json$/, '')));
      log({ stage: 'MACRO_STORE_TRACE', message: 'Listing cached weeks', data: { count: weeks.length, weeks: weeks.slice(0,10) } });
      return weeks;
    } catch (err) {
      return [];
    }
  }

  static async getLatestWeek(): Promise<MacroCalendarState | null> {
    const weeks = await this.listCachedWeeks();
    if (!weeks || weeks.length === 0) {
      log({ stage: 'MACRO_STORE_TRACE', message: 'No cached weeks available', data: { count: 0 } });
      return null;
    }
    // assume ISO strings; pick latest lexicographically
    const sorted = weeks.slice().sort();
    const latest = sorted[sorted.length - 1];
    const state = await this.load(latest);
    log({ stage: 'MACRO_STORE_TRACE', message: 'Chosen latest cached week', data: { chosen: latest, loaded: !!state, events_count: state?.events?.length } });
    return state;
  }
}
