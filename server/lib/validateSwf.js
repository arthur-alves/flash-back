// A real Flash file (.swf) always starts with one of these 3-byte signatures:
//   "FWS" - uncompressed
//   "CWS" - zlib compressed
//   "ZWS" - LZMA compressed
// Checking the extension/mimetype alone is not enough since both are
// client-supplied and trivially spoofable.
const SWF_SIGNATURES = ["FWS", "CWS", "ZWS"];

function isValidSwf(buffer) {
  if (!buffer || buffer.length < 8) return false;
  const signature = buffer.toString("ascii", 0, 3);
  return SWF_SIGNATURES.includes(signature);
}

module.exports = { isValidSwf };
