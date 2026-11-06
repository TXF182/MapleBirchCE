/* ============ v2.0.0.002 新适配：FertilityExpansion 1.7.0（伊甸生育/子女大扩展） ============
   源码实证（GitHub Liliths-Legacy/DOL-FertilityExpansion-MOD@main，对照源码 _modcache/fert_tmp）：
   mods/FertilityExpansion/boot.json —— name "FertilityExpansion"、version "1.7.0"，
   tweeFileList/scriptFileList/styleFileList 全空（全部内容靠 TweeReplacer 注入 + game/*.twee 15 个 + modules 20+ js + img 22 张）；
   addonPlugin = TweeReplacer（StoryCaption 挂 <<edenSetup>>、Children Activity Events 挂记录钩子等）。
   变量命名空间 = V.eden.*（eden.twee 里 $eden 是 schema 迁移对象，逐档 0→8 迁移，默认结构见 eden.twee:40-50/79-84/91-95）。
   本适配器只声明"源码有默认值、判定为标量"的键（object/array 如 eden.children / eden.facility 整体不声明，避免类型错配）。
   已证伪不声明的一条：`eden.lifeStoryReadMode` 取值为字符串 "first"/"reread"/null
   （eden-life-story.twee:3/93/121/128），不是 0/1 档位——按 v2.0.0.001 类型语义纪律，不建 stage。
   注：该模组自带 eden-cheats.js / eden-cheats-ui.js 作弊面板（10 项）。v2.0.0.002 起 CE 不做"只写数值"的
   缩水适配——04a-14-fert-cheats.js 直接复用其 window.EdenCheats，把模组面板的 10 项等价搬到 CE 的模组作弊页，
   与模组共用同一套 guard / 快照回滚 / feats.locked 语义（不重写它的 sync 链，避免两套写入口互相打架）。 */
/* 共享 helper：判定 ModLoader 是否装了某个名字的 mod。
   window.modDataValueZipList 的条目形态不稳定（string / {name|modName|id} 两种都见过），故都兼容。 */
function mbCEHasModNamed(names) {
	try {
		if (typeof window === "undefined") { return false; }
		var want = Array.isArray(names) ? names : [names];
		var list = window.modDataValueZipList;
		if (list && list.length) {
			for (var i = 0; i < list.length; i++) {
				var it = list[i];
				var n = "";
				if (typeof it === "string") { n = it; }
				else if (it && typeof it === "object") { n = String(it.name || it.modName || it.id || ""); }
				if (!n) { continue; }
				for (var j = 0; j < want.length; j++) {
					if (n.indexOf(want[j]) >= 0) { return true; }
				}
			}
		}
		return false;
	} catch (e) { return false; }
}
CHEAT_ADAPTERS["fertility-expansion"] = {
	detect: function () {
		try {
			if (typeof window === "undefined") { return false; }
			if (typeof mbCEHasModNamed === "function" && mbCEHasModNamed(["FertilityExpansion", "Fertility Expansion"])) { return true; }
			var V = (typeof getV === "function") ? getV() : null;
			return !!(V && V.eden && typeof V.eden === "object");
		} catch (e) { return false; }
	},
	entry: {
		modId: "fertility-expansion",
		modName: "FertilityExpansion 1.7.0（伊甸子女/生育扩展）",
		tasks: [],
		stages: [
			{ key: "fert_schema", name: "数据结构版本（0–8，逐档迁移）", varPath: "eden.schemaVersion",
			  levels: [0, 1, 2, 3, 4, 5, 6, 7, 8],
			  labels: ["0 初始", "1 子女容器", "2 journal→profile", "3 伊甸房产", "4 成长阶段设置",
			           "5 天赋与性格", "6 技能与日程", "7 亲密度/成年/通讯录", "8 成年遭遇指针"] }
		],
		abilities: [
			{ key: "fert_owned", name: "已取得伊甸房产", varPath: "eden.facility.owned", type: "boolean" },
			{ key: "fert_expanded", name: "伊甸房产已扩建", varPath: "eden.facility.expanded", type: "boolean" },
			{ key: "fert_bailey", name: "贝利已上门（房产线前置）", varPath: "eden.facility.baileyIntroduced", type: "boolean" },
			{ key: "fert_transfer", name: "转移流程已介绍", varPath: "eden.facility.transferIntroduced", type: "boolean" },
			{ key: "fert_neveradult", name: "禁止自动成年", varPath: "eden.settings.neverAutoAdult", type: "boolean" },
			{ key: "fert_sterile", name: "允许不孕妊娠分支", varPath: "eden.settings.allowSterilePregnancy", type: "boolean" },
			{ key: "fert_hotspot", name: "大厅热点显示", varPath: "eden.settings.showHallHotspots", type: "boolean" },
			{ key: "fert_human", name: "允许人类后代", varPath: "eden.settings.allowHumanDescendants", type: "boolean" },
			/* v2.0.0.002 补声明：eden-age.js normalizeSettings 里还有 3 个未被 CE 覆盖的布尔设置
			   （resetAgeOnTransfer:45 / immediateLifeStory:48 / enableNightVisits:52，均按 === true / !== false 判定）。
			   有意不声明 eden.settings.parentTitleSource（取值是字符串 "parentage"/"identity"/"appearance"，
			   eden-age.js:51，按 types-are-judgements 纪律不做 stage/number 档位，免得写入数字把模组判定打坏）。 */
			{ key: "fert_resetage", name: "转移时重置成长年龄", varPath: "eden.settings.resetAgeOnTransfer", type: "boolean" },
			{ key: "fert_immstory", name: "立即生成人生故事", varPath: "eden.settings.immediateLifeStory", type: "boolean" },
			{ key: "fert_nightvisit", name: "启用夜间探访（关闭后不触发）", varPath: "eden.settings.enableNightVisits", type: "boolean" }
		],
		scenes: [],
		values: [
			{ key: "fert_capacity", name: "伊甸房产容量（默认 3）", varPath: "eden.facility.capacity", type: "number", min: 0, max: 20,
			  note: "eden.twee:82 默认 3；模组按 gte 判定，写大值不会崩，但 UI 列表会随之变长" },
			{ key: "fert_maturity", name: "成长天数阈值（默认 90）", varPath: "eden.settings.maturityDays", type: "number", min: 0, max: 365,
			  note: "eden.twee:93 默认 90；写 0 会让子女立即进入下一成长阶段（模组按日结算）" }
		]
	}
};
