/* 职责：言灵页「原帖 52 条」补丁执行器 + 选项卡渲染 + 逐条/整页撤销。
   写入一律走 V.mbCE_wrote["yanling:q:<id>"] 留痕，且只记首次写入前值（连点后一次撤销回到最初）。
   与 cheatWriteValue 的分工：后者拒绝 DoL 原版变量根，本页条目全部是原版键，故在此自带解析/写入/回退。 */
MB_CSS +=
	".mce-subtabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:2px 0 6px}" +
	".mce-subtabs button{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;background:var(--mce-bg-ctl);" +
	"border:1px solid var(--mce-border-quiet);border-radius:var(--mce-radius-sm);color:var(--mce-txt-dim);padding:7px 9px;font-size:var(--mce-fs-btn);" +
	"cursor:pointer;font-family:inherit;white-space:nowrap;text-align:left}" +
	".mce-subtabs button:hover{border-color:var(--mce-accent);color:var(--mce-txt-bright)}" +
	".mce-subtabs button.mce-active{background:var(--mce-accent);border-color:var(--mce-accent-dark);color:var(--mce-txt-on-accent);font-weight:700}" +
	".mce-subtabs .mce-subtab-t{overflow:hidden;text-overflow:ellipsis}" +
	".mce-subtabs .mce-subtab-n{flex:none;min-width:20px;text-align:center;border-radius:var(--mce-radius-pill);background:rgba(255,255,255,.07);" +
	"color:var(--mce-txt-mid);font-size:var(--mce-fs-xs);font-weight:400;padding:1px 5px}" +
	".mce-subtabs button.mce-active .mce-subtab-n{background:rgba(0,0,0,.16);color:var(--mce-txt-on-accent)}" +
	".mce-subpanel{border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius);background:var(--mce-bg-stage);padding:8px 8px 4px;margin:0}" +
	".mce-quick-meta{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:var(--mce-fs-sm);color:var(--mce-txt-faint);margin:0 0 2px}" +
	".mce-quick-meta b{color:var(--mce-accent);font-weight:700}" +
	".mce-subsec{margin:8px 0 2px}" +
	".mce-subsec-h{display:flex;align-items:center;gap:6px;padding:0 0 4px 7px;border-left:3px solid var(--mce-accent-55);" +
	"color:var(--mce-txt-strong);font-size:var(--mce-fs-btn);font-weight:700}" +
	".mce-subsec-h .mce-subsec-t{flex:1 1 auto;min-width:0}" +
	".mce-subsec-n,.mce-subsec-d{flex:none;font-size:var(--mce-fs-xs);font-weight:400;padding:1px 6px;border-radius:var(--mce-radius-pill);" +
	"border:1px solid var(--mce-border-quiet);color:var(--mce-txt-faint)}" +
	".mce-subsec-d{border-color:var(--mce-green-badge-b);color:var(--mce-green)}" +
	".mce-quick-undo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--mce-border-quiet);margin-top:6px;padding-top:7px}" +
	".mce-quick-undo-txt{flex:1 1 150px;font-size:var(--mce-fs-sm);color:var(--mce-txt-faint);margin:0}";

var mbCEYanlingQuickTab = 0;
function mbCEYanlingQuickTabGet() { return mbCEYanlingQuickTab; }
function mbCEYanlingQuickTabSet(idx) {
	var n = Number(idx);
	if (!isFinite(n) || n < 0 || n >= MCE_YANLING_QUICK_TABS.length) { return mbCEYanlingQuickTab; }
	mbCEYanlingQuickTab = n;
	return mbCEYanlingQuickTab;
}
function mbCEYanlingQuickFind(id) {
	for (var i = 0; i < MCE_YANLING_QUICK.length; i++) {
		if (MCE_YANLING_QUICK[i].id === id) { return MCE_YANLING_QUICK[i]; }
	}
	return null;
}
/* 深拷贝 before：数组/对象整体替换类条目（晒痕 layers）撤销时必须还原成独立副本，
   不能把存档里同一个对象引用再塞回去（后续游戏改动会污染留痕）。 */
function mbCEYanlingQuickClone(v) {
	if (v === undefined) { return undefined; }
	try { return JSON.parse(JSON.stringify(v)); } catch (e) { return Array.isArray(v) ? v.slice() : v; }
}
/* 路径解析：支持 a.b、a[3].b（数组下标按字符串键读写，JS 数组同样成立）。
   根固定为 V；中间宿主缺失时明确拒绝，绝不创建 undefined 对象。
   @returns {{ok: true, parent: any, leaf: string} | {ok: false, msg: string}} */
function mbCEYanlingQuickResolve(p) {
	var V = getV();
	if (!V) { return { ok: false, msg: "存档变量不可用" }; }
	var parts = String(p || "").replace(/^\$/, "").match(/[^.[\]]+/g);
	if (!parts || !parts.length) { return { ok: false, msg: "变量路径为空" }; }
	var cur = V, i;
	for (i = 0; i < parts.length - 1; i++) {
		cur = cur[parts[i]];
		if (cur === undefined || cur === null) { return { ok: false, msg: "宿主不存在：" + p }; }
	}
	return { ok: true, parent: cur, leaf: parts[parts.length - 1] };
}
function mbCEYanlingQuickTrace(id, before, after) {
	try {
		var V = getV();
		if (!V) { return false; }
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		var key = "yanling:q:" + id, prev = V.mbCE_wrote[key];
		/* 只记首次：连点 +100 / +2000 后撤销仍回到最初，而不是「撤销等于原地打转」 */
		if (prev && prev.before) { return false; }
		V.mbCE_wrote[key] = { type: "yanling", modId: "vanilla", op: "q:" + id, before: before, after: after, t: Date.now() };
		return true;
	} catch (e) { return false; }
}
function mbCEYanlingQuickBool(v) { return v === true || v === 1 || v === "1" || v === "true"; }
function mbCEYanlingQuickTimeReady() { return typeof Time !== "undefined" && !!Time && typeof Time.set === "function"; }
function mbCEYanlingQuickNow(V) {
	if (typeof V.timeStamp === "number") { return V.timeStamp; }
	if (typeof Time === "undefined" || !Time || !Time.date) { return null; }
	return (typeof Time.date.timeStamp === "number") ? Time.date.timeStamp : null;
}
function mbCEYanlingQuickRunTime(V, e, id) {
	var ts = mbCEYanlingQuickNow(V);
	if (ts === null) { return { ok: false, msg: "时间戳不可用（$timeStamp / Time.date 均缺失）" }; }
	if (!mbCEYanlingQuickTimeReady()) { return { ok: false, msg: "Time.set 不可用" }; }
	var delta = Number(e.value);
	if (!isFinite(delta)) { return { ok: false, msg: "时间增量不是有效数字" }; }
	var next = ts + delta;
	Time.set(next);
	mbCEYanlingQuickTrace(id, { kind: "time", value: ts }, { kind: "time", value: next });
	return { ok: true, msg: "时间已" + (delta < 0 ? "倒退" : "前进") + "：" + String(Math.abs(delta)) + " 秒（可撤销）" };
}
function mbCEYanlingQuickRunSkin(V, e, id) {
	var pl = V.player;
	if (!pl || !pl.skin || !Array.isArray(pl.skin.layers)) { return { ok: false, msg: "宿主不存在：$player.skin.layers（尚未初始化）" }; }
	var skinBefore = mbCEYanlingQuickClone(pl.skin.layers);
	var skinAfter = [{ layers: [], slots: {}, value: 0 }];
	pl.skin.layers = skinAfter;
	mbCEYanlingQuickTrace(id, { kind: "skin", value: skinBefore }, { kind: "skin", value: skinAfter });
	return { ok: true, msg: "已清除晒痕（$player.skin.layers 写为空壳，可撤销）" };
}
function mbCEYanlingQuickRunPillory(V, e, id) {
	var pt = V.pillory && V.pillory.tenant;
	if (!pt || pt.exists !== true) { return { ok: false, msg: "当前无人示众（$pillory.tenant.exists 不为真），本条不执行" }; }
	if (typeof pt.endTime !== "number" || !isFinite(pt.endTime)) { return { ok: false, msg: "承租人 endTime 不是有效数字，拒绝写入" }; }
	var pilloryBefore = pt.endTime;
	pt.endTime = pilloryBefore + 86400000000;
	mbCEYanlingQuickTrace(id, { kind: "pillory", value: pilloryBefore }, { kind: "pillory", value: pt.endTime });
	return { ok: true, msg: "枷锁示众已延长 1000 天（可撤销）" };
}
function mbCEYanlingQuickRunNpc(e, id) {
	var field = String(e.field || "");
	if (!field) { return { ok: false, msg: "NPC 字段名为空，拒绝写入" }; }
	var npc = mbCEYanlingNpc(e.npc);
	var npcName = e.npc === "Ivory Wraith" ? "象牙怨灵（Ivory Wraith）" : String(e.npc);
	if (!npc) { return { ok: false, msg: "角色槽位不存在：" + npcName + "（$NPCNameList 未包含）" }; }
	var npcBefore = npc[field];
	if (typeof npcBefore !== "number" || !isFinite(npcBefore)) { return { ok: false, msg: "字段不是有效数字：" + field }; }
	var npcDelta = Number(e.value);
	if (!isFinite(npcDelta)) { return { ok: false, msg: "增量不是有效数字：" + field }; }
	npc[field] = npcBefore + npcDelta;
	mbCEYanlingQuickTrace(id, { kind: "npc", name: e.npc, field: field, value: npcBefore }, { kind: "npc", name: e.npc, field: field, value: npc[field] });
	return { ok: true, msg: npcName + " " + field + "：" + String(npcBefore) + " → " + String(npc[field]) + "（可撤销）" };
}
function mbCEYanlingQuickApplyPlan(e, plan) {
	for (var k = 0; k < plan.length; k++) {
		var it = plan[k];
		if (e.kind === "bool") { it.parent[it.leaf] = mbCEYanlingQuickBool(it.value); }
		else if (e.kind === "add") {
			var base = Number(it.parent[it.leaf]);
			it.parent[it.leaf] = (isFinite(base) ? base : 0) + Number(it.value);
		} else { it.parent[it.leaf] = it.value; }
	}
}
function mbCEYanlingQuickRunOps(V, e, id) {
	var ops = e.ops;
	if (!Array.isArray(ops) || ops.length === 0) { return { ok: false, msg: "条目缺少变量声明：" + id }; }
	var plan = [], k;
	for (k = 0; k < ops.length; k++) {
		var path = String(ops[k][0] || "");
		if (!path) { return { ok: false, msg: "变量路径为空（" + e.label + "）" }; }
		var r = mbCEYanlingQuickResolve(path);
		if (r.ok !== true) { return { ok: false, msg: r.msg + "（" + e.label + "）" }; }
		var leaf = r.leaf;
		if (typeof leaf !== "string" || !leaf) { return { ok: false, msg: "变量叶子为空（" + e.label + "）" }; }
		plan.push({ path: path, parent: r.parent, leaf: leaf, before: mbCEYanlingQuickClone(r.parent[leaf]), value: ops[k][1] });
	}
	mbCEYanlingQuickApplyPlan(e, plan);
	var beforeOps = plan.map(function (it2) { return { path: it2.path, before: it2.before }; });
	mbCEYanlingQuickTrace(id, { kind: e.kind, ops: beforeOps }, { kind: e.kind, count: plan.length });
	return { ok: true, msg: e.label + "：已写入 " + String(plan.length) + " 个变量（可撤销）" };
}
function mbCEYanlingQuickRun(id) {
	try {
		var V = getV();
		if (!V) { return { ok: false, msg: "存档变量不可用" }; }
		var e = mbCEYanlingQuickFind(id);
		if (!e) { return { ok: false, msg: "未知条目：" + String(id) }; }
		if (e.kind === "time") { return mbCEYanlingQuickRunTime(V, e, id); }
		if (e.kind === "skin") { return mbCEYanlingQuickRunSkin(V, e, id); }
		if (e.kind === "pillory") { return mbCEYanlingQuickRunPillory(V, e, id); }
		if (e.kind === "npc") { return mbCEYanlingQuickRunNpc(e, id); }
		return mbCEYanlingQuickRunOps(V, e, id);
	} catch (err) { return { ok: false, msg: "操作异常：" + mbCEErr(err) }; }
}
function mbCEYanlingQuickUndoTime(b) {
	if (typeof Time === "undefined" || !Time || typeof Time.set !== "function") { return { ok: false, msg: "Time.set 不可用，无法回退时间" }; }
	Time.set(b.value);
	return { ok: true };
}
function mbCEYanlingQuickUndoSkin(V, b) {
	if (!V.player || !V.player.skin) { return { ok: false, msg: "目标结构已变化，拒绝回退（$player.skin 缺失）" }; }
	V.player.skin.layers = mbCEYanlingQuickClone(b.value);
	return { ok: true };
}
function mbCEYanlingQuickUndoPillory(V, b) {
	var pt = V.pillory && V.pillory.tenant;
	if (!pt) { return { ok: false, msg: "目标结构已变化，拒绝回退（$pillory.tenant 缺失）" }; }
	pt.endTime = b.value;
	return { ok: true };
}
function mbCEYanlingQuickUndoNpc(b) {
	var npc = mbCEYanlingNpc(b.name);
	if (!npc) { return { ok: false, msg: "目标结构已变化，拒绝回退（角色槽位缺失）" }; }
	npc[b.field] = b.value;
	return { ok: true };
}
function mbCEYanlingQuickUndoOps(V, b) {
	for (var i = 0; i < b.ops.length; i++) {
		var r = mbCEYanlingQuickResolve(b.ops[i].path);
		if (r.ok !== true) { return { ok: false, msg: "目标结构已变化，拒绝回退（" + b.ops[i].path + "）" }; }
		mbCEYanlingRestoreKey(r.parent, r.leaf, b.ops[i].before);
	}
	return { ok: true };
}
function mbCEYanlingQuickUndoApply(V, b) {
	if (b.kind === "time") { return mbCEYanlingQuickUndoTime(b); }
	if (b.kind === "skin") { return mbCEYanlingQuickUndoSkin(V, b); }
	if (b.kind === "pillory") { return mbCEYanlingQuickUndoPillory(V, b); }
	if (b.kind === "npc") { return mbCEYanlingQuickUndoNpc(b); }
	return mbCEYanlingQuickUndoOps(V, b);
}
function mbCEYanlingQuickUndo(id) {
	try {
		var V = getV();
		if (!V) { return { ok: false, msg: "存档变量不可用" }; }
		var key = "yanling:q:" + id, rec = V.mbCE_wrote && V.mbCE_wrote[key];
		if (!rec || rec.type !== "yanling" || !rec.before) { return { ok: false, msg: "没有可撤销的留痕（先执行一次该条目）" }; }
		var r = mbCEYanlingQuickUndoApply(V, rec.before);
		if (r.ok !== true) { return r; }
		try { delete V.mbCE_wrote[key]; } catch (err) { V.mbCE_wrote[key] = undefined; }
		return { ok: true, msg: "已撤销「" + id + "」，还原为首次执行前状态" };
	} catch (err) { return { ok: false, msg: "撤销异常：" + mbCEErr(err) }; }
}
function mbCEYanlingQuickHasTrace(V, id) { return !!(V && V.mbCE_wrote && V.mbCE_wrote["yanling:q:" + id]); }
function mbCEYanlingQuickUndoTab(tabIdx) {
	var n = Number(tabIdx), ids = [], i;
	for (i = 0; i < MCE_YANLING_QUICK.length; i++) {
		if (MCE_YANLING_QUICK[i].tab === n) { ids.push(MCE_YANLING_QUICK[i].id); }
	}
	var V = getV(), done = 0, failed = 0;
	for (i = 0; i < ids.length; i++) {
		if (!mbCEYanlingQuickHasTrace(V, ids[i])) { continue; }
		var r = mbCEYanlingQuickUndo(ids[i]);
		if (r.ok === true) { done++; } else { failed++; }
	}
	if (done + failed === 0) { return { ok: false, msg: "本页没有可撤销的改动" }; }
	if (failed) { return { ok: false, msg: "已撤销 " + done + " 项，失败 " + failed + " 项（结构已变化，见留痕）" }; }
	return { ok: true, msg: "本页已撤销 " + done + " 项，全部还原为首次执行前状态" };
}
/* 页签角标 / 小节计数 / 改动数一律现算，避免副标写死后与数据表漂移 */
function mbCEYanlingQuickTabCount(tab) {
	var n = 0, i;
	for (i = 0; i < MCE_YANLING_QUICK.length; i++) { if (MCE_YANLING_QUICK[i].tab === tab) { n++; } }
	return n;
}
function mbCEYanlingQuickDirtyCount(tab, V) {
	var n = 0, i;
	for (i = 0; i < MCE_YANLING_QUICK.length; i++) {
		if (MCE_YANLING_QUICK[i].tab === tab && mbCEYanlingQuickHasTrace(V, MCE_YANLING_QUICK[i].id)) { n++; }
	}
	return n;
}
function mbCEYanlingQuickSecDirty(list, V) {
	var n = 0, i;
	for (i = 0; i < list.length; i++) { if (mbCEYanlingQuickHasTrace(V, list[i].id)) { n++; } }
	return n;
}
/* 选项卡渲染：外层页签用 .mce-tabs，内层必须另起类名，否则 07a-shell2 的整页签分发会把内层按钮当外层页签处理 */
function renderYanlingQuickTabs(parent, tab) {
	var tabs = MCE_YANLING_QUICK_TABS, box = el("div", "mce-subtabs"), i;
	box.setAttribute("role", "tablist");
	for (i = 0; i < tabs.length; i++) {
		(function (idx) {
			var cnt = String(mbCEYanlingQuickTabCount(idx));
			var b = el("button", "mce-btn" + (idx === tab ? " mce-active" : ""));
			b.type = "button";
			b.setAttribute("data-subtab", tabs[idx].key);
			b.setAttribute("data-count", cnt);
			b.setAttribute("role", "tab");
			b.setAttribute("aria-selected", idx === tab ? "true" : "false");
			b.title = tabs[idx].name + "：" + tabs[idx].sub;
			b.appendChild(el("span", "mce-subtab-t", tabs[idx].name));
			b.appendChild(el("span", "mce-subtab-n", cnt));
			b.addEventListener("click", function () {
				mbCEYanlingQuickTab = idx;
				renderYanling();
			});
			box.appendChild(b);
		})(i);
	}
	parent.appendChild(box);
}
/* 单个小节：左侧金色竖条 + 标题 + 「N 项」+（有留痕时）「已改动 N」，下面接 2 列按钮网格 */
function renderYanlingQuickSec(parent, name, list, V) {
	var wrap = el("div", "mce-subsec");
	var h = el("div", "mce-subsec-h");
	h.appendChild(el("span", "mce-subsec-t", name));
	h.appendChild(el("span", "mce-subsec-n", String(list.length) + " 项"));
	var dirty = mbCEYanlingQuickSecDirty(list, V);
	if (dirty) { h.appendChild(el("span", "mce-subsec-d", "已改动 " + String(dirty))); }
	wrap.appendChild(h);
	var grid = mceBtnGrid(wrap);
	for (var j = 0; j < list.length; j++) {
		(function (en) {
			var b2 = el("button", "mce-btn " + MCE_CLS.gold, en.label);
			b2.type = "button";
			b2.title = en.hint;
			b2.setAttribute("data-qid", en.id);
			b2.addEventListener("click", function () {
				var r = mbCEYanlingQuickRun(en.id);
				setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
				mbCEFlashRow(b2);
				renderYanling();
			});
			grid.appendChild(b2);
		})(list[j]);
	}
	parent.appendChild(wrap);
}
function renderYanlingQuickSections(parent, tab, V) {
	var secs = [], map = {}, i;
	for (i = 0; i < MCE_YANLING_QUICK.length; i++) {
		var entry = MCE_YANLING_QUICK[i];
		if (entry.tab !== tab) { continue; }
		if (!map[entry.sec]) { map[entry.sec] = []; secs.push(entry.sec); }
		map[entry.sec].push(entry);
	}
	for (i = 0; i < secs.length; i++) { renderYanlingQuickSec(parent, secs[i], map[secs[i]], V); }
}
/* 整页撤销行：左侧说明、右侧按钮；按钮数即本页已改动条目数，0 项时置灰 */
function renderYanlingQuickUndoRow(parent, tab, V) {
	var undoable = mbCEYanlingQuickDirtyCount(tab, V);
	var row = el("div", "mce-quick-undo");
	row.appendChild(el("div", "mce-quick-undo-txt", "可撤销 " + String(undoable) + " 项 · 留痕键 yanling:q:<条目>，只记首次"));
	var ub = el("button", "mce-btn mce-red", "撤销本页改动（" + String(undoable) + "）");
	ub.type = "button";
	ub.disabled = undoable === 0;
	ub.title = "按 yanling:q:<条目> 留痕回退本页所有已执行条目；留痕只记首次，连点也能一次回到最初";
	ub.addEventListener("click", function () {
		var r = mbCEYanlingQuickUndoTab(tab);
		setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
		renderYanling();
	});
	row.appendChild(ub);
	parent.appendChild(row);
}
function renderYanlingQuickPanel(parent, tab, V) {
	var box = el("div", "mce-subpanel");
	box.setAttribute("role", "tabpanel");
	var meta = el("div", "mce-quick-meta");
	meta.appendChild(el("span", "mce-quick-meta-n", "共 " + String(mbCEYanlingQuickTabCount(tab)) + " 项"));
	meta.appendChild(el("span", "mce-quick-meta-d", "点一次即写入 · 撤销按首次写入前值还原"));
	box.appendChild(meta);
	renderYanlingQuickSections(box, tab, V);
	renderYanlingQuickUndoRow(box, tab, V);
	parent.appendChild(box);
}
function renderYanlingQuick(parent) {
	try {
		if (!parent) { return; }
		var tab = mbCEYanlingQuickTabSet(mbCEYanlingQuickTab);
		renderYanlingQuickTabs(parent, tab);
		renderYanlingQuickPanel(parent, tab, getV());
	} catch (err) { /* 渲染失败不抛到面板主链 */ }
}
