/*
 * 一键发布 v1.9.11：git credential token + REST Release（新 tag v1.9.11）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.11";
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
    name: "MapleBirchCE v1.9.11",
    body: [
      "**MapleBirchCE v1.9.11**（2026-10-26）",
      "",
      "**v1.9.11：悬浮球可拖动 + 全局页锁定/解锁入口（语义修正）+ 热重载绑定守卫**",
      "",
      "**悬浮球可拖动（右下角金色「解锁」球）**",
      "- pointer 拖拽全链（pointerdown/move/up/cancel），3px 阈值区分「点击开关」与「拖动挪位」，拖动后吞 click 防误触；",
      "- 位置 clamp 视口内（按按钮实际渲染尺寸，不再硬编码 64px）；rAF 节流写入 style；位置持久化 `mbCE_toggle_pos_v1`；",
      "- 拖动态 grabbing 光标 + 高亮；CSS 加 `touch-action/user-select` 防拖动误选文本。",
      "",
      "**全局页固定按钮（语义修正：锁定拖动，废除隐藏）**",
      "- 「全局」页顶部新增「锁定悬浮球拖动/解锁悬浮球拖动」固定按钮：锁定后悬浮球固定不动（不再误拖/挡其他模组 UI），**点击悬浮球本身仍可正常开关面板**；",
      "- 悬浮球是面板**唯一入口**，废除「隐藏」功能（隐藏即死锁，无法再进面板）——自动清理旧 `mbCE_toggle_hidden_v1` 键并强制恢复显示；拖动锁持久化 `mbCE_toggle_lock_v1`；锁定/解锁时悬浮球 title 同步提示；",
      "- **热重载绑定守卫**：`ensureDom` 复用已存在 `#mce-toggle` + `__mbCEBound` 打标——ModLoader 重载时跳过重复 addEventListener，防 click 监听堆叠导致一次点击多次开关面板。",
      "",
      "**归并说明**",
      "- v1.9.10（猫舍 Cattery 第 9 适配器 + 枯木逢春 2.5.1 / 归途之书 1.4.1 + 庄园维护全自动改造）已单独发布，本版为其后改动归版；",
      "- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E 9 适配器 → 性别集成）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；SHA256 见资产核对。",
      "",
      "版本线：v1.9.11 → v1.9.10 → v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3 → v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
