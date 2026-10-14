import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test } from "vitest";
import { createMcpServer } from "./mcp.js";
test("MCP exposes the shipping tools", async () => { const [ct, st] = InMemoryTransport.createLinkedPair(); const server = createMcpServer(); await server.connect(st); const client = new Client({ name: "test", version: "1" }); await client.connect(ct); try { expect((await client.listTools()).tools.map((x) => x.name).sort()).toEqual(["buy_label", "rate_shipment", "track_parcel"]); } finally { await client.close(); await server.close(); } });
