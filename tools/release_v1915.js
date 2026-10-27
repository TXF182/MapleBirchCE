/*
 * 一键发布 v1.9.15：git credential token + REST Release（新 tag v1.9.15）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.15";
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
    name: "MapleBirchCE v1.9.15",
    body: [
      "**MapleBirchCE v1.9.15**（2026-10-28）",
      "",
      "**数值固定（Lock Values）+ UI 动效六项全量发布**",
      "",
      "**① 数值固定（新增 · 全局页新区块）**",
      "- 8 个预设推荐行 + 自由添加任意 varPath：锁定 / 更新目标 / 取消三态，输入框回车即提交；",
      "- 写回机制：锁定后每 1 秒强制写回目标值 + 锁定/更新时**立即生效**（不等 tick）；锁定表存存档 `V.mbCE_lock`，**读档自动恢复**；",
      "- 安全边界（深层自查）：当前值不存在时不凭空创建字段（不污染未触发的转化/未开的键）；路径空段（`a..b`）拒绝；定时器惰性——有锁定向才启动，无锁定向零空转；",
      "- 预设实证键：渡鸦 `maplebirch.transformation.raven.build`（未戴羽毛项链每日衰减）/ 马 / 鲸 / 亡灵 `undead.level`（锁 0 解除亡灵诅咒）/ 天使 `angel`（无三位一体成长点减少）/ 堕天使 `fallenangel`（每日纯洁流失）/ 恶魔 `demon` / 纯洁 `purity`（内部 0-2000）——直击社区痛点：渡鸦到值自动干亡灵、天使无三位一体总掉线、转化值想固定。",
      "",
      "**② UI 动效六项（v1.9.14 内容，随本版一并发布）**",
      "- 按压反馈：全部按钮 `:active` 缩放 scale(.96)（悬浮球 .94）+ 12ms 过渡；",
      "- 悬停微动效：金色按钮上浮 + 阴影，红色按钮变亮，悬浮球 hover/拖动态高亮；",
      "- 写入成功闪烁：Mod 作弊 / 快捷面板 / 地点档位（−1/+1/拉满/回退）操作成功 → 目标行金底 `mce-flash` 0.6s（连点不堆积；**失败不闪**——地点页失败分支修复）；",
      "- 折叠组展开淡入 0.2s（覆盖全部折叠组）；面板开合动画（打开 pop-in 0.15s / 关闭淡出 0.12s）；",
      "- 动画只用 transform/opacity/background/box-shadow，不碰布局属性（防 DoL-Game-UI 每帧 rAF 扫描叠加压力）。",
      "",
      "**③ 深层自查优化（数值固定）**",
      "- 锁定/更新即生效、Enter 提交、不存在的值不凭空创建、空段路径拒绝、惰性定时器不空转——三层测试全过（冒烟 3 + 回归 44.9 十二条 + E2E L 区块 9 条）。",
      "",
      "**测试与验证**",
      "- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E → 性别集成 24/24）+ verifier 4/4 + zip 正斜杠 4/4；codegraph sync 完成；",
      "- 产物 MapleBirchCE.mod.zip（206027 B）SHA256 `B6CB5CA3E60F0AA44633E618614E032204AC00C0EA1C71578E7AEA9086F13D90`，GitHub 资产 digest 回读一致。",
      "",
      "**致谢**：数值固定预设键依据枯木逢春（deadwood-reblooms）与 DoL 原版转化机制实证定位；本模组修改存档风险自负，与各模组作者无关。",
      "",
      "版本线：v1.9.15 → v1.9.14 → v1.9.13 → v1.9.12 → v1.9.11 → v1.9.10 → v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3 → v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
