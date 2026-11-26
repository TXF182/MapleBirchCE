/* 职责：房租金额的「便士 ↔ 英镑」换算 · 每周租金直写 · 租金锁定（07m 房租组的补充分段）。
   原版事实（DoL 0.5.12.13 源码实证，勿凭印象改口径）：
   - 金额一律按便士存：printmoney 注释 "amount in pennies"（HTML L346818），formatMoney 显示时 Math.floor(amount / 100)（L68492–L68502）。
   - 租金档位表 [10000,30000,50000,70000,100000,150000,200000]（<<rentpay>> L589275）= £100 / £300 / £500 / £700 / £1000 / £1500 / £2000。
   - <<rentmod>>（L589266–L589271）在初始化与每次交租时重算：rentmoney *= settings.rentCostModifier（滑块 ≥1、默认 1），robinpaid === 1 时再 ×2。
   - 因此「锁定」= 记住目标便士值，在每次 passageinit 检查 rentmoney 是否被重算改写，改了就写回；
     若玩家开着倍率或替 Robin 付，结算瞬间仍会乘一次，返回文案里显式警告。
   留痕走 07l 的 vcore 通道，回退由 07m-vanilla-econ-undo.js 的 rent-money / rent-lock 分支处理。 */

	function mbCEVanillaEconFmt(pennies) {
		var n = Number(pennies);
		if (!isFinite(n)) { n = 0; }
		var neg = n < 0;
		n = Math.abs(n);
		var intPart = Math.floor(n / 100);
		var s = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		var dec = Math.floor(n % 100);
		var body = "£" + s + (dec ? "." + ("0" + dec).slice(-2) : "");
		return (neg ? "-" : "") + body;
	}
	/* 输入按英镑收（允许两位小数），结果转便士；空串 / 非数字 / 负数 / 超上限一律判 null */
	function mbCEVanillaEconPoundsToPence(raw) {
		if (raw === "" || raw === null || raw === undefined) { return null; }
		var n = Number(raw);
		if (!isFinite(n) || n < 0) { return null; }
		var p = Math.round(n * 100);
		if (!isFinite(p) || p > 99999999) { return null; }
		return p;
	}
	function mbCEVanillaEconRentMoney(raw) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var pence = mbCEVanillaEconPoundsToPence(raw);
		if (pence === null) { return { ok: false, message: "每周租金需为 £0 – £999,999.99 的金额（可带两位小数）" }; }
		var before = { kind: "rent-money", rentmoney: V.rentmoney === undefined ? undefined : Number(V.rentmoney) };
		V.rentmoney = pence;
		if (V.mbCE_rentLock && typeof V.mbCE_rentLock === "object") { V.mbCE_rentLock.money = pence; }
		mbCEVanillaTrace("rent-money", before, "rentmoney", "每周租金直写（英镑输入转便士）", "vcore-econ");
		return { ok: true, message: "每周租金已设为 " + mbCEVanillaEconFmt(pence) };
	}
	function mbCEVanillaEconRentLockRaw() {
		var V = getV();
		var lock = V && V.mbCE_rentLock;
		if (!lock || typeof lock !== "object") { return null; }
		var m = Number(lock.money);
		if (!isFinite(m) || m < 0) { return null; }
		return { money: m };
	}
	/* 锁定警告：原版重算会乘倍率，锁值在结算瞬间可能对不上，必须提前告诉玩家 */
	function mbCEVanillaEconRentLockWarn(V) {
		var warn = "";
		try {
			var mod = V && V.settings ? Number(V.settings.rentCostModifier) : 1;
			if (isFinite(mod) && mod !== 1) { warn += "；当前租金倍率 " + mod + "，结算时会按倍率重算一次"; }
		} catch (eM) { /* 设置缺失时按默认 1 处理 */ }
		if (V && V.robinpaid === 1) { warn += "；你正替 Robin 付租（×2），锁值在交租时会翻倍，建议先解除代付"; }
		return warn;
	}
	function mbCEVanillaEconRentLockOn() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var cur = Number(V.rentmoney);
		if (!isFinite(cur) || cur < 0) { return { ok: false, message: "当前没有可锁定的周租金额（先写入每周租金）" }; }
		var before = {
			kind: "rent-lock",
			lock: mbCEVanillaEconClone(V.mbCE_rentLock),
			rentmoney: cur
		};
		V.mbCE_rentLock = { money: Math.round(cur), at: Date.now() };
		mbCEVanillaTrace("rent-lock", before, "mbCE_rentLock", "锁定每周租金（每次进入段落检查并写回）", "vcore-econ");
		return { ok: true, message: "已锁定每周租金 " + mbCEVanillaEconFmt(cur) + mbCEVanillaEconRentLockWarn(V) };
	}
	function mbCEVanillaEconRentLockOff() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		if (!V.mbCE_rentLock) { return { ok: false, message: "当前没有锁定" }; }
		var before = { kind: "rent-lock", lock: mbCEVanillaEconClone(V.mbCE_rentLock), rentmoney: Number(V.rentmoney) || 0 };
		delete V.mbCE_rentLock;
		mbCEVanillaTrace("rent-lock", before, "mbCE_rentLock", "解除每周租金锁定", "vcore-econ");
		return { ok: true, message: "已解除每周租金锁定（原版重算将恢复正常）" };
	}
	/* passageinit 每段检查：只纠正被重算改写的值，锁值本身不动；任何异常静默，不得阻断段落流转 */
	function mbCEVanillaEconRentLockTick() {
		var V = getV();
		var lock = mbCEVanillaEconRentLockRaw();
		if (!V || !lock) { return; }
		if (Number(V.rentmoney) !== lock.money) { V.rentmoney = lock.money; }
	}
