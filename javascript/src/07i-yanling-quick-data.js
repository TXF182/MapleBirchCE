/* 职责：言灵页「原帖 52 条」补丁数据表 —— 分组 / 键路径 / 写入类型 / 玩家说明。
   只放数据，不含执行逻辑；执行与回退见 07i-yanling-quick.js。
   来源：DoL-Project\言灵去重后-纯净版.txt（贴吧 221 条 → 72 条校验 → 与 CE 逐条去重 → 52 条）。
   分组原则：同类型合并为选项卡；普通置数/布尔/增量共用执行器，数组、枷锁承租人、怨灵槽位、时间戳单列特殊类型。 */
var MCE_YANLING_QUICK_TABS = [
	{ key: "base", name: "贞洁与统计", sub: "6 贞洁 · 14 统计" },
	{ key: "body", name: "身体与状态", sub: "9 项" },
	{ key: "fame", name: "名声", sub: "6 项" },
	{ key: "misc", name: "角色与时间", sub: "17 项" }
];

var MCE_YANLING_QUICK = [
	/* ===== 选项卡 1：贞洁（6） ===== */
	{ id: "virg_vaginal", tab: 0, sec: "贞洁", label: "阴道贞洁", kind: "bool", ops: [["player.virginity.vaginal", true]], hint: "$player.virginity.vaginal = true（原帖：荫道贞洁）" },
	{ id: "virg_penile", tab: 0, sec: "贞洁", label: "阴茎贞洁", kind: "bool", ops: [["player.virginity.penile", true]], hint: "$player.virginity.penile = true（原帖：阴金贞洁）" },
	{ id: "virg_anal", tab: 0, sec: "贞洁", label: "菊部贞洁", kind: "bool", ops: [["player.virginity.anal", true]], hint: "$player.virginity.anal = true" },
	{ id: "virg_oral", tab: 0, sec: "贞洁", label: "口腔贞洁", kind: "bool", ops: [["player.virginity.oral", true]], hint: "$player.virginity.oral = true" },
	{ id: "virg_hand", tab: 0, sec: "贞洁", label: "牵手贞洁", kind: "bool", ops: [["player.virginity.handholding", true]], hint: "$player.virginity.handholding = true" },
	{ id: "virg_kiss", tab: 0, sec: "贞洁", label: "接吻贞洁", kind: "bool", ops: [["player.virginity.kiss", true]], hint: "$player.virginity.kiss = true" },

	/* ===== 选项卡 1：性经历统计（13） + 事件统计（1） ===== */
	{ id: "stat_orgasm", tab: 0, sec: "性经历统计", label: "清空高潮", kind: "set", ops: [["orgasmstat", 0], ["orgasmTimeStat", 0]], hint: "$orgasmstat / $orgasmTimeStat 清零" },
	{ id: "stat_penetration", tab: 0, sec: "性经历统计", label: "清空插入", kind: "set", ops: [["vaginalstat", 0], ["analstat", 0], ["vaginalTimeStat", 0], ["analTimeStat", 0]], hint: "阴道 / 肛门次数与时长四项清零" },
	{ id: "stat_oral", tab: 0, sec: "性经历统计", label: "清空口部", kind: "set", ops: [["oralstat", 0], ["oralejacstat", 0], ["semenswallowedstat", 0]], hint: "口腔次数 / 口射 / 吞咽三项清零" },
	{ id: "stat_hand", tab: 0, sec: "性经历统计", label: "清空手部", kind: "set", ops: [["handstat", 0], ["handejacstat", 0]], hint: "手部次数 / 手射两项清零" },
	{ id: "stat_legs", tab: 0, sec: "性经历统计", label: "足腿清零", kind: "set", ops: [["feetstat", 0], ["thighstat", 0], ["feetejacstat", 0], ["thighejacstat", 0]], hint: "足 / 腿次数与射精四项清零" },
	{ id: "stat_chest", tab: 0, sec: "性经历统计", label: "胸臀清零", kind: "set", ops: [["cheststat", 0], ["bottomstat", 0], ["chestejacstat", 0], ["bottomejacstat", 0]], hint: "胸 / 臀次数与射精四项清零" },
	{ id: "stat_face", tab: 0, sec: "性经历统计", label: "精液清除", kind: "set", ops: [["faceejacstat", 0], ["neckejacstat", 0], ["hairejacstat", 0], ["tummyejacstat", 0]], hint: "脸 / 颈 / 头发 / 腹部精液四项清零" },
	{ id: "stat_creampie", tab: 0, sec: "性经历统计", label: "内射清除", kind: "set", ops: [["creamstat", 0], ["sexStats.creampie.self.vagina", 0], ["sexStats.creampie.self.anus", 0], ["sexStats.creampie.self.mouth", 0]], hint: "$creamstat + 三处内射计数清零（只动 self，不碰 NPC 侧）" },
	{ id: "stat_masturbation", tab: 0, sec: "性经历统计", label: "自慰重置", kind: "set", ops: [["masturbationstat", 0], ["masturbationorgasmstat", 0], ["masturbationTimeStat", 0]], hint: "自慰次数 / 高潮 / 时长三项清零" },
	{ id: "stat_fluids", tab: 0, sec: "性经历统计", label: "体液清除", kind: "set", ops: [["milk_drank_stat", 0], ["milk_produced_stat", 0], ["nectar_drank_stat", 0], ["semen_produced_stat", 0], ["lube_produced_stat", 0]], hint: "饮奶 / 产奶 / 饮蜜 / 产精 / 分泌润滑五项清零" },
	{ id: "stat_double", tab: 0, sec: "性经历统计", label: "双穴清除", kind: "set", ops: [["vaginaldoublestat", 0], ["analdoublestat", 0]], hint: "双插（阴道 / 肛门）两项清零" },
	{ id: "stat_urine", tab: 0, sec: "性经历统计", label: "排尿清除", kind: "set", ops: [["urinestat", 0]], hint: "$urinestat = 0" },
	{ id: "stat_toys", tab: 0, sec: "性经历统计", label: "道具清除", kind: "set", ops: [["sextoystat", 0], ["straponstat", 0]], hint: "性玩具 / 穿戴阳具两项清零" },
	{ id: "stat_events", tab: 0, sec: "事件统计", label: "事件统计清零", kind: "set", ops: [["rapestat", 0], ["forcedprostitutionstat", 0], ["beastrapestat", 0], ["rapeTimeStat", 0]], hint: "强袭 / 强迫卖淫 / 兽袭次数与时长清零（CE 无 rapestat 入口，故保留）" },

	/* ===== 选项卡 2：身体与状态（9） ===== */
	{ id: "body_negative", tab: 1, sec: "身体与状态", label: "负面状态", kind: "set", ops: [["pain", 200], ["tiredness", 2000], ["stress", 10000], ["trauma", 5000], ["control", 0], ["drunk", 1000], ["drugged", 1000], ["hallucinogen", 1000], ["arousal", 10000]], hint: "疼痛 200 / 疲劳 2000 / 压力 10000 / 创伤 5000 / 控制 0 / 醉 1000 / 药 1000 / 幻觉 1000 / 兴奋 10000（原帖数值）" },
	{ id: "body_hypnosis", tab: 1, sec: "身体与状态", label: "去除催眠暗示", kind: "set", ops: [["hypnosis", 0]], hint: "$hypnosis = 0" },
	{ id: "body_tan", tab: 1, sec: "身体与状态", label: "去除晒痕", kind: "skin", ops: [], hint: "$player.skin.layers = [{layers: [], slots: {}, value: 0}]（整组替换；撤销还原原数组）" },
	{ id: "body_fallen", tab: 1, sec: "身体与状态", label: "失落衰减", kind: "set", ops: [["fallenbuild", 100]], hint: "$fallenbuild = 100（原帖名「失落衰减」）" },
	{ id: "body_play", tab: 1, sec: "身体与状态", label: "戏剧魅影", kind: "add", ops: [["englishPlayReadiness", 100]], hint: "$englishPlayReadiness += 100（英语剧准备度；可连点累加）" },
	{ id: "body_babyfood", tab: 1, sec: "身体与状态", label: "宝宝辅食", kind: "add", ops: [["foodstuff.bottle_of_breast_milk.amount", 1000]], hint: "$foodstuff.bottle_of_breast_milk.amount += 1000（需已解锁该食物，否则拒绝）" },
	{ id: "body_grace", tab: 1, sec: "身体与状态", label: "恩典满溢", kind: "set", ops: [["grace", 100]], hint: "$grace = 100" },
	{ id: "body_irrigation", tab: 1, sec: "身体与状态", label: "自动灌溉", kind: "set", ops: [["farm.irrigation", 9]], hint: "$farm.irrigation = 9（农场未初始化时拒绝）" },
	{ id: "body_farmbuild", tab: 1, sec: "身体与状态", label: "农场修建", kind: "set", ops: [["farm.build_timer", 1]], hint: "$farm.build_timer = 1" },

	/* ===== 选项卡 3：名声（6） ===== */
	{ id: "fame_exhibitionism", tab: 2, sec: "名声", label: "风光尽显", kind: "add", ops: [["fame.exhibitionism", 2000]], hint: "$fame.exhibitionism += 2000" },
	{ id: "fame_impreg", tab: 2, sec: "名声", label: "花花公子", kind: "add", ops: [["fame.impreg", 2000]], hint: "$fame.impreg += 2000（生育名声；上限受生育次数限制时由原版 clamp）" },
	{ id: "fame_sex", tab: 2, sec: "名声", label: "纵乐之巅", kind: "add", ops: [["fame.sex", 2000]], hint: "$fame.sex += 2000" },
	{ id: "fame_prostitution", tab: 2, sec: "名声", label: "明星花魁", kind: "add", ops: [["fame.prostitution", 2000]], hint: "$fame.prostitution += 2000" },
	{ id: "fame_rape", tab: 2, sec: "名声", label: "被袭难民", kind: "add", ops: [["fame.rape", 2000]], hint: "$fame.rape += 2000" },
	{ id: "fame_bestiality", tab: 2, sec: "名声", label: "福瑞大师", kind: "add", ops: [["fame.bestiality", 2000]], hint: "$fame.bestiality += 2000" },

	/* ===== 选项卡 4：角色与时间（17） ===== */
	{ id: "misc_ivory", tab: 3, sec: "角色", label: "不再痴迷", kind: "npc", npc: "Ivory Wraith", field: "lust", value: -100, hint: "象牙怨灵 $NPCName[29].lust -= 100（按 setup.NPCNameList 名称定位，不硬编码下标）" },
	{ id: "misc_framed", tab: 3, sec: "角色", label: "峭壁街见", kind: "set", ops: [["framed", "leighton"]], hint: "$framed = \"leighton\"（原帖名：峭壁街见）" },
	{ id: "misc_pillory", tab: 3, sec: "角色", label: "手枷延长", kind: "pillory", ops: [], hint: "仅在 $pillory.tenant.exists 为真时，把承租人 endTime 延长 1000 天（86400000000 ms）；无人示众时拒绝" },
	{ id: "misc_protected", tab: 3, sec: "角色", label: "交羽而眠", kind: "bool", ops: [["virginityProtected", true]], hint: "$virginityProtected = true" },
	{ id: "time_back_15m", tab: 3, sec: "时间倒退", label: "倒退一刻", kind: "time", value: -900, ops: [], hint: "Time.set($timeStamp - 900)" },
	{ id: "time_back_1h", tab: 3, sec: "时间倒退", label: "倒退一时", kind: "time", value: -3600, ops: [], hint: "Time.set($timeStamp - 3600)" },
	{ id: "time_back_6h", tab: 3, sec: "时间倒退", label: "倒退六时", kind: "time", value: -21600, ops: [], hint: "Time.set($timeStamp - 21600)" },
	{ id: "time_back_1d", tab: 3, sec: "时间倒退", label: "倒退一天", kind: "time", value: -86400, ops: [], hint: "Time.set($timeStamp - 86400)" },
	{ id: "time_back_1w", tab: 3, sec: "时间倒退", label: "倒退一周", kind: "time", value: -604800, ops: [], hint: "Time.set($timeStamp - 604800)" },
	{ id: "time_back_1mo", tab: 3, sec: "时间倒退", label: "倒退一月", kind: "time", value: -2592000, ops: [], hint: "Time.set($timeStamp - 2592000)，按 30 天计" },
	{ id: "time_fwd_1h", tab: 3, sec: "时间前进", label: "前进一时", kind: "time", value: 3600, ops: [], hint: "Time.set($timeStamp + 3600)" },
	{ id: "time_fwd_6h", tab: 3, sec: "时间前进", label: "前进六时", kind: "time", value: 21600, ops: [], hint: "Time.set($timeStamp + 21600)" },
	{ id: "time_fwd_1d", tab: 3, sec: "时间前进", label: "前进一天", kind: "time", value: 86400, ops: [], hint: "Time.set($timeStamp + 86400)" },
	{ id: "time_fwd_1w", tab: 3, sec: "时间前进", label: "前进一周", kind: "time", value: 604800, ops: [], hint: "Time.set($timeStamp + 604800)" },
	{ id: "time_fwd_1m", tab: 3, sec: "时间前进", label: "前进一月", kind: "time", value: 2592000, ops: [], hint: "Time.set($timeStamp + 2592000)，按 30 天计" },
	{ id: "misc_lesson", tab: 3, sec: "学业", label: "旷课自由", kind: "set", ops: [["lessonmissed", 0]], hint: "$lessonmissed = 0" },
	{ id: "misc_detention", tab: 3, sec: "学业", label: "留校清除", kind: "set", ops: [["detention", 0]], hint: "$detention = 0（留校次数，不是礼顿把柄键）" }
];

/* 数据自检：构建期暴露重复 id / 空分组（tool 侧另有测试，这里 fail-closed 让粘贴出错时构建就报） */
(function () {
	var seen = {}, i, e;
	for (i = 0; i < MCE_YANLING_QUICK.length; i++) {
		e = MCE_YANLING_QUICK[i];
		if (!e || typeof e.id !== "string" || seen[e.id]) { throw new Error("言灵补丁数据表 id 重复或缺失：" + String(e && e.id)); }
		seen[e.id] = 1;
		if (!(e.tab >= 0 && e.tab < MCE_YANLING_QUICK_TABS.length)) { throw new Error("言灵补丁数据表 tab 越界：" + e.id); }
	}
})();
