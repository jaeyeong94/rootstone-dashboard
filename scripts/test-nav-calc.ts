/**
 * Test: Compare Bybit NAV (mark price) vs Kline Open NAV
 */
import { getPositions, getWalletBalance } from "../src/lib/bybit/client";

async function check() {
  const pos = await getPositions();
  console.log("=== 현재 포지션 ===");
  const activePositions = pos.list.filter((p) => parseFloat(p.size) > 0);
  for (const p of activePositions) {
    console.log(
      p.symbol,
      "| side:",
      p.side,
      "| size:",
      p.size,
      "| avgPrice:",
      p.avgPrice,
      "| markPrice:",
      p.markPrice,
      "| unrealisedPnl:",
      p.unrealisedPnl
    );
  }
  console.log("활성 포지션 수:", activePositions.length);

  const bal = await getWalletBalance();
  const account = bal.list[0];
  const cash = parseFloat(account.totalWalletBalance);
  const bybitUPL = parseFloat(account.totalPerpUPL);
  const bybitEquity = parseFloat(account.totalEquity);
  console.log("\n=== Bybit 잔고 ===");
  console.log("Cash (walletBalance):", cash.toFixed(2));
  console.log("Bybit UPL:", bybitUPL.toFixed(4));
  console.log("Bybit Equity:", bybitEquity.toFixed(2));

  // kline open price로 직접 NAV 계산
  console.log("\n=== Kline Open 기반 NAV 계산 ===");
  let calcUPL = 0;
  for (const p of activePositions) {
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${p.symbol}&interval=D&limit=1`
    );
    const data = await res.json();
    const candle = data.result?.list?.[0];
    if (!candle) continue;

    const openPrice = parseFloat(candle[1]);
    const size = parseFloat(p.size);
    const avgEntry = parseFloat(p.avgPrice);
    const side = p.side === "Buy" ? 1 : -1;
    const symbolUPL = side * size * (openPrice - avgEntry);

    console.log(
      p.symbol,
      "| openPrice:",
      openPrice,
      "| avgEntry:",
      avgEntry,
      "| size:",
      size,
      "| side:",
      p.side,
      "| UPL(kline):",
      symbolUPL.toFixed(4),
      "| UPL(bybit):",
      p.unrealisedPnl
    );
    calcUPL += symbolUPL;
  }

  const navKline = cash + calcUPL;
  console.log("\n=== 비교 ===");
  console.log("Bybit NAV (mark price):    ", bybitEquity.toFixed(4));
  console.log("Kline NAV (open price):    ", navKline.toFixed(4));
  console.log(
    "차이:                       ",
    (bybitEquity - navKline).toFixed(4),
    "(" + (((bybitEquity - navKline) / bybitEquity) * 100).toFixed(4) + "%)"
  );
}

check().catch(console.error);
