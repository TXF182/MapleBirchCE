/* 职责：DoL 联机&地下城（Dolonline 5.28）适配器 —— **只做单机状态键**。
   用户口径（2026-11-08）：Dolonline 仅本地单机状态，不做联机交互（不碰 WebSocket / auth / 服务器共享血量）。

   源码实证（tools\_modcache\dolonline528\unpacked\，index.js 449,013 B + 4 个 twee + img，2026-11-09 复核 5.27→5.28）：
   - boot.json：nickName「DoLOnline」、version 5.28、scriptFileList ["index.js"]、dependenceInfo []
     → 零依赖；**新增 addonPlugin TweeReplacerAddon**（替换 `Harvest Street` 段落尾部追加 `<<dol-dg-entry>>`）。
       注意：ModLoaderGui SafeMode 禁 TweeReplacer 时该补丁不生效；5.28 已自带 JS DOM 兜底
       `ensureDgEntry()`（index.js:4305–4413，直接插 `#dol-dg-entry-link`），入口不依赖 addonPlugin。
   - index.js 用 WebSocket 定向消息（auth / cp_accept），不上传整档；只有共享怪物血量以服务器为准
     → 单机状态全部落在本地 $ 变量，本地直写成立。
   - 入口解锁 `dgUnlocked()` index.js:4189–4202：mpDgUnlocked 为真 → 解锁；另兼容 dgFloor>1（:4194）/
     dgKills>0 / mpDgLv>1（:4196）/ mpDgAtk|Def|Agi>0（:4197）/ mpSkill 非空（:4198）/ mpSkillPts>0（:4199）
     —— 比 5.27 多两条老档兼容。`migrateDgUnlock()` :4203–4208 在成立时把 mpDgUnlocked 置 1。
   - 等级：`dailyNeed(lv)=80+(lv-1)*40`（:4472）、`dgNeed(lv)=100+(lv-1)*50`（:4473）；UI 侧 :4705–4711。
   - 技能：5.28 由"法术开关"重构为**技能树** `SKILL_NODES`（:6476–6493，16 节点）——
       5 个法术解锁节点 fireWall/iceSpike/shadowBolt/thunderStorm/meteor 的 auto 阈值仍为 3/5/7/9/12（:6484–6488，值 1 = 已解锁）；
       新增 6 个可升级节点 atk/def/hp/crit/lifesteal/loot（max 10）与 arcane（max 3、cost 2）。
       每下 1 层 20% +1 点、每满 5 层固定 +1 点（:1829–1830）。
   - 进本初始化（dungeon.twee:3–12）：dgFloor=1、dgHp=dolStaminaMax()、mpCat 兜底 0、dgMana/dgManaMax=100。
   - 宝箱（dungeon.twee:894–928）：_tier=min(5,max(1,ceil(floor/4)))，10% 概率 +1 档（:895）；
     $dgChestTier 写入 :899、$dgChestReq 由 _reqs[_tier-1] 写入 :900；撬锁判 `skulduggery >= dgChestReq`（:908），
     +100 为无损判据 `_clean`（:928）。
   - 猫猫币（dungeon.twee:301/307/313）：30 换满体力 / 25 换满法力 / 120 掉道具。
   - 敏捷加成公式：`3 + floor(min(100,physique)/15) + Number($mpDgAgi)`（dungeon.twee:67/215，index.js:2845）。
   - 灰（npc.twee）：npcAff 上限 15（:56/:79 Math.min(15,…)）；npcCh 置 1/2/3 在 :154/:225/:242；
     委托进度按 `dgKills - npcQStart >= 3`（:23/:25）。
   - 职业专属技能按 $mpClass 判（dungeon.twee:92–95），四职业 warrior/mage/ranger/priest。
   - `mpEquip.*` 读取前一律存在性守卫 → 装备对象缺失时模组自己跳过，CE 不代建。 */

	CHEAT_ADAPTERS["dolonline"] = {
		detect: function () {
			try {
				var v = getV();
				if (!hasV()) { return false; }
				/* mpCat / mpDgLv / mpSkillPts / mpDgUnlocked / dgFloor / npcAff 都是 Dolonline 独有键；
				   任一组出现即认定模组在场（未进过本的新档也可能只有 mpDgLv） */
				return (v.mpCat !== undefined || v.mpDgLv !== undefined || v.mpSkillPts !== undefined
					|| v.mpDgUnlocked !== undefined || v.dgFloor !== undefined
					|| v.npcAff !== undefined || v.npcCh !== undefined);
			} catch (e) { return false; }
		},
		entry: {
			modId: "dolonline",
			modName: "DoL 联机&地下城 v5.28（单机状态键）",
			tasks: [],
			stages: [
				{ key: "dl_unlocked", name: "地下城 · 入口解锁", varPath: "mpDgUnlocked",
				  levels: [0, 1], labels: ["未解锁", "已解锁"],
				  note: "模组判据 index.js:4192 `if (v.mpDgUnlocked) return true`；:4203–4208 migrate 在 dgUnlocked() 成立时置 1（老档痕迹 mpDgLv>1 / mpSkillPts>0 也算解锁，见 :4194–4199）" },
				{ key: "dl_class", name: "地下城 · 职业", varPath: "mpClass",
				  levels: ["", "warrior", "mage", "ranger", "priest"],
				  labels: ["未选", "剑士", "法师", "游侠", "祭司"],
				  note: "职业专属技能在 dungeon.twee:92–95 判定；空串 = 未选职业" }
			],
			abilities: [],
			scenes: [],
			values: [
				{ key: "dl_dglv", name: "地下城等级 mpDgLv", varPath: "mpDgLv", type: "number", min: 1, max: 99,
				  note: "≥3/5/7/9/12 自动解锁 火墙/冰锥/暗影箭/雷暴/陨石（SKILL_NODES auto，index.js:6484–6488）；升级阈值 need=100+(lv-1)*50（:4473）" },
				{ key: "dl_dgexp", name: "地下城经验 mpDgExp", varPath: "mpDgExp", type: "number", min: 0, max: 999999,
				  note: "写 need-1（=100+(lv-1)*50-1）再打一只怪即可自然升级" },
				{ key: "dl_dailylv", name: "日常挑战等级 mpDLv", varPath: "mpDLv", type: "number", min: 1, max: 99,
				  note: "升级阈值 need=80+(lv-1)*40（index.js:4472）" },
				{ key: "dl_dailyexp", name: "日常经验 mpDExp", varPath: "mpDExp", type: "number", min: 0, max: 999999,
				  note: "注意键名是 mpDExp（不是 mpDgExp），index.js:4705 实证" },
				{ key: "dl_skillpts", name: "技能点 mpSkillPts", varPath: "mpSkillPts", type: "number", min: 0, max: 999,
				  note: "技能树货币：每层 20% +1、每满 5 层固定 +1（index.js:1829–1830）；解锁与升级节点都扣此值" },
				{ key: "dl_mpcat", name: "猫猫币 mpCat", varPath: "mpCat", type: "number", min: 0, max: 999999,
				  note: "地下城专属货币：30 换满体力 / 25 换满法力 / 120 掉道具（dungeon.twee:301–323）" },
				{ key: "dl_agi", name: "敏捷加成 mpDgAgi", varPath: "mpDgAgi", type: "number", min: 0, max: 999,
				  note: "命中/闪避公式 `3 + floor(min(100,physique)/15) + Number($mpDgAgi)`（dungeon.twee:67/215）" },
				{ key: "dl_floor", name: "当前层 dgFloor", varPath: "dgFloor", type: "number", min: 1, max: 30,
				  note: "层的门控在 index.js:4126/4163（step.cond.floor 比对 dgFloor）；开箱档位按 ceil(floor/4) 推导（dungeon.twee:894）" },
				{ key: "dl_hp", name: "地下城体力 dgHp", varPath: "dgHp", type: "number", min: 0, max: 99999,
				  note: "进本初始化 = dolStaminaMax()（dungeon.twee:4）；写超上限即无敌（模组只做 <=0 判死）" },
				{ key: "dl_mana", name: "法力 dgMana", varPath: "dgMana", type: "number", min: 0, max: 99999,
				  note: "进本 100（dungeon.twee:12）；低于技能消耗则无法施法" },
				{ key: "dl_manamax", name: "法力上限 dgManaMax", varPath: "dgManaMax", type: "number", min: 1, max: 99999,
				  note: "进本 100；`$mpCat gte 25` 时置回该值（dungeon.twee:309）" },
				{ key: "dl_gold", name: "地下城金币 dgGold", varPath: "dgGold", type: "number", min: 0, max: 999999,
				  note: "只是本局显示用的战利品计数；真实加钱走 $money（dungeon.twee 结算段）" },
				{ key: "dl_kills", name: "本局击杀 dgKills", varPath: "dgKills", type: "number", min: 0, max: 99999,
				  note: "灰的委托进度按 `dgKills - npcQStart >= 3` 判定（npc.twee:23/25）" },
				{ key: "dl_chestreq", name: "宝箱诡术门槛 dgChestReq", varPath: "dgChestReq", type: "number", min: 0, max: 500,
				  note: "原值 ∈ {100,200,300,400,500}（dungeon.twee:900 `_reqs[_tier-1]`）；写 0 = 任何诡术都能撬（判据 :908）" },
				{ key: "dl_chesttier", name: "宝箱档位 dgChestTier", varPath: "dgChestTier", type: "number", min: 1, max: 5,
				  note: "1–5 档；原版由 min(5,max(1,ceil(floor/4))) 推导，10% 概率 +1（dungeon.twee:894–895，写入 :899）" },
				{ key: "dl_npcaff", name: "灰 · 好感 npcAff", varPath: "npcAff", type: "number", min: 0, max: 15,
				  note: "上限 15（npc.twee:56/79 均 Math.min(15,…)）；影响 npc.twee 剧情分支（阈值 2/5/8/9/10）" },
				{ key: "dl_npcch", name: "灰 · 章节 npcCh", varPath: "npcCh", type: "number", min: 0, max: 3,
				  note: "npc.twee:225 置 2 / :242 置 3 —— 直写会跳过对应的剧情场景，仅在重复剧情时使用" },
				{ key: "dl_sk_atk", name: "技能树 · 力量训练（攻击 +2/级）", varPath: "mpSkill.atk", type: "number", min: 0, max: 10,
				  note: "5.28 新增技能树节点（index.js:6477，max 10）；需 mpSkill 对象存在（先执行「初始化地下城运行态键」）" },
				{ key: "dl_sk_def", name: "技能树 · 体能锻炼（防御 +2/级）", varPath: "mpSkill.def", type: "number", min: 0, max: 10,
				  note: "index.js:6478，max 10" },
				{ key: "dl_sk_hp", name: "技能树 · 耐力（体力上限 +10/级）", varPath: "mpSkill.hp", type: "number", min: 0, max: 10,
				  note: "index.js:6479，max 10" },
				{ key: "dl_sk_crit", name: "技能树 · 弱点洞察（暴击 +2%/级）", varPath: "mpSkill.crit", type: "number", min: 0, max: 10,
				  note: "index.js:6480，max 10" },
				{ key: "dl_sk_lifesteal", name: "技能树 · 血液掌控（吸血 +2%/级）", varPath: "mpSkill.lifesteal", type: "number", min: 0, max: 10,
				  note: "index.js:6481，max 10" },
				{ key: "dl_sk_loot", name: "技能树 · 寻宝直觉（掉落率 +3%/级）", varPath: "mpSkill.loot", type: "number", min: 0, max: 10,
				  note: "index.js:6482，max 10" },
				{ key: "dl_sk_arcane", name: "技能树 · 咒文精通（法术强度 +8/级）", varPath: "mpSkill.arcane", type: "number", min: 0, max: 3,
				  note: "index.js:6483，max 3、每级 cost 2 点" }
			],
			actions: [
				{
					key: "dl_init_run",
					name: "初始化地下城运行态键",
					note: "未进过地下城时 dgFloor/dgHp/dgMana 等键还不存在，数值栏会拒绝写入。本动作按 dungeon.twee:3–12 的原版初值补齐（已有的不覆盖），并补 mpSkill 空对象。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						var added = 0;
						if (v.dgFloor === undefined) { v.dgFloor = 1; added++; }
						if (v.dgHp === undefined) {
							var hp = 100;
							try { if (typeof window !== "undefined" && typeof window.dolStaminaMax === "function") { hp = Number(window.dolStaminaMax()) || 100; } } catch (eHp) {}
							v.dgHp = hp; added++;
						}
						if (v.dgGold === undefined) { v.dgGold = 0; added++; }
						if (v.dgMana === undefined) { v.dgMana = 100; added++; }
						if (v.dgManaMax === undefined) { v.dgManaMax = 100; added++; }
						if (v.dgKills === undefined) { v.dgKills = 0; added++; }
						if (!v.mpSkill || typeof v.mpSkill !== "object") { v.mpSkill = {}; added++; }
						if (v.mpCat === undefined) { v.mpCat = 0; added++; }
						return {
							ok: true,
							message: added
								? "已补齐 " + added + " 个运行态键，已有值未覆盖（明细见下方数值栏）"
								: "运行态键已齐全，未做改动"
						};
					}
				},
				{
					key: "dl_all_spells",
					name: "解锁全部法术（含职业技能）",
					note: "5.28 技能树里 9 个解锁节点（max 1）置 1：通用 fireWall/iceSpike/shadowBolt/thunderStorm/meteor + 职业 uDesp/uBurst/uChain/uBlood（SKILL_NODES，index.js:6484–6492）。原版靠 mpDgLv 3/5/7/9/12 逐档自动开放，本动作直接写入等价；可升级节点（atk/def/hp/crit/lifesteal/loot/arcane）不在此动作，走数值栏逐项设置。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						if (!v.mpSkill || typeof v.mpSkill !== "object") { v.mpSkill = {}; }
						var keys = ["fireWall", "iceSpike", "shadowBolt", "thunderStorm", "meteor", "uDesp", "uBurst", "uChain", "uBlood"];
						var n = 0;
						keys.forEach(function (k) { if (v.mpSkill[k] !== 1) { v.mpSkill[k] = 1; n++; } });
						return { ok: true, message: n ? "已解锁 " + n + " 个法术（其余此前已解锁）" : "全部法术此前已解锁" };
					}
				}
			]
		}
	};
