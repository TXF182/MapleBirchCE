/*
 * 一键发布 v1.9.2：git credential token + REST Release（新 tag）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.2";
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
    name: "MapleBirchCE v1.9.2",
    body: [
      "**MapleBirchCE v1.9.2**（2026-10-23）",
      "",
      "**四模组适配跟进（枯木逢春 2.4.5 / 归途之书 1.3.11 / Dol-Optimization 1.1.2.1 / 框架 5.5.4）**",
      "- **枯木逢春 2.4.5 新增 12 个作弊项**：金币洞穴 CoinCave（cc_found 一键跳过岛屿探索 100 次入口门槛 / cc_appraised / cc_agreed 跳过归还对话；火把与四处金币 5 数值，全部归零即凑齐）+ 悉尼 NPC 转化三数值（天使点数 max50 满级6 / 堕天点数 max31 满分3 / 恶魔点数 max100，≥90 触发原版受孕强化判定）；",
      "- **归途之书 1.3.11 / Dol-Optimization 1.1.2.1**：纯修复版（src 0 增删 / 快速存档+处女膜冲突修复），版本声明同步；",
      "- **框架 5.5.4**：declOverride 同步（API 核对 8/10，缺失 2 项 CE 均不依赖）；",
      "- **精确性全量核查**：3 适配器 111 条 varPath 逐一在新版源码验证全部存活（新增 tools/_check_keys_mod.js）；角色名中文化修复唯一不一致 Needmeet→尼德米特（新增 tools/_check_char_names.py）。",
      "",
      "**DoL-Game-UI 冲突修复（滑动卡住截断 / 展开过多卡顿闪退）**",
      "- **根因**：Mod作弊子页一次性全量建数百行 + DoL-Game-UI 每帧 rAF 全量样式扫描抢主线程 → 移动 WebView 滚动丢帧、长任务 ANR；",
      "- **修复**：子页四分组默认收起 + 懒渲染（组头常驻、行闭包点击展开才建）、展开态持久化、新增「全部展开/全部收起」折叠工具行；`.mce-grp` 加 `contain:content`（限制组内重排/重绘扩散）、`.mce-body` 加 `overscroll-behavior:contain`；",
      "- **自查补充**：行构建失败可见提示（不再静默吞错）；补 values list 型端到端测试 M 段 8 断言（此前 C 段注释误标已覆盖，实际是盲区）。",
      "",
      "**测试**：DOM 冒烟全 PASS、全量回归 570+（含 45.x 懒渲染段 8 断言）全 PASS、功能 E2E（含 M 段 8 断言）全 PASS；zip 内 JS 与 build 产物 SHA 一致、verifier 4/4。",
      "",
      "版本线：v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
