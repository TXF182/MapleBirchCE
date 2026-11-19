/* 职责：07m 五项直写的回退处理器（vcore-econ 留痕落地；拆分原因为结构门禁 S1 单段 400 行）。
   由 mbCEVanillaExtUndo 在未知 kind 处委派；未知 kind 返回 null。 */

/* ---------- 回退（由 mbCEVanillaExtUndo 在未知 kind 处委派；未知 kind 返回 null） ----------
	   每种 kind 一个处理器，避免一个巨型 if 链把复杂度顶穿 lint 棘轮。 */
	var MB_CE_ECON_UNDO = {
		"rent-days": function (V, b, key) {
			if (b.renttime === undefined) { try { delete V.renttime; } catch (e1) {} } else { V.renttime = b.renttime; }
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原租期倒计时为 " + (b.renttime === undefined ? "未设置" : b.renttime + " 天") };
		},
		"rent-debt": function (V, b, key) {
			V.baileyRefusedToPayTotal = Number(b.debt) || 0;
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原欠租为 £" + (Number(b.debt) || 0) };
		},
		"school": function (V, b, key) {
			if (V.daily && V.daily.school && b.attended) { V.daily.school.attended = mbCEVanillaEconClone(b.attended); }
			if (b.missed === undefined || b.missed === null) {
				try { delete V.schoolLessonsMissed; } catch (e2) {}
			} else {
				V.schoolLessonsMissed = mbCEVanillaEconClone(b.missed);
			}
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原今日出勤与旷课计数" };
		},
		"farm": function (V, b, key) {
			if (!V.plots || typeof V.plots !== "object") { return { ok: false, message: "农场地块已不在，无法回退" }; }
			V.plots[b.loc] = mbCEVanillaEconClone(b.plots);
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原「" + mbCEVanillaEconPlotZh(b.loc) + "」的地块状态" };
		},
		"condoms": function (V, b, key) {
			if (b.condoms === undefined) { try { delete V.condoms; } catch (e3) {} } else { V.condoms = b.condoms; }
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原避孕套数量为 " + (b.condoms === undefined ? "未设置" : b.condoms + " 个") };
		},
		"tattoo": function (V, b, key) {
			if (!V.skin || typeof V.skin !== "object") { return { ok: false, message: "皮肤数据已不在，无法回退" }; }
			V.skin[b.part] = mbCEVanillaEconClone(b.value);
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原「" + mbCEVanillaEconBodyZh(b.part) + "」的皮肤数据" };
		},
		"tattoo-all": function (V, b, key) {
			V.skin = mbCEVanillaEconClone(b.skin);
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原全部皮肤数据" };
		}
	};
	function mbCEVanillaEconUndo(id, b, key) {
		var V = getV();
		if (!V || !b || typeof b !== "object") { return null; }
		var fn = MB_CE_ECON_UNDO[String(b.kind || "")];
		return typeof fn === "function" ? fn(V, b, key) : null;
	}
