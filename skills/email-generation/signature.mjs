/**
 * Ordered signature lines from a Business Profile object; empty/missing fields
 * dropped. Mirrors src/pipeline/stage-03-render/signature.js's buildSignatureLines
 * exactly -- same order, same drop-empty behavior -- with the parameter renamed
 * since the input is now a runtime Business Profile object, not bundled client
 * config.
 */
export function buildSignatureLines(profile) {
  const sig = profile.signature || {};
  return [profile.signingName, sig.title, sig.address, sig.phone, sig.website]
    .filter((v) => typeof v === "string" && v.trim() !== "");
}

export default buildSignatureLines;
