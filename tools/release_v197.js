/*
 * 一键发布 v1.9.7：git credential token + REST Release（新 tag）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.7";
const ASSET = "MapleBirchCE.mod.zip";
const ZIP = path.join(__dirname, "..", "MapleBirchCE.mod.zip");
const LOCAL_SIZE = fs.statSync(ZIP).size;
const LOCAL_SHA = crypto.createHash("sha256").update(fs.readFileSync(ZIP)).digest("hex").toUpperCase();

(async () => {
  // 1) token（内存使用，不落盘）
  const cred = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8"
  });
  const m = cred.match(/password=(\S+)/);
  if (!m) { console.error("FAIL: git credential fill 无 token"); process.exit(1); }
  const token = m[1];
  const auth = { Authorization: "Bearer " + token, "User-Agent": "mce-release" };

  // 2) 查找或创建 Release
  const body = {
    tag_name: TAG,
    name: "MapleBirchCE v1.9.7",
    body: [
      "**MapleBirchCE v1.9.7**（2026-10-25）",
      "",
      "**1.9.6 发布后治理收尾：源码工程化（04/06 拆分）+ 适配器版本声明同步 + 框架 5.5.6 升级 + 对照源码清理**",
      "",
      "**源码工程化**",
      "- **按主题边界拆分两个超长源码文件**（可维护性整改，产物零变化）：`04-modcheat.js`（869 行）→ `04a-modcheat-adapters.js`（适配器数据 650 行）/ `04b-modcheat-write.js`（写入执行器 157 行）/ `04c-modcheat-util.js`（审计工具 53 行）；`06-traits.js`（994 行）→ `06a-traits-data.js` / `06b-traits-eval.js` / `06c-traits-ui.js` / `06d-traits-gender.js`；src 由 17 段增至 22 段；",
      "- **零变化实证**：拼接产物 SHA 与拆分前字节级一致（`ce47e3aa…`，444,192 B）；六工具（audit_adapters / check_mod_updates / resolve_missing / scan_mod_vars / _check_keys_mod / _check_char_names）适配器源码路径全部改指 `04a-modcheat-adapters.js`，已实跑验证；",
      "- **验证链完善**：`tools/run_all.ps1` 步骤编号 `[1/6]-[6/6]` 全程显示、全绿后自动 `codegraph sync`；pre-commit 文案同步；UI 非热路径加载后置。",
      "",
      "**治理收尾**",
      "- **适配器版本声明同步**：枯木逢春 `2.4.6 → 2.4.7`、归途之书 `v1.3.12 → v1.3.13`（与已装 game 官方包对齐）；更新检测 UPDATES 3 → 1；",
      "- **对照源码同步 + 清理**：枯木 `dw246 → dw247`（604 文件）、归途 `rv1312 → rv1313`（89 文件）；`_check_keys_mod.js` 全量核查：枯木 117 条 varPath、归途 57 条**全部存活**；框架对照 `fw555mod → fw556`；删除被取代的旧对照（fw555mod/dw246/rv1312 等）；",
      "- **框架 5.5.6 升级**：`check_framework_api.js` 核对 inject_early.js 核心 8 项全过 → 判兼容；game 框架包 v5.5.0 → v5.5.6 替换（旧包备份可回滚）；",
      "- **更新检测复核**：9 渠道全无更新（枯木 2.4.7 / 归途 1.3.13 / 框架 5.5.6 全部对齐）。",
      "",
      "**验证**：全链 6 步全绿（build → syntax → smoke → regression → E2E → 性别集成），回归 ALL PASSED；zip 条目正斜杠 4/4、verifier 4/4；SHA256 见资产核对。",
      "",
      "版本线：v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3（性别切换盲区修复）→ v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
      "安装：游戏内 ModLoader → 添加旁加载Mod → 选 MapleBirchCE.mod.zip → 刷新页面；右下角金色圆形 CE 按钮打开面板。"
    ].join("\n")
  };
  let rel;
  const getRes = await fetch("https://api.github.com/repos/" + REPO + "/releases/tags/" + TAG, { headers: auth });
  if (getRes.ok) {
    rel = await getRes.json();
    console.log("Release 已存在: id=" + rel.id + " tag=" + rel.tag_name);
    const patchRes = await fetch("https://api.github.com/repos/" + REPO + "/releases/" + rel.id, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, auth),
      body: JSON.stringify({ body: body.body })
    });
    if (!patchRes.ok) { const e = await patchRes.text(); console.error("FAIL: PATCH 发布说明 " + patchRes.status + " " + e.slice(0, 500)); process.exit(1); }
    rel = await patchRes.json();
    console.log("发布说明已更新");
    for (const a of rel.assets || []) {
      if (a.name === ASSET) {
        const delRes = await fetch("https://api.github.com/repos/" + REPO + "/releases/assets/" + a.id, { method: "DELETE", headers: auth });
        if (!delRes.ok && delRes.status !== 404) { console.error("FAIL: 删除旧资产 " + delRes.status); process.exit(1); }
        console.log("旧资产已删: id=" + a.id + " size=" + a.size);
      }
    }
  } else if (getRes.status === 404) {
    console.log("Release 不存在，创建新 Release");
    const relRes = await fetch("https://api.github.com/repos/" + REPO + "/releases", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, auth),
      body: JSON.stringify(body)
    });
    if (!relRes.ok) {
      const err = await relRes.text();
      console.error("FAIL: 创建 Release " + relRes.status + " " + err.slice(0, 500));
      process.exit(1);
    }
    rel = await relRes.json();
    console.log("Release 创建成功: id=" + rel.id + " tag=" + rel.tag_name + " url=" + rel.html_url);
  } else {
    console.error("FAIL: GET release " + getRes.status);
    process.exit(1);
  }

  // 3) 上传 zip（Buffer 直发，Content-Type application/zip）
  const uploadUrl = rel.upload_url.replace("{?name,label}", "?name=" + encodeURIComponent(ASSET));
  const buf = fs.readFileSync(ZIP);
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/zip", "Content-Length": String(buf.length) }, auth),
    body: buf
  });
  if (!upRes.ok) {
    const err = await upRes.text();
    console.error("FAIL: 上传资产 " + upRes.status + " " + err.slice(0, 500));
    process.exit(1);
  }
  const asset = await upRes.json();

  // 4) 核对 size
  console.log("本地 zip: " + LOCAL_SIZE + " B  sha256=" + LOCAL_SHA);
  console.log("远端 asset: " + asset.size + " B  name=" + asset.name + "  id=" + asset.id);
  if (asset.size !== LOCAL_SIZE) {
    console.error("FAIL: size 不一致（" + LOCAL_SIZE + " vs " + asset.size + "）");
    process.exit(1);
  }
  console.log("SIZE_MATCH=1");

  // 5) 下载回读比对 SHA256（github.com:443 被断 → 走 API assets 端点，Accept: application/octet-stream）
  const dlUrl = "https://api.github.com/repos/" + REPO + "/releases/assets/" + asset.id;
  const dl = await fetch(dlUrl, { headers: Object.assign({ "Accept": "application/octet-stream" }, auth) });
  if (!dl.ok) { console.error("FAIL: API 回读 " + dl.status); process.exit(1); }
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  const dlSha = crypto.createHash("sha256").update(dlBuf).digest("hex").toUpperCase();
  console.log("API 回读: " + dlBuf.length + " B  sha256=" + dlSha);
  if (dlSha !== LOCAL_SHA) {
    console.error("FAIL: SHA 不一致（本地 " + LOCAL_SHA + " vs 远端 " + dlSha + "）");
    process.exit(1);
  }
  console.log("SHA_MATCH=1  RELEASE_DONE");
})().catch((e) => { console.error("FAIL: " + (e && e.message || e)); process.exit(1); });
