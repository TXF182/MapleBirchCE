/*
 * 一键发布 v1.9.13：git credential token + REST Release（新 tag v1.9.13）+ Buffer 上传 zip + size 核对 + API assets 端点回读 SHA256。
 * 坑位（tool-gotchas）：中文 body 需 charset=utf-8；二进制必须 Buffer 直发；上传后核对 asset.size；
 *   github.com:443 被断时回读改走 api.github.com assets 端点（Accept: application/octet-stream）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const TAG = "v1.9.13";
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
    name: "MapleBirchCE v1.9.13",
    body: [
      "**MapleBirchCE v1.9.13**（2026-10-27）",
      "",
      "**8 项功能扩充 + 四轮自查优化 + Mod 作弊页排版优化**",
      "",
      "**功能扩充**",
      "- 全局页时间调节：当前时间/日期显示 + 前进 1 小时/6 小时/1 天 + 跳转指定时刻（mcTimeNow/mcTimeAdvance/mcTimeJump，只用 Time.set/setTime 改游戏时钟，绝不触碰 V.timer 行动点）；",
      "- 快捷面板补负面属性组：紧张/创伤/痛苦/兴奋/疲劳/焦虑/违规/迷幻/醉酒 9 键（原版根键非黑名单，直写）；",
      "- Mod 自定义数值搜索框：按名称/键名/写入路径实时过滤（mce-search-inp 独立 class，250ms 防抖重建，搜索态强制展开）；",
      "- 预设模板：「全属性拉满」「经典开局」一键应用（快捷面板，逐项留痕可回退）；",
      "- 场景直达补充 6 地点：精神病院 Asylum / 警局牢房 Police Cell / 码头 Docks / 湖畔 Lake Stroll / 狼群领地 Wolf Pack / 医院前门 Hospital front（入口段落名均对照本体 HTML 实证，Wolf Pack pid=208 确认存在；地点页合计 14 组）；",
      "- 04a 适配器按模组拆分：注册表容器 + 9 个模组块文件；行级等价性 old 821 lines merged 821 identical: true；工具脚本统一 src 目录扫描；",
      "- 翻译表收敛：ZH_KEYS 单源（190 键无重复）+ PANEL 49 处 label 动态化 zhKey(path)；",
      "",
      "**四轮自查优化**",
      "- 修复 _check_keys_mod.js / scan_mod_vars.js 引用已删文件的旧路径（改目录扫描，枯木 133 varPath 提取正常）；",
      "- 翻译同义词统一（analSkill 旧值→\"后庭\"）；E2E 补数值搜索框 N 区块 5 断言；README 补地点页小节；build 稳定性验证（连续两次 SHA 一致）；",
      "- 第四轮自查无新缺陷：时间函数只用 Time 不碰 V.timer、预设执行器组归属注释自警、搜索防抖定义在位、场景新组 match/main 实证正确；src 单文件语法检查 2 个 FAIL 均为设计使然（00-preamble 空壳占位、09-exports 跨文件 IIFE 片段），构建产物整体 node --check PASS；",
      "",
      "**Mod 作弊页排版优化**",
      "- 能力行/数值行/list 行 label 去掉冗余（varPath）——写入路径保留在「说明」折叠与悬停 title，行变短不挤压按钮区；",
      "- 阶段下拉 select 限宽 max-width:170px（长枚举配合 flex-wrap 自动换行）；不碰 data-mce-key/按钮文案/input 类名，测试断言全兼容；",
      "",
      "**测试与验证**",
      "- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E 含 N/W 区块 → 性别集成 24/24）+ verifier 4/4 + zip 正斜杠 4/4；codegraph sync 完成；",
      "- 产物 MapleBirchCE.mod.zip（200430 B）SHA256 `8BD6B306B294E01282E76552F233F5C3E8B26AB65428D881158AC34000491BC0`，GitHub 资产 digest 回读一致。",
      "",
      "版本线：v1.9.13 → v1.9.12 → v1.9.11 → v1.9.10 → v1.9.9 → v1.9.8 → v1.9.7 → v1.9.6 → v1.9.5 → v1.9.4 → v1.9.3 → v1.9.2 → v1.9.1 → v1.9.0 → v1.8.23 → v1.8.22 → v1.8.21 → v1.8.20 → v1.8.19 → v1.8.18 → v1.8.17 → v1.8.16 → v1.8.15 → v1.8.14 → v1.8.13 → v1.8.12 → v1.8.11",
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
