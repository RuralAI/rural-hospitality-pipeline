import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSignatureLines } from "./signature.mjs";

const profile = {
  signingName: "Alex Rivera and Sam Rivera",
  signature: {
    title: "Innkeepers, Example Inn",
    address: "100 Main Street, Rivertown, CO 80000",
    phone: "970 555 0100",
    website: "www.example.com",
  },
};

test("buildSignatureLines orders name, title, address, phone, website", () => {
  assert.deepEqual(buildSignatureLines(profile), [
    "Alex Rivera and Sam Rivera",
    "Innkeepers, Example Inn",
    "100 Main Street, Rivertown, CO 80000",
    "970 555 0100",
    "www.example.com",
  ]);
});

test("buildSignatureLines drops missing optional fields", () => {
  const lines = buildSignatureLines({ signingName: "Alex Rivera", signature: { title: "Innkeeper" } });
  assert.deepEqual(lines, ["Alex Rivera", "Innkeeper"]);
});

test("buildSignatureLines tolerates a missing signature object entirely", () => {
  const lines = buildSignatureLines({ signingName: "Alex Rivera" });
  assert.deepEqual(lines, ["Alex Rivera"]);
});
