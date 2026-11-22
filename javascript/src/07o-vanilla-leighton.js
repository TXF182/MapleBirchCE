/* 职责：全局页 ⑬「礼顿把柄（学校）」——原版 $headblackmailed 清零（贴吧言灵 `$headblackmailed = 0`）、
   把三条来源分支一并清 0 的「彻底解除」、以及 v2.2.0 的「获取把柄」直写 1；vcore-leighton 留痕，可回退。
   原版取证（DoL 0.5.12.13 单文件 HTML，game\Degrees of Lewdity.html，可复跑 Grep）：
     - 全库 12 处 headblackmailed，原版没有任何一处写 0；置 1 的三条路径：
       L686106、L686131（School First Shoot 两个接受分支）、L695630（科学展拿 £5000，同时 headmoney=1）、L695638（拘留，同时 headnodetention=1）。
     - 判定：L299783（礼顿 NPC 得到 unforgiving trait）、L380149（Gwylan 对话：headblackmailed is 1 and headpolice isnot 1）、
       L540125（周事件 leightonDanceRefused）、L685909（School Fame Blackmail 台词）、L824459 / L824473（Leighton Private 兽/旁观分支）、L891945。
     - 陷阱：widget variablesVersionUpdate（L184483）的 L185169
       `<if $headnodetention is 1 or $headmoney is 1 or $headphotoshoot is 1>` → `<<set $headblackmailed to 1>>`
       只在版本升级时跑（L179027 Upgrade Waiting Room；L187986 backComp 且 _version lte 30408）。只清把柄会被下次跨版本升级回填。
     - 三条来源键同时被用于**跳过**礼顿线事件（L694235 / 694316 / 694868 / 694894 / 694902 / 853903 / 856490 / 856542 / 901193），
       清 0 等于把这些事件重新打开，故提供两个力度不同的按钮并写明后果。
     - 「获取把柄」= 直接写 headblackmailed=1：原版只有三条事件路径置 1（无旁门），直写等价跳过事件进入被勒索状态；
       来源分支与警局线不写（保持真实，版本升级迁移 L185169 也不会被误触发）。
     - headpolice 是另一条线（L643796 把证据交给警察，L380154 / 645122 / 645138 判定），本组只读不写。
   排版复用 07m-vanilla-econ-view.js 的 Ui* 助手；拆段不拆语义。 */

	function mbCEVanillaLeightonN(v) {
		var n = Number(v);
		if (isFinite(n)) { return n; }
		return 0;
	}
	function mbCEVanillaLeightonHas(sv, k) {
		return Object.prototype.hasOwnProperty.call(sv, k);
	}
	/* 三个来源分支键：科学展 £5000 / 拘留 / 写真 */
	var MCE_LEIGHTON_SRC = [
		{ key: "headmoney", zh: "5000 英镑线" },
		{ key: "headnodetention", zh: "拘留线" },
		{ key: "headphotoshoot", zh: "写真线" }
	];

	function mbCEVanillaLeightonState() {
		var out = { ok: false, blackmailed: 0, police: 0, src: {}, set: false };
		var sv = getV();
		if (!sv) { return out; }
		out.ok = true;
		out.set = mbCEVanillaLeightonHas(sv, "headblackmailed");
		out.blackmailed = mbCEVanillaLeightonN(sv.headblackmailed);
		out.police = mbCEVanillaLeightonN(sv.headpolice);
		MCE_LEIGHTON_SRC.forEach(function (m) {
			out.src[m.key] = mbCEVanillaLeightonN(sv[m.key]);
		});
		return out;
	}

	/* purge=false：只清把柄（贴吧原版）；purge=true：连三条来源一起清，避免版本升级回填 */
	function mbCEVanillaLeightonClear(purge) {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var id = purge ? "leighton-purge" : "leighton-clear";
		var keys = purge ? ["headblackmailed", "headmoney", "headnodetention", "headphotoshoot"] : ["headblackmailed"];
		var before = { kind: id, val: {}, had: {} };
		keys.forEach(function (k) {
			before.val[k] = sv[k];
			before.had[k] = mbCEVanillaLeightonHas(sv, k);
			sv[k] = 0;
		});
		mbCEVanillaTrace(id, before, "headblackmailed", purge ? "礼顿把柄彻底解除" : "礼顿把柄清零", "vcore-leighton");
		if (!purge) {
			return { ok: true, message: "已把礼顿把柄写到 0（原版只有置 1 的三条路径，没有自己清零的分支）。"
				+ "注意：版本升级时，若拘留 / 5000 英镑 / 写真任一条仍为 1，原版迁移会把把柄重新置 1——要长期解除请用「彻底解除」。" };
		}
		return { ok: true, message: "已把把柄与三条来源分支（拘留 / 5000 英镑 / 写真）一起清 0，版本升级不会再把把柄回填。"
			+ "副作用：这三条分支同时被用来跳过礼顿线的拘留、写真、5000 英镑事件，清 0 后这些内容会按「未发生过」重新开放；警局线未动。" };
	}

	/* v2.2.0 获取把柄：直写 headblackmailed = 1（等价原版被勒索状态；原版置 1 只有三条事件路径，无旁门）。
	   来源分支与警局线一律不写——来源保持真实，版本升级迁移（L185169）不会被误触发。 */
	function mbCEVanillaLeightonGet() {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var before = { kind: "leighton-get",
			val: { headblackmailed: sv.headblackmailed },
			had: { headblackmailed: mbCEVanillaLeightonHas(sv, "headblackmailed") } };
		sv.headblackmailed = 1;
		mbCEVanillaTrace("leighton-get", before, "headblackmailed", "礼顿把柄获取（置 1）", "vcore-leighton");
		return { ok: true, message: "已获取礼顿把柄（置 1）：礼顿会按「手上有你把柄」走勒索线；"
			+ "来源分支与警局线未动（原版三条事件路径仍按未发生过开放），可回退。" };
	}

	function mbCEVanillaLeightonUndo(id, b, key) {
		if (!b || typeof b !== "object") { return null; }
		var kinds = { "leighton-clear": 1, "leighton-purge": 1, "leighton-get": 1 };
		if (!kinds[b.kind]) { return null; }
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用" }; }
		var val = b.val && typeof b.val === "object" ? b.val : {};
		var had = b.had && typeof b.had === "object" ? b.had : {};
		Object.keys(val).forEach(function (k) {
			if (had[k]) { sv[k] = val[k]; return; }
			try { delete sv[k]; } catch (eL) { void eL; }
		});
		delete sv.mbCE_wrote[key];
		return { ok: true, message: "已还原礼顿把柄与来源分支到首次写入前的值" };
	}

	/* ---------- ⑬ 礼顿把柄 ---------- */
	function mbCEVanillaLeightonSecBody(body, redraw) {
		mbCEVanillaEconUiClear(body);
		var st = mbCEVanillaLeightonState();
		if (!st.ok) {
			body.appendChild(el("div", MCE_CLS.hint, "存档变量不可用（游戏尚未就绪），暂不能写礼顿把柄。"));
			return;
		}
		var srcTxt = MCE_LEIGHTON_SRC.map(function (m) { return m.zh + " " + (st.src[m.key] ? "有" : "无"); }).join(" / ");
		mbCEVanillaEconUiKv(body, [
			["礼顿把柄", st.blackmailed ? "有（勒索中）" : (st.set ? "无" : "未设置")],
			["警局线", st.police ? "已交给警察" : "未交"],
			["来源分支", srcTxt]
		]);
		var g = mceBtnGrid(body);
		mbCEVanillaEconUiBtn(g, "获取把柄", "把礼顿把柄置 1（等价原版被拍到照片后的勒索状态）；来源分支与警局线不动", function () {
		mbCEVanillaEconUiRun(mbCEVanillaLeightonGet(), redraw);
	});
	mbCEVanillaEconUiBtn(g, "解除把柄", "只把礼顿把柄写 0（贴吧言灵口径）；版本升级可能被原版迁移回填", function () {
			mbCEVanillaEconUiRun(mbCEVanillaLeightonClear(false), redraw);
		});
		mbCEVanillaEconUiBtn(g, "彻底解除", "把柄 + 拘留线 + 5000 英镑线 + 写真线一起清 0：升级不会回填，但这些事件会重新开放", function () {
			mbCEVanillaEconUiRun(mbCEVanillaLeightonClear(true), redraw);
		});
		body.appendChild(mceFoldHint("原版把柄只能由科学展 £5000、拘留、写真三条路径置 1，也没有「解除勒索」的分支。"
			+ "「获取把柄」直接写 1，跳过事件进入被勒索状态（礼顿按勒索者对待，学校名声勒索台词等都会出现）；"
			+ "清 0 后礼顿不再把你当被勒索者，但礼顿身上已经获得的 unforgiving 特质属于 NPC 数据，不会因此撤销。"));
		mbCEVanillaEconUiUndoGrid(body, redraw, [["leighton-get", "回退获取把柄"], ["leighton-clear", "回退解除把柄"], ["leighton-purge", "回退彻底解除"]]);
	}

	function mbCERenderVanillaLeighton(pane) {
		var sec = mceNewSec(pane, 13, "礼顿把柄（学校）",
			"原版「礼顿把柄」清零与来源分支彻底解除，两者分别留痕、可分别回退。写 0 前请看清两个按钮的后果差异。");
		mbCEVanillaLeightonSec(sec);
	}
	function mbCEVanillaLeightonSec(sec) {
		var body = mceNewGroup(sec, "勒索把柄", "解除把柄 / 彻底解除（连三条来源分支）");
		var redraw = function () { mbCEVanillaLeightonSecBody(body, redraw); };
		redraw();
	}
