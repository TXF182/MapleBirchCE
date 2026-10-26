/*
 * 一键发布 v1.9.10：git credential token + REST Release（新 tag v1.9.10）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.10";
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
    name: "MapleBirchCE v1.9.10",
    body: [
      "**MapleBirchCE v1.9.10**（2026-10-26）",
      "",
      "**v1.9.10：猫舍 Cattery 第 9 适配器 + 枯木逢春 2.5.1 / 归途之书 1.4.1 适配 + 庄园维护全自动改造**",
      "",
      "**猫舍 Cattery v1.1.8.2 兼容适配（第 9 个适配器，repo `Maomaoi/Degrees-of-Lewdity-Cattery`）**",
      "- 9 阶段 + 39 数值、全数字通道（模组全部 `is 1`/`gte 1` 严格比较判定，禁 boolean）；探测 `window.createCafePC` 或 V 顶层键兜底；",
      "- 出租屋线 `rentingahouse`（每月 1 日交租、养宠减清洁）；养猫线 `pchaveCat` + **sync 联动**（写 1 自动补 `firstCat_variety=橘猫` + `catArr=[{name:咪咪,love:0,play:0}]` 防模组 catArr[0] 读取崩溃，ifMissing 幂等已有猫不重置）；",
      "- `cat_love/cat_play` = `catArr.0.love/play`（0-40，未领养时父级缺失拒绝写入防崩）；11 菜品计数 + 13 食材键；`birdFly` 飞行解锁 / 书房藏书 1-5 / `pcHome_clean` 0-40 / 门口后院 0-3 / 绘画 0-100；",
      "- **loveMax 联动修复**：模组「金牌饲养员」特质触发链 = love≥40 且 `firstCat_loveMax≠1` 时置 loveMax=1（Cathave_speciality widget 实证），CE 写好感 ≥40 自动补 `firstCat_loveMax=1`，特质直接成立；写低值不撤销（对齐模组仅电脑降级归 0）；",
      "- 本体包 `Cattery.mod.zip` 已装入 game（原包缺 `.mod` 后缀不会被 ModLoader 扫描，已改名就位）。",
      "",
      "**枯木逢春 2.5.1 / 归途之书 1.4.1 适配（每日更新检测检出）**",
      "- 枯木 `2.5.0→2.5.1`：文件级 diff 7 个文件，零 varPath 变更，仅升声明；audit 35 条 resolve KEEP + REVIEW 8 保留，REMOVE 0；",
      "- 归途 `v1.4.0→v1.4.1`：覆盖 55/57，零 varPath 变更，仅升声明；",
      "- 更新检测渠道新增第 10 渠道 cattery（pickAsset 补裸 .zip 兜底——该模组只发 .zip）。",
      "",
      "**庄园维护全自动改造**",
      "- 神殿技能判断路径修复：旧判 `V.skill.*`（原版 0 处，恒 false 根因）→ 顶层 `V.housekeeping/V.tending`（0-1000）；",
      "- 农场/补给/打扫对齐 AutoClean 0.1.5 实证语义（`farm_stock_init` stock 键映射、`temple_quarters/garden` 入 0/每日 -10/clamp 0-100、`$soap/$salve` Twee 顶层消耗键、艾弗里十房间全 `to 0`）；",
      "- 6 键 UI 改**自动开关**（自动维护/自动投喂）+ **每日全自动调度器**（localStorage `mbCE_auto` + `Time.days` 日锚，不写 V 不污染存档、新档不继承）；",
      "- 投喂修复：`avery_food_select` 移出最高难度菜谱分支、喂食后无条件刷新（艾弗里不再永远吃同一种菜）；开启当日 `lastDay` 去重防投喂双扣食材。",
      "",
      "**其他**",
      "- Cattery 45 键对照 cat1182 源码逐键实证全部存活；note 修正（pcHome_clean 30/35/40 实情）；测试补 47.5b 联动断言；",
      "- `tools/_modcache` 旧对照清理（dw250/rv140/v2.4.7/v1.3.13）+ tools 未跟踪残留清零；git 未跟踪归零；",
      "- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E 9 适配器 → 性别集成）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；SHA256 见资产核对。",
      "",
      "版本线：v1.9.10 → v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3 → v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
