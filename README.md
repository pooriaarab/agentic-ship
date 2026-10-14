# agentic-ship

[![npm version](https://img.shields.io/npm/v/agentic-ship)](https://www.npmjs.com/package/agentic-ship) [![Downloads/month](https://img.shields.io/npm/dm/agentic-ship)](https://www.npmjs.com/package/agentic-ship) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit)

agentic-ship is an open-source TypeScript shipping adapter for parcel rates, label purchases, and tracking through EasyPost and Shippo.

## Install

```sh
npm install agentic-ship
```

Requires Node.js 18 or later. Includes TypeScript declarations and three runtime dependencies.

## Rate your first parcel

Save this as `shipment.json`:

```json
{"vendor":"shippo","fromAddress":{"street1":"1 Market St","city":"San Francisco","state":"CA","postalCode":"94105","country":"US"},"toAddress":{"street1":"2 Broadway","city":"New York","state":"NY","postalCode":"10007","country":"US"},"parcel":{"length":10,"width":8,"height":4,"weight":2}}
```

```sh
npx agentic-ship rate --vendor shippo --input shipment.json
```

Expect JSON with `"dryRun":true`, `"rateId":"dry-run-rate"`, and a synthetic USD rate of `6.10`.
No credentials or network requests are needed.
For live requests, export `SHIPPO_API_KEY` or `EASYPOST_API_KEY`, then add `--live`.
The CLI reads environment variables; it does not load `.env` files.

## Features and coverage

- Validate required address fields and positive parcel dimensions.
- Return normalized rates, label results, and tracking events.
- Use address shapes compatible with agentic-address, without importing that package.
- Surface vendor HTTP, network, and JSON errors as `VendorError`.

| Integration | Rates | Labels | Tracking | Verification |
| --- | --- | --- | --- | --- |
| EasyPost | Implemented | Incomplete shipment ID handoff | Implemented | No credential verification in this rewrite |
| Shippo | Implemented | Implemented | Implemented | No credential verification in this rewrite |

The source contains two HTTP adapters. Dry-run output is synthetic and does not verify vendor delivery.

## Runtime surfaces

The library exports `createAdapter`, both adapter classes, validation, and dry-run helpers.

```js
import { dryRunTrack } from "agentic-ship";
console.log(dryRunTrack("shippo", "demo").status); // pre_transit
```

CLI operations: `rate`, `buy-label`, `track`, and `mcp`. Use `--help` or `--version` for package information.
`buy-label` requires `--input` and `--rate '<rate JSON>'`; `track` requires `--tracking-code` and accepts `--carrier`.
Start the Model Context Protocol (MCP) server with `npx agentic-ship mcp` or `npx agentic-ship-mcp`.
Its three tools are `rate_shipment`, `buy_label`, and `track_parcel`. Each defaults to dry run.

## Behavior limits

Live label purchases can incur vendor charges. Inspect dry-run output before enabling live calls.
Shippo receives inches and pounds. EasyPost receives the parcel object directly.
EasyPost rating returns a bare rate ID, but label buying derives the shipment ID from that field.
The returned rate therefore lacks the shipment context needed for a reliable EasyPost label purchase.
Requests have no explicit timeout, retry policy, or idempotency handling.
The Worker entry point returns HTTP 404; it provides no shipping API.
Version 0.1.x interfaces can change. No public case studies are published in this repository.

## Links and license

[Package](https://www.npmjs.com/package/agentic-ship) · [EasyPost API](https://docs.easypost.com/) · [Shippo API](https://docs.goshippo.com/)

MIT license.
