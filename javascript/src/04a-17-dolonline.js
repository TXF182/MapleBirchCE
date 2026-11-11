/* 职责：DoL 联机&地下城（Dolonline 5.31）适配器 —— **只做单机状态键**。
   用户口径（2026-11-08）：Dolonline 仅本地单机状态，不做联机交互（不碰 WebSocket / auth / 服务器共享血量）。

   源码实证（tools\_modcache\dolonline531\unpacked\，index.js 716,973 B + 4 个 twee + img，2026-11-11 复核 5.30→5.31）：
   - boot.json：nickName「DoLOnline」、version 5.30、scriptFileList ["index.js"]、dependenceInfo []
     → 零依赖；addonPlugin 仍只有 TweeReplacerAddon（`Harvest Street` 段落尾部追加 `<<dol-dg-entry>>`），与 5.28 同。
       ModLoaderGui SafeMode 禁 TweeReplacer 时入口仍有 JS DOM 兜底 ensureDgEntry()。
   - 5.28 → 5.29 变更范围（**逐文件 SHA256 判定，不按体积**——boot.json 前后同为 922 B 但内容已变）：
       变更 4 个：boot.json（仅 version 5.28→5.29）、dungeon.twee 54,440→153,961 B（+99,521）、
       index.js 449,013→595,350 B（+146,337）、README.md 5,620→6,614 B；
       内容完全相同 6 个：combat.twee 333 B、npc.twee 16,357 B、quests.twee 15,209 B、img 三张。
   - 5.29 → 5.30 变更范围（**逐文件 SHA256 判定，不按体积**，2026-11-10 复核；包 363,642 B /
     sha256 0292819de287982e6a3ded8af1441dc118c7313d3779e90ae6bce0781133730c）：
       变更 4 个：boot.json（仅 version 5.29→5.30，仍 922 B）、dungeon.twee 153,961→154,786 B（+825）、
       index.js 595,350→620,847 B（+25,497）、README.md 6,614→6,644 B；
       内容完全相同 6 个：combat.twee 333 B、npc.twee 16,357 B、quests.twee 15,209 B、img 三张。
   - 5.30 是**纯 bug 修复版**（README 增量只两行：`**5.30**` + 「修复缩放 bug」），无新功能面。
       三组读数与 5.29 逐项相同：audit [2] 新增候选只 1 条 mpSkill、[4] 其它根同 30 个、[5] 动态前缀同 pot_/food_
       → 零新增状态根、零删除。resolve_missing 42/42 KEEP、REMOVE 0 → 声明**零改动**，仅同步版本号与对照目录。
       注：+25,497 B 全落在 index.js 的缩放/尺寸计算实作，未触及任何 `v.xxx` / `$xxx` 状态键契约。
   - 5.30 → 5.31 变更范围（**逐文件 SHA256 判定，不按体积**，2026-11-11 复核；包 449,718 B /
     sha256 d204012661e416ef301c8309760c0714be91470d6e9adf69cd313733f9a58514）：
       变更 4 个：boot.json 922→950 B（version 5.30→5.31 **且新增 repository 字段**，非纯版本号变化）、
       dungeon.twee 154,786→167,648 B（+12,862）、index.js 620,847→716,973 B（+96,126）、README.md 6,644→7,708 B；
       内容完全相同 4 个：combat.twee 333 B、npc.twee 16,357 B、quests.twee 15,209 B、img 三张；
       **新增文件 1 个**：img\dol-town-map.png 31,493 B（小镇地图，boot.json imgFileList 同步登记为第 4 项）。
   - 5.31 是**新增大系统版**（README「5.31」段）：小镇地图（14 个地点、走路消耗时间）、银行（猫猫币存款，
       每日 1% 利息、上限 60 天）、旅馆（£300 休息）、公会（六项委托各领一次）、巷子随机事件 10 种、
       图鉴武器/装备全收集页、成就接入原生成就系统（8 个）、铁匠铺强化上限 +5。
       状态键层面新增 12 个（全量键集 135 → 147，**消失键 0**）：mpBank / mpBankDay / mpGuildDone / mpBossKills /
       mpTownAt / mpTownEv / mpTownEvAt / mpTownEvRes / dgBossMode / dgSkipExchange（另 arousalmax / feats 属原版键）。
       resolve_missing 42/42 KEEP（REMOVE 0）→ 既有 42 条声明**零删失**，仅同步版本号；本轮按单机可作弊面补 3 条
       （mpBank 存款 / mpBossKills 层主击杀 / mpTownAt 地点直达）。豁免与不声明理由：
       dgBossMode、dgSkipExchange 属层主战瞬态；mpTownEv/mpTownEvAt/mpTownEvRes 属事件瞬时状态
       （mpTownEv 非空会拦截移动，是模组自身流程锁，不代解）；mpGuildDone **刻意为不声明**——写 1 等于标记已领，
       会反向堵死领奖，清空才能重领，属模组领奖缺口，不代玩家利用；mpBankDay 是计息起始日、与 Time.days 强耦合，
       只作 mpBank 的说明项。
   - 5.29 功能增量（README L51–66）：层主战重做（分回合 / 血条 / 三套招式轮转）、地下商人（猫猫币买随机装备）、
       **随身物系统**（材料 / 药水 / 食物，背包下方独立栏）、**药水**（回血回蓝 / 攻防闪避增益 3 回合）、
       **篝火**（材料做四种食物）、怪物掉材料、战斗页「使用物品」栏（不耗回合）、猫猫商店改每 5 层、
       音效开关、死亡插图；管理作弊面板**需服务端授权**（单机不可用）。
       → 单机可作弊的新增面 = 随身物 `$dgInv`；层主战 7 个 `dgBoss*` 键与物品增益 buff 均为战斗瞬态，不作弊。
   - 入口解锁 dgUnlocked() index.js:4312–4325：mpDgUnlocked 为真 → 解锁；兼容 dgFloor>1（:4317）/ dgKills>0（:4318）/
     mpDgLv>1（:4319）/ mpDgAtk|Def|Agi>0（:4320）/ mpSkill 非空（:4321）/ mpSkillPts>0（:4322）。
     `migrateDgUnlock()` :4326–4331 成立时把 mpDgUnlocked 置 1。
     注：:4320 仍读 mpDgAtk/mpDgDef，但 audit 的 `V.` 字面扫描采不到（源码走小写 `v.` / `v[a.key]` 动态索引），属扫描盲区不是键消失。
   - 等级阈值：`dailyNeed(lv)=80+(lv-1)*40`（:4595）、`dgNeed(lv)=100+(lv-1)*50`（:4596）。
   - 加点面板：ATTRS_DAILY（:4906–4912）stressmax / traumamax / controlmax / mpFatigueCut(:4910 max 80%) / mpPainReduce(:4911 max 80%)；
       ATTRS_DG（:4913–4918）mpDgAtk(:4914 max 60) / mpDgDef(:4915 max 60) / mpDgAgi(:4916 max 60) / mpDgHp(:4917 max 100)。
       **audit 扫不到这批键**（源码写成 `v[a.key]` 动态索引 + 字符串键名）→ 动态键盲区，已逐条实证后补声明。
   - 战斗属性公式：pAtk=5+floor(min(100,physique)/10)+mpDgAtk（:2966）、pDef=3+floor(min(100,physique)/20)+mpDgDef（:2967）、
     pAgi=3+floor(min(100,physique)/15)+mpDgAgi（:2968 / dungeon.twee:75/236）；mpDgHp 进本叠上限见 :2255。
   - 技能树 SKILL_NODES（:7044–7061，16 节点）：7 个可升级节点 atk/def/hp/crit/lifesteal/loot（max 10）+ arcane（max 3, cost 2）在 :7045–7051；
       9 个解锁节点 fireWall/iceSpike/shadowBolt/thunderStorm/meteor（auto 3/5/7/9/12）+ 职业 uBurst/uChain/uDesp/uBlood 在 :7052–7060。
       技能点收入：每满 5 层固定 +1、其余层 20% +1（index.js:1952–1953）。
   - 随身物 `$dgInv`（5.29 新增，对象，值 = 数量）：ensureDgInv :6109–6113、dgAdd :6114–6121、renderBag :6576；
       材料键无前缀 fang/hide/herb/ore/dust/ember/slime（DG_MATS :6085–6093）；
       药水 pot_hp1/pot_hp2/pot_mp1/pot_mp2/pot_atk/pot_def/pot_agi（DG_POTIONS :6094–6102）；
       食物 food_soup/food_steak/food_stew/food_ember_tea（DG_FOODS :6103–6108）；使用入口 dolDgUse :6179/6209。
   - 进本初始化（dungeon.twee:3–6、:41）：dgFloor=1、dgHp=dolStaminaMax()、dgGold=0、dgMana/dgManaMax=100。
   - 宝箱（dungeon.twee:984–1010）：_tier=min(5,max(1,ceil(floor/4)))（:984）、10% 概率 +1 档（:985）；
     $dgChestTier 写入 :989、$dgChestReq 由 _reqs[_tier-1] 写入 :990；撬锁判 `skulduggery >= dgChestReq`（:998）；缺省兜底 :1008/:1009。
   - 猫猫商店（dungeon.twee:330–350）：30 换满体力（:337–341）/ 25 换满法力（:343–347）/ 120 随机装备（:349 起）；5.29 起每 5 层与层主同层出现。
   - 灰（npc.twee，5.28/5.29 内容同）：npcAff 上限 15（:56/:79 Math.min(15,…)）；npcCh 置 1/2/3 在 :154/:225/:242；
     委托进度按 `dgKills - npcQStart >= 3`（:23/:25）。
   - 职业专属技能按 $mpClass 判（dungeon.twee:108 起），四职业 warrior/mage/ranger/priest。
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
			modName: "DoL 联机&地下城 v5.31（单机状态键）",
			tasks: [],
			stages: [
				{ key: "dl_unlocked", name: "地下城 · 入口解锁", varPath: "mpDgUnlocked",
				  levels: [0, 1], labels: ["未解锁", "已解锁"],
				  note: "模组判据 index.js:4315 `if (v.mpDgUnlocked) return true`；:4326–4331 migrate 在 dgUnlocked() 成立时置 1（老档痕迹 dgFloor>1 / dgKills>0 / mpDgLv>1 / mpDgAtk|Def|Agi>0 / mpSkill 非空 / mpSkillPts>0 也算解锁，见 :4317–4322）" },
				{ key: "dl_class", name: "地下城 · 职业", varPath: "mpClass",
				  levels: ["", "warrior", "mage", "ranger", "priest"],
				  labels: ["未选", "剑士", "法师", "游侠", "祭司"],
				  note: "职业专属技能在 dungeon.twee:108 起判定；空串 = 未选职业" },
				{ key: "dl_townat", name: "小镇 · 当前地点", varPath: "mpTownAt",
				  levels: ["harvest", "market", "smith", "guild", "bank", "inn", "plaza", "online", "catshop", "merchant", "campfire", "dungeon", "fish", "rogue"],
				  labels: ["丰收街", "市场", "铁匠铺", "公会", "银行", "旅馆", "广场", "联机·世界", "猫猫商店", "地下商人", "篝火", "地下世界", "水潭·钓鱼", "深渊回廊"],
				  note: "5.31 新增小镇地图（DOL_TOWN 14 项，index.js:2106–2134）；默认 'harvest'（townAt :2136–2138 兜底）。直写即瞬移到该地点、跳过走路耗时——正常走 dolTownGo 会 passTime(:2339–2341)。写非法 id 时渲染按 `DOL_TOWN[cur] || DOL_TOWN.harvest` 兜底(:2328)，不会崩；但 mpTownEv 非空时移动被拦截(:2338)，那是事件未处理完，本项不解。" }
			],
			abilities: [],
			scenes: [],
			values: [
				{ key: "dl_dglv", name: "地下城等级 mpDgLv", varPath: "mpDgLv", type: "number", min: 1, max: 99,
				  note: "≥3/5/7/9/12 自动解锁 火墙/冰锥/暗影箭/雷暴/陨石（SKILL_NODES auto，index.js:7052–7056）；升级阈值 need=100+(lv-1)*50（:4596）" },
				{ key: "dl_dgexp", name: "地下城经验 mpDgExp", varPath: "mpDgExp", type: "number", min: 0, max: 999999,
				  note: "写 need-1（=100+(lv-1)*50-1）再打一只怪即可自然升级" },
				{ key: "dl_dailylv", name: "日常挑战等级 mpDLv", varPath: "mpDLv", type: "number", min: 1, max: 99,
				  note: "升级阈值 need=80+(lv-1)*40（index.js:4595）" },
				{ key: "dl_dailyexp", name: "日常经验 mpDExp", varPath: "mpDExp", type: "number", min: 0, max: 999999,
				  note: "注意键名是 mpDExp（不是 mpDgExp）；读取处 index.js:4601 键名选择 / :4818 / :4857 结算" },
				{ key: "dl_skillpts", name: "技能点 mpSkillPts", varPath: "mpSkillPts", type: "number", min: 0, max: 999,
				  note: "技能树货币：每满 5 层固定 +1、其余层 20% +1（index.js:1952–1953）；解锁与升级节点都扣此值" },
				{ key: "dl_mpcat", name: "猫猫币 mpCat", varPath: "mpCat", type: "number", min: 0, max: 999999,
				  note: "地下城专属货币：30 换满体力（dungeon.twee:337–341）/ 25 换满法力（:343–347）/ 120 随机装备（:349 起）" },
				{ key: "dl_agi", name: "敏捷加成 mpDgAgi", varPath: "mpDgAgi", type: "number", min: 0, max: 999,
				  note: "命中/闪避公式 `3 + floor(min(100,physique)/15) + Number($mpDgAgi)`（dungeon.twee:75/236、index.js:2968）" },
				{ key: "dl_floor", name: "当前层 dgFloor", varPath: "dgFloor", type: "number", min: 1, max: 30,
				  note: "层的门控 `step.cond.floor` 比对 dgFloor（index.js:4249/4286）；开箱档位按 ceil(floor/4) 推导（dungeon.twee:984）" },
				{ key: "dl_hp", name: "地下城体力 dgHp", varPath: "dgHp", type: "number", min: 0, max: 99999,
				  note: "进本初始化 = dolStaminaMax()（dungeon.twee:4）；进本页会把超上限值夹回 _hpMax（:14），战斗中只判 ≤0 → 战斗中写高值即无敌" },
				{ key: "dl_mana", name: "法力 dgMana", varPath: "dgMana", type: "number", min: 0, max: 99999,
				  note: "进本 100（dungeon.twee:6）；低于技能消耗则无法施法" },
				{ key: "dl_manamax", name: "法力上限 dgManaMax", varPath: "dgManaMax", type: "number", min: 1, max: 99999,
				  note: "进本 100（dungeon.twee:6/:41）；`$mpCat gte 25` 时置回该值（:345）" },
				{ key: "dl_gold", name: "地下城金币 dgGold", varPath: "dgGold", type: "number", min: 0, max: 999999,
				  note: "只是本局显示用的战利品计数；真实加钱走 $money（dungeon.twee:123 击杀结算 / :270 层主结算）" },
				{ key: "dl_kills", name: "本局击杀 dgKills", varPath: "dgKills", type: "number", min: 0, max: 99999,
				  note: "灰的委托进度按 `dgKills - npcQStart >= 3` 判定（npc.twee:23/25）" },
				{ key: "dl_chestreq", name: "宝箱诡术门槛 dgChestReq", varPath: "dgChestReq", type: "number", min: 0, max: 500,
				  note: "原值 ∈ {100,200,300,400,500}（dungeon.twee:990 `_reqs[_tier-1]`）；写 0 = 任何诡术都能撬（判据 :998）" },
				{ key: "dl_chesttier", name: "宝箱档位 dgChestTier", varPath: "dgChestTier", type: "number", min: 1, max: 5,
				  note: "1–5 档；原版由 min(5,max(1,ceil(floor/4))) 推导，10% 概率 +1（dungeon.twee:984–985，写入 :989）" },
				{ key: "dl_npcaff", name: "灰 · 好感 npcAff", varPath: "npcAff", type: "number", min: 0, max: 15,
				  note: "上限 15（npc.twee:56/79 均 Math.min(15,…)）；影响 npc.twee 剧情分支（阈值 2/5/8/9/10）" },
				{ key: "dl_npcch", name: "灰 · 章节 npcCh", varPath: "npcCh", type: "number", min: 0, max: 3,
				  note: "npc.twee:225 置 2 / :242 置 3 —— 直写会跳过对应的剧情场景，仅在重复剧情时使用" },
				{ key: "dl_sk_atk", name: "技能树 · 力量训练（攻击 +2/级）", varPath: "mpSkill.atk", type: "number", min: 0, max: 10,
				  note: "技能树可升级节点（index.js:7045，max 10）；需 mpSkill 对象存在（先执行「初始化地下城运行态键」）" },
				{ key: "dl_sk_def", name: "技能树 · 体能锻炼（防御 +2/级）", varPath: "mpSkill.def", type: "number", min: 0, max: 10,
				  note: "index.js:7046，max 10" },
				{ key: "dl_sk_hp", name: "技能树 · 耐力（体力上限 +10/级）", varPath: "mpSkill.hp", type: "number", min: 0, max: 10,
				  note: "index.js:7047，max 10" },
				{ key: "dl_sk_crit", name: "技能树 · 弱点洞察（暴击 +2%/级）", varPath: "mpSkill.crit", type: "number", min: 0, max: 10,
				  note: "index.js:7048，max 10" },
				{ key: "dl_sk_lifesteal", name: "技能树 · 血液掌控（吸血 +2%/级）", varPath: "mpSkill.lifesteal", type: "number", min: 0, max: 10,
				  note: "index.js:7049，max 10" },
				{ key: "dl_sk_loot", name: "技能树 · 寻宝直觉（掉落率 +3%/级）", varPath: "mpSkill.loot", type: "number", min: 0, max: 10,
				  note: "index.js:7050，max 10" },
				{ key: "dl_sk_arcane", name: "技能树 · 咒文精通（法术强度 +8/级）", varPath: "mpSkill.arcane", type: "number", min: 0, max: 3,
				  note: "index.js:7051，max 3、每级 cost 2 点" },
				/* ↓ 5.29 补声明：9 个法术解锁节点（SKILL_NODES max 1，index.js:7052–7060）
				   此前只在 dl_all_spells 动作里写入、缺 varPath 声明，属声明体系破口（不进矩阵/注册表、面板不可单独查看）。
				   模组侧判据为**数值**：:7088 `Number(v.mpSkill[k]) || 0`，>=1 即已解锁；auto 节点在 :7090 按 mpDgLv 自动置 1，直写 1 等价提前解锁。 */
				{ key: "dl_sk_firewall", name: "法术 · 火墙（原第 3 层开放）", varPath: "mpSkill.fireWall", type: "number", min: 0, max: 1,
				  note: "index.js:7052，auto 3、cost 2" },
				{ key: "dl_sk_icespike", name: "法术 · 冰锥（原第 5 层开放）", varPath: "mpSkill.iceSpike", type: "number", min: 0, max: 1,
				  note: "index.js:7053，auto 5、cost 2" },
				{ key: "dl_sk_shadowbolt", name: "法术 · 暗影箭（原第 7 层开放）", varPath: "mpSkill.shadowBolt", type: "number", min: 0, max: 1,
				  note: "index.js:7054，auto 7、cost 3" },
				{ key: "dl_sk_thunderstorm", name: "法术 · 雷暴（原第 9 层开放）", varPath: "mpSkill.thunderStorm", type: "number", min: 0, max: 1,
				  note: "index.js:7055，auto 9、cost 3" },
				{ key: "dl_sk_meteor", name: "法术 · 陨石（原第 12 层开放）", varPath: "mpSkill.meteor", type: "number", min: 0, max: 1,
				  note: "index.js:7056，auto 12、cost 4" },
				{ key: "dl_sk_uburst", name: "法术 · 爆裂魔法（职业）", varPath: "mpSkill.uBurst", type: "number", min: 0, max: 1,
				  note: "index.js:7057，蓄力 3 回合 400+ 伤害、cost 4；无 auto，纯购买解锁" },
				{ key: "dl_sk_uchain", name: "法术 · 连锁闪电（职业）", varPath: "mpSkill.uChain", type: "number", min: 0, max: 1,
				  note: "index.js:7058，耗光法力按 1.6 倍返还伤害、cost 4" },
				{ key: "dl_sk_udesp", name: "法术 · 背水之炎（职业）", varPath: "mpSkill.uDesp", type: "number", min: 0, max: 1,
				  note: "index.js:7059，残血爆发、cost 3" },
				{ key: "dl_sk_ublood", name: "法术 · 血祭（职业）", varPath: "mpSkill.uBlood", type: "number", min: 0, max: 1,
				  note: "index.js:7060，献祭体力换伤害、cost 3" },
				/* ↓ 5.29 复核补声明：加点面板属性（audit 的 `v[a.key]` 动态索引盲区，逐条实证见头部注释） */
				{ key: "dl_dgatk", name: "地下城 · 攻击加成 mpDgAtk", varPath: "mpDgAtk", type: "number", min: 0, max: 60,
				  note: "战斗公式 pAtk = 5 + floor(min(100,physique)/10) + mpDgAtk（index.js:2966）；加点上限 60（ATTRS_DG :4914）" },
				{ key: "dl_dgdef", name: "地下城 · 防御加成 mpDgDef", varPath: "mpDgDef", type: "number", min: 0, max: 60,
				  note: "pDef = 3 + floor(min(100,physique)/20) + mpDgDef（index.js:2967）；上限 60（:4915）" },
				{ key: "dl_dghpmax", name: "地下城 · 体力上限加成 mpDgHp", varPath: "mpDgHp", type: "number", min: 0, max: 100,
				  note: "进本 _hpMax 叠加该加成（index.js:2255）；加点上限 100（:4917，step 10）" },
				{ key: "dl_fatiguecut", name: "疲劳减免 mpFatigueCut（%）", varPath: "mpFatigueCut", type: "number", min: 0, max: 80,
				  note: "作用于**原版疲劳**：按该百分比削减（index.js:4665 clamp 0–80）；向上限 80（ATTRS_DAILY :4910，step 5）" },
				{ key: "dl_painreduce", name: "疼痛减免 mpPainReduce（%）", varPath: "mpPainReduce", type: "number", min: 0, max: 80,
				  note: "作用于**原版疼痛**：按该百分比削减（index.js:4774）；上限 80（:4911，step 5）" },
				{ key: "dl_dgsp", name: "地下城点数池 mpDgSP", varPath: "mpDgSP", type: "number", min: 0, max: 9999,
				  note: "加点面板扣此池（index.js:4960 读取 / :4984 扣减 / :5030 洗点返还）；持有即可自由加 ATTRS_DG 四项" },
				{ key: "dl_dsp", name: "日常点数池 mpDSP", varPath: "mpDSP", type: "number", min: 0, max: 9999,
				  note: "加点面板扣此池（index.js:4933 / :4960 / :5029 洗点返还）；持有即可自由加 ATTRS_DAILY 五项" },
				{ key: "dl_bank", name: "银行 · 存款 mpBank", varPath: "mpBank", type: "number", min: 0, max: 999999,
				  note: "5.31 新增银行：存入从 mpCat 扣、取回按 1%/天计息、上限 60 天（bankState index.js:2371–2383；deposit :2394–2403；withdraw :2405–2415 取回 st.amt + st.interest 后把 mpBank/mpBankDay 清零）。写大额后到银行点「取回」即可兑现；**不改 mpBankDay 则利息为 0、只回本金**（day0 :2393 在首次存款时置为当日 Time.days）。公会委托 bank 项按该值判 need 500（:2424）。" },
				{ key: "dl_bosskills", name: "层主击杀 mpBossKills", varPath: "mpBossKills", type: "number", min: 0, max: 999,
				  note: "5.31 新增计数：唯一写入处 dungeon.twee:670 `set $mpBossKills to ($mpBossKills or 0) + 1`（击败层主时）。两处读取——公会委托 boss1（need 1 → 120 猫猫币，index.js:2421）、原生成就「DoLOnline 深渊之主」（:8206 `> 0`）。写 1 即同时满足；成就需等下一次成就判定渲染才落。" }
			],
			actions: [
				{
					key: "dl_init_run",
					name: "初始化地下城运行态键",
					note: "未进过地下城时 dgFloor/dgHp/dgMana 等键还不存在，数值栏会拒绝写入。本动作按 dungeon.twee:3–6/:41 的原版初值补齐（已有的不覆盖），并补 mpSkill / dgInv 空对象。",
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
						if (!v.dgInv || typeof v.dgInv !== "object") { v.dgInv = {}; added++; }
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
					note: "技能树里 9 个解锁节点（max 1）置 1：通用 fireWall/iceSpike/shadowBolt/thunderStorm/meteor + 职业 uBurst/uChain/uDesp/uBlood（SKILL_NODES，index.js:7052–7060）。原版靠 mpDgLv 3/5/7/9/12 逐档自动开放，本动作直接写入等价；可升级节点（atk/def/hp/crit/lifesteal/loot/arcane）不在此动作，走数值栏逐项设置。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						if (!v.mpSkill || typeof v.mpSkill !== "object") { v.mpSkill = {}; }
						var keys = ["fireWall", "iceSpike", "shadowBolt", "thunderStorm", "meteor", "uDesp", "uBurst", "uChain", "uBlood"];
						var n = 0;
						keys.forEach(function (k) { if (v.mpSkill[k] !== 1) { v.mpSkill[k] = 1; n++; } });
						return { ok: true, message: n ? "已解锁 " + n + " 个法术（其余此前已解锁）" : "全部法术此前已解锁" };
					}
				},
				{
					key: "dl_fill_inv",
					name: "随身物全满（材料 / 药水 / 食物）",
					note: "5.29 新增物品系统：`$dgInv` 是一个对象，键=物品 id、值=数量。材料键**无前缀**（fang/hide/herb/ore/dust/ember/slime，DG_MATS index.js:6085–6093）；药水 pot_hp1/pot_hp2/pot_mp1/pot_mp2/pot_atk/pot_def/pot_agi（DG_POTIONS :6094–6102）；食物 food_soup/food_steak/food_stew/food_ember_tea（DG_FOODS :6103–6108）。本动作把 18 个键补到 99（已有更高值不覆盖），并在 dgInv 缺失时先建空对象（等价 ensureDgInv :6109–6113）。篝火做食物、技能药水都由模组读该对象，写数量即可生效。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						if (!v.dgInv || typeof v.dgInv !== "object") { v.dgInv = {}; }
						var keys = [
							"fang", "hide", "herb", "ore", "dust", "ember", "slime",
							"pot_hp1", "pot_hp2", "pot_mp1", "pot_mp2", "pot_atk", "pot_def", "pot_agi",
							"food_soup", "food_steak", "food_stew", "food_ember_tea"
						];
						var n = 0;
						keys.forEach(function (k) {
							if ((Number(v.dgInv[k]) || 0) < 99) { v.dgInv[k] = 99; n++; }
						});
						return {
							ok: true,
							message: n
								? "已补满 " + n + " 类随身物到 99（原值更高者未覆盖）"
								: "随身物已全部 ≥99，未改动"
						};
					}
				},
				{
					key: "dl_refill_run",
					name: "地下城资源补满（体力 / 法力 / 金币）",
					note: "战斗中可重复点，只增不减（已有更高值不覆盖）。dgHp 补到体力上限（window.dolStaminaMax()，与进本初值同源 dungeon.twee:4）；dgMana 补到 dgManaMax（dungeon.twee:6–7，缺省 100）；dgGold 补到 9999（:5 进本置 0、猫猫商店 :330–350 消费、击杀掉落累加）。法术有法力门槛（$dgMana gte 10/12/15/18/20，dungeon.twee:95–99），法力见底时点本动作即可继续施法。注意 dgHp 是**单次地下城运行内**的当前体力，不是永久属性。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						var hpMax = 100;
						try {
							if (typeof window !== "undefined" && typeof window.dolStaminaMax === "function") {
								hpMax = Number(window.dolStaminaMax()) || 100;
							}
						} catch (eHp) { hpMax = 100; }
						var manaMax = Number(v.dgManaMax) || 100;
						var curHp = Number(v.dgHp) || 0;
						var curMana = Number(v.dgMana) || 0;
						var curGold = Number(v.dgGold) || 0;
						var parts = [];
						if (curHp < hpMax) { v.dgHp = hpMax; parts.push("体力 " + curHp + " → " + hpMax); }
						if (curMana < manaMax) { v.dgMana = manaMax; parts.push("法力 " + curMana + " → " + manaMax); }
						if (curGold < 9999) { v.dgGold = 9999; parts.push("金币 " + curGold + " → 9999"); }
						return {
							ok: true,
							message: parts.length
								? "已补满：" + parts.join("，")
								: "体力 / 法力 / 金币均已在上限，未改动"
						};
					}
				}
			]
		}
	};
