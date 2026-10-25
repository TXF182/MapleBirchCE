/*
 * 一键发布 v1.9.6：git credential token + REST Release（新 tag）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.6";
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
    name: "MapleBirchCE v1.9.6",
    body: [
      "**MapleBirchCE v1.9.6**（2026-10-25）",
      "",
      "**枯木逢春 2.4.6 作弊项全补 + 联动写入机制 + 新键能力核查**",
      "- **补 20 项作弊（首批）**：原版增强六属性突破特质×7 → `VanillaPlus.traits.*`；三位一体前置三接触 + 本体 → `divineTransformations.*`；诡异镜子×6（孤儿院/农场/高塔/神殿/西里斯/凯拉尔）→ `deviancy.mirrors.*`；健身房会员阶段（无/周/月/年/终身）→ `LifeSimulation.gym.membership`；赌场疑心值（0–100）→ `LifeSimulation.casino.suspicion`；医务待审标记 → `LifeSimulation.medicine.review.pending`；城镇堕落不加（DoLSims `ds_corruption` 已覆盖同键）；",
      "- **新增联动写入机制（applyCheatSync，clear/set/copyMax 三型）**：写着装规范强制裸体自动清待审批申请、同步最高政策（只升不降）、清零试行期——修复实测「已强制裸体但公告栏仍等待礼顿决定」；写健身房会员自动补十年期 `expires_at`——修复 onDay 结算当天失效盲区；",
      "- **适配器全量自查 +43 键**：原版增强+7（属性锁定×6 + 驱除已用）、罗宾+11（投资线 6 / 店铺设施 4 / 房租分担 3）、金融+13（银行/券商/公司/订单/孤儿院双买断）、交通+5（头盔/工具/零件）、街道+2（劫案阶段/悬赏数）；跳过复杂对象（持仓/股价/房产/车辆/每日标记/天文排期种子）；",
      "- **新键能力核查 + 联动补足（43 键写入=读回全正常）**：对照 2.4.6 源码补 4 处「写了不生效」联动——借记卡/信用卡勾选自动开户（模组 `if (!bank.opened) return 'bank-required'`）、存款余额自动开户+借记卡（可用资金判定依赖 opened&&debit_card）、投资协议勾选缺省补 10% 股份（不覆盖已有值）、自租联动分开租房（对齐模组自身语义）；自足键确认：孤儿院双买断/四项成就/银行档位/属性锁定×6/驱除标记/容貌加成/花摊爆米花气球；不自动补（note 已明示）：劫案阶段建议逐步写、交通头盔/工具/零件需已有对应车辆；",
      "- **测试**：§32.6（18 键+着装联动+会员十年期）+ §32.7（11 声明收录+9 条写入生效抽样）+ §32.7.3（6 条联动断言：借记卡/信用卡/余额/股份不覆盖/股份补 10%/自租）；21.1 分组断言版本无关化（阶段≥10/能力≥35/数值≥29）；README 适配器表 阶段 12 / 能力 64 / 数值 41；",
      "",
      "**验证**：全链 6 步全绿（build → syntax → smoke → regression → E2E → 性别集成），回归 ALL PASSED；zip 条目正斜杠 4/4、verifier 4/4；复核重打包后 README 同步进 zip；SHA256 见资产核对。",
      "",
      "版本线：v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3（性别切换盲区修复）→ v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
