export type Vendor = "easypost" | "shippo";

export interface Address {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface Parcel {
  length: number;
  width: number;
  height: number;
  weight: number;
  predefinedPackage?: string;
}

export interface ShipmentInput {
  vendor: Vendor;
  fromAddress: Address;
  toAddress: Address;
  parcel: Parcel;
  carrier?: string;
  service?: string;
  reference?: string;
}

export interface Rate {
  carrier: string;
  service: string;
  amount: string;
  currency: string;
  deliveryDays?: number;
  rateId?: string;
}

export interface RateResult {
  dryRun: boolean;
  vendor: Vendor;
  shipment: ShipmentInput;
  rates: Rate[];
}

export interface LabelResult {
  dryRun: boolean;
  vendor: Vendor;
  shipment: ShipmentInput;
  rate: Rate;
  labelUrl?: string;
  trackingCode?: string;
  trackingUrl?: string;
  shipmentId?: string;
}

export interface TrackingEvent {
  status: string;
  message?: string;
  location?: string;
  occurredAt?: string;
}

export interface TrackingResult {
  dryRun: boolean;
  vendor: Vendor;
  trackingCode: string;
  status: string;
  carrier?: string;
  trackingUrl?: string;
  events: TrackingEvent[];
}

export class VendorError extends Error {
  readonly code = "VENDOR_FAILED";
  readonly status?: number;
  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "VendorError";
    this.status = options.status;
  }
}

export interface ShippingAdapter {
  readonly vendor: Vendor;
  rate(input: ShipmentInput): Promise<RateResult>;
  buyLabel(input: ShipmentInput, rate: Rate): Promise<LabelResult>;
  track(trackingCode: string, carrier?: string): Promise<TrackingResult>;
}

function ensureAddress(address: Address, label: string): void {
  for (const field of ["street1", "city", "postalCode", "country"] as const) {
    if (!address[field]?.trim()) throw new Error(`${label}.${field} is required`);
  }
}

export function validateShipment(input: ShipmentInput): void {
  ensureAddress(input.fromAddress, "fromAddress");
  ensureAddress(input.toAddress, "toAddress");
  for (const field of ["length", "width", "height", "weight"] as const) {
    if (!Number.isFinite(input.parcel[field]) || input.parcel[field] <= 0) {
      throw new Error(`parcel.${field} must be greater than zero`);
    }
  }
}

export function dryRunRate(input: ShipmentInput): RateResult {
  validateShipment(input);
  const pounds = input.parcel.weight;
  const amount = (5 + pounds * 0.55).toFixed(2);
  const rate: Rate = {
    carrier: input.carrier ?? "USPS",
    service: input.service ?? "Ground Advantage",
    amount,
    currency: "USD",
    deliveryDays: 3,
    rateId: "dry-run-rate",
  };
  return { dryRun: true, vendor: input.vendor, shipment: input, rates: [rate] };
}

export function dryRunLabel(input: ShipmentInput, rate?: Rate): LabelResult {
  const selected = rate ?? dryRunRate(input).rates[0];
  return { dryRun: true, vendor: input.vendor, shipment: input, rate: selected };
}

export function dryRunTrack(vendor: Vendor, trackingCode: string, carrier?: string): TrackingResult {
  if (!trackingCode.trim()) throw new Error("trackingCode is required");
  return { dryRun: true, vendor, trackingCode, status: "pre_transit", carrier, events: [] };
}

export function createAdapter(vendor: Vendor, apiKey?: string, fetchFn: typeof fetch = fetch): ShippingAdapter {
  if (!apiKey?.trim()) throw new VendorError(`${vendor} API key is required for live requests`);
  return vendor === "easypost"
    ? new EasyPostAdapter(apiKey, fetchFn)
    : new ShippoAdapter(apiKey, fetchFn);
}

abstract class HttpShippingAdapter implements ShippingAdapter {
  abstract readonly vendor: Vendor;
  constructor(protected readonly apiKey: string, protected readonly fetchFn: typeof fetch) {}
  protected async request(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try { response = await this.fetchFn(url, init); }
    catch (error) { throw new VendorError(`${this.vendor} request failed: ${String(error)}`, { cause: error }); }
    const body = await response.text();
    if (!response.ok) throw new VendorError(`${this.vendor} returned ${response.status}: ${body}`, { status: response.status });
    try { return JSON.parse(body) as unknown; }
    catch { throw new VendorError(`${this.vendor} returned invalid JSON`); }
  }
  abstract rate(input: ShipmentInput): Promise<RateResult>;
  abstract buyLabel(input: ShipmentInput, rate: Rate): Promise<LabelResult>;
  abstract track(trackingCode: string, carrier?: string): Promise<TrackingResult>;
}

export class EasyPostAdapter extends HttpShippingAdapter {
  readonly vendor = "easypost" as const;
  private headers(): HeadersInit { return { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" }; }
  async rate(input: ShipmentInput): Promise<RateResult> {
    validateShipment(input);
    const data = await this.request("https://api.easypost.com/v2/shipments", { method: "POST", headers: this.headers(), body: JSON.stringify({ shipment: { to_address: addressForEasyPost(input.toAddress), from_address: addressForEasyPost(input.fromAddress), parcel: input.parcel } }) }) as EasyPostShipment;
    return { dryRun: false, vendor: this.vendor, shipment: input, rates: (data.rates ?? []).map(rateFromEasyPost) };
  }
  async buyLabel(input: ShipmentInput, rate: Rate): Promise<LabelResult> {
    const data = await this.request(`https://api.easypost.com/v2/shipments/${shipmentIdFromRate(rate)}/buy`, { method: "POST", headers: this.headers(), body: JSON.stringify({ rate: { id: rate.rateId } }) }) as EasyPostShipment;
    return labelFromEasyPost(input, rate, data);
  }
  async track(trackingCode: string, carrier?: string): Promise<TrackingResult> {
    const data = await this.request("https://api.easypost.com/v2/trackers", { method: "POST", headers: this.headers(), body: JSON.stringify({ tracker: { tracking_code: trackingCode, carrier } }) }) as EasyPostTracker;
    return { dryRun: false, vendor: this.vendor, trackingCode, carrier: data.carrier, status: data.status ?? "unknown", trackingUrl: data.public_url, events: (data.tracking_details ?? []).map((e) => ({ status: e.status ?? "unknown", message: e.message, location: e.tracking_location?.city, occurredAt: e.datetime })) };
  }
}

export class ShippoAdapter extends HttpShippingAdapter {
  readonly vendor = "shippo" as const;
  private headers(): HeadersInit { return { Authorization: `ShippoToken ${this.apiKey}`, "content-type": "application/json" }; }
  async rate(input: ShipmentInput): Promise<RateResult> {
    validateShipment(input);
    const data = await this.request("https://api.goshippo.com/shipments/", { method: "POST", headers: this.headers(), body: JSON.stringify({ address_from: addressForShippo(input.fromAddress), address_to: addressForShippo(input.toAddress), parcels: [parcelForShippo(input.parcel)], async: false }) }) as ShippoShipment;
    return { dryRun: false, vendor: this.vendor, shipment: input, rates: (data.rates ?? []).map(rateFromShippo) };
  }
  async buyLabel(input: ShipmentInput, rate: Rate): Promise<LabelResult> {
    const data = await this.request("https://api.goshippo.com/transactions/", { method: "POST", headers: this.headers(), body: JSON.stringify({ rate: rate.rateId, label_file_type: "PDF", async: false }) }) as ShippoTransaction;
    return { dryRun: false, vendor: this.vendor, shipment: input, rate, labelUrl: data.label_url, trackingCode: data.tracking_number, trackingUrl: data.tracking_url_provider, shipmentId: data.object_id };
  }
  async track(trackingCode: string, carrier?: string): Promise<TrackingResult> {
    const data = await this.request("https://api.goshippo.com/tracks/", { method: "POST", headers: this.headers(), body: JSON.stringify({ tracking_number: trackingCode, carrier }) }) as ShippoTrack;
    return { dryRun: false, vendor: this.vendor, trackingCode, carrier: data.carrier, status: data.tracking_status?.status ?? "unknown", events: (data.tracking_history ?? []).map((e) => ({ status: e.status ?? "unknown", message: e.status_details, location: e.location?.city, occurredAt: e.status_date })) };
  }
}

function addressForEasyPost(a: Address) { return { name: a.name, company: a.company, street1: a.street1, street2: a.street2, city: a.city, state: a.state, zip: a.postalCode, country: a.country, phone: a.phone, email: a.email }; }
function addressForShippo(a: Address) { return { name: a.name, company: a.company, street1: a.street1, street2: a.street2, city: a.city, state: a.state, zip: a.postalCode, country: a.country, phone: a.phone, email: a.email }; }
function parcelForShippo(p: Parcel) { return { length: String(p.length), width: String(p.width), height: String(p.height), distance_unit: "in", weight: String(p.weight), mass_unit: "lb" }; }
function shipmentIdFromRate(rate: Rate) { const [shipmentId] = (rate.rateId ?? "").split(":"); if (!shipmentId) throw new VendorError("EasyPost rateId is required to buy a label"); return shipmentId; }
interface EasyPostShipment { id?: string; rates?: { id: string; carrier: string; service: string; rate: string; currency: string; delivery_days?: number }[]; postage_label?: { label_url?: string; tracking_code?: string; tracking_url?: string }; }
function rateFromEasyPost(r: NonNullable<EasyPostShipment["rates"]>[number]): Rate { return { carrier: r.carrier, service: r.service, amount: r.rate, currency: r.currency, deliveryDays: r.delivery_days, rateId: r.id }; }
function labelFromEasyPost(shipment: ShipmentInput, rate: Rate, data: EasyPostShipment): LabelResult { return { dryRun: false, vendor: "easypost", shipment, rate, labelUrl: data.postage_label?.label_url, trackingCode: data.postage_label?.tracking_code, trackingUrl: data.postage_label?.tracking_url, shipmentId: data.id }; }
interface EasyPostTracker { carrier?: string; status?: string; public_url?: string; tracking_details?: { status?: string; message?: string; datetime?: string; tracking_location?: { city?: string } }[]; }
interface ShippoShipment { rates?: { object_id: string; provider: string; servicelevel: { name: string }; amount: string; currency: string; estimated_days?: number }[]; }
function rateFromShippo(r: NonNullable<ShippoShipment["rates"]>[number]): Rate { return { carrier: r.provider, service: r.servicelevel.name, amount: r.amount, currency: r.currency, deliveryDays: r.estimated_days, rateId: r.object_id }; }
interface ShippoTransaction { object_id?: string; label_url?: string; tracking_number?: string; tracking_url_provider?: string; }
interface ShippoTrack { carrier?: string; tracking_status?: { status?: string }; tracking_history?: { status?: string; status_details?: string; status_date?: string; location?: { city?: string } }[]; }
