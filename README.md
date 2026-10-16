# agentic-ship

agentic-ship buys shipping labels and tracks parcels with EasyPost and Shippo. It also rates shipments. Dry run is the default.

## Install

```sh
npm install agentic-ship
```

## Vendors

| Brand | Environment key | Live command |
| --- | --- | --- |
| EasyPost | `EASYPOST_API_KEY` | `agentic-ship rate --vendor easypost --input shipment.json --live` |
| Shippo | `SHIPPO_API_KEY` | `agentic-ship rate --vendor shippo --input shipment.json --live` |

## Quick start

Create `shipment.json`. Addresses use the `agentic-address` shape. This package has no runtime dependency on it.

```json
{"vendor":"easypost","fromAddress":{"street1":"1 Market St","city":"San Francisco","state":"CA","postalCode":"94105","country":"US"},"toAddress":{"street1":"2 Broadway","city":"New York","state":"NY","postalCode":"10007","country":"US"},"parcel":{"length":10,"width":8,"height":4,"weight":2}}
```

This command is a dry run. It makes no network request.

```sh
npx agentic-ship rate --vendor easypost --input shipment.json
```

Add `--live` to call a vendor. Set that vendor's environment key first. Vendor errors are returned without being hidden.

## Commands

Buy a label.

```sh
agentic-ship buy-label --vendor easypost --input shipment.json --rate '{"rateId":"RATE_ID","carrier":"USPS","service":"Ground","amount":"6.10","currency":"USD"}' --live
```

Track a parcel.

```sh
agentic-ship track --vendor shippo --tracking-code TRACKING_CODE
```

## Library

```js
import { dryRunRate } from "agentic-ship";
const result = dryRunRate(shipment);
```

## MCP

```sh
npx agentic-ship mcp
```

The MCP server offers `rate_shipment`, `buy_label`, and `track_parcel`. All three default to dry run.
