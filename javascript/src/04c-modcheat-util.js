	function normalizeCheatMod(m) {
		return {
			modId: m.modId, modName: m.modName, declared: true,
			tasks: Array.isArray(m.tasks) ? m.tasks : [],
			stages: Array.isArray(m.stages) ? m.stages : [],
			abilities: Array.isArray(m.abilities) ? m.abilities : [],
			scenes: Array.isArray(m.scenes) ? m.scenes : [],
			values: Array.isArray(m.values) ? m.values : []
		};
	}

	/* v1.8.12 功能12：适配器工作流工具——运行时一致性审计（开发新适配器后自查：
	   注册键与 entry.modId 一致、分类项 key/name/varPath 完整、探测函数存在、无空适配器）。
	   返回 { total, healthy, warnings[], errors[] }；healthy>0 时可用面板正常渲染全部适配器。 */
	function auditAdapters() {
		var out = { total: 0, healthy: 0, warnings: [], errors: [] };
		try {
			Object.keys(CHEAT_ADAPTERS).forEach(function (id) {
				var a = CHEAT_ADAPTERS[id];
				out.total++;
				var entry = (a && a.entry) ? a.entry : {};
				var name = entry.modName || id;
				var cats = ["tasks", "stages", "abilities", "scenes", "values"];
				var itemCount = 0;
				cats.forEach(function (c) {
					if (Array.isArray(entry[c])) { itemCount += entry[c].length; }
				});
				var errs = [];
				if (!entry.modId) { errs.push("entry 缺 modId"); }
				else if (entry.modId !== id) { errs.push("entry.modId（" + entry.modId + "）与注册键不一致"); }
				if (!itemCount) { out.warnings.push(id + "（" + name + "）：没有任何能力/阶段/数值项（空适配器）"); }
				/* 分类字段要求：varPath 类（tasks/stages/abilities/values）必须 varPath；
				   scenes 类（场景直达）用 skipVar/completeVar/progressVar，无 varPath */
				cats.forEach(function (c) {
					(Array.isArray(entry[c]) ? entry[c] : []).forEach(function (it, idx) {
						if (!it || typeof it !== "object") { errs.push(c + "[" + idx + "] 非对象项"); return; }
						if (!it.key) { errs.push(c + "[" + idx + "] 缺 key"); }
						if (!it.name) { errs.push(c + "[" + idx + "] 缺 name"); }
						if (c === "scenes") {
							if (it.skipVar === undefined && it.completeVar === undefined && it.progressVar === undefined) {
								errs.push(c + "[" + idx + "] 缺 skipVar/completeVar/progressVar（场景直达键）");
							}
						} else if (it.varPath === undefined) {
							errs.push(c + "[" + idx + "] 缺 varPath");
						}
					});
				});
				if (typeof a.detect !== "function") { out.warnings.push(id + "：缺 detect 探测函数（列表永不命中）"); }
				if (errs.length) { out.errors.push(id + "（" + name + "）：" + errs.slice(0, 6).join("；") + (errs.length > 6 ? " 等" + errs.length + " 项" : "")); return; }
				out.healthy++;
			});
		} catch (e) { out.errors.push("审计异常：" + (e && e.message ? e.message : e)); }
		return out;
	}
