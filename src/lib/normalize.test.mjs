import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCity, extractState, stateNameToCode } from "./normalize.js";

test("extractState pulls the 2-letter code before the zip", () => {
  assert.equal(extractState("311A Co Rd 501, Bayfield, CO 81122"), "CO");
  assert.equal(extractState("7144 E Stetson Dr C-200, Scottsdale, AZ 85251"), "AZ");
});

// Regression: a Denver batch lost city/state on records whose Maps listing carried
// no zip, no street line, or a spelled-out state. The old patterns required the
// full ", CITY, ST 12345" shape, so any of those three shapes yielded "".
test("extractState reads a state that is not followed by a zip", () => {
  assert.equal(extractState("123 Main St, Denver, CO"), "CO");
  assert.equal(extractState("Denver, CO"), "CO");
});

test("extractState reads a spelled-out state name", () => {
  assert.equal(extractState("4th Floor, 1600 Broadway, Denver, Colorado 80202"), "CO");
  assert.equal(extractState("Phoenix, Arizona"), "AZ");
});

test("extractState returns '' when there is no state at all", () => {
  assert.equal(extractState("1600 Broadway"), "");
  assert.equal(extractState(""), "");
  assert.equal(extractState(null), "");
});

test("extractCity pulls the segment before the state", () => {
  assert.equal(extractCity("123 Main St, Denver, CO 80216"), "Denver");
  assert.equal(extractCity("457 Mountain Village Blvd, Telluride, CO 81435"), "Telluride");
  assert.equal(
    extractCity("1660 Lincoln St Ste 1800, Denver, CO 80264, United States"),
    "Denver",
  );
});

test("extractCity handles listings with no zip", () => {
  assert.equal(extractCity("123 Main St, Denver, CO"), "Denver");
});

test("extractCity handles listings with no street line", () => {
  // The exact shape that cost the Denver batch a record: zip parsed fine, city did not.
  assert.equal(extractCity("Aurora, CO 80011"), "Aurora");
  assert.equal(extractCity("Denver, CO 80202"), "Denver");
  assert.equal(extractCity("Denver, CO"), "Denver");
});

test("extractCity handles a spelled-out state name", () => {
  assert.equal(extractCity("4th Floor, 1600 Broadway, Denver, Colorado 80202"), "Denver");
});

test("extractCity returns '' when there is no state to anchor on", () => {
  assert.equal(extractCity("1600 Broadway"), "");
  assert.equal(extractCity("Denver"), "");
  assert.equal(extractCity(""), "");
  assert.equal(extractCity(null), "");
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
