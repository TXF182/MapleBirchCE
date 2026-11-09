/* 职责：面板写入留痕 V.mbCE_wrote 有界化（v2.0.12 结构门禁拆段：01-core 因错误池涨到 415 行超 400 上限）；同一 IIFE 闭包内，函数声明提升，调用顺序不受影响 */
	/* v1.8.15 九巡：面板写入留痕 V.mbCE_wrote 有界化——条目数 > 400 时按时间戳升序删除最旧一半。
	   防止长时间高强度操作导致留痕无限增长（每笔写入都占存档空间）；被删条目的回退窗口随之关闭（旧操作不再可回退）。 */
	function mbCEWroteTrim(V) {
		try {
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return; }
			var keys = Object.keys(V.mbCE_wrote);
			if (keys.length <= 400) { return; }
			keys.sort(function (a, b) {
				var ta = (V.mbCE_wrote[a] && typeof V.mbCE_wrote[a].t === "number") ? V.mbCE_wrote[a].t : 0;
				var tb = (V.mbCE_wrote[b] && typeof V.mbCE_wrote[b].t === "number") ? V.mbCE_wrote[b].t : 0;
				return ta - tb;
			});
			/* v2.0.8：锁定写回留痕（type:"lock"）不参与裁剪——每个被锁 key 只有一条，是「取消锁定 + 还原原值」的
			   唯一依据；被裁掉后再次写回会把 before 记成「已被锁定覆盖后的值」，回退就退化成原样还原、等于失效。 */
			var drop = Math.floor(keys.length / 2);
			var rm = 0, vi = 0;
			while (rm < drop && vi < keys.length) {
				var vLock = V.mbCE_wrote[keys[vi]];
				if (vLock && vLock.type === "lock") { vi++; continue; }
				try { delete V.mbCE_wrote[keys[vi]]; } catch (e) { V.mbCE_wrote[keys[vi]] = undefined; }
				rm++; vi++;
			}
		} catch (e) { mbCECatch("mbCEWroteTrim", e); }
	}
