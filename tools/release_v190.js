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

  // 2) 查找或创建 Release（v1.9.0 tag 已占用 → 更新资产路径：PATCH 说明 + 删旧 zip + 重传）
  const body = {
    tag_name: TAG,
    name: "MapleBirchCE v1.9.0",
    body: [
      "**MapleBirchCE v1.9.0**（2026-10-22）",
      "",
      "**新功能 · 角色页按类型拆 4 个子页面（按钮展开/收起）**：模组角色 / 恋爱角色 / 普通角色 / 持久NPC 各一组，默认收起，点击标题展开；折叠状态持久化（localStorage）。",
      "**新功能 · 持久 NPC 入角色页**：经理（随机名显示「经理（XXX）」）、校医、黑客·米奇、主教、守卫/囚犯/坐骑族（saddled_steed / anxious_guard 等变体键显示族中文名）等原版 allowed_npcs 注册角色——存档已生成才枚举，支持数值卡（爱意/支配/情欲/警戒）读写。",
      "**新功能 · 场景页新增「地点」子界面**：双层页签「场景直达 / 地点」，地点页为原版地点阶段任务作弊区——市政改造（town_projects 道路/潜水/灌木/桥梁/绿地 0-5）、农场（farm_stage 0-12）、公寓/商店/阁楼/妓院、修道院/精神病院/学校机构阶段，全部「−1/+1/拉满/回退」逐步推进，全部留痕可回退。",
      "**自查修复（五轮，未升版本）**：① 地点写入留痕语义 bug——建壳字段多次写入后回退本应删除字段，修复前残留上次值；② cheatWriteValue/cheatWriteListValue 同源留痕 bug 一并修复（traitWriteValue 通道同受益）；③ 持久 NPC 变体键不再裸显英文键名；④ 角色页/地点页重建后保持滚动位置；⑤ 角色页收起组懒渲染（收起不建卡片 DOM、展开补建、防重复）；⑥ 模组特质数值可改控件（字符串 has 的模组特质行出现「改数值/回退」按钮）；⑦ 修复 gt（严格大于）条件特质「获取后判定未获得」——traitWriteSatisfy 对 gt 与 gte/is 共用写 num 分支导致 `x > num` 恒 false（原版受影响：Purity Boost `$featsPurityBoost gt 0`、Bratty `$submissive lte 850 and gt 500`），改为 gt 写 num+1 满足严格大于；⑧ gt 条件「改数值」默认值与其满足值不一致——values 对 gt 生成 num（gt 0 → 0），与 satisfy 的 num+1 语义矛盾（输入框默认 0 直接点「改数值」写 0 恒不满足），统一为 num+1。",
      "**测试**：全量回归 44.1-44.8 全 PASS（含留痕语义、placesTab 持久化恢复、变体中文名、空档不枚举 per_npc、37.3c 模组特质 values 写入/undo、37.3d gt 条件获取判定）；jsdom 层 DOM 冒烟全 PASS（角色页折叠/场景页双层页签真实 DOM 语义/懒渲染补建）；功能 E2E 全 PASS（D3 模组特质行改数值、D4 gt 特质获取/改数值默认值=满足值/移除 点击级断言）；17 个源码文件全量精读；全链 build→syntax→smoke→regression→E2E 5/5 绿。",
      "**数值无上限**：体能/意志/意识/淫乱/暴露癖/异种癖 均可写至 999999（仅防误输入）；纯洁 0-2000；技能/性技能/成绩/武器 0-1000。",
      "",
      "版本线：v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
      if (a.name === "MapleBirchCE.mod.zip") {
        const delRes = await fetch("https://api.github.com/repos/" + REPO + "/releases/assets/" + a.id, { method: "DELETE", headers: auth });
        if (!delRes.ok && delRes.status !== 404) { console.error("FAIL: 删除旧资产 " + delRes.status); process.exit(1); }
        console.log("旧资产已删: id=" + a.id + " size=" + a.size + " sha=" + (a.sha256 || "-"));
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
