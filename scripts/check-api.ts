import crypto from "crypto";

const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = "5000";
const API_KEY = process.env.BYBIT_API_KEY || "";
const API_SECRET = process.env.BYBIT_API_SECRET || "";

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

async function main() {
  // 1. Current balance
  const acct = await fetchApi("/v5/account/wallet-balance", { accountType: "UNIFIED" });
  const a = acct.result?.list?.[0];
  console.log("=== Account ===");
  console.log("Equity:", a?.totalEquity, "WalletBal:", a?.totalWalletBalance);

  // 2. Transaction log - 1 year range
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const tx = await fetchApi("/v5/account/transaction-log", {
    accountType: "UNIFIED",
    limit: "50",
    startTime: oneYearAgo.toString(),
    endTime: Date.now().toString(),
  });
  console.log("\n=== Transaction Log (UNIFIED, 1yr) ===");
  console.log("retCode:", tx.retCode, "retMsg:", tx.retMsg);
  console.log("Count:", tx.result?.list?.length || 0);
  if (tx.result?.list?.length > 0) {
    const first = tx.result.list[0];
    const last = tx.result.list[tx.result.list.length - 1];
    console.log("Newest:", new Date(parseInt(first.transactionTime)).toISOString(), first.type, "balance:", first.cashBalance);
    console.log("Oldest:", new Date(parseInt(last.transactionTime)).toISOString(), last.type, "balance:", last.cashBalance);
    console.log("Cursor:", tx.result.nextPageCursor ? "yes" : "no");
  }

  // 3. Closed PnL - max records
  const pnl = await fetchApi("/v5/position/closed-pnl", {
    category: "linear",
    limit: "200",
  });
  console.log("\n=== Closed PnL ===");
  console.log("Count:", pnl.result?.list?.length || 0);
  if (pnl.result?.list?.length > 0) {
    const first = pnl.result.list[0];
    const last = pnl.result.list[pnl.result.list.length - 1];
    console.log("Newest:", new Date(parseInt(first.updatedTime)).toISOString(), first.symbol, "PnL:", first.closedPnl);
    console.log("Oldest:", new Date(parseInt(last.updatedTime)).toISOString(), last.symbol, "PnL:", last.closedPnl);
    console.log("Cursor:", pnl.result.nextPageCursor ? "yes" : "no");
  }

  // 4. Try different transaction types
  for (const txType of ["TRADE", "TRANSFER_IN", "TRANSFER_OUT", "SETTLEMENT", "DELIVERY", "LIQUIDATION"]) {
    const r = await fetchApi("/v5/account/transaction-log", {
      accountType: "UNIFIED",
      type: txType,
      limit: "5",
    });
    const cnt = r.result?.list?.length || 0;
    if (cnt > 0) {
      console.log(`\n=== Tx type: ${txType} === count: ${cnt}`);
      for (const item of r.result.list) {
        console.log(" ", new Date(parseInt(item.transactionTime)).toISOString(), "bal:", item.cashBalance, "amt:", item.amount);
      }
    }
  }

  // 5. Check account info (creation date etc)
  const info = await fetchApi("/v5/account/info", {});
  console.log("\n=== Account Info ===");
  console.log("retCode:", info.retCode);
  if (info.result) {
    console.log(JSON.stringify(info.result, null, 2));
  }
}

main().catch(console.error);
