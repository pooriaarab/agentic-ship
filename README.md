# agentic-ship

Rate, buy a label, and track a parcel. EasyPost and Shippo are supported.
Dry run is the default.

## Install

```sh
npm install agentic-ship
```

## Quick start

Create `shipment.json`. Addresses use the `agentic-address` shape, but this
package has no runtime dependency on it.

```json
{"vendor":"easypost","fromAddress":{"street1":"1 Market St","city":"San Francisco","state":"CA","postalCode":"94105","country":"US"},"toAddress":{"street1":"2 Broadway","city":"New York","state":"NY","postalCode":"10007","country":"US"},"parcel":{"length":10,"width":8,"height":4,"weight":2}}
```

This is a dry run. It makes no network request.

```sh
npx agentic-ship rate --vendor easypost --input shipment.json
```

Add `--live` to call a vendor. Set `EASYPOST_API_KEY` or `SHIPPO_API_KEY`.
Vendor errors are returned as errors without being hidden.

## Three uses

### CLI

```sh
agentic-ship track --vendor shippo --tracking-code TRACKING_CODE
```

### npm library

```js
import { dryRunRate } from "agentic-ship";
const result = dryRunRate(shipment);
```

### MCP

```sh
npx agentic-ship mcp
```

The MCP server offers `rate_shipment`, `buy_label`, and `track_parcel`. Each
uses the same JSON shapes as the CLI and library. All three default to dry run.
