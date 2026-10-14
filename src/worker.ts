export default { async fetch(): Promise<Response> { return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } }); } };
