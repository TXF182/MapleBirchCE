/*
 * 一键发布 v1.8.22：git credential token + REST Release + Buffer 上传 zip + size 核对。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.8.22";
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
    name: "MapleBirchCE v1.8.22",
    body: [
      "**MapleBirchCE v1.8.22**（2026-10-21）",
      "",
      "**模组适配跟随上游更新**：枯木逢春 · Deadwood Reblooms **2.4.3**（渡鸦神社/月羽拆为独立 DarkfeatherShrine 模块，存档键不变；新增 ResidentBath/ParkBench/Robin·Savings 内容已甄别，作弊语义不足不纳入面板）、归途之书 · Revelation **1.3.9**、maplebirch 框架 declOverride **5.5.2**（核心 8 项 API 核对全过）。",
      "**适配检测 9 渠道全覆盖**：8 个适配模组 + 框架本体每日 21:15 自动检测；修复 DolSims 0.8.1.7 版本提取误报。",
      "**数值无上限**：体能/意志/意识/淫乱/暴露癖/异种癖 均可写至 999999（仅防误输入）；纯洁 0-2000；技能/性技能/成绩/武器 0-1000。",
      "**剧情重放修复**：播放结束自动清理重放状态并移除队列已用项（不再重复播放）；播放器内取消固定跳回原位，不再被困场景播放器。",
      "**角色译名**：Seath→希斯、Alice→爱丽丝、Liddell→利德尔（连同此前怨灵/艾利克斯/约旦/礼顿/伦恩/布莱尔等全套中文化）。",
      "**v1.8.22 自查收尾**：README 版本表同步（5.5.2/2.4.3/1.3.9/9 渠道）、条目文案去版本号依赖、两模组注册名（detect 探测键）在新版源码实证成立。",
      "",
      "版本线：v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
      "安装：游戏内 ModLoader → 添加旁加载Mod → 选 MapleBirchCE.mod.zip → 刷新页面；右下角金色圆形 CE 按钮打开面板。"
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
  console.log("Release 创建成功: id=" + rel.id + " tag=" + rel.tag_name + " url=" + rel.html_url);

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
