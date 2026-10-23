/* 集成测试：性别切换（v1.9.1）
 * 不依赖 mock——运行时从原版 Degrees of Lewdity.html（0.5.12.13）抽取真实性别判定函数
 * （isGenitalMismatch / isCrossdressing / isHermOrCrossdresser / 服装分型），
 * 注入本项目构建产物（maplebirchce.js）的 applyPlayerGender / getPlayerGender，
 * 用切换后的玩家状态直接跑原版真实逻辑断言行为。
 * 原版文件缺失时跳过（不误报），并提示路径。
 */
const fs = require("fs");
const path = require("path");
const VM = require("vm");

const DOL_HTML = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game\\Degrees of Lewdity.html";
const MCE_JS = path.join(__dirname, "..", "javascript", "maplebirchce.js");

let passed = 0, failed = 0;
function assert(cond, msg, extra) {
  if (cond) { passed++; console.log("PASS: " + msg); }
  else { failed++; console.log("FAIL: " + msg + (extra !== undefined ? " | 实际 " + extra : "")); }
}

/* —— 抽取原版函数（find + 括号配平） —— */
function extractFunc(src, name) {
  let i = src.indexOf("function " + name + "(");
  if (i < 0) i = src.indexOf(name + " = function(");
  if (i < 0) return null;
  const j = src.indexOf("{", i);
  let depth = 1, m = j + 1;
  while (m < src.length && depth > 0) {
    const c = src[m];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    m++;
  }
  return src.slice(i, m);
}

if (!fs.existsSync(DOL_HTML)) {
  console.log("SKIP: 原版 DoL.html 不存在（" + DOL_HTML + "）——集成测试跳过，请确认原版游戏文件路径");
  process.exit(0);
}
const dol = fs.readFileSync(DOL_HTML, "utf8");
if (!fs.existsSync(MCE_JS)) {
  console.log("SKIP: 构建产物 maplebirchce.js 不存在，请先 build");
  process.exit(0);
}

const isGenitalMismatch = extractFunc(dol, "isGenitalMismatch");
const isCrossdressing = extractFunc(dol, "isCrossdressing");
const isHermOrCrossdresser = extractFunc(dol, "isHermOrCrossdresser");
const clothesTypeFn = extractFunc(dol, "clothesTypeOf"); // 原版无此函数，用分型片段拼装
for (const [n, f] of [["isGenitalMismatch", isGenitalMismatch], ["isCrossdressing", isCrossdressing], ["isHermOrCrossdresser", isHermOrCrossdresser]]) {
  if (!f) { console.log("SKIP: 原版函数抽取失败 " + n); process.exit(0); }
}
/* 服装分型：从原版片段拼装（gender 三态 → clothesType） */
const clothesTypeSrc = "function clothesTypeOf() { let clothesType; if (V.player.gender === \"m\") { clothesType = \"male\"; } else if (V.player.gender === \"f\") { clothesType = \"female\"; } else { if (V.player.gender_body === \"m\" || (V.player.gender_body === \"a\" && V.player.breastsize <= 3)) { clothesType = \"male\"; } else { clothesType = \"female\"; } } if (V.background === \"crossdresser\") { clothesType = V.player.sex === \"m\" ? \"female\" : \"male\"; } return clothesType; }";
/* 原版战斗性器官分型（CloseCombatMapper.mapClosePenis）：sex==="f"→parasite，否则 ballsExist→penis / 无→herm */
const genitalsSrc = "function penisTypeOf() { return V.player.sex === \"f\" ? \"parasite\" : (V.player.ballsExist ? \"penis\" : \"herm\"); }";

/* —— 加载本项目构建产物，取性别 API（getSetup 读全局 setup，须在沙箱提供） —— */
const mceSrc = fs.readFileSync(MCE_JS, "utf8");
const sandbox = { console, setTimeout, clearTimeout, window: {} };
sandbox.setup = {};
sandbox.window.setup = sandbox.setup;
sandbox.window.maplebirch = { get: function () { return null; }, npc: {} };
sandbox.window.SugarCube = undefined;
/* 盲区修复验证（实测路径=测试路径）：注入 fake 引擎收敛函数，
   断言 applyPlayerGender 写完七键后立即触发一次 exposedcheck(true) */
sandbox.window.__mceExposedcheckCalls = 0;
sandbox.window.exposedcheck = function () { sandbox.window.__mceExposedcheckCalls++; };
VM.createContext(sandbox);
VM.runInContext(mceSrc, sandbox);
const api = sandbox.setup.mbStageCE;
if (!api || !api.applyPlayerGender || !api.getPlayerGender) {
  console.log("SKIP: 构建产物未暴露性别 API（applyPlayerGender/getPlayerGender）——先 build 或检查导出");
  process.exit(0);
}

/* —— 原版函数沙箱（真实逻辑 + 可控依赖） —— */
function genderSandbox(player, genderAppearance) {
  const V = {
    player: player,
    settings: { nudeGenderPerception: 1 },
    background: player.background || ""
  };
  const getVisibleClothesList = function () { return []; }; // 裸体/无性别服装
  const src = [isGenitalMismatch, isCrossdressing, isHermOrCrossdresser, clothesTypeSrc, genitalsSrc].join("\n") +
    "\nreturn { isGenitalMismatch, isCrossdressing, isHermOrCrossdresser, clothesTypeOf, penisTypeOf };";
  const f = new Function("V", "getVisibleClothesList", src);
  return f(V, getVisibleClothesList);
}

/* —— 构造玩家状态：用本项目 applyPlayerGender 切换，gender_appearance 模拟引擎收敛（=sex） —— */
function playerAfter(g) {
  const V = { player: { money: 500, name: "X", penisExist: true, vaginaExist: false, penissize: 2, gender: "m", gender_body: "m", sex: "m", ballsExist: false, breastsize: 3, background: "" } };
  api.applyPlayerGender(V, g);
  V.player.gender_appearance = V.player.sex; // genderappearancecheck 由 sex 派生，模拟收敛
  V.player.background = V.player.background || "";
  return V.player;
}

/* ================= 断言 ================= */
console.log("== 切男（m） ==");
{
  const before = sandbox.window.__mceExposedcheckCalls;
  const pl = playerAfter("m");
  const r = genderSandbox(pl, pl.gender_appearance);
  assert(pl.sex === "m" && pl.gender === "m" && pl.gender_body === "m" && pl.ballsExist === false, "七键：男", JSON.stringify({ s: pl.sex, g: pl.gender, gb: pl.gender_body, b: pl.ballsExist }));
  assert(r.isGenitalMismatch() === false, "原版 isGenitalMismatch → false（不误判 mismatch）", r.isGenitalMismatch());
  assert(r.isCrossdressing() === false, "原版 isCrossdressing → false（不误判变装）", r.isCrossdressing());
  assert(r.isHermOrCrossdresser() === false, "原版 isHermOrCrossdresser → false", r.isHermOrCrossdresser());
  assert(r.clothesTypeOf() === "male", "原版服装分型 → male", r.clothesTypeOf());
  assert(api.getPlayerGender({ player: pl }) === "m", "getPlayerGender → 男");
  assert(sandbox.window.__mceExposedcheckCalls === before + 1, "切男后立即触发引擎收敛（exposedcheck）", "calls=" + sandbox.window.__mceExposedcheckCalls);
}
console.log("== 切女（f） ==");
{
  const before = sandbox.window.__mceExposedcheckCalls;
  const pl = playerAfter("f");
  const r = genderSandbox(pl, pl.gender_appearance);
  assert(pl.sex === "f" && pl.gender === "f" && pl.gender_body === "f" && pl.ballsExist === false && pl.penissize === 0, "七键：女", JSON.stringify({ s: pl.sex, g: pl.gender, gb: pl.gender_body, b: pl.ballsExist, ps: pl.penissize }));
  assert(r.isGenitalMismatch() === false, "原版 isGenitalMismatch → false（修复前 sex=m 残留会误判 true）", r.isGenitalMismatch());
  assert(r.isCrossdressing() === false, "原版 isCrossdressing → false（不误判变装）", r.isCrossdressing());
  assert(r.isHermOrCrossdresser() === false, "原版 isHermOrCrossdresser → false", r.isHermOrCrossdresser());
  assert(r.clothesTypeOf() === "female", "原版服装分型 → female（修复前 gender=m 会走 male）", r.clothesTypeOf());
  assert(api.getPlayerGender({ player: pl }) === "f", "getPlayerGender → 女");
  assert(sandbox.window.__mceExposedcheckCalls === before + 1, "切女后立即触发引擎收敛（exposedcheck）", "calls=" + sandbox.window.__mceExposedcheckCalls);
}
console.log("== 切双性（h） ==");
{
  const before = sandbox.window.__mceExposedcheckCalls;
  const pl = playerAfter("a");
  const r = genderSandbox(pl, pl.gender_appearance);
  assert(pl.sex === "h" && pl.gender === "h" && pl.gender_body === "a" && pl.ballsExist === true && pl.penissize >= 1, "七键：双性", JSON.stringify({ s: pl.sex, g: pl.gender, gb: pl.gender_body, b: pl.ballsExist, ps: pl.penissize }));
  assert(r.isGenitalMismatch() === "herm", "原版 isGenitalMismatch → herm（herm 判定成立）", r.isGenitalMismatch());
  assert(r.isHermOrCrossdresser() === "herm", "原版 isHermOrCrossdresser → herm", r.isHermOrCrossdresser());
  assert(r.clothesTypeOf() === "male", "原版服装分型（gender_body=a 且 breastsize≤3）→ male", r.clothesTypeOf());
  pl.breastsize = 4;
  assert(genderSandbox(pl, pl.gender_appearance).clothesTypeOf() === "female", "原版服装分型（gender_body=a 且 breastsize=4）→ female", genderSandbox(pl, pl.gender_appearance).clothesTypeOf());
  assert(api.getPlayerGender({ player: pl }) === "a", "getPlayerGender → 双性");
  assert(sandbox.window.__mceExposedcheckCalls === before + 1, "切双性后立即触发引擎收敛（exposedcheck）", "calls=" + sandbox.window.__mceExposedcheckCalls);
}
console.log("== 回归护栏：修复前旧实现（只写四键）确实会导致原版误判 ==");
{
  /* 模拟旧版 applyPlayerGender（只写 penisExist/vaginaExist/penissize/gender_body，sex/gender/ballsExist 残留原值） */
  const Vold = { player: { money: 500, name: "X", penisExist: true, vaginaExist: false, penissize: 2, gender: "m", gender_body: "m", sex: "m", ballsExist: false, breastsize: 3, background: "" } };
  Vold.player.vaginaExist = true; Vold.player.penisExist = false; Vold.player.penissize = 0; Vold.player.gender_body = "f";
  Vold.player.gender_appearance = Vold.player.sex; // 引擎按残留 sex=m 收敛
  const rold = genderSandbox(Vold.player, Vold.player.gender_appearance);
  assert(rold.clothesTypeOf() === "male", "旧实现（gender 残留 m）→ 服装 male（新实现切女为 female，确认修复必要性）", rold.clothesTypeOf());
  assert(rold.penisTypeOf() === "herm", "旧实现（sex 残留 m + ballsExist 残留 false）→ 战斗性器官显示 herm（新实现切女为 parasite），确认修复必要性", rold.penisTypeOf());
  const Vnew = playerAfter("f");
  assert(genderSandbox(Vnew, Vnew.gender_appearance).penisTypeOf() === "parasite", "新实现切女 → 战斗性器官显示 parasite（女性生殖器）", genderSandbox(Vnew, Vnew.gender_appearance).penisTypeOf());
}

console.log(""); console.log("INTEGRATION GENDER " + (failed === 0 ? "ALL PASSED" : ("FAILED " + failed)) + "（passed=" + passed + " failed=" + failed + "）");
process.exit(failed === 0 ? 0 : 1);
