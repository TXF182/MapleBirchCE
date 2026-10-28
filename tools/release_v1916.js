/*
 * 一键发布 v1.9.16：git credential token + REST Release（新 tag v1.9.16）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.16";
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
    name: "MapleBirchCE v1.9.16",
    body: [
      "**MapleBirchCE v1.9.16**（2026-10-28）",
      "",
      "**双模组适配更新：枯木逢春 2.5.3 + 归途之书 1.4.3**",
      "",
      "**① 枯木逢春 2.5.2 → 2.5.3（新增两键）**",
      "- 科学课系统：`scienceprogression`（0-4 档，控制科学课演示事件阶段；写 4 后配合 delinquency≥10 + 衣着裸露触发最高档演示）；",
      "- 心智系统核心值：`Psyche.mood`（-1000~1000，负数=入迷 Fascination / 正数=恐惧 Dread，|值|>200 进极端态；模组自带 PsycheCheats 页同键同界）；",
      "- 枯木数值作弊项 55 → 57；新增源码文件 `Science.ts` + `Science.twee`（84 文件变更）；",
      "",
      "**② 归途之书 1.4.2 → 1.4.3（修复版）**",
      "- 29 文件内容变更、无新增/删除文件、无新增作弊键——适配器声明版本号同步；",
      "",
      "**③ 键存活核对（精确性核查）**",
      "- 枯木：audit 97/133（73%，TS 动态键盲区），resolve 汇总 122 KEEP + 9 REVIEW 全部保留；唯一 REMOVE 判定 `RobinExpansion.investment.agreed` 经人工复核**证伪**——源码 `Finance\\Adrian.twee:285` 为 `$RobinExpansion?.investment.agreed` 可选链写法（静态正则盲区误报），**声明保留**；",
      "- 归途：audit 55/57（96%），KEEP 全量 + REVIEW `TempleDuties.watch.phase` 保留；",
      "",
      "**④ 自查优化（发布前）**",
      "- `scienceprogression` 说明补精确触发条件（delinquency≥10 + 衣着裸露，Science.ts 实证）；",
      "- 测试补盲：回归新增 21.14 段 6 断言（两新键声明存在性 / 写入 / 下限钳制 / 上限按 v1.9.10 既定策略原样落档）；清理段补 `delete V.scienceprogression` 防残留污染；",
      "",
      "**测试与验证**",
      "- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E → 性别集成 24/24）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；",
      "- 产物 MapleBirchCE.mod.zip（206782 B）SHA256 `44872443A0472BA0FE879CC5131CB4ED219E2281D02B445439566ABE768CC670`，GitHub 资产 digest 回读一致；",
      "- game 内官方模组包已替换为 2.5.3 / 1.4.3（旧包备份 modpack-backup）。",
      "",
      "**致谢**：适配依据 MaplebirchLeaf 官方源码核验（运行时互操作、不改第三方文件），致谢枯木逢春与归途之书作者；本模组修改存档风险自负。",
      "",
      "版本线：v1.9.16 → v1.9.15 → v1.9.14 → v1.9.13 → v1.9.12 → v1.9.11 → v1.9.10 → v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3 → v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
