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

    console.log(data.topic);

    if (!pairs.has(data.symbole))
      pairs.set(data.symbole, new Pair(data.symbole));

    const pair = pairs.get(data.pair);

    let side = data.side;
    if (invert) {
      if (side === "Buy") side = "Sell";
      else if (side === "Sell") side = "Buy";
    }

    pair?.postOrder(side, data.qty * multiplier);
  });

  wsClient.subscribeV5(["execution"], "linear").catch((e) => console.warn(e));
}

startSocket();
