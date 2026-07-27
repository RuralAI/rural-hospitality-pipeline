import { test } from "node:test";
import assert from "node:assert/strict";
import { extractState, stateNameToCode } from "./normalize.js";

test("extractState pulls the 2-letter code before the zip", () => {
  assert.equal(extractState("311A Co Rd 501, Bayfield, CO 81122"), "CO");
  assert.equal(extractState("7144 E Stetson Dr C-200, Scottsdale, AZ 85251"), "AZ");
});

test("extractState returns '' when no STATE ZIP suffix", () => {
  assert.equal(extractState("Phoenix, Arizona"), "");
  assert.equal(extractState(""), "");
  assert.equal(extractState(null), "");
});

test("stateNameToCode maps full names case-insensitively, '' when unknown", () => {
  assert.equal(stateNameToCode("Colorado"), "CO");
  assert.equal(stateNameToCode("new mexico"), "NM");
  assert.equal(stateNameToCode("Bavaria"), "");
  assert.equal(stateNameToCode(null), "");
});

import { stateCodeToName, expandStateCode } from "./normalize.js";

test("stateCodeToName maps 2-letter codes to full names, '' when unknown", () => {
  assert.equal(stateCodeToName("CO"), "Colorado");
  assert.equal(stateCodeToName("co"), "Colorado");
  assert.equal(stateCodeToName("NM"), "New Mexico");
  assert.equal(stateCodeToName("ZZ"), "");
  assert.equal(stateCodeToName(null), "");
});

test("stateCodeToName keeps connector words lowercase (DC)", () => {
  assert.equal(stateCodeToName("DC"), "District of Columbia");
  assert.equal(expandStateCode("Washington DC"), "Washington District of Columbia");
});

test("expandStateCode expands a trailing US state code to full name", () => {
  assert.equal(expandStateCode("Bayfield CO"), "Bayfield Colorado");
  assert.equal(expandStateCode("Bayfield, CO"), "Bayfield, Colorado");
  assert.equal(expandStateCode("santa fe nm"), "santa fe New Mexico");
});

test("expandStateCode leaves non-state-code inputs unchanged", () => {
  assert.equal(expandStateCode("Phoenix"), "Phoenix");
  assert.equal(expandStateCode("Bayfield Colorado"), "Bayfield Colorado");
  assert.equal(expandStateCode("81122"), "81122");
  assert.equal(expandStateCode("Paris France"), "Paris France");
  assert.equal(expandStateCode(""), "");
  assert.equal(expandStateCode(null), "");
});
