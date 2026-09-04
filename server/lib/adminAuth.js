const crypto = require("crypto");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");

if (!process.env.ADMIN_PASSWORD) {
  console.log("");
  console.log("========================================");
  console.log(" Admin panel credentials (not set via ADMIN_PASSWORD env var):");
  console.log(`   user:     ${ADMIN_USER}`);
  console.log(`   password: ${ADMIN_PASSWORD}`);
  console.log(" This password is regenerated every restart unless you set");
  console.log(" ADMIN_USER / ADMIN_PASSWORD explicitly.");
  console.log("========================================");
  console.log("");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    if (timingSafeEqual(user, ADMIN_USER) && timingSafeEqual(password, ADMIN_PASSWORD)) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Flash Games Server Admin"');
  res.status(401).send("Authentication required.");
}

module.exports = { requireAdminAuth };
