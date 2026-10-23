/*
 * 一键发布 v1.9.1：git credential token + REST Release（新 tag）+ Buffer 上传 zip + size 核对 + 下载回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；发布后下载比对 SHA256。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.1";
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

  // 2) 查找或创建 Release（v1.9.1 应不存在 → POST 创建）
  const body = {
    tag_name: TAG,
    name: "MapleBirchCE v1.9.1",
    body: [
      "**MapleBirchCE v1.9.1**（2026-10-23）",
      "",
      "**新功能 · 玩家自己页「性别切换」（男 / 女 / 双性）**：一键切换当前性别，按钮高亮 ✓。",
      "**新功能 · 资金无上限**：快捷编辑区「资金」上限 1,000,000 → 99,999,999（仅防误输入，实际无上限）。",
      "",
      "**性别切换的细节（原版权威键实证 0.5.12.13）**：玩家性别实际是 **7 键**体系——`sex`（生殖器性别权威键，\"m\"/\"f\"/\"h\"=herm）/ `gender`（社会性别）/ `gender_body` / `penisExist` / `vaginaExist` / `penissize`（0-6）/ `ballsExist`。三态对齐新游戏预设：男（gender=m/gender_body=m/sex=m/ballsExist=false）、女（gender=f/gender_body=f/sex=f/ballsExist=false）、双性（gender=h/gender_body=a/sex=h/ballsExist=true）。`getPlayerGender` 优先读 sex 推断；gender_appearance 交引擎 genderappearancecheck 自动重算，不手写。",
      "**自查修复（同版本）**：首版只写 4 键遗漏 sex/gender/ballsExist——修复前切女后原版服装仍按男分型、战斗性器官显示 herm（应为 parasite）、误判 crossdressing；现补全 7 键对齐原版判定。",
      "",
      "**测试**：① 数据层 37.4 十二断言（三态七键 / 推断 / 幂等 / 缺壳兜底 / 未知性别 FAIL）② 功能 E2E D5 八断言（点击级）③ **新增集成测试 integration_gender 二十一断言**——不用 mock，运行时从原版 Degrees of Lewdity.html 抽取真实判定函数（isGenitalMismatch / isCrossdressing / isHermOrCrossdresser / 服装分型 / 战斗性器官分型），注入构建产物直接断言原版行为；含回归护栏（模拟旧四键实现 → 原版服装仍 male、性器官显示 herm，实证修复必要性）。④ 资金上限经 PANEL_QUICK_GROUPS 数据表核对。全链 build→syntax→smoke→regression→E2E 4/4 绿 + integration 21/21。",
      "**资金说明**：money 上限放开仅为防误输入护栏，`cheatWriteValue` 对非 number max 不钳制，实际可写任意大额。",
      "",
      "版本线：v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
  console.log("远端 asset: " + asset.size + " B  name=" + asset.name + "  download_url=" + asset.browser_download_url);
  if (asset.size !== LOCAL_SIZE) {
    console.error("FAIL: size 不一致（" + LOCAL_SIZE + " vs " + asset.size + "）");
    process.exit(1);
  }
  console.log("SIZE_MATCH=1");

  // 5) 下载回读比对 SHA256（常规通道；github.com 若被断则走 API assets 端点）
  const dlUrl = "https://github.com/" + REPO + "/releases/download/" + TAG + "/" + ASSET;
  const dl = await fetch(dlUrl);
  if (!dl.ok) { console.error("FAIL: 下载回读 " + dl.status + "（可改 API assets 端点比对）"); process.exit(1); }
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  const dlSha = crypto.createHash("sha256").update(dlBuf).digest("hex").toUpperCase();
  console.log("下载回读: " + dlBuf.length + " B  sha256=" + dlSha);
  if (dlSha !== LOCAL_SHA) {
    console.error("FAIL: SHA 不一致（本地 " + LOCAL_SHA + " vs 远端 " + dlSha + "）");
    process.exit(1);
  }
  console.log("SHA_MATCH=1  RELEASE_DONE");
})().catch((e) => { console.error("FAIL: " + (e && e.message || e)); process.exit(1); });
