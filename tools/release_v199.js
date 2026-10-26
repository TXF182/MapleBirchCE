/*
 * 一键发布 v1.9.9：git credential token + REST Release（新 tag）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 * 本次 Release 涵盖 v1.9.8 + v1.9.9（两者此前均未发布，上次发布为 v1.9.7）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.9";
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
    name: "MapleBirchCE v1.9.9",
    body: [
      "**MapleBirchCE v1.9.9**（2026-10-26）",
      "",
      "**v1.9.9：枯木逢春 2.5.0 说明页内容补全作弊项 + 月羽译名更正 + 发布前全面自查**",
      "",
      "**新增作弊项（对照 dw250 源码逐一实证）**",
      "- **心智系统**：`Psyche.sanity`（理智 -500~1000 初始 1000）与 `Psyche.fear`（恐惧 0~1000 初始 0）——8 档状态（混乱/迷乱/心乱/恍惚/动摇/安定/清醒/专注）与学习收益（60%~120%）由理智自动结算；",
      "- **PC 动物转化**：马/鲸/渡鸦三个转化点数键（`maplebirch.transformation.horse/whale/raven.build` 0-100）——各六阶段、build≥1 停止衰减、写 100 直达满级；",
      "- **黯羽神社线**：`MoreTransformations.shrine.stage`（0 未开始/1 已收信/2 已获指路与鸦羽项链/3 已到访认识月羽）+ 喂鸦次数键；**sync 联动补足**：写 1+ 自动补喂鸦 3 次 + 已遇见渡鸦 `raven.met`（模组收信前置=feeds≥3 且 raven.met），写 3 自动补月羽已认识 `init=1`；喂鸦键写 1+ 同样补已遇见；",
      "- **月羽（Tsukihan）**：好感/任性（Wilfulness）/欲望数值键 + 已认识（init）键 + 恋人列表键（`loveInterestList`）——小屋门禁=神社线完成+已认识+NPC 活跃，好感档位作用于互动（≥20 亲密 / ≥30 受邀 / ≥50 独处）；",
      "- **果园计数**：`Orchard.orders_completed/contracts_completed/sales_income/regular_visits` 4 键；",
      "- **译名更正**：`tsukihan` 月半 → 月羽（枯木 2.5.0 官方中文名）。",
      "",
      "**v1.9.8：枯木逢春 2.5.0 / 归途之书 1.4.0 适配 + 便利店「遇欲」补全 + 面板按钮合并**",
      "- **枯木 2.5.0**（对照 dw250）：投资键重构——`investment.share/.valuation` 删除，`invested_total/returned_total/dividends_total` 改指 `contributed/returned/dividends`，新增 `treasury` 周转金；`r_invest_agreed` 联动四门店开启；枯木数值 41→40；",
      "- **归途之书 v1.4.0**（对照 rv140）：56 键 55 存活 + 1 动态键零删，仅升声明；",
      "- **便利店「遇欲」补全（Dol-Optimization）**：`opt_needmeet` 显示名改「遇欲（Needmeet）· 好感」；新增 12 个便利店库存键（`daily.conveniencestoregoods.中文键` 0-99，柜台/货架/外摆，首次需进店初始化）；",
      "- **面板按钮合并**：右上角「收起」「关闭」行为一致，删除「收起」只留「关闭」。",
      "",
      "**发布前全面自查**",
      "- v1.9.8~1.9.9 全部键对照 dw250/opt1121/rv140 源码逐一核验存活与判定（心智档位/月羽配置/转化衰减/果园计数/便利店库存与商品名/遇欲恋爱线/投资四店联动/归途 55 键）；",
      "- 修复神社线阶段联动缺口（raven.met 补全）与 3 处说明文案精确化；测试补 3 条联动断言；",
      "- 全链 6 步全绿（build → syntax → smoke → regression → E2E → 性别集成）；zip 条目正斜杠 4/4、verifier 4/4；SHA256 见资产核对。",
      "",
      "版本线：v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3（性别切换盲区修复）→ v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
