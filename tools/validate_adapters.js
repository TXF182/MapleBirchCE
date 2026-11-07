/* validate_adapters.js —— 适配器声明形态/域/必填校验（架构治理 P1 的门禁）
 *
 * 与既有工具的分工（避免重复造轮子）：
 *   tools/check_claims.js   ：D1~D5 语义自洽（重复路径、levels/labels 数量、min>max、跨适配器共享键）
 *   tools/check_key_types.js：声明类型 vs 模组源码形态（需 _modcache 对照源码）
 *   本工具                  ：形态层——字段白名单、必填、类型枚举、数值域、sync 结构、varPath 形状
 *   三者互补：形态错（字段拼错/类型拼错）本工具必报；语义冲突由 check_claims 报。
 *
 * 退出码：0 全过；1 有 ERROR（fail-closed，可直接挂门禁）。
 * 用法：node tools/validate_adapters.js [--json] [--src <dir>]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ir = require("./lib/adapter_ir.js");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "schemas", "adapter.schema.json");

const argv = process.argv.slice(2);
const asJson = argv.indexOf("--json") !== -1;
const srcIdx = argv.indexOf("--src");
const SRC_DIR = srcIdx !== -1 && argv[srcIdx + 1]
  ? path.resolve(argv[srcIdx + 1])
  : (process.env.MCE_SRC_DIR ? path.resolve(process.env.MCE_SRC_DIR) : path.join(ROOT, "javascript", "src"));

const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const VAR_RE = new RegExp(SCHEMA.varPathPattern);

const errors = [];
const warns = [];
function err(where, msg) { errors.push({ where, msg }); }
function warn(where, msg) { warns.push({ where, msg }); }

function isStr(v) { return typeof v === "string"; }
function isNum(v) { return typeof v === "number" && isFinite(v); }
function isBool(v) { return typeof v === "boolean"; }

/* ---------- 1. 装载 IR ---------- */
const R = ir.loadAdapters(SRC_DIR);
if (R.errors.length) {
  for (const e of R.errors) err(e.file, "段执行失败（语法错误或顶层抛错）：" + e.message);
}
if (!R.ids.length) err("CHEAT_ADAPTERS", "未解析到任何适配器（04a-*.js 未声明 CHEAT_ADAPTERS 或全部执行失败）");

const allowedEntry = SCHEMA.entry.required.concat(SCHEMA.entry.optional);
const syncFields = SCHEMA.sync.fields;
const setFields = SCHEMA.sync.setFields;
const ifFields = SCHEMA.sync.ifFields;
const actionReq = SCHEMA.actions.required;
const actionOpt = SCHEMA.actions.optional;

/* ---------- 2. 逐适配器逐条目校验 ---------- */
for (const id of R.ids) {
  const ad = R.adapters[id];
  const where0 = id;
  if (!ad || typeof ad !== "object") { err(where0, "适配器条目不是对象"); continue; }
  if (typeof ad.detect !== "function") err(where0, "缺 detect()（getCheatMods 用它门控，缺了面板永远不出现）");
  const e = ad.entry;
  if (!e || typeof e !== "object") { err(where0, "缺 entry 声明"); continue; }

  /* 2.1 entry 形态 */
  for (const f of Object.keys(e)) {
    if (allowedEntry.indexOf(f) === -1) err(where0, "entry 出现未登记字段 " + f + "（拼错即静默失效；确需新增请先更新 schemas/adapter.schema.json）");
  }
  for (const f of SCHEMA.entry.required) {
    if (!(f in e)) err(where0, "entry 缺必填字段 " + f);
  }
  if (e.modId !== id) err(where0, "entry.modId(" + e.modId + ") 与注册表键(" + id + ") 不一致");
  if (!isStr(e.modName) || !e.modName.trim()) err(where0, "entry.modName 必须是非空字符串");
  for (const sec of SCHEMA.entry.arraySections) {
    if (!(sec in e)) continue;
    if (!Array.isArray(e[sec])) err(where0, "entry." + sec + " 必须是数组（当前 " + typeof e[sec] + "）");
  }

  /* 2.2 每个段的条目 */
  const keyOwner = {};
  for (const sec of R.SECTIONS) {
    const arr = Array.isArray(e[sec]) ? e[sec] : [];
    const allowedItem = (SCHEMA.itemFields.common || []).concat(SCHEMA.itemFields[sec] || []);
    arr.forEach((it, i) => {
      const where = where0 + " / " + sec + "[" + i + "]";
      if (!it || typeof it !== "object") { err(where, "条目不是对象"); return; }
      const key = it.key;
      const w = isStr(key) && key ? where0 + " / " + sec + ":" + key : where;

      /* 字段白名单（防拼写漂移） */
      for (const f of Object.keys(it)) {
        if (allowedItem.indexOf(f) === -1) err(w, "出现未登记字段 " + f + "（该段允许：" + allowedItem.join("/") + "）");
      }
      /* 必填 */
      if (!isStr(key) || !key.trim()) err(w, "key 必须是非空字符串");
      else if (keyOwner[sec + ":" + key]) err(w, "key 在本适配器 " + sec + " 段重复（首个在 " + keyOwner[sec + ":" + key] + "）");
      else keyOwner[sec + ":" + key] = where;
      if (!isStr(it.name) || !it.name.trim()) err(w, "name 必须是非空字符串（面板靠它显示中文标签）");
      if (it.note !== undefined && !isStr(it.note)) err(w, "note 必须是字符串");

      /* varPath：inventory 类段必须给，且形状合法 */
      const needVarPath = sec === "stages" || sec === "abilities" || sec === "values" || sec === "tasks";
      if (needVarPath) {
        if (!isStr(it.varPath) || !it.varPath.trim()) err(w, "varPath 缺失（写入目标键必须有路径）");
        else if (!VAR_RE.test(it.varPath)) err(w, "varPath 形状非法：" + it.varPath + "（允许 a / a.b / a[0].b）");
      }

      /* 段内类型规则 */
      if (sec === "stages") validateStage(w, it);
      if (sec === "abilities") validateAbility(w, it, SCHEMA);
      if (sec === "values") validateValue(w, it, SCHEMA);
      if (sec === "scenes") validateScene(w, it);
      if (sec === "tasks") validateAbility(w, it, SCHEMA);

      if (it.sync !== undefined) validateSync(w, it.sync);
    });
  }

  /* 2.3 actions（一键动作）*/
  if (Array.isArray(e.actions)) {
    e.actions.forEach((a, i) => {
      const w = where0 + " / actions[" + i + "]" + (isStr(a && a.key) ? ":" + a.key : "");
      if (!a || typeof a !== "object") { err(w, "动作不是对象"); return; }
      for (const f of Object.keys(a)) {
        if (actionReq.indexOf(f) === -1 && actionOpt.indexOf(f) === -1) err(w, "动作出现未登记字段 " + f);
      }
      for (const f of actionReq) {
        if (f === "run") { if (typeof a.run !== "function") err(w, "run 必须是函数"); }
        else if (!isStr(a[f]) || !a[f].trim()) err(w, f + " 必须是非空字符串");
      }
      if (a.needsChild !== undefined && !isBool(a.needsChild)) err(w, "needsChild 必须是布尔");
    });
  } else if (e.actions !== undefined) {
    err(where0, "entry.actions 必须是数组");
  }
  if (e.actionPanel !== undefined && typeof e.actionPanel !== "function") err(where0, "entry.actionPanel 必须是函数（渲染自定义动作区）");
}

/* ---------- 段级校验器 ---------- */
function validateStage(w, it) {
  if (!Array.isArray(it.levels) || !it.levels.length) { err(w, "levels 必须是非空数组（阶段写入靠它给候选值）"); return; }
  const allStr = it.levels.every(isStr);
  const allNum = it.levels.every(isNum);
  if (!allStr && !allNum) err(w, "levels 元素必须同为字符串或同为数字");
  if (!Array.isArray(it.labels)) {
    err(w, "缺 labels（面板会退回显示原始值，中文面板里就是裸英文）；labels 必须与 levels 等长");
  } else if (it.labels.length !== it.levels.length) {
    err(w, "labels 长度 " + it.labels.length + " ≠ levels 长度 " + it.levels.length + "（标签与档位错位）");
  } else if (!it.labels.every(isStr)) {
    err(w, "labels 元素必须都是字符串");
  }
}

function validateAbility(w, it, S) {
  const allowed = S.types.abilities;
  if (it.type !== undefined && allowed.indexOf(it.type) === -1) err(w, "type 只能是 " + allowed.join("/") + "，当前 " + JSON.stringify(it.type));
  if (it.numeric !== undefined && !isBool(it.numeric)) err(w, "numeric 必须是布尔（true 表示走 number 通道写 1/0）");
  if (it.min !== undefined && !isNum(it.min)) err(w, "min 必须是有限数字");
  if (it.max !== undefined && !isNum(it.max)) err(w, "max 必须是有限数字");
  if (isNum(it.min) && isNum(it.max) && it.min > it.max) err(w, "min(" + it.min + ") > max(" + it.max + ")");
  if (it.type === "boolean" && it.numeric === true && !isNum(it.min)) warn(w, "boolean+numeric 未给 min（写入端 vs 模组严格比较的域请自行确认）");
}

function validateValue(w, it, S) {
  const allowed = S.types.values;
  if (allowed.indexOf(it.type) === -1) { err(w, "type 必须是 " + allowed.join("/") + "，当前 " + JSON.stringify(it.type)); return; }
  if (it.type === "number") {
    if (!isNum(it.min)) err(w, "number 型必须给 min（防写入掉到模组不接受的下限）");
    if (!isNum(it.max)) err(w, "number 型必须给 max");
    if (isNum(it.min) && isNum(it.max) && it.min > it.max) err(w, "min(" + it.min + ") > max(" + it.max + ")");
  } else {
    if (it.min !== undefined || it.max !== undefined) err(w, "type=" + it.type + " 不应带 min/max（面板会误显示滑杆/区间）");
  }
  if (it.type === "list") {
    if (!Array.isArray(it.options) || !it.options.length) err(w, "list 型必须给非空 options（面板按它渲染可增删项）");
    else if (!it.options.every(isStr)) err(w, "options 元素必须都是字符串");
  } else if (it.options !== undefined) {
    err(w, "options 仅 list 型可用");
  }
}

function validateScene(w, it) {
  const any = ["skipVar", "completeVar", "progressVar"].some(k => isStr(it[k]) && it[k].trim());
  if (!any) err(w, "scenes 条目至少要给 skipVar / completeVar / progressVar 之一（否则无法判定剧情进度）");
  for (const k of ["skipVar", "completeVar", "progressVar"]) {
    if (it[k] !== undefined && (!isStr(it[k]) || !it[k].trim())) err(w, k + " 必须是非空字符串");
  }
  if (it.resetValue !== undefined && !isNum(it.resetValue) && !isStr(it.resetValue)) err(w, "resetValue 必须是数字或字符串");
}

function validateSync(w, sync) {
  if (!sync || typeof sync !== "object" || Array.isArray(sync)) { err(w, "sync 必须是对象"); return; }
  for (const f of Object.keys(sync)) {
    if (syncFields.indexOf(f) === -1) err(w, "sync 出现未登记字段 " + f + "（允许 " + syncFields.join("/") + "）");
  }
  if (sync.clear !== undefined) {
    if (!Array.isArray(sync.clear) || !sync.clear.length) err(w, "sync.clear 必须是非空数组");
    else sync.clear.forEach((p, i) => { if (!isStr(p) || !p.trim()) err(w, "sync.clear[" + i + "] 必须是非空路径串"); });
  }
  if (sync.set !== undefined) {
    if (!Array.isArray(sync.set)) err(w, "sync.set 必须是数组");
    else sync.set.forEach((s, i) => {
      const sw = w + " sync.set[" + i + "]";
      if (!s || typeof s !== "object") { err(sw, "联动项不是对象"); return; }
      for (const f of Object.keys(s)) if (setFields.indexOf(f) === -1) err(sw, "出现未登记字段 " + f);
      if (!isStr(s.path) || !s.path.trim()) err(sw, "path 必须是非空路径串");
      else if (!VAR_RE.test(s.path)) err(sw, "path 形状非法：" + s.path);
      if (!("value" in s)) err(sw, "缺 value（联动写入值）");
      if (s.if !== undefined) {
        if (!s.if || typeof s.if !== "object") err(sw, "if 必须是对象");
        else {
          for (const f of Object.keys(s.if)) {
            if (ifFields.indexOf(f) === -1) err(sw, "if 出现未登记字段 " + f);
            else if (!isNum(s.if[f])) err(sw, "if." + f + " 必须是有限数字");
          }
        }
      }
      if (s.ifMissing !== undefined && !isBool(s.ifMissing)) err(sw, "ifMissing 必须是布尔");
    });
  }
  if (sync.copyMax !== undefined) {
    const cm = sync.copyMax;
    if (!cm || typeof cm !== "object") err(w, "sync.copyMax 必须是对象");
    else {
      for (const f of Object.keys(cm)) if (f !== "path" && f !== "order") err(w, "sync.copyMax 出现未登记字段 " + f);
      if (!isStr(cm.path) || !cm.path.trim()) err(w, "sync.copyMax.path 必须是非空路径串");
      else if (!VAR_RE.test(cm.path)) err(w, "sync.copyMax.path 形状非法：" + cm.path);
      if (!Array.isArray(cm.order) || !cm.order.length) err(w, "sync.copyMax.order 必须是非空数组（按索引取较大者前移）");
    }
  }
}

/* ---------- 3. 汇总输出 ---------- */
const total = R.items.length;
const perSec = {};
for (const sec of R.SECTIONS) perSec[sec] = R.items.filter(x => x.section === sec).length;

if (asJson) {
  process.stdout.write(JSON.stringify({ ok: errors.length === 0, adapters: R.ids.length, items: total, perSection: perSec, errors, warns }, null, 2) + "\n");
} else {
  console.log("声明校验：适配器 " + R.ids.length + " 个 / 条目 " + total + " 条（" + R.SECTIONS.map(s => s + " " + perSec[s]).join(" / ") + "）");
  console.log("规则：字段白名单 / 必填 / 类型枚举 / 数值域 / levels-labels 等长 / sync 结构 / varPath 形状");
  if (errors.length) {
    console.log("\n[FAIL] " + errors.length + " 项");
    const shown = errors.slice(0, 40);
    for (const x of shown) console.log("  " + x.where + " — " + x.msg);
    if (errors.length > shown.length) console.log("  …另有 " + (errors.length - shown.length) + " 项，跑 --json 取全量");
  }
  if (warns.length) {
    console.log("\n[WARN] " + warns.length + " 项");
    for (const x of warns.slice(0, 10)) console.log("  " + x.where + " — " + x.msg);
  }
  if (!errors.length) console.log("\nOK：声明形态全部通过");
}
process.exit(errors.length ? 1 : 0);
