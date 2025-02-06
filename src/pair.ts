import { OrderParamsV5, RestClientV5 } from "bybit-api";

const targetApiInstance = new RestClientV5({
  testnet: (process.env.TARGET_BYBIT_API_TESTNET || "").toLowerCase() == "true",
  demoTrading:
    (process.env.TARGET_BYBIT_API_DEMO || "").toLowerCase() === "true"
      ? true
      : undefined,
  key: process.env.TARGET_BYBIT_API_KEY,
  secret: process.env.TARGET_BYBIT_API_SECRET,
});

class Pair {
  #pair: string = "";
  #qtyDigits: number = 0;
  #priceDigits: number = 0;
  #maxQty: number = 0;
  #minQty: number = 0;
  #precision: number = 0;
  #initialized: boolean = false;

  constructor(pair: string) {
    this.#pair = pair;
    this.#initPairInfo();
  }

  get pair() {
    return this.#pair;
  }

  countDecimalDigits(input: string) {
    const reg = /\.(\d+)/gi;
    const res = reg.exec(input);
    if (res && res.length === 2) return res[1].length;
    else return 0;
  }

  async #initPairInfo() {
    if (this.#initialized) return;
    this.#initialized = true;

    //Disable hedging
    await targetApiInstance.switchPositionMode({
      category: "linear",
      symbol: this.#pair,
      mode: 0,
    });

    await targetApiInstance
      .getInstrumentsInfo({
        category: "linear",
        symbol: this.#pair,
      })
      .then((r) => {
        if (r.retCode > 0) console.warn(r.retCode + " - " + r.retMsg);
        if (r.result.list.length > 0) {
          const symboleInfo = r.result.list[0];
          this.#precision = parseFloat(symboleInfo?.lotSizeFilter?.qtyStep);
          this.#qtyDigits = this.countDecimalDigits(
            symboleInfo?.lotSizeFilter?.qtyStep
          );
          this.#maxQty = parseFloat(symboleInfo?.lotSizeFilter.maxOrderQty);
          this.#minQty = parseFloat(symboleInfo?.lotSizeFilter.minOrderQty);
          this.#priceDigits = this.countDecimalDigits(
            symboleInfo?.priceFilter?.tickSize
          );
        }
      })
      .catch((e) => {
        console.warn(e);
      });
  }

  async postOrder(
    side: "Buy" | "Sell",
    qty: number,
    price: number | undefined = undefined,
    takeProfit: number | undefined = undefined,
    stopLoss: number | undefined = undefined
  ): Promise<boolean | void> {
    await this.#initPairInfo();

    if (this.#precision && this.#precision !== 0)
      qty = Math.floor(qty / this.#precision) * this.#precision;

    if (qty > this.#maxQty) qty = this.#maxQty;

    if (qty < this.#minQty) {
      console.warn("Insufficient balance");
      return false;
    }

    const request: OrderParamsV5 = {
      category: "linear",
      symbol: this.#pair,
      orderType: price ? "Limit" : "Market",
      price: price ? price.toFixed(this.#priceDigits) : undefined,
      qty: qty.toFixed(this.#qtyDigits),
      side: side as "Buy" | "Sell",
      timeInForce: "GTC",
      tpslMode: "Full",
    };

    if (takeProfit) {
      request.takeProfit = takeProfit.toFixed(this.#priceDigits);
      request.tpOrderType = "Market";
    }

    if (stopLoss) {
      request.stopLoss = stopLoss.toFixed(this.#priceDigits);
    }

    const response = await targetApiInstance
      .submitOrder(request)
      .then(async (r) => {
        if (r.retCode > 0) console.warn(r.retCode + " - " + r.retMsg, request);
        return r.retCode === 0;
      })
      .catch((e) => {
        console.warn(e, request);
      });

    return response;
  }
}

export default Pair;
