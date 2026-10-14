import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createApiServer } from "../server.mjs";
test("development API stays read-only and loopback-capable",async()=>{
 const server=createApiServer(); await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try { const base="http://127.0.0.1:"+server.address().port;
 const cap=await (await fetch(base+"/v1/capabilities")).json();
 assert.deepEqual(cap.supported,["catalog.read"]);
 assert.equal((await fetch(base+"/v1/sessions",{method:"POST"})).status,405);
 assert.equal((await fetch(base+"/v1/sessions")).status,501);
 assert.equal((await fetch(base+"/v1/catalog/games")).status,200);
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
