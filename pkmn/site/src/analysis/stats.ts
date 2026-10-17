import { typesIn } from "@/analysis/dex";
import type { Metric, Pool } from "@/analysis/pool";

export interface Description {
  mean: number;
  sd: number;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

export function describe(pool: Pool, k: Metric): Description {
  const values = pool.dist[k].sorted;
  const n = values.length || 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  return {
    mean,
    sd,
    min: pool.dist[k].min,
    p10: pool.quantile(k, 0.1),
    p25: pool.quantile(k, 0.25),
    median: pool.quantile(k, 0.5),
    p75: pool.quantile(k, 0.75),
    p90: pool.quantile(k, 0.9),
    max: pool.dist[k].max,
  };
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

export function histogram(pool: Pool, k: Metric, bins = 20): Bin[] {
  const { sorted, min, max } = pool.dist[k];
  const width = Math.max(1, (max - min) / bins);
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, count: 0 }));
  for (const v of sorted) out[Math.min(bins - 1, Math.floor((v - min) / width))].count++;
  return out;
}

export interface TypeShare {
  type: string;
  count: number;
  share: number;
  mono: number;
  meanBst: number;
}

export function typeBreakdown(pool: Pool): TypeShare[] {
  return typesIn(pool.filters.gen)
    .map((type) => {
      const users = pool.members.filter((m) => m.types.includes(type));
      return {
        type,
        count: users.length,
        share: pool.size ? users.length / pool.size : 0,
        mono: users.filter((m) => m.types.length === 1).length,
        meanBst: users.length ? users.reduce((a, m) => a + m.bst, 0) / users.length : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export const BASE_STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

export function correlations(pool: Pool): number[][] {
  const cols = BASE_STATS.map((k) => pool.members.map((m) => m.st[k]));
  const n = pool.members.length || 1;
  const means = cols.map((c) => c.reduce((a, b) => a + b, 0) / n);
  return cols.map((a, i) =>
    cols.map((b, j) => {
      if (i === j) return 1;
      let num = 0;
      let da = 0;
      let db = 0;
      for (let x = 0; x < a.length; x++) {
        const u = a[x] - means[i];
        const v = b[x] - means[j];
        num += u * v;
        da += u * u;
        db += v * v;
      }
      return da && db ? num / Math.sqrt(da * db) : 0;
    }),
  );
}
