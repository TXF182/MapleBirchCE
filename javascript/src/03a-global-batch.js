/* 职责：全局批量填充 —— 属性·恋爱·转化·衣物·配方一键拉满 */
	/* ============ 全局批量 ============ */
	function globalFill() {
		var chars = listCharacters();
		var n = 0;
		chars.forEach(function (name) {
			var npc = findNpc(name);
			n += fillStats(npc, name);
		});
		return { characters: chars.length, stats: n };
	}
	function globalRomance() {
		var chars = listCharacters();
		var fixed = 0, total = 0;
		chars.forEach(function (name) {
			var stages = getRomanceStages(name);
			total += stages.length;
			stages.forEach(function (st) {
				if (st.ok) { return; }
				if (completeRomanceStage(name, st).ok) { fixed += 1; }
			});
			if (hasVanillaRomance(name)) {
				total += VANILLA_STAGES.length;
				fixed += unlockVanillaAll(name);
			}
		});
		ensureFarmState(); /* 一键完成后兜底：若写入了 farm_stage（艾利克斯农场阶段），立即补 $farm 空壳防社交页崩 */
		return { characters: chars.length, total: total, fixed: fixed };
	}
	function globalTransform() {
		var chars = listCharacters();
		var fixed = 0;
		chars.forEach(function (name) { fixed += unlockAllTransform(name); });
		return { characters: chars.length, stages: fixed };
	}

	/* ============ v1.9.26：特殊服装（setup.specialClothes 款式）+ 食谱一键解锁
	     DoL 0.5.12.13 特殊服装 = setup.specialClothes（135 件款式，分属万圣节/圣诞/情人节/神殿等套装）；
	     解锁标志 = V.specialClothes[i].unlocked = 3（满足要求解锁）；
	     每件有对应"故事"前置条件（套装 requirements，如 tentacletrait/syndromekylar/temple_rank 等），
	     解锁时同步补足这些条件，让游戏认为玩家已完成对应剧情（服装合法获得，非凭空出现）。
	     食谱 = setup.foodstuff[key].recipe.ingredients 非空；学会标志 = V.foodstuff[key].knows_recipe = true。 ============ */
	/* 套装→补足条件映射（从 DoL 0.5.12.13 setup.specialClothesSets 实证提取）。
	   op: "set"=标量赋值, "push"=数组去重push, "ensureField"=确保对象+设子键。
	   日期条件（halloween/valentines）不补足——unlocked=3 已解锁，日期随游戏推进。 */
	var SPECIAL_CLOTHES_SET_COND = {
		witch: [{key:"tentacletrait", op:"set", val:1}],
		vampire: [{key:"syndromekylar", op:"set", val:1}],
		mummy: [{key:"specialClothesEvents", op:"push", val:"cocoon"}],
		scarecrow: [{key:"specialClothesEvents", op:"push", val:"farm_defended"}],
		skeleton: [{key:"crypt_intro", op:"set", val:1}],
		future_suit: [{key:"tenyclusPlayCount", op:"set", val:7}],
		christmas: [{key:"specialClothesEvents", op:"push", val:"skulduggery_gift"}],
		rose_wedding: [{key:"kylarSeen", op:"push", val:"basement"}],
		wrap: [{key:"gwylanSeen", op:"push", val:"steal_wrap"}],
		underground_brothel: [{key:"undergroundbrothelescaped", op:"set", val:true}],
		underground_farm: [{key:"livestock", op:"ensureField", val:{field:"intro", value:1}}],
		loincloth: [{key:"syndromeeden", op:"set", val:1}],
		bird: [{key:"syndromebird", op:"set", val:1}],
		prison: [{key:"prison_intro", op:"set", val:1}],
		asylum: [{key:"asylumescaped", op:"set", val:1}],
		temple_initiate: [{key:"temple_rank", op:"set", val:"monk"}],
		temple_monk_and_nun: [{key:"temple_rank", op:"set", val:"monk"}],
		temple_evangelist: [{key:"specialClothesEvents", op:"push", val:"temple_solicitation"}],
		temple_confessor: [{key:"temple_confessor_intro", op:"set", val:1}],
		temple_exorcist: [{key:"jordan_ritual_dance", op:"set", val:4}],
		temple_sparring: [{key:"prof", op:"ensureField", val:{field:"whip", value:600}}],
		temple_sexy: [{key:"world_corruption_reduced", op:"set", val:30}],
		holy_stole: [{key:"grace", op:"set", val:100}],
		holy_pendant: [{key:"soup_kitchen_known", op:"set", val:1}],
		stone_pendant: [{key:"stone_pendant_found", op:"set", val:1}],
		dark_pendant: [{key:"loft_known", op:"set", val:1}],
		museum_rags: [{key:"museum_horse_success", op:"set", val:1},{key:"museum_stool_success", op:"set", val:1}],
		vintage: [{key:"museumAntiques", op:"ensureField", val:{field:"paintings", value:{paintingward:"museum"}}}],
		chain_tunic: [{key:"hcEndings", op:"push", val:"S"}],
		foreign_school: [{key:"headdrive", op:"set", val:1}],
		brothel: [{key:"brothelshowdata", op:"ensureField", val:{field:"intro", value:1}}],
		chef: [{key:"chef_state", op:"set", val:9}],
		hookah: [{key:"hookah_state", op:"set", val:2}],
		islander: [{key:"islander_mask", op:"set", val:100}],
		fox_mask: [{key:"auriga_artefact", op:"set", val:1}],
		fedora: [{key:"specialClothesEvents", op:"push", val:"smuggling"}],
		catsuit: [{key:"catsuit_found", op:"set", val:1}],
		janet: [{key:"janet_book_read", op:"set", val:1}],
		dance_studio: [{key:"danceStudio", op:"ensureField", val:{field:"jobOffered", value:1}}],
		sage_witch_hat: [{key:"gwylanSeen", op:"push", val:"ritual_sex"}],
		familiar_collar: [{key:"gwylanSeen", op:"push", val:"familiar_collar"}],
		shrine: [{key:"fox", op:"set", val:6}],
		jasper: [{key:"gwylanSeen", op:"push", val:"request_gold_accessories"}],
		butterfly: [{key:"backgroundTraits", op:"push", val:"plantlover"}],
		succubus: [{key:"demon", op:"set", val:6}]
	};
	/* 单件条件（baseItem.requirements，非 set 条件） */
	var SPECIAL_CLOTHES_ITEM_COND = {
		"rose": [{key:"gwylanSeen", op:"push", val:"rose"}],
		"daisy": [{key:"plants_known", op:"push", val:"daisy"}],
		"flower crown": [{key:"specialClothesEvents", op:"push", val:"flowerCrownGH"}]
	};
	function globalUnlockClothes() {
		var V = getV(), setup = getSetup();
		var n = 0, stories = 0;
		try {
			if (!Array.isArray(setup.specialClothes)) { return { unlocked: 0, stories: 0 }; }
			if (!Array.isArray(V.specialClothes)) { V.specialClothes = []; }
			function applyCond(c) {
				try {
					if (c.op === "set") {
						if (V[c.key] !== c.val) { V[c.key] = c.val; stories += 1; }
					} else if (c.op === "push") {
						if (!Array.isArray(V[c.key])) { V[c.key] = []; }
						if (V[c.key].indexOf(c.val) === -1) { V[c.key].push(c.val); stories += 1; }
					} else if (c.op === "ensureField") {
						if (!V[c.key] || typeof V[c.key] !== "object") { V[c.key] = {}; }
						if (typeof c.val.value === "object" && c.val.value !== null) {
							/* value 是对象：确保 field 是对象，合并 value（不覆盖兄弟键，如 vintage.paintings 不丢其他画） */
							if (!V[c.key][c.val.field] || typeof V[c.key][c.val.field] !== "object") { V[c.key][c.val.field] = {}; }
							var chg = false;
							Object.keys(c.val.value).forEach(function (vk) {
								if (V[c.key][c.val.field][vk] !== c.val.value[vk]) { V[c.key][c.val.field][vk] = c.val.value[vk]; chg = true; }
							});
							if (chg) { stories += 1; }
						} else {
							if (V[c.key][c.val.field] !== c.val.value) { V[c.key][c.val.field] = c.val.value; stories += 1; }
						}
					}
				} catch (e) { /* 单条解锁条件应用失败即跳过，其余条件继续（不中断整批） */ }
			}
			setup.specialClothes.forEach(function (item) {
				/* v1.9.28：逐项守卫——坏条目（null/非对象/缺 name）跳过不中断，避免单条异常中止整批解锁 */
				if (!item || typeof item !== "object" || !item.name) { return; }
				var entry = null;
				for (var i = 0; i < V.specialClothes.length; i++) {
					if (V.specialClothes[i] && V.specialClothes[i].name === item.name) { entry = V.specialClothes[i]; break; }
				}
				if (!entry) { entry = { name: item.name, unlocked: 0 }; V.specialClothes.push(entry); }
				entry.unlocked = 3;
				n += 1;
				if (SPECIAL_CLOTHES_ITEM_COND[item.name]) { SPECIAL_CLOTHES_ITEM_COND[item.name].forEach(applyCond); }
				if (Array.isArray(item.sets)) {
					item.sets.forEach(function (set) {
						if (SPECIAL_CLOTHES_SET_COND[set]) { SPECIAL_CLOTHES_SET_COND[set].forEach(applyCond); }
					});
				}
			});
			/* v1.9.28：聚合审计留痕（type=batch，非面板写入——undo 按 rec.type!=="cheat" 拒绝，
			   不提供逐键回退；仅记录受影响的解锁数与联动故事计数，供玩家自查批量操作） */
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:global:unlockClothes"] = { type: "batch", modId: "global", op: "global_unlock:clothes", count: n, stories: stories, t: Date.now() };
			mbCEWroteTrim(V);
		} catch (e) { /* 异常不阻断统计返回：unlocked/stories 按已处理数上报 */ }
		return { unlocked: n, stories: stories };
	}
	function globalUnlockRecipes() {
		var V = getV(), setup = getSetup();
		var n = 0;
		try {
			if (setup.foodstuff && typeof setup.foodstuff === "object") {
				if (!V.foodstuff || typeof V.foodstuff !== "object") { V.foodstuff = {}; }
				Object.keys(setup.foodstuff).forEach(function (k) {
					var def = setup.foodstuff[k];
					/* v1.9.28：逐项守卫——坏定义跳过不中断整批 */
					if (!def || typeof def !== "object") { return; }
					if (def.recipe && def.recipe.ingredients && def.recipe.ingredients.length) {
						if (!V.foodstuff[k] || typeof V.foodstuff[k] !== "object") {
							V.foodstuff[k] = { amount: 0 };
						}
						V.foodstuff[k].knows_recipe = true;
						n += 1;
					}
				});
				/* v1.9.28：聚合审计留痕（type=batch，不可逐键回退，仅记录解锁数） */
				if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
				V.mbCE_wrote["cheat:global:unlockRecipes"] = { type: "batch", modId: "global", op: "global_unlock:recipes", count: n, t: Date.now() };
				mbCEWroteTrim(V);
			}
		} catch (e) { /* 异常不阻断统计返回：unlocked 按已处理数上报 */ }
		return { unlocked: n };
	}

