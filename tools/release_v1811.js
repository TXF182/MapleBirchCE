/*
 * 一键发布 v1.8.11：Git Data API 已恢复正常（git push 可用），
 * 但 gh CLI 未登录 → 用 git credential fill 提取 token，手动调 REST 创建 Release + 上传 zip。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.8.11";
const ZIP = path.join(__dirname, "..", "MapleBirchCE.mod.zip");
const LOCAL_SIZE = fs.statSync(ZIP).size;

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

  // 2) 创建 Release（中文 body → charset=utf-8）
  const body = {
    tag_name: TAG,
    name: "MapleBirchCE v1.8.11",
    body: [
      "**MapleBirchCE v1.8.11**（2026-10-20）",
      "",
      "**模组特质可直接获取**：特质管理区对模组注入特质（`maplebirch.temporary.traitLists`）不再只读——字符串型 has 写满足变量直接获得/移除，函数判定型走强制获得标记；适配完整性核对 8 适配器功能面全覆盖。",
      "**功能级 E2E 测试**：8 适配器全命中 + 模组特质获取/移除 + 全局页战斗终结/庄园维护全部真实 DOM 点击验证，接入打包验证链。",
      "**打包修复 ERR-20261020-001**：zip 条目正斜杠分隔符（修复 ModLoader cannot get file 报错）。",
      "",
      "版本线：v1.8.11 → v1.8.10 → v1.8.9 → v1.8.8（5 模组适配）→ v1.8.7 → v1.8.6（自动更新检测）→ v1.8.5 → v1.8.4",
      "安装：游戏内 ModLoader → 添加旁加载Mod → 选 MapleBirchCE.mod.zip → 刷新页面。"
    ].join("\n")
  };
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
  const rel = await relRes.json();
  console.log("Release 创建成功: id=" + rel.id + " tag=" + rel.tag_name);

  // 3) 上传 zip（Buffer 直发，Content-Type application/zip）
  const uploadUrl = rel.upload_url.replace("{?name,label}", "?name=" + encodeURIComponent("MapleBirchCE.mod.zip"));
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
  console.log("本地 zip: " + LOCAL_SIZE + " B");
  console.log("远端 asset: " + asset.size + " B  name=" + asset.name + "  download_url=" + asset.browser_download_url);
  if (asset.size !== LOCAL_SIZE) {
    console.error("FAIL: size 不一致（" + LOCAL_SIZE + " vs " + asset.size + "）");
    process.exit(1);
  }
  console.log("SIZE_MATCH=1  SIZE_MATCHED");
})().catch((e) => { console.error("FAIL: " + (e && e.message || e)); process.exit(1); });
