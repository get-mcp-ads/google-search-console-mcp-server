import { test } from "node:test";
import assert from "node:assert/strict";
import { GSCClient } from "../src/platforms/gsc/gscClient.ts";
import { CompareSearchTypesSchema } from "../src/platforms/gsc/tools.ts";
const request = {startDate:"2026-08-01",endDate:"2026-08-31",dimensions:["page"]};
test("auto pagination caps requests, preserves metadata and reports truncation", async () => {
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=async (_url, init) => { calls.push(JSON.parse(init.body)); assert.equal(init.redirect,"error"); return Response.json({rows:Array.from({length:25000},()=>({keys:["/"],clicks:1,impressions:2,ctr:0.5,position:1})),metadata:{firstIncompleteHour:"2026-08-31T00:00:00"}}); };
  try {
    const result=await new GSCClient("private-token").querySearchAnalytics("https://example.com/",{...request,startRow:10});
    assert.equal(calls.length,4);assert.deepEqual(calls.map(x=>x.startRow),[10,25010,50010,75010]);
    assert.equal(result.rows.length,100000);assert.equal(result.pagination.truncated,true);
    assert.equal(result.metadata.firstIncompleteHour,"2026-08-31T00:00:00");
  } finally { globalThis.fetch=original; }
});
test("explicit pages make one request and small results are not marked truncated", async () => {
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({rows:[{keys:["/"],clicks:0,impressions:0,ctr:0,position:0}]});};
  try { const result=await new GSCClient("fixture").querySearchAnalytics("sc-domain:example.com",{...request,rowLimit:25});assert.equal(calls,1);assert.equal(result.pagination.mode,"single_page");assert.equal(result.pagination.truncated,false);assert.equal(result.rows[0].clicks,0); }
  finally {globalThis.fetch=original;}
});
test("provider errors and logs never echo credentials or private site URLs", async () => {
  const original=globalThis.fetch, originalError=console.error, logs=[];
  globalThis.fetch=async()=>Response.json({error:{message:"private-token https://private.example/"}},{status:403});
  console.error=(...args)=>logs.push(args);
  try { await assert.rejects(new GSCClient("private-token").listSites(),e=>e.message.includes("authorization failed")&&!e.message.includes("private-token"));assert.doesNotMatch(JSON.stringify(logs),/private-token|private.example/); }
  finally {globalThis.fetch=original;console.error=originalError;}
});
test("comparison fan-out rejects duplicates, empty lists and excess entries", () => {
  assert.equal(CompareSearchTypesSchema.safeParse(["web","image"]).success,true);
  for(const value of [[],["web","web"],Array(7).fill("web")]) assert.equal(CompareSearchTypesSchema.safeParse(value).success,false);
});
