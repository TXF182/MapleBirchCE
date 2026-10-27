const { execFileSync } = require("child_process");
const cred = execFileSync("git", ["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n", encoding: "utf8", cwd: __dirname });
const t = cred.match(/^password=(.+)$/m)[1].trim();
fetch("https://api.github.com/repos/TXF182/MapleBirchCE/releases/tags/v1.9.12", {
  headers: { Authorization: "Bearer " + t, "User-Agent": "mce-check" }
}).then(r => r.json()).then(j => {
  console.log("id=" + j.id + " tag=" + j.tag_name + " name=" + j.name);
  console.log("url=" + j.html_url);
  for (const a of (j.assets || [])) {
    console.log("asset: " + a.name + " size=" + a.size + " id=" + a.id + " digest=" + (a.digest || "n/a"));
  }
  const ref = j.target_commitish || "";
  console.log("target_commitish=" + ref);
}).catch(e => { console.error("FAIL: " + e.message); process.exit(1); });
