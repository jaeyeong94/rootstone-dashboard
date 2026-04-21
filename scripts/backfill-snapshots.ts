/**
 * Backfill balance_snapshots from Bybit transaction-log API.
 *
 * Fetches transaction logs in 7-day windows (API limit),
 * extracts daily cashBalance, inserts into PostgreSQL.
 *
 * Usage: npx tsx scripts/backfill-snapshots.ts
 */

import crypto from "crypto";
import { balanceSnapshots } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db";

const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = "5000";
const API_KEY = process.env.BYBIT_API_KEY || "";
const API_SECRET = process.env.BYBIT_API_SECRET || "";

// Account creation: Nov 15, 2024
const ACCOUNT_START = new Date("2024-11-15T00:00:00Z").getTime();
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function sign(ts: string, qs: string) {
  return crypto.createHmac("sha256", API_SECRET).update(ts + API_KEY + RECV_WINDOW + qs).digest("hex");
}

async function fetchApi(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const ts = Date.now().toString();
  const res = await fetch(BASE_URL + endpoint + "?" + qs, {
    headers: {
      "X-BAPI-API-KEY": API_KEY,
      "X-BAPI-SIGN": sign(ts, qs),
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    },
  });
  return res.json();
}

interface TxEntry {
  transactionTime: string;
  cashBalance: string;
  type: string;
  amount: string;
}

async function fetchWindowTransactions(startTime: number, endTime: number): Promise<TxEntry[]> {
  const all: TxEntry[] = [];
  let cursor = "";

  while (true) {
    const params: Record<string, string> = {
      accountType: "UNIFIED",
      limit: "50",
      startTime: startTime.toString(),
      endTime: endTime.toString(),
    };
    if (cursor) params.cursor = cursor;

    const result = await fetchApi("/v5/account/transaction-log", params);

    if (result.retCode !== 0) {
      console.warn(`  API error: ${result.retCode} - ${result.retMsg}`);
      break;
    }

    const list: TxEntry[] = result.result?.list || [];
    if (list.length === 0) break;

    all.push(...list);
    cursor = result.result?.nextPageCursor || "";
    if (!cursor) break;

    await new Promise((r) => setTimeout(r, 220));
  }

  return all;
}

async function main() {
  console.log("=== Backfilling balance snapshots from Bybit ===\n");

  // 1. Fetch transactions in 7-day windows
  const allTransactions: TxEntry[] = [];
  const now = Date.now();
  let windowStart = ACCOUNT_START;
  let windowNum = 0;

  while (windowStart < now) {
    windowNum++;
    const windowEnd = Math.min(windowStart + SEVEN_DAYS, now);
    const startDate = new Date(windowStart).toISOString().split("T")[0];
    const endDate = new Date(windowEnd).toISOString().split("T")[0];

    process.stdout.write(`Window ${windowNum}: ${startDate} ~ ${endDate} ... `);
    const txs = await fetchWindowTransactions(windowStart, windowEnd);
    console.log(`${txs.length} transactions`);

    allTransactions.push(...txs);
    windowStart = windowEnd;

    await new Promise((r) => setTimeout(r, 220));
  }

  console.log(`\nTotal transactions: ${allTransactions.length}\n`);

  if (allTransactions.length === 0) {
    console.log("No transactions found. Exiting.");
    process.exit(0);
  }

  // 2. Group by day, keep last cashBalance per day
  const byDay = new Map<string, { cashBalance: number; timestamp: Date }>();

  for (const tx of allTransactions) {
    const ts = new Date(parseInt(tx.transactionTime));
    const day = ts.toISOString().split("T")[0];
    const balance = parseFloat(tx.cashBalance);

    const existing = byDay.get(day);
    if (!existing || ts > existing.timestamp) {
      byDay.set(day, { cashBalance: balance, timestamp: ts });
    }
  }

  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  console.log(`Unique days with data: ${days.length}`);
  console.log(`Date range: ${days[0]?.[0]} ~ ${days[days.length - 1]?.[0]}\n`);

  // 3. Clear existing snapshots and insert fresh
  const db = getDb();

  await db.delete(balanceSnapshots);
  console.log("Cleared existing snapshots");

  let inserted = 0;
  for (const [day, data] of days) {
    const snapshotAt = new Date(`${day}T23:59:59Z`);

    await db.insert(balanceSnapshots).values({
      totalEquity: data.cashBalance,
      totalWalletBalance: data.cashBalance,
      totalUnrealisedPnl: 0,
      snapshotAt,
    });
    inserted++;
  }

  console.log(`Inserted ${inserted} daily snapshots\n`);

  // 4. Summary
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (firstDay && lastDay) {
    const startBal = firstDay[1].cashBalance;
    const endBal = lastDay[1].cashBalance;
    const returnPct = ((endBal - startBal) / startBal * 100).toFixed(2);
    console.log(`Start: $${startBal.toFixed(2)} (${firstDay[0]})`);
    console.log(`End:   $${endBal.toFixed(2)} (${lastDay[0]})`);
    console.log(`Return: ${returnPct}%`);
  }

  console.log("\nDone!");
  await closeDb();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Error:", e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
