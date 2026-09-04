// Downloads the latest Ruffle "web-selfhosted" build into public/ruffle/
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const RUFFLE_DIR = path.join(__dirname, "..", "..", "public", "ruffle");

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "flashback" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpGetJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GET ${url} -> ${res.statusCode}`));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { "User-Agent": "flashback" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return resolve(downloadFile(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`GET ${url} -> ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching latest Ruffle release info...");
  const release = await httpGetJson("https://api.github.com/repos/ruffle-rs/ruffle/releases/latest");
  const asset = release.assets.find((a) => a.name.endsWith("-web-selfhosted.zip"));

  if (!asset) {
    throw new Error("Could not find web-selfhosted asset in latest Ruffle release.");
  }

  console.log(`Found ${asset.name} (${release.tag_name}).`);

  fs.mkdirSync(RUFFLE_DIR, { recursive: true });
  const zipPath = path.join(RUFFLE_DIR, "ruffle.zip");

  console.log("Downloading...");
  await downloadFile(asset.browser_download_url, zipPath);

  console.log("Extracting...");
  execFileSync("unzip", ["-o", zipPath, "-d", RUFFLE_DIR]);
  fs.unlinkSync(zipPath);

  fs.writeFileSync(
    path.join(RUFFLE_DIR, "VERSION"),
    `${release.tag_name}\n`
  );

  console.log(`Ruffle ${release.tag_name} installed at ${RUFFLE_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
