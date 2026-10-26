/* 本体特质 has 表达式编译缓存（懒编译：判定函数 + 条件变量清单 + 可写数值清单） */
var VANILLA_TRAITS_CACHE = null;
function safeGetObj(root, path) {
	var cur = root, parts = String(path).split(".");
	for (var i = 0; i < parts.length; i++) {
		if (cur === null || cur === undefined) { return undefined; }
		cur = cur[parts[i]];
	}
	return cur;
}
function traitEval(V, C, expr) {
	try {
		if (!expr) { return false; }
		var js = String(expr)
			.replace(/\bisnot\b/g, "!==").replace(/\bis\b/g, "===")
			.replace(/\bgte\b/g, ">=").replace(/\bgt\b/g, ">")
			.replace(/\blte\b/g, "<=").replace(/\blt\b/g, "<")
			.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		/* $a.b.c → V.a.b.c（带可选链 ?. 的原样保留） */
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\?\.)/g, 'safeGet(V,"$1")$2');
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g, 'safeGet(V,"$1")');
		/* _pills 局部变量 = sexStats.pills.pills */
		js = js.replace(/_pills/g, 'safeGet(V,"sexStats.pills.pills")');
		/* C.npc.X.y */
		js = js.replace(/\bC\.npc\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g, 'safeGet(C,"npc.$1.$2")');
		/* 函数调用（playerIsPregnant() 等全局函数）→ globalThis 兜底；排除已生成的 safeGet/globalThis */
		js = js.replace(/([A-Za-z_]\w*)\s*\(/g, function (m0, name) {
			if (name === "safeGet" || name === "globalThis") { return m0; }
			return 'globalThis["' + name + '"](';
		});
		var fn = new Function("V", "C", "safeGet", "return (" + js + ");");
		return !!fn(V, C, safeGetObj);
	} catch (e) { return false; }
}
/* 解析 has 表达式：找出所有 "$var op value" 比较段与 includes 段 */
function parseTraitHas(expr) {
	var out = { vars: [], includes: null, complex: false };
	if (!expr) { return out; }
	var re = /\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+(gte|gt|lte|lt|is|isnot)\s+(true|false|undefined|"[^"]*"|'[^']*'|\d+)/g;
	var m;
	while ((m = re.exec(expr)) !== null) {
		out.vars.push({ path: m[1], op: m[2], val: m[3] });
	}
	var mi = expr.match(/includes\(\s*"([^"]+)"\s*\)/);
	if (mi) { out.includes = mi[1]; }
	if (/playerIsPregnant|playerAwareTheyArePregnant|playerNormalPregnancyTotal|playerBellySize|between\(|toUpperFirst/.test(expr)) {
		out.complex = true;
	}
	return out;
}
function zhTraitName(en) {
	if (TRAIT_ZH[en]) { return TRAIT_ZH[en]; }
	var s = String(en);
	/* 函数源码型 name（traits widget 里 name 为函数文本）：提取 return 模板再映射 */
	if (/^\s*\(\s*\)\s*=>/.test(s) || /^\s*function\b/.test(s)) {
		var m = s.match(/return\s*`([^`]*)`/);
		if (m) { s = m[1]; } else { return "（函数型特质）"; }
	}
	/* 模板插值关键词：Acceptance 系列函数名 "${penisSize}/${breastSize}"（不依赖前缀键） */
	if (/\$\{penisSize\}/.test(s)) { return "接纳：阴茎"; }
	if (/\$\{breastSize\}/.test(s)) { return "接纳：胸部"; }
	/* A/B 多段（全角／与半角/ 分隔，同格并存的两个特质名）逐段映射 */
	var parts = s.split(/[／\/]/);
	if (parts.length > 1) {
		var zh = [];
		parts.forEach(function (p) {
			var t = String(p).trim();
			if (t) { zh.push(zhTraitName(t)); }
		});
		return zh.join(" / ");
	}
	/* ":" 前缀 + 插值名："Temple Burden: $temple_burden%" / "Rite of Promise: ..." */
	var i = s.indexOf(":");
	if (i > 0) {
		var head = s.slice(0, i).trim();
		var tail = s.slice(i + 1).trim();
		if (TRAIT_ZH[head]) {
			return TRAIT_ZH[head] + (tail ? "：" + zhTraitName(tail) : "");
		}
	}
	if (TRAIT_ZH[s]) { return TRAIT_ZH[s]; }
	return s;
}
/* 动态显示名：name 字符串内 $var 替换为当前值；函数表达式取候选英文名转中文 */
function traitDisplayName(t, V) {
	var nm = t.name;
	if (typeof nm === "function") {
		try { nm = nm(); } catch (e) { nm = String(t.name); }
	}
	nm = String(nm);
	nm = nm.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g, function (_, p) {
		var v = safeGetObj(V, p);
		return (v === undefined || v === null) ? "?" : String(v);
	});
	/* 拆出候选英文名做中文映射：形如 "A/B" 或 "A - B" 的取两端 */
	var out = zhTraitName(nm);
	return out;
}
/* 强制获得标记（v1.8.3）：has 无可写条件变量的特质（复杂表达式/函数判定）无法通过写变量满足，
   点「获取」时直接记入 V.mbCE_forcedTraits，面板内视为已获得；可移除（从标记列表删除）。 */
function forcedTraitKey(t) {
	return (t.cat ? String(t.cat) : "?") + "\u0001" + String(t.name || "");
}
function isForcedTrait(V, t) {
	try {
		var fl = V.mbCE_forcedTraits;
		return Array.isArray(fl) && fl.indexOf(forcedTraitKey(t)) !== -1;
	} catch (e) { return false; }
}
function traitOwned(t, V, C) {
	if (isForcedTrait(V, t)) { return true; }
	if (t.hasFn) { try { return !!t.hasFn(); } catch (e) { return false; } }
	return traitEval(V, C, t.has);
}
/* 获取特质：has 全部比较变量写满足值；includes 目标 push 进数组；无可写条件 → 强制获得标记 */
function grantTrait(t, V, C) {
	var info = parseTraitHas(t.has);
	var wrote = [];
	if (info.includes) {
		var arr = safeGetObj(V, "backgroundTraits");
		if (!Array.isArray(arr)) {
			try { V.backgroundTraits = []; arr = V.backgroundTraits; } catch (e) { arr = null; }
		}
		if (arr && arr.indexOf(info.includes) === -1) { arr.push(info.includes); wrote.push("backgroundTraits+" + info.includes); }
	}
	info.vars.forEach(function (v) {
		var vv = String(v.val).replace(/["']/g, "");
		/* isnot + 非布尔/数字字符串值（如 "none"/"prospective"）：无法推断满足值，跳过不写（防写坏） */
		if (v.op === "isnot" && vv !== "true" && vv !== "false" && vv !== "undefined" && isNaN(parseFloat(vv))) { return; }
		var w = traitWriteSatisfy(V, v.path, v.op, v.val);
		if (w) { wrote.push(w); }
	});
	/* 无可写条件（复杂表达式/函数判定/isnot 字符串值）→ 直接获得：记入强制标记 */
	if (!wrote.length) {
		try {
			if (!V.mbCE_forcedTraits || !Array.isArray(V.mbCE_forcedTraits)) { V.mbCE_forcedTraits = []; }
			var fk = forcedTraitKey(t);
			if (V.mbCE_forcedTraits.indexOf(fk) === -1) {
				V.mbCE_forcedTraits.push(fk);
				wrote.push("mbCE_forcedTraits+" + (t.name || fk));
			} else {
				wrote.push("mbCE_forcedTraits+" + (t.name || fk) + "(已有)");
			}
		} catch (e) { wrote.push("(强制获得失败) " + (e && e.message ? e.message : e)); }
	}
	return wrote;
}
/* 移除特质：先清强制获得标记（若有）；再主变量（第一个比较变量）写回不满足值 */
function revokeTrait(t, V, C) {
	var info = parseTraitHas(t.has);
	var wrote = [];
	if (isForcedTrait(V, t)) {
		try {
			var fl = V.mbCE_forcedTraits;
			var idx = fl.indexOf(forcedTraitKey(t));
			if (idx !== -1) { fl.splice(idx, 1); wrote.push("mbCE_forcedTraits-" + (t.name || forcedTraitKey(t))); }
		} catch (e) {}
	}
	if (info.includes) {
		var arr = safeGetObj(V, "backgroundTraits");
		if (Array.isArray(arr)) {
			var idx2 = arr.indexOf(info.includes);
			if (idx2 !== -1) { arr.splice(idx2, 1); wrote.push("backgroundTraits-" + info.includes); }
		}
	}
	if (info.vars.length) {
		var v0 = info.vars[0];
		var w = traitWriteUnsatisfy(V, v0.path, v0.op, v0.val);
		if (w) { wrote.push(w); }
	}
	return wrote;
}
function traitWriteSatisfy(V, path, op, valRaw) {
	var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	/* 十二巡修复：isnot 语义是「不等于」——满足 isnot true → 写 false；isnot false → 写 true；
	   isnot undefined → 写 1；isnot N → 写 N-1。此前与 is 共用分支导致布尔写反 */
	if (op === "isnot") {
		if (String(valRaw) === "true") { setPathVal(V, path, false); return path + "=false"; }
		if (String(valRaw) === "false") { setPathVal(V, path, true); return path + "=true"; }
		if (String(valRaw) === "undefined") { setPathVal(V, path, 1); return path + "=1"; }
		setPathVal(V, path, num - 1); return path + "=" + (num - 1);
	}
	if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
	if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "undefined") { return null; }
	if (isNaN(num)) { setPathVal(V, path, String(valRaw).replace(/["']/g, "")); return path + "=" + String(valRaw).replace(/["']/g, ""); }
	if (op === "lte") { setPathVal(V, path, num); return path + "=" + num; }
	if (op === "lt") { setPathVal(V, path, num - 1); return path + "=" + (num - 1); }
	/* 四巡自查修复：gt（严格大于）条件满足值必须是 num+1——此前与 gte/is 共用写 num，
	   写后 "x > num" 恒 false → 获取按钮显示已写但判定仍「未获得」
	   （原版受影响特质：Purity Boost $featsPurityBoost gt 0、Bratty $submissive lte 850 and gt 500） */
	if (op === "gt") { setPathVal(V, path, num + 1); return path + "=" + (num + 1); }
	setPathVal(V, path, num); return path + "=" + num;
}
function traitWriteUnsatisfy(V, path, op, valRaw) {
	var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	/* 十二巡修复：移除时让 isnot 条件变 false——isnot true → 写 true；isnot false → 写 false；
	   isnot undefined → 写 undefined（属性值为 undefined 时 undefined !== undefined 为 false）；isnot N → 写 N */
	if (op === "isnot") {
		if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
		if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
		if (String(valRaw) === "undefined") { setPathVal(V, path, undefined); return path + "=undefined"; }
		setPathVal(V, path, num); return path + "=" + num;
	}
	if (String(valRaw) === "true") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "false") { setPathVal(V, path, true); return path + "=true"; }
	if (isNaN(num)) { setPathVal(V, path, ""); return path + '=""'; }
	if (op === "lte") { setPathVal(V, path, num + 1); return path + "=" + (num + 1); }
	if (op === "lt") { setPathVal(V, path, num); return path + "=" + num; }
	setPathVal(V, path, 0); return path + "=0";
}
function setPathVal(V, path, val) {
	var parts = String(path).split(".");
	var cur = V;
	for (var i = 0; i < parts.length - 1; i++) {
		if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== "object") { cur[parts[i]] = {}; }
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = val;
}
/* 编译本体特质表（懒执行） */
function compileVanillaTraits() {
	if (VANILLA_TRAITS_CACHE) { return VANILLA_TRAITS_CACHE; }
	var out = [];
	VANILLA_TRAITS_RAW.forEach(function (t) {
		var info = parseTraitHas(t.has);
		var nm = String(t.name || "").replace(/^"|"$/g, "");
		/* 数值可改清单：数字比较变量（如 temple_burden / sciencetrait） */
		var values = [];
		info.vars.forEach(function (v) {
			var num = parseFloat(String(v.val).replace(/["']/g, ""));
			if (!isNaN(num) && (v.op === "gte" || v.op === "is" || v.op === "gt")) {
				/* 五巡自查：gt 满足值 = num+1，与 traitWriteSatisfy 一致（values 默认值即满足值） */
				values.push({ path: v.path, op: v.op, val: (v.op === "gt") ? num + 1 : num });
			}
		});
		out.push({ cat: t.cat, name: nm, has: t.has, parsed: info, values: values });
	});
	VANILLA_TRAITS_CACHE = out;
	return out;
}
/* 运行时发现模组特质：maplebirch.temporary.traitLists（MLI traits.inject 解析后的注入表） */
function discoverModTraits() {
	var out = [];
	try {
		var mb = resolveMB();
		var lists = mb && mb.temporary && mb.temporary.traitLists;
		if (!Array.isArray(lists)) { return out; }
		lists.forEach(function (cat) {
			if (!cat || !Array.isArray(cat.traits)) { return; }
			cat.traits.forEach(function (t) {
				if (!t || !t.name) { return; }
				var hasStr = (typeof t.has === "string") ? t.has : "";
				var parsed = parseTraitHas(hasStr);
				/* 双巡优化①：模组特质数字比较变量同样生成「可改数值」清单（仿 compileVanillaTraits），
				   使模组注入特质的数字条件也能直接改数值/回退——数据层 traitWriteValue/undo 已通用 */
				var values = [];
				parsed.vars.forEach(function (v) {
					var num = parseFloat(String(v.val).replace(/["']/g, ""));
					if (!isNaN(num) && (v.op === "gte" || v.op === "is" || v.op === "gt")) {
						values.push({ path: v.path, op: v.op, val: (v.op === "gt") ? num + 1 : num });
					}
				});
				out.push({
					cat: String(cat.title || "模组特质"),
					name: (typeof t.name === "function") ? t.name() : String(t.name),
					text: (typeof t.text === "function") ? String(t.text()) : String(t.text || ""),
					/* v1.8.11：保留 has 字符串——字符串判定可复用 grant/revoke 写变量直接获得/移除；
					   函数判定保留 hasFn，走强制获得标记路径 */
					has: hasStr,
					hasFn: (typeof t.has === "function") ? t.has : null,
					parsed: parsed,
					values: values,
					mod: true
				});
			});
		});
	} catch (e) {}
	return out;
}
