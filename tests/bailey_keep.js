/* 贝利扣押拦截（07f-bailey）行为契约测试
 *
 * 原版 0.5.12.13 Bailey Confiscation System（行号取自 game\Degrees of Lewdity.html）：
 *   · Orphanage 睡眠线 `<<elseif $renttime lte -21 and !$bailey_confiscation>>`（@43841899）→ `<<baileyRentConfiscation>>`
 *   · widget `baileyRentConfiscation`（@44071041）先算 `baileyConfiscationBundle($rentmoney + $babyRent)`
 *     `<<if _bundle.items.length is 0>>` → 只走 `<<rentdue 0>>`（正常催租）
 *     `<<else>>` → `baileyConfiscationApply(_bundle)` 搬走衣物/家具并把 `$renttime` 重置为 7 天赎回期
 *   · 清单生成器 `window.baileyConfiscationBundle`（@16508590 起）
 * 因此拦截的正确切口是「让清单恒为空」，而不是改 apply / 改存档结构。
 *
 * 本测试锁定：开关三态、只保存一次原引用、幂等、无原版函数时拒绝、apply 不被改动、UI 点击可切换。
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " =="); }

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;

const V = { player: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0 };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

/* 模拟原版：清单里有 1 件衣物（value 200）；apply/restore 均记录调用 */
const nativeCalls = [];
const nativeBundle = function (target) {
  nativeCalls.push(target);
  return { items: [{ source: "clothing", slot: "upper", index: 0, name: "shirt", value: 200 }], total: 200 };
};
window.baileyConfiscationBundle = nativeBundle;
const nativeApply = function (bundle) { window.__appliedBundle = bundle; };
const nativeRestore = function () { window.__restored = true; };
window.baileyConfiscationApply = nativeApply;
window.baileyConfiscationRestore = nativeRestore;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

if (!api || typeof api.baileyKeepSet !== "function" || typeof api.baileyKeepState !== "function" ||
    typeof api.baileyKeepSync !== "function" || typeof api.baileyKeepRender !== "function") {
  console.error("FAIL: 07f-bailey 未实现或未导出（baileyKeepSet/State/Sync/Render）");
  console.log("\nBAILEY KEEP: passed=0 failed=1");
  process.exit(1);
}

/* ================= 1. 默认关闭：不动原函数 ================= */
section("1 默认关闭");
let st = api.baileyKeepState();
assert(st.on === false, "默认关闭");
assert(st.hasNative === true, "检测到原版扣押清单函数");
assert(st.active === false, "未处于拦截态");
let out = window.baileyConfiscationBundle(1000);
assert(out.items.length === 1 && out.total === 200, "关闭时原函数照旧返回非空清单");
assert(nativeCalls[nativeCalls.length - 1] === 1000, "关闭时参数原样透传");

/* ================= 2. 开启：清单恒空（twee 走 rentdue 分支） ================= */
section("2 开启拦截");
const r2 = api.baileyKeepSet(true);
assert(r2.ok === true && r2.on === true, "开启成功并回填 on=true");
assert(V.mbCE_baileyKeep === true, "开关写进存档（V.mbCE_baileyKeep）");
out = window.baileyConfiscationBundle(1000);
assert(Array.isArray(out.items) && out.items.length === 0, "拦截后 items 为空数组（_bundle.items.length is 0 成立）");
assert(out.total === 0, "拦截后 total 为 0");
assert(typeof out === "object" && out !== null, "返回值仍是对象（twee 直接读 _bundle.items，不能返回 undefined）");

/* ================= 3. 幂等：重复 sync 不重复包装 ================= */
section("3 幂等");
const ref = window.baileyConfiscationBundle;
api.baileyKeepSync();
api.baileyKeepSync();
api.baileyKeepSync();
assert(window.baileyConfiscationBundle === ref, "连续 sync 3 次引用不变（不叠加包装）");

/* ================= 4. 关闭：写回同一个原引用 ================= */
section("4 关闭还原");
const r4 = api.baileyKeepSet(false);
assert(r4.ok === true && r4.on === false, "关闭成功");
assert(window.baileyConfiscationBundle === nativeBundle, "关闭后写回同一个原引用（不是新包装）");
out = window.baileyConfiscationBundle(2000);
assert(out.items.length === 1 && out.total === 200, "关闭后重新返回非空清单");
assert(nativeCalls[nativeCalls.length - 1] === 2000, "还原后参数仍透传");
assert(V.mbCE_baileyKeep === false, "开关写回 false");

/* ================= 5. apply / restore 全程未被替换 ================= */
section("5 不动搬运实现");
assert(window.baileyConfiscationApply === nativeApply, "baileyConfiscationApply 保持原函数（拦截只改清单）");
assert(window.baileyConfiscationRestore === nativeRestore, "baileyConfiscationRestore 保持原函数");

/* ================= 6. 无原版函数：拒绝开启，不伪造成功 ================= */
section("6 无原版机制（旧版本游戏）");
const savedBundle = window.baileyConfiscationBundle;
delete window.baileyConfiscationBundle;
const r6 = api.baileyKeepSet(true);
assert(r6.ok === false, "无原版函数时拒绝开启");
assert(r6.on === false, "拒绝时不置 on");
window.baileyConfiscationBundle = savedBundle;
const st6 = api.baileyKeepState();
assert(st6.hasNative === true, "恢复后重新识别到原版函数");

/* ================= 7. 存档变量不可用：安全降级 ================= */
section("7 V 不可用");
global.V = null;
global.State.variables = null;
let st7 = null;
let threw = false;
try { st7 = api.baileyKeepState(); } catch (e) { threw = true; }
assert(threw === false, "V 不可用时不抛异常");
assert(st7 && st7.on === false && st7.reason === "novars", "V 不可用返回 on=false + reason=novars");
global.V = V;
global.State.variables = V;

/* ================= 8. UI：渲染 + 点击切换 ================= */
section("8 UI");
const pane = document.createElement("div");
api.baileyKeepRender(pane);
const btns = pane.querySelectorAll("button");
assert(btns.length >= 1, "渲染出开关按钮");
assert(pane.textContent.indexOf("贝利") !== -1, "区块文案含「贝利」");
const sw = btns[0];
const before = api.baileyKeepState().on;
sw.click();
assert(api.baileyKeepState().on === !before, "点击切换开关状态");
sw.click();
assert(api.baileyKeepState().on === before, "再次点击切回");
assert(window.baileyConfiscationApply === nativeApply, "UI 点击不触碰 apply");

/* ================= 9. 旧档已有扣押记录时不清空 ================= */
section("9 已有扣押记录保持");
V.bailey_confiscation = { items: [{ source: "clothing", slot: "upper", item: { name: "shirt" }, name: "shirt", value: 200 }], day: 3 };
api.baileyKeepSet(true);
assert(V.bailey_confiscation && Array.isArray(V.bailey_confiscation.items) && V.bailey_confiscation.items.length === 1,
  "开启拦截不改动已存在的扣押记录（赎回流程照旧）");
api.baileyKeepSet(false);

console.log("\nBAILEY KEEP: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
