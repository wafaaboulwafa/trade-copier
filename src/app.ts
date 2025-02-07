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

  wsClient.on("update", (data: any) => {
    if (data.topic !== "execution") return;

    const symbol = data.symbol.toLocaleLowerCase();
    const qty: number = parseInt(data.execPrice);
    let side = data.side.toLocaleLowerCase();

    if (!pairs.has(symbol)) pairs.set(symbol, new Pair(symbol));
    const pair = pairs.get(symbol);

    if (invert) {
      if (side === "buy") side = "sell";
      else if (side === "sell") side = "buy";
    }

    pair?.postOrder(side, qty * multiplier);
  });

  wsClient.subscribeV5(["execution"], "linear").catch((e) => console.warn(e));
}

startSocket();
