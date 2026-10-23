/*
 * 一键发布 v1.9.4：git credential token + REST Release（新 tag）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.4";
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
    name: "MapleBirchCE v1.9.4",
    body: [
      "**MapleBirchCE v1.9.4**（2026-10-24）",
      "",
      "**剧情页重构：按角色/地点所属收起 + 懒渲染（不再整屏平铺）**",
      "- **角色/地点分组默认收起**：原版区 16 个角色/地点组（亚历克斯/伊甸/哈珀/艾弗里/罗宾/惠特尼/凯拉尔/黑狼/神殿/监狱/学校/成人店/厨师/米奇/噩梦梦境/其他）+ MOD 区全部默认收起只建组标题「▸ 名称（N 场景）」，点击展开才懒渲染该组场景与剧情进度块——长列表不再整屏平铺；",
      "- **折叠状态持久化 + 滚动保持**：展开/收起状态持久化到 `mbCEUiState.collapsed`（「剧情:<组名>」键），固定触发/回退/一键完成/切 tab 重建后展开的组保持展开、懒渲染内容仍在；`renderScenes()` 重建后恢复滚动位置，不再跳回顶部；",
      "- **剧情进度块汉化 + 剧情归属标注**：凯拉尔组行名汉化（爱意/被侵犯/谜题/成名阶段）；「已看剧情标记补全」8 个英文标记全部汉化并标注归属剧情（悉尼写作·悉尼线 / 表白·主线 / 突击队·绑架线 / 冬季喷泉·冬季 / 喷泉初遇·初遇 / 聊天初遇·初遇 / 食堂·校园 / 地下室·绑架）；",
      "- **独立场景标题乱码修复**：`[object HTMLSpanElement]` 显示 bug（el() 第三参数误传 element），改为两段 appendChild；",
      "",
      "**模组角色分区细化 + 剧情页原版/MOD 分区（任务三收口）**",
      "- 模组角色页分区内再细分「恋爱角色 / 普通角色」两子组（按钮展开收起）；",
      "- 剧情页原版剧情（游戏本体注册）与 MOD 剧情（第三方模组注册）分区展示，模组剧情明确归 MOD 区；",
      "- 剧情缺口按角色清单核对补录（按角色分类收纳）。",
      "",
      "**测试**：DOM 冒烟 176 PASS/0 FAIL（新增折叠持久化/懒渲染/汉化断言）、全量回归 570+、功能 E2E、性别集成 24 项全 PASS；zip 内 JS 与 build 产物 SHA 一致、verifier 4/4。",
      "",
      "版本线：v1.9.4 → v1.9.3（性别切换盲区修复）→ v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
