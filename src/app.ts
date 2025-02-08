require("dotenv").config();

import { WebsocketClient } from "bybit-api";
import Pair from "./pair";

export default async function startSocket() {
  const invert: boolean =
    process.env.INVERT?.toLocaleLowerCase() === "true" || false;
  const multiplier: number = parseInt(process.env.MULTIPLIER || "0") || 1;
  const pairs = new Map<string, Pair>();

  const wsClient = new WebsocketClient({
    market: "v5",
    testnet:
      (process.env.SOURCE_BYBIT_API_TESTNET || "").toLowerCase() === "true"
        ? true
        : false,
    demoTrading:
      (process.env.SOURCE_BYBIT_API_DEMO || "").toLowerCase() === "true"
        ? true
        : false,
    key: process.env.SOURCE_BYBIT_API_KEY,
    secret: process.env.SOURCE_BYBIT_API_SECRET,
  });

  process.once("SIGINT", () => wsClient.closeAll(true));
  process.once("SIGTERM", () => wsClient.closeAll(true));

  wsClient.on("update", (msg: any) => {
    if (msg.topic !== "execution") return;
    const data = (msg.data.length > 0 && (msg.data[0] as any)) || undefined;
    if (!data) return;

    const symbol = data.symbol.toLocaleLowerCase();
    const qty: number = parseFloat(data.execQty);
    let side = data.side.toLocaleLowerCase();

    if (!pairs.has(symbol)) pairs.set(symbol, new Pair(symbol));
    const pair = pairs.get(symbol);

    if (invert) {
      if (side === "buy") side = "sell";
      else if (side === "sell") side = "buy";
    }

    if (side.toLocaleLowerCase() === "sell") side = "Sell";
    if (side.toLocaleLowerCase() === "buy") side = "Buy";

    pair?.postOrder(side, qty * multiplier);
  });

  wsClient.subscribeV5(["execution"], "linear").catch((e) => console.warn(e));
}

startSocket();
