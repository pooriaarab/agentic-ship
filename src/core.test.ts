import { describe, expect, test } from "vitest";
import { EasyPostAdapter, ShippoAdapter, createAdapter, dryRunLabel, dryRunRate, dryRunTrack } from "./core.js";
const shipment = { vendor: "easypost" as const, fromAddress: { street1: "1 Market St", city: "San Francisco", state: "CA", postalCode: "94105", country: "US" }, toAddress: { street1: "2 Broadway", city: "New York", state: "NY", postalCode: "10007", country: "US" }, parcel: { length: 10, width: 8, height: 4, weight: 2 } };
describe("dry runs", () => {
  test("rates without the network", () => { const result = dryRunRate(shipment); expect(result).toMatchObject({ dryRun: true, vendor: "easypost" }); expect(result.rates[0].amount).toBe("6.10"); });
  test("buys no label", () => expect(dryRunLabel(shipment).labelUrl).toBeUndefined());
  test("tracks without the network", () => expect(dryRunTrack("shippo", "TEST123")).toMatchObject({ dryRun: true, status: "pre_transit" }));
  test("validates agentic-address-shaped fields", () => expect(() => dryRunRate({ ...shipment, toAddress: { ...shipment.toAddress, street1: "" } })).toThrow("toAddress.street1"));
});
describe("vendor adapters", () => {
  test("missing live key is clear", () => expect(() => createAdapter("easypost")).toThrow("easypost API key is required"));
  test("EasyPost preserves vendor errors", async () => { const adapter = new EasyPostAdapter("key", async () => new Response('{"error":"bad key"}', { status: 401 })); await expect(adapter.rate(shipment)).rejects.toMatchObject({ name: "VendorError", status: 401 }); });
  test("Shippo maps fixture rates", async () => { const adapter = new ShippoAdapter("key", async () => new Response(JSON.stringify({ rates: [{ object_id: "rate_1", provider: "USPS", servicelevel: { name: "Priority" }, amount: "8.00", currency: "USD", estimated_days: 2 }] }))); const result = await adapter.rate({ ...shipment, vendor: "shippo" }); expect(result.rates[0]).toMatchObject({ rateId: "rate_1", carrier: "USPS" }); });
});
