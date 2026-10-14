#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createAdapter, dryRunLabel, dryRunRate, dryRunTrack, type Rate, type ShipmentInput, type Vendor } from "./core.js";
import { VERSION } from "./version.js";

export class UsageError extends Error { constructor(message: string) { super(message); this.name = "UsageError"; } }
export type Command = "rate" | "buy-label" | "track" | "mcp" | "help" | "version";
export interface CliRequest { command: Command; vendor?: Vendor; input?: string; trackingCode?: string; carrier?: string; rate?: Rate; live: boolean; }

export function parseArgs(argv: string[]): CliRequest {
  const request: CliRequest = { command: "help", live: false };
  const args = [...argv]; const first = args.shift();
  if (!first || first === "--help" || first === "-h") return request;
  if (first === "--version" || first === "-V") return { ...request, command: "version" };
  if (!(["rate", "buy-label", "track", "mcp"] as string[]).includes(first)) throw new UsageError(`unknown command "${first}"`);
  request.command = first as Command;
  while (args.length) {
    const flag = args.shift()!;
    if (flag === "--live") { request.live = true; continue; }
    if (["--vendor", "--input", "--tracking-code", "--carrier", "--rate"].includes(flag) && args.length) {
      const value = args.shift()!;
      if (flag === "--vendor") { if (value !== "easypost" && value !== "shippo") throw new UsageError("--vendor must be easypost or shippo"); request.vendor = value; }
      if (flag === "--input") request.input = value;
      if (flag === "--tracking-code") request.trackingCode = value;
      if (flag === "--carrier") request.carrier = value;
      if (flag === "--rate") { try { request.rate = JSON.parse(value) as Rate; } catch { throw new UsageError("--rate must be JSON"); } }
      continue;
    }
    throw new UsageError(`unknown flag "${flag}"`);
  }
  if (request.command !== "mcp" && !request.vendor) throw new UsageError(`${request.command} needs --vendor`);
  if ((request.command === "rate" || request.command === "buy-label") && !request.input) throw new UsageError(`${request.command} needs --input <shipment.json>`);
  if (request.command === "buy-label" && !request.rate) throw new UsageError("buy-label needs --rate <rate JSON>");
  if (request.command === "track" && !request.trackingCode) throw new UsageError("track needs --tracking-code");
  return request;
}
export interface CliIo { out(line: string): void; err(line: string): void; readFile(path: string): string; env: NodeJS.ProcessEnv; }
function defaultIo(): CliIo { return { out: console.log, err: console.error, readFile: (p) => readFileSync(p, "utf8"), env: process.env }; }
function helpText(): string { return `agentic-ship ${VERSION}\nRate, buy labels, and track parcels. Dry run is the default.\n\nUsage: agentic-ship <command> [flags]\n\nCommands:\n  rate --vendor <easypost|shippo> --input shipment.json [--live]\n  buy-label --vendor <easypost|shippo> --input shipment.json --rate '<json>' [--live]\n  track --vendor <easypost|shippo> --tracking-code <code> [--carrier <name>] [--live]\n  mcp\n\nUse --live to call a vendor. Without it, every command is a dry run.`; }
function keyFor(vendor: Vendor, env: NodeJS.ProcessEnv): string | undefined { return vendor === "easypost" ? env.EASYPOST_API_KEY : env.SHIPPO_API_KEY; }
export async function runCli(argv: string[], io: CliIo = defaultIo()): Promise<number> {
  let request: CliRequest;
  try { request = parseArgs(argv); } catch (e) { io.err(e instanceof Error ? e.message : String(e)); return 2; }
  try {
    if (request.command === "help") { io.out(helpText()); return 0; }
    if (request.command === "version") { io.out(VERSION); return 0; }
    if (request.command === "mcp") { const { startMcp } = await import("./mcp.js"); await startMcp(); return 0; }
    const vendor = request.vendor!;
    if (request.command === "track") {
      const result = request.live ? await createAdapter(vendor, keyFor(vendor, io.env)).track(request.trackingCode!, request.carrier) : dryRunTrack(vendor, request.trackingCode!, request.carrier);
      io.out(JSON.stringify(result)); return 0;
    }
    const input = JSON.parse(io.readFile(request.input!)) as ShipmentInput;
    if (input.vendor !== vendor) input.vendor = vendor;
    if (request.command === "rate") { const result = request.live ? await createAdapter(vendor, keyFor(vendor, io.env)).rate(input) : dryRunRate(input); io.out(JSON.stringify(result)); return 0; }
    const result = request.live ? await createAdapter(vendor, keyFor(vendor, io.env)).buyLabel(input, request.rate!) : dryRunLabel(input, request.rate!); io.out(JSON.stringify(result)); return 0;
  } catch (e) { io.err(e instanceof Error ? `${e.name}: ${e.message}` : String(e)); return 1; }
}
function isMainModule(): boolean { try { return typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } }
if (isMainModule()) runCli(process.argv.slice(2)).then((code) => { if (code) process.exit(code); }, (e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
