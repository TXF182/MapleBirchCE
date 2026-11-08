/* 职责：DoL 联机&地下城（Dolonline 5.27）适配器 —— **只做单机状态键**。
   用户口径（2026-11-08）：Dolonline 仅本地单机状态，不做联机交互（不碰 WebSocket / auth / 服务器共享血量）。

   源码实证（tools\_modcache\dolonline527\unpacked\，10 文件 / index.js 447,621 B）：
   - boot.json：nickName「DoLOnline」、version 5.27、scriptFileList ["index.js"]、dependenceInfo []、addonPlugin []
     → 零依赖、无补丁注入，CE 侧只需读写存档变量，不调模组函数。
   - index.js 用 WebSocket 定向消息（auth L96 / cp_accept L159），**不上传整档**；只有共享怪物血量以服务器为准
     → 单机状态全部落在本地 $ 变量，本地直写成立。
   - 入口解锁：index.js L4157 `if (v.mpDgUnlocked) return true`；L4161 `if ((Number(v.mpDgLv) || 1) > 1) return true`；
     L4170–4171 `dgUnlocked()` 成立时自动 `v.mpDgUnlocked = 1`。
   - 等级/经验条：index.js L4663–4669 —— 日常 `mpDLv` / `mpDExp` need=80+(lv-1)*40；地下城 `mpDgLv` / `mpDgExp` need=100+(lv-1)*50。
   - 法术解锁（dungeon.twee:84–88 与 index.js）：`mpDgLv` ≥3/≥5/≥7/≥9/≥12 分别解锁 火墙/冰锥/暗影箭/雷暴/陨石；
     每次 5 层 +1 `mpSkillPts`（index.js L1805–1806）。
   - 进本初始化（dungeon.twee:3–5、:884）：`dgFloor=1`、`dgHp=dolStaminaMax()`、`dgGold=0`、`dgMana=100`、`dgManaMax=100`；
     `mpCat` 顶部 `<<set $mpCat to ($mpCat or 0)>>` 兜底 → 直写前不必保证存在，但运行态键必须先有。
   - 宝箱（dungeon.twee:891–905）：`_tier = min(5, max(1, ceil(floor/4)))`，10% +1 档；`_reqs = [100,200,300,400,500]`；
     `skulduggery >= dgChestReq` 才能撬（+100 为无损判据 `_clean`，倍率 1.5）。
   - 灰（npc.twee）：`npcAff` 上限 15（`Math.min(15, ...)`）；`npcCh` 0→3；`npcQ` 0/1/2 剧情阶段；
     `mpEquip.*` 读取前一律 `<<if $mpEquip and $mpEquip.helmet>>` 存在性守卫 → 装备对象缺失时模组自己会跳过，CE 不代建。 */

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
			modName: "DoL 联机&地下城 v5.27（单机状态键）",
			tasks: [],
			stages: [
				{ key: "dl_unlocked", name: "地下城 · 入口解锁", varPath: "mpDgUnlocked",
				  levels: [0, 1], labels: ["未解锁", "已解锁"],
				  note: "模组判据 index.js:4157 `if (v.mpDgUnlocked) return true`；L4170–4171 在 dgUnlocked() 成立时自动置 1（等级 >1 也会解锁）" },
				{ key: "dl_class", name: "地下城 · 职业", varPath: "mpClass",
				  levels: ["", "warrior", "mage", "ranger", "priest"],
				  labels: ["未选", "剑士", "法师", "游侠", "祭司"],
				  note: "职业专属技能在 dungeon.twee:90–93 判定；空串 = 未选职业" }
			],
			abilities: [],
			scenes: [],
			values: [
				{ key: "dl_dglv", name: "地下城等级 mpDgLv", varPath: "mpDgLv", type: "number", min: 1, max: 99,
				  note: "≥3/5/7/9/12 解锁 火墙/冰锥/暗影箭/雷暴/陨石；升级阈值 need=100+(lv-1)*50（index.js:4669）" },
				{ key: "dl_dgexp", name: "地下城经验 mpDgExp", varPath: "mpDgExp", type: "number", min: 0, max: 999999,
				  note: "写 need-1（=100+(lv-1)*50-1）再打一只怪即可自然升级" },
				{ key: "dl_dailylv", name: "日常挑战等级 mpDLv", varPath: "mpDLv", type: "number", min: 1, max: 99,
				  note: "升级阈值 need=80+(lv-1)*40（index.js:4664）" },
				{ key: "dl_dailyexp", name: "日常经验 mpDExp", varPath: "mpDExp", type: "number", min: 0, max: 999999,
				  note: "注意键名是 mpDExp（不是 mpDgExp），index.js:4436/4663 实证" },
				{ key: "dl_skillpts", name: "技能点 mpSkillPts", varPath: "mpSkillPts", type: "number", min: 0, max: 999,
				  note: "每下 5 层 +1（index.js:1805–1806）" },
				{ key: "dl_mpcat", name: "猫猫币 mpCat", varPath: "mpCat", type: "number", min: 0, max: 999999,
				  note: "地下城专属货币：30 换满体力 / 25 换满法力 / 120 掉道具 / 150 特殊（dungeon.twee:299–323）" },
				{ key: "dl_agi", name: "敏捷加成 mpDgAgi", varPath: "mpDgAgi", type: "number", min: 0, max: 999,
				  note: "命中/闪避公式 `3 + floor(min(100,physique)/15) + Number($mpDgAgi)`（dungeon.twee:65/213）" },
				{ key: "dl_floor", name: "当前层 dgFloor", varPath: "dgFloor", type: "number", min: 1, max: 30,
				  note: "层数门控 index.js:4091/4128/4159；开箱档位按 ceil(floor/4) 推导（dungeon.twee:891）" },
				{ key: "dl_hp", name: "地下城体力 dgHp", varPath: "dgHp", type: "number", min: 0, max: 99999,
				  note: "进本初始化 = dolStaminaMax()；写超上限即无敌（模组只做 <=0 判死）" },
				{ key: "dl_mana", name: "法力 dgMana", varPath: "dgMana", type: "number", min: 0, max: 99999,
				  note: "进本 100；低于技能消耗则无法施法" },
				{ key: "dl_manamax", name: "法力上限 dgManaMax", varPath: "dgManaMax", type: "number", min: 1, max: 99999,
				  note: "进本 100；`$mpCat gte 25` 时置回该值（dungeon.twee:307）" },
				{ key: "dl_gold", name: "地下城金币 dgGold", varPath: "dgGold", type: "number", min: 0, max: 999999,
				  note: "只是本局显示用的战利品计数；真实加钱走 $money（dungeon.twee:342 起）" },
				{ key: "dl_kills", name: "本局击杀 dgKills", varPath: "dgKills", type: "number", min: 0, max: 99999,
				  note: "灰的委托进度按 `dgKills - npcQStart >= 3` 判定（npc.twee:23/25）" },
				{ key: "dl_chestreq", name: "宝箱诡术门槛 dgChestReq", varPath: "dgChestReq", type: "number", min: 0, max: 500,
				  note: "原值 ∈ {100,200,300,400,500}；写 0 = 任何诡术都能撬（`skulduggery >= dgChestReq`，+100 判定无损）" },
				{ key: "dl_chesttier", name: "宝箱档位 dgChestTier", varPath: "dgChestTier", type: "number", min: 1, max: 5,
				  note: "1–5 档；原版由 min(5,max(1,ceil(floor/4))) 推导，10% 概率 +1（dungeon.twee:891–905）" },
				{ key: "dl_npcaff", name: "灰 · 好感 npcAff", varPath: "npcAff", type: "number", min: 0, max: 15,
				  note: "上限 15（模组处处 Math.min(15, ...)）；影响 npc.twee 剧情分支" },
				{ key: "dl_npcch", name: "灰 · 章节 npcCh", varPath: "npcCh", type: "number", min: 0, max: 3,
				  note: "npc.twee:225 置 2 / :242 置 3 —— 直写会跳过对应的剧情场景，仅在重复剧情时使用" }
			],
			actions: [
				{
					key: "dl_init_run",
					name: "初始化地下城运行态键",
					note: "未进过地下城时 dgFloor/dgHp/dgMana 等键还不存在，数值栏会拒绝写入。本动作按 dungeon.twee:3–5 的原版初值补齐（已有的不覆盖），并补 mpSkill 空对象。",
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
					note: "mpSkill 9 键置 1：通用 fireWall/iceSpike/shadowBolt/thunderStorm/meteor + 职业 uDesp/uBurst/uChain/uBlood（dungeon.twee:84–97）。原版本靠 mpDgLv 3/5/7/9/12 逐档解锁，本动作直接写入等价。",
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
