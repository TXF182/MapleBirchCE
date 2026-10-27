/*
 * 一键发布 v1.9.12：git credential token + REST Release（新 tag v1.9.12）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.12";
const ASSET = "MapleBirchCE.mod.zip";
const ZIP = path.join(__dirname, "..", "MapleBirchCE.mod.zip");
const LOCAL_SIZE = fs.statSync(ZIP).size;
const LOCAL_SHA = crypto.createHash("sha256").update(fs.readFileSync(ZIP)).digest("hex").toUpperCase();

(async () => {
  const cred = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8"
  });
  const m = cred.match(/password=(\S+)/);
  if (!m) { console.error("FAIL: git credential fill 无 token"); process.exit(1); }
  const token = m[1];
  const auth = { Authorization: "Bearer " + token, "User-Agent": "mce-release" };

  const body = {
    tag_name: TAG,
    name: "MapleBirchCE v1.9.12",
    body: [
      "**MapleBirchCE v1.9.12**（2026-10-26）",
      "",
      "**v1.9.12：全局页新增原版世界硬/软腐化数值调整**",
      "",
      "**世界腐化（原版 World Corruption）**",
      "- 全局页新增「世界腐化（原版 World Corruption）」区：世界硬腐化（V.world_corruption_hard）/ 世界软腐化（V.world_corruption_soft）两行，各自「当前值 + 数值输入 + 应用 + 回退」；",
      "- 写入通道复用地点页「阶段任务」的直写能力（placeStageWrite），绕过原版根键黑名单直写原版顶层键，全部留痕（place: 前缀）可回退——回退还原首次写入前状态，写入前无该字段时直接删除；",
      "- **上限不钳制**（对齐「直接填数值的别上限」口径）：hard 上限放开（原版宏 30 不生效）、soft 上限放开（原版宏 100 不生效）；下限按原版语义保留（hard ≥ -30、soft ≥ 0），防负值破坏存档；",
      "- 应用/回退**局部刷新行内值**，不重建整页、不丢滚动位置；",
      "- 自查优化：渲染 getV() 缓存一次（forEach 与留痕检查共用）；回退按钮 title 标注「还原到首次写入前状态」；DOM 冒烟补世界腐化区 + 初始值（hard=2 / soft=0）断言；E2E 断言写法规范化。",
      "",
      "**测试与验证**",
      "- 回归 §48 新增 15 条（直写绕过黑名单+留痕 → 上限不钳制 hard=50/soft=150 → 下限钳制 hard=-40→-30/soft=-5→0 → 既有值回退还原+清留痕 → 无字段回退删字段）；",
      "- 功能 E2E W 区块 11 条（区块渲染、两行 data-wckey、输入框+应用、应用→写入+留痕+回退按钮、回退还原 2+清留痕、软腐化 -5 钳 0）；",
      "- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E 9 适配器 → 性别集成）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；SHA256 见资产核对。",
      "",
      "版本线：v1.9.12 → v1.9.11 → v1.9.10 → v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3 → v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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

  console.log("本地 zip: " + LOCAL_SIZE + " B  sha256=" + LOCAL_SHA);
  console.log("远端 asset: " + asset.size + " B  name=" + asset.name + "  id=" + asset.id);
  if (asset.size !== LOCAL_SIZE) {
    console.error("FAIL: size 不一致（" + LOCAL_SIZE + " vs " + asset.size + "）");
    process.exit(1);
  }
  console.log("SIZE_MATCH=1");

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
