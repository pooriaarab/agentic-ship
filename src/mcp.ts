import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAdapter, dryRunLabel, dryRunRate, dryRunTrack, type Rate, type ShipmentInput, type Vendor } from "./core.js";
import { VERSION } from "./version.js";
const vendor = z.enum(["easypost", "shippo"]);
const address = z.object({ name: z.string().optional(), company: z.string().optional(), street1: z.string(), street2: z.string().optional(), city: z.string(), state: z.string().optional(), postalCode: z.string(), country: z.string(), phone: z.string().optional(), email: z.string().optional() });
const shipment = z.object({ vendor, fromAddress: address, toAddress: address, parcel: z.object({ length: z.number(), width: z.number(), height: z.number(), weight: z.number(), predefinedPackage: z.string().optional() }), carrier: z.string().optional(), service: z.string().optional(), reference: z.string().optional() });
function result(value: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(value) }] }; }
function error(e: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }], isError: true as const }; }
function key(v: Vendor) { return v === "easypost" ? process.env.EASYPOST_API_KEY : process.env.SHIPPO_API_KEY; }
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "agentic-ship", version: VERSION });
  server.registerTool("rate_shipment", { description: "Rate a parcel. Dry run is the default.", inputSchema: { shipment, live: z.boolean().optional() } }, async ({ shipment: input, live }) => { try { return result(live ? await createAdapter(input.vendor, key(input.vendor)).rate(input as ShipmentInput) : dryRunRate(input as ShipmentInput)); } catch (e) { return error(e); } });
  server.registerTool("buy_label", { description: "Buy a label from a selected rate. Dry run is the default.", inputSchema: { shipment, rate: z.object({ carrier: z.string(), service: z.string(), amount: z.string(), currency: z.string(), deliveryDays: z.number().optional(), rateId: z.string().optional() }), live: z.boolean().optional() } }, async ({ shipment: input, rate, live }) => { try { return result(live ? await createAdapter(input.vendor, key(input.vendor)).buyLabel(input as ShipmentInput, rate as Rate) : dryRunLabel(input as ShipmentInput, rate as Rate)); } catch (e) { return error(e); } });
  server.registerTool("track_parcel", { description: "Track a parcel. Dry run is the default.", inputSchema: { vendor, trackingCode: z.string(), carrier: z.string().optional(), live: z.boolean().optional() } }, async ({ vendor: v, trackingCode, carrier, live }) => { try { return result(live ? await createAdapter(v, key(v)).track(trackingCode, carrier) : dryRunTrack(v, trackingCode, carrier)); } catch (e) { return error(e); } });
  return server;
}
export async function startMcp(): Promise<void> { const server = createMcpServer(); await server.connect(new StdioServerTransport()); }
