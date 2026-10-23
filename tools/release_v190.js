/*
 * 一键发布 v1.9.0：git credential token + REST Release + Buffer 上传 zip + size 核对。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.0";
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
    name: "MapleBirchCE v1.9.0",
    body: [
      "**MapleBirchCE v1.9.0**（2026-10-22）",
      "",
      "**新功能 · 角色页按类型拆 4 个子页面（按钮展开/收起）**：模组角色 / 恋爱角色 / 普通角色 / 持久NPC 各一组，默认收起，点击标题展开；折叠状态持久化（localStorage）。",
      "**新功能 · 持久 NPC 入角色页**：经理（随机名显示「经理（XXX）」）、校医、黑客·米奇、主教、守卫/囚犯/坐骑族（saddled_steed / anxious_guard 等变体键显示族中文名）等原版 allowed_npcs 注册角色——存档已生成才枚举，支持数值卡（爱意/支配/情欲/警戒）读写。",
      "**新功能 · 场景页新增「地点」子界面**：双层页签「场景直达 / 地点」，地点页为原版地点阶段任务作弊区——市政改造（town_projects 道路/潜水/灌木/桥梁/绿地 0-5）、农场（farm_stage 0-12）、公寓/商店/阁楼/妓院、修道院/精神病院/学校机构阶段，全部「−1/+1/拉满/回退」逐步推进，全部留痕可回退。",
      "**自查修复（两轮，未升版本）**：① 地点写入留痕语义 bug——建壳字段多次写入后回退本应删除字段，修复前残留上次值；② cheatWriteValue/cheatWriteListValue 同源留痕 bug 一并修复（traitWriteValue 通道同受益）；③ 持久 NPC 变体键不再裸显英文键名；④ 角色页/地点页重建后保持滚动位置；⑤ 旧测试 18.8 断言原依赖 bug 行为已按正确语义修正。",
      "**测试**：全量回归 44.1-44.8 全 PASS（含留痕语义、placesTab 持久化恢复、变体中文名、空档不枚举 per_npc）；jsdom 层 DOM 冒烟全 PASS（角色页折叠/场景页双层页签真实 DOM 语义）；功能 E2E 全 PASS；17 个源码文件全量精读。",
      "**数值无上限**：体能/意志/意识/淫乱/暴露癖/异种癖 均可写至 999999（仅防误输入）；纯洁 0-2000；技能/性技能/成绩/武器 0-1000。",
      "",
      "版本线：v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
