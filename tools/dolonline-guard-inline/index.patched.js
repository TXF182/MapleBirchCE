/* ===== DoLOnline 反作弊守卫（内联，由 patch_index.js 注入）===== */
/* ============================================================
 * DoLOnline 反作弊守卫（内置版）v1.0.0
 *
 * 目的：让外部作弊器（如 MapleBirchCE 的旧版 "dolonline" 适配器）
 *       无法再改写本模组的关键状态。原理是**实时阻断**，不是事后清理。
 *
 * 为什么能挡住：
 *   实测 MapleBirchCE 的写入器 `cheatWriteValue` 最终执行的是
 *     `r.parent[r.leaf] = val;`        （04b-modcheat-write.js:140）
 *   这是一句**普通赋值**。本守卫把目标属性换成「getter + 受控 setter」，
 *   setter 在「非模组写入窗口」里**主动 throw TypeError**。
 *   该异常由 CE 自己的 try/catch（同文件 L96 / L146）接住，面板表现为
 *   「操作异常：...」，值不会落进存档。
 *
 *   注意：拦截强度**与 CE 是否开严格模式无关**——因为是我们主动抛，
 *   不是靠"严格模式下给 getter-only 属性赋值才报错"那套机制。
 *   （实测 CE 包体在 (function(){ "use strict"; ... })() 里，产物 L112-113，
 *    但即便它不开严格模式，这里照样抛。）
 *
 * 实测依据（dolonline534/unpacked/index.js，行号已逐条核对）：
 *   dgGold    唯一写入 L9523（进本置 0），模组从不给它加钱 → 合法态恒为 0
 *   dgInv     写入 L7610(dgAdd) / L7689(dolDgUse) / L7713(dolDgCook)
 *   mpSkill   写入 L8828(等级白送) / L8848(解锁) / L8871(洗点重建)
 *   mpSkillPts 写入 L1448 / L3087 / L3088 / L3891 / L8849 / L8873
 *   mpDgLv    写入 L5953/L5961（gainExpKind 里的 v[lvKey]，上限 99）
 *   dgFloor   写入 L1455 / L1460 / L9522
 *
 * 接入方式（二选一）：
 *   A. 推荐：把本文件作为独立脚本随包分发，在 index.js 最前面 require/eval，
 *      并把下面「需要改的写入点」逐条换成 DGAC.set(...) / DGAC.write(...)。
 *   B. 改动最小的兜底：只调用 DGAC.boot()，不装实时守卫（dgac.strict = false），
 *      仅靠 audit() 自检。能拦"不可能值"（如金币 9999），但拦不住"恰好合法"的值。
 * ============================================================ */
var DGAC = (function () {
	'use strict';

	var VERSION = '1.0.0';
	var TAG = '[DoLOnline] ';

	/* 唯一允许写状态的窗口计数（可嵌套，便于 write 里再调 write） */
	var W = 0;
	/* 容器键的当前真实对象与代理对象，按 key 存 */
	var slots = {};
	/* 拦截记录（内存，不进存档），上限 40 条 */
	var log = [];
	/* 是否安装实时守卫（A 方案 true / B 方案 false） */
	var strict = true;

	var INV_KEYS = ['fang', 'hide', 'herb', 'ore', 'dust', 'ember', 'slime',
		'pot_hp1', 'pot_hp2', 'pot_mp1', 'pot_mp2', 'pot_atk', 'pot_def', 'pot_agi',
		'food_soup', 'food_steak', 'food_stew', 'food_ember_tea'];

	function win() { return W > 0; }

	function note(kind, key, val) {
		try {
			log.push({ t: Date.now(), kind: kind, key: String(key), v: val });
			if (log.length > 40) { log.shift(); }
			if (typeof window !== 'undefined' && window) { window.__dgacLog = log; }
		} catch (e) { /* 记录器自身失败必须静默 */ }
	}

	function deny(key) {
		var e = new TypeError(TAG + '拒绝外部写入 ' + key + '（该状态只允许模组自身修改）');
		e.dolonlineGuard = true;
		return e;
	}

	/* ---- 状态对象取值：兼容模组自己的 VV() ---- */
	function getV() {
		try {
			if (typeof VV === 'function') { return VV(); }
		} catch (e) {}
		try {
			if (typeof window !== 'undefined' && window.State && window.State.variables) {
				return window.State.variables;
			}
		} catch (e2) {}
		return null;
	}

	/* ---- 标量键：装 getter/setter，外部写入抛 TypeError ---- */
	function armScalar(v, key) {
		if (!v || typeof v !== 'object') { return false; }
		var cur = v[key];
		var desc = Object.getOwnPropertyDescriptor(v, key);
		if (desc && desc.get && desc.get.__dolGuard) { return true; }   /* 已装，幂等 */

		var getter = function () { return cur; };
		getter.__dolGuard = true;
		Object.defineProperty(v, key, {
			configurable: true,
			enumerable: true,
			get: getter,
			set: function (x) {
				if (!win()) { note('reject', key, x); throw deny(key); }
				cur = x;
			}
		});
		return true;
	}

	/* ---- 容器键（dgInv / mpSkill）：键本身防整体替换，成员防逐键写 ---- */
	function makeProxy(key, real) {
		if (typeof Proxy !== 'function') { return real; }   /* 老运行环境降级为原对象 */
		var px = new Proxy(real, {
			set: function (t, k, val) {
				if (!win()) { note('reject', key + '.' + String(k), val); throw deny(key + '.' + String(k)); }
				t[k] = val;
				return true;
			},
			deleteProperty: function (t, k) {
				if (!win()) { note('reject-del', key + '.' + String(k), ''); throw deny(key + '.' + String(k)); }
				delete t[k];
				return true;
			}
		});
		/* 注意：绝不能给 px 自身赋标记属性——那会走它自己的 set trap 被自己拦下（实测踩过） */
		return px;
	}

	function armObj(v, key) {
		if (!v || typeof v !== 'object') { return false; }
		var real = v[key];
		if (real === null || typeof real !== 'object') { return false; }

		var desc = Object.getOwnPropertyDescriptor(v, key);
		if (desc && desc.get && desc.get.__dolGuard) {
			/* 已装容器键：仅当底层对象被换掉时刷新代理 */
			if (slots[key] && slots[key].real === real) { return true; }
		} else {
			slots[key] = { real: real, proxy: makeProxy(key, real) };
			var getter = function () {
				return slots[key] ? slots[key].proxy : undefined;
			};
			getter.__dolGuard = true;
			Object.defineProperty(v, key, {
				configurable: true,
				enumerable: true,
				get: getter,
				set: function (nv) {
					if (!win()) { note('reject', key, nv); throw deny(key); }
					slots[key] = { real: nv, proxy: makeProxy(key, nv) };
				}
			});
			return true;
		}
		slots[key] = { real: real, proxy: makeProxy(key, real) };
		return true;
	}

	/* ---- 安装 / 重装（存档加载会整体替换 State.variables，必须能重来） ---- */
	function boot() {
		var v = getV();
		if (!v) { return false; }
		if (!strict) { note('boot', 'skip-strict', ''); return true; }
		armScalar(v, 'dgGold');
		armScalar(v, 'mpSkillPts');
		armScalar(v, 'mpDgLv');
		armScalar(v, 'dgFloor');
		armObj(v, 'dgInv');
		armObj(v, 'mpSkill');
		return true;
	}

	/* ---- 对外写入入口（模组自身唯一合法通道） ---- */
	function write(fn) {
		W++;
		try { return fn(); } finally { W--; }
	}

	function set(container, key, val) {
		W++;
		try { container[key] = val; } finally { W--; }
	}

	/* ---- 兜底自检：清掉「守卫装上之前」就已经被写进来的不可能值 ---- */
	function audit() {
		var v = getV();
		if (!v) { return []; }
		var fixed = [];

		write(function () {
			if (Number(v.dgGold) !== 0) { fixed.push('dgGold(' + v.dgGold + '→0)'); v.dgGold = 0; }
			if (!(Number(v.mpSkillPts) >= 0)) { fixed.push('mpSkillPts(' + v.mpSkillPts + '→0)'); v.mpSkillPts = 0; }
			var lv = Number(v.mpDgLv);
			if (!(lv >= 1 && lv <= 99)) { fixed.push('mpDgLv(' + v.mpDgLv + '→1)'); v.mpDgLv = 1; }
			var fl = Number(v.dgFloor);
			if (!(fl >= 1 && fl <= 999)) { fixed.push('dgFloor(' + v.dgFloor + '→1)'); v.dgFloor = 1; }
			var inv = v.dgInv;
			if (inv && typeof inv === 'object') {
				for (var i = 0; i < INV_KEYS.length; i++) {
					var k = INV_KEYS[i], n = Number(inv[k]);
					if (inv[k] !== undefined && !(n >= 0 && n <= 99)) { fixed.push('dgInv.' + k + '(' + inv[k] + '→0)'); inv[k] = 0; }
				}
			}
			var sk = v.mpSkill;
			if (sk && typeof sk === 'object') {
				for (var k2 in sk) {
					if (!Object.prototype.hasOwnProperty.call(sk, k2)) { continue; }
					var m = Number(sk[k2]);
					if (!(m >= 0)) { fixed.push('mpSkill.' + k2 + '(' + sk[k2] + '→0)'); sk[k2] = 0; }
				}
			}
		});
		if (fixed.length) { note('audit', 'fixed', fixed.join(' / ')); }
		return fixed;
	}

	/* ---- 自动挂载：等待 SugarCube 就绪 → 装守卫 → 每次换页自检 ---- */
	var booted = false, tries = 0;
	function waitBoot() {
		if (boot()) {
			booted = true;
			audit();
			try {
				if (typeof jQuery === 'function') {
					jQuery(document).on(':passageinit', function () { boot(); audit(); });
				}
			} catch (e) {}
			try { setInterval(function () { boot(); audit(); }, 30000); } catch (e2) {}
			return;
		}
		tries++;
		if (tries > 60) { return; }
		setTimeout(waitBoot, 500);
	}

	/* ---- 公开 API ---- */
	return {
		version: VERSION,
		boot: boot,
		rearm: boot,
		audit: audit,
		write: write,
		set: set,
		deny: deny,
		log: log,
		invKeys: INV_KEYS,
		setStrict: function (on) { strict = !!on; },
		start: function () { try { waitBoot(); } catch (e) { note('boot-fail', 'waitBoot', String(e)); } },
		booted: function () { return booted; }
	};
})();

if (typeof window !== 'undefined' && window) { window.DGAC = DGAC; }
if (typeof module !== 'undefined' && module.exports) { module.exports = DGAC; }

/* 启动守卫：等待 SugarCube 就绪后安装，并在每次换页 / 30s 巡检时自检 */
try { DGAC.start(); } catch (e) { /* 守卫启动失败不得影响模组本体 */ }
/* ===== 内联结束 ===== */
/*!
 * DoLOnline —— Degrees of Lewdity (Lyra) 联机插件
 * 功能：账号登录、游戏内聊天大厅、云存档上传/下载
 * 服务端默认 http://127.0.0.1:8787（可在面板内修改）
 */
(function () {
  'use strict';
  if (window.__DoLOnlineLoaded) return;
  window.__DoLOnlineLoaded = true;

  var LS = {
    server: 'dolonline_server',
    token: 'dolonline_token',
    user: 'dolonline_user',
  };

  var DEFAULT_SERVER = 'https://47-118-55-194.sslip.io:8443';
  var SERVER = localStorage.getItem(LS.server) || DEFAULT_SERVER;
  if (SERVER && !/^https?:\/\//i.test(SERVER)) SERVER = 'http://' + SERVER;
  var TOKEN = localStorage.getItem(LS.token) || '';
  var USERNAME = localStorage.getItem(LS.user) || '';

  var ws = null;
  var reconnectTimer = null;
  var pingMs = 0, lastPongAt = 0, pingTimer = null, lastMsgAt = 0;
  var el = {};          // 面板元素引用
  var statusText = '';
  var unreadChat = 0;
  var mirrorScreens = {};     // username -> { passage, html, ts }
  var mirrorSelected = '';    // '' = 自动(最新)
  var timeSyncOn = localStorage.getItem('dolon_time_sync') === '1';
  var timeSyncTimer = null;
  var worldHost = '';
  var cheatAllow = [];
  var marketItems = [];
  var combatState = null;
  var MOD_VERSION = '5.34';
  var fightReturn = '';
  var FIGHT_PASSAGES = ['DoLOnlineCombat'];  // 带战斗 UI、只需 1 个 NPC
  var frameworkHooked = false;
  var frameworkTries = 0;
  var worldId = '';     // 当前加入的共享世界
  var foreignWorld = false;   // 当前世界是否属于别人
  var worldVersion = 0; // 当前世界版本号（本地进度基于的版本）
  var worldLatestVersion = 0; // 世界最新版本号
  var worldPresences = {}; // username -> { passage, day, money, ts }
  var presenceTimer = null;
  var worldActions = [];   // [{ from, action, ts }]
  var MAP_COORDS = {
    domus: [1, 46], barb: [38, 9], danube: [38, 83], connudatus: [63, 46],
    cliff: [88, 9], wolf: [88, 83], high: [114, 46], starfish: [146, 9],
    nightingale: [146, 83], oxford: [176, 46], mer: [204, 9], elk: [204, 83],
    harvest: [230, 46], residential: [38, 46], commercial: [88, 46],
    park: [146, 46], industrial: [204, 46]
  };
  var lastScreenHtml = '';
  var screenTimer = null;

  function wsUrl() {
    var u = SERVER.replace(/^http/i, 'ws');
    try {
      // 页面是 HTTPS 时，浏览器/WebView 禁止 ws://（混合内容），自动改用 wss://
      if (location.protocol === 'https:' && /^ws:\/\//i.test(u)) u = 'wss://' + u.slice(5);
    } catch (e) {}
    return u;
  }

  // 每件装备/物品的唯一 ID（防重复出售）
  function newItemUid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function ensureUid(it) { try { if (it && !it.uid) it.uid = newItemUid(); } catch (e) {} return it; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function api(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
    var opt = { method: method, headers: headers };
    if (body != null) opt.body = JSON.stringify(body);
    return fetch(SERVER + path, opt).then(function (r) {
      return r.json().catch(function () { return { error: 'HTTP ' + r.status }; });
    }).catch(function (e) {
      var msg = (e && e.message) ? e.message : String(e);
      return { error: '无法连接服务器(' + SERVER + ')：' + msg };
    });
  }

  function connectWS() {
    if (!TOKEN) return;
    try {
      if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    } catch (e) {}
    var sock;
    try {
      sock = new WebSocket(wsUrl());
      ws = sock;
    } catch (e) {
      setStatus('连接失败：' + e.message, 'err');
      return;
    }
    sock.onopen = function () {
      try {
        if (sock.readyState === 1) sock.send(JSON.stringify({ type: 'auth', token: TOKEN, ver: MOD_VERSION }));
      } catch (e) {}
    };
    ws.onmessage = function (ev) {
      lastMsgAt = Date.now();
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'auth_ok') {
        if (m.titles) { TITLES = m.titles; }
        try {
          serverAdmins = Array.isArray(m.admins) ? m.admins : [];
          serverIsAdmin = !!m.youAreAdmin;
          if (!m.youAreAdmin) { try { localStorage.removeItem('dolon_cheat_ok'); } catch (e) {} }
        } catch (e) {}
        try { refreshAdminUI(); } catch (e) {}
        setStatus('已连接，在线 ' + m.count + ' 人', 'ok');
        setTimeout(function () { try { unlockAch('firstOnline'); } catch (e) {} }, 500);
        lastOnline = m.users || [];
        renderOnline(lastOnline);
        try { _lastFriendsHtml = ''; renderFriends(); } catch (e) {}
        renderHistory(m.history || []);
        if (m.worlds) renderRooms(m.worlds);
        setTimeout(function () { try { loadMailbox(); } catch (e) {} }, 600);
        if (worldId) { resubscribeWorld(); startPresence(); startScreenSync(); }
      } else if (m.type === 'online') {
        if (m.titles) { TITLES = m.titles; }
        try {
          if (Array.isArray(m.admins)) serverAdmins = m.admins;
          if (typeof m.youAreAdmin === 'boolean') {
            serverIsAdmin = m.youAreAdmin;
            if (!m.youAreAdmin) { try { localStorage.removeItem('dolon_cheat_ok'); } catch (e) {} }
          }
          refreshAdminUI();
        } catch (e) {}
        setStatus('已连接，在线 ' + m.count + ' 人', 'ok');
        setTimeout(function () { try { unlockAch('firstOnline'); } catch (e) {} }, 500);
        lastOnline = m.users || [];
        renderOnline(lastOnline);
        try { _lastFriendsHtml = ''; renderFriends(); } catch (e) {}
        try { renderParty(); } catch (e) {}
      } else if (m.type === 'world_list') {
        renderRooms(m.worlds || []);
      } else if (m.type === 'combat_invite') {
        try {
          if (window.confirm(m.from + ' 邀请你决斗，接受吗？')) {
            try { ws.send(JSON.stringify({ type: 'pvp_accept', from: m.from })); } catch (e) {}
          }
        } catch (e) {}
      } else if (m.type === 'combat_turn') {
        applyPeerCombatTurn(m.turn, m.from);
      } else if (m.type === 'pm') {
        pmHistory.push({ from: m.from, text: m.text, ts: m.ts });
        showToast(' ' + m.from + '：' + m.text);
        try { appendChat('[私信] ' + m.from, m.text, m.ts, false); } catch (e) {}
      } else if (m.type === 'pm_sent') {
        pmHistory.push({ to: m.to, text: m.text, ts: Date.now() });
      } else if (m.type === 'title_list') {
        TITLES = m.titles || TITLES;
        _lastFriendsHtml = '';
        try { if (typeof renderOnline === 'function' && lastOnline) renderOnline(lastOnline); } catch (e) {}
        try { renderFriends(); } catch (e) {}
      } else if (m.type === 'grant_exp') {
        gainExp(m.amount || 0);
        showToast(' ' + (m.reason || ('获得 ' + (m.amount||0) + ' 经验')));
      } else if (m.type === 'cp_apply') {
        if (window.confirm(m.from + ' 想和你结为CP，同意吗？')) {
          try { ws.send(JSON.stringify({ type: 'cp_accept', from: m.from })); } catch (e) {}
        } else {
          try { ws.send(JSON.stringify({ type: 'cp_reject', from: m.from })); } catch (e) {}
        }
      } else if (m.type === 'cp_list') {
        var allCp = m.cps || {};
        cpPartner = allCp[USERNAME] || '';
        if (cpPartner) setTimeout(function () { try { unlockAch('firstCp'); } catch (e) {} }, 200);
        try { if (VV()) VV().__cpPartner = cpPartner; } catch (e) {}
        if (m.reqs) cpReqs = m.reqs;
        renderCp();
      } else if (m.type === 'cp_notice') {
        showToast(' ' + m.text);
      } else if (m.type === 'friend_request') {
        if (window.confirm(m.from + ' 想加你为好友，同意吗？')) {
          try { ws.send(JSON.stringify({ type: 'friend_accept', from: m.from })); } catch (e) {}
        } else {
          try { ws.send(JSON.stringify({ type: 'friend_reject', from: m.from })); } catch (e) {}
        }
      } else if (m.type === 'friend_list') {
        friendList = m.friends || friendList;
        if (friendList.length) setTimeout(function () { try { unlockAch('firstFriend'); } catch (e) {} }, 200);
        if (m.reqs) friendReqs = m.reqs;
        renderFriends();
      } else if (m.type === 'friend_notice') {
        showToast(' ' + m.text);
      } else if (m.type === 'party_invite') {
        if (window.confirm(m.from + ' 邀请你组队，接受吗？')) {
          try { ws.send(JSON.stringify({ type: 'party_accept', from: m.from })); } catch (e) {}
        }
      } else if (m.type === 'party_enter') {
        try {
          var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
          if (cur === 'Harvest Street') {
            showToast(m.from + ' 进入了地下城，正在跟上…');
            try { SugarCube.Engine.play('DoLOnlineDungeonEntry'); } catch (e) {}
          } else if (cur.indexOf('DoLOnline') !== 0) {
            showToast(m.from + ' 进了地下城（回丰收街可跟上）');
          }
        } catch (e) {}
      } else if (m.type === 'combat_state') {
        if (m.over) { nativeCombat = null; nativeLeader = ''; }
        else { nativeCombat = { name: m.name, hp: m.hp, hpMax: m.hpMax }; nativeLeader = m.from; }
        renderNativeCombat();
      } else if (m.type === 'combat_assist') {
        try {
          var e2 = nativeEnemy();
          if (e2 && e2.ref) {
            var nv = Math.max(0, e2.hp - (Number(m.value) || 0));
            e2.ref[e2.field] = nv;
            try { if (window.SugarCube && SugarCube.Engine) SugarCube.Engine.play(); } catch (e) {}
            showToast(m.from + ' 协助攻击，造成 ' + (m.value || 0) + ' 伤害');
            if (window.SugarCube && SugarCube.Engine) { try { SugarCube.Engine.play(); } catch (e) {} }
          }
        } catch (e) {}
      } else if (m.type === 'party_run') {
        partyRun = m.run;
        try { renderPartyRun(); } catch (e) {}
        try {
          if (partyRun && partyRun.active) {
            var _cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
            if (_cur.indexOf('DoLOnline') !== 0 && (!window.__dolPartyRunToast || Date.now() - window.__dolPartyRunToast > 8000)) {
              window.__dolPartyRunToast = Date.now();
              showToast('队伍打起来了：面板「队伍 → 共享怪物」参战');
            }
          }
        } catch (e) {}
        try {
          if (partyRun && partyRun.mon) {
            var v = VV();
            var _psg = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
            var _changed = false;
            if (v) {
              _changed = (Number(v.dgEHp) || 0) !== (Number(partyRun.mon.hp) || 0);
              v.dgEHp = partyRun.mon.hp; v.dgEHpMax = partyRun.mon.hpMax; v.dgEnemyName = partyRun.mon.name;
            }
            dungeonPassageEnhance(_psg);
            // 本地血条和服务器不一致时刷新一次，让页面上的血条跟上
            if (_changed && _psg.indexOf('DoLOnline') === 0) {
              var _now = Date.now();
              if (!window.__dolPartySyncAt || _now - window.__dolPartySyncAt > 900) {
                window.__dolPartySyncAt = _now;
                try { SugarCube.Engine.play(_psg); } catch (e) {}
              }
            }
          }
        } catch (e) {}
      } else if (m.type === 'party_state') {
        var _oldId = partyId;
        partyMembers = m.members || [];
        partyId = m.partyId || '';
        if (!_oldId && partyId && partyMembers.length > 1) {
          showToast(' 组队成功：' + partyMembers.join('、'));
        }
        renderParty();
      } else if (m.type === 'item_offer') {
        try {
          var ok = window.confirm((m.from || '对方') + ' 想送你：「' + ((m.item && m.item.n) || '?') + '」，接受吗？');
          ws.send(JSON.stringify({ type: 'item_reply', to: m.from, accept: !!ok }));
        } catch (e) {}
      } else if (m.type === 'item_reply') {
        if (m.accept) {
          var v2 = VV();
          var arr = (v2 && Array.isArray(v2.mpBag)) ? v2.mpBag : [];
          var target = window.__dolPendingItem;
          if (target) {
            for (var bi = 0; bi < arr.length; bi++) {
              if (arr[bi] && arr[bi].n === target.n && arr[bi].dur === target.dur) { arr.splice(bi, 1); break; }
            }
            try { ws.send(JSON.stringify({ type: 'item_give', to: m.from, item: target })); } catch (e) {}
            window.__dolPendingItem = null;
            try { renderBag(); renderEquip(); } catch (e) {}
            showToast('已送出');
          }
        } else {
          window.__dolPendingItem = null;
          showToast('对方拒绝了赠予');
        }
      } else if (m.type === 'item_give') {
        try {
          var v3 = VV();
          if (v3 && m.item) {
            if (!Array.isArray(v3.mpBag)) v3.mpBag = [];
            v3.mpBag.push(ensureUid(m.item));
            try { window.dolCodexEquip(m.item.n); } catch (e) {}
            showToast('收到 ' + (m.from || '对方') + ' 送的「' + (m.item.n || '装备') + '」');
            try { renderBag(); renderEquip(); } catch (e) {}
          }
        } catch (e) {}
      } else if (m.type === 'grant_gold') {
        try { var vg = VV(); if (vg) { vg.money = (Number(vg.money) || 0) + (Number(m.amount) || 0); showToast('获得 ' + fmtMoney(m.amount)); } } catch (e) {}
      } else if (m.type === 'grant_equip') {
        try { window.dolGrantEquip(m.slot || 'weapon'); } catch (e) {}
      } else if (m.type === 'world_boss') {
        renderWorldBoss(m.boss, m.msg);
      } else if (m.type === 'market_data') {
        marketItems = m.items || []; renderMarket();
      } else if (m.type === 'mail_list') {
        mailList = m.mails || [];
        try { renderMailbox(); } catch (e) {}
      } else if (m.type === 'mail_new') {
        try { showToast('📬 收到 ' + (m.count || 1) + ' 封新邮件'); } catch (e) {}
        try { loadMailbox(); } catch (e) {}
      } else if (m.type === 'mail_claimed') {
        try {
          showToast('领取：' + (m.kind === 'cat' ? ((m.amount || 0) + ' 猫猫币') : (m.amount ? fmtMoney(m.amount) : (m.text || '物品'))));
          if (m.amount) ws.send(JSON.stringify({ type: 'market_payout' }));
        } catch (e) {}
        try { loadMailbox(); } catch (e) {}
      } else if (m.type === 'pong') {
        lastPongAt = Date.now();
        pingMs = Math.max(1, lastPongAt - (Number(m.ts) || lastPongAt));
        try {
          var pe = document.getElementById('dol-ping');
          if (pe) {
            pe.textContent = '延迟 ' + pingMs + ' ms';
            pe.style.color = pingMs < 100 ? '#7ec98a' : (pingMs < 300 ? '#e8c97a' : '#e07a7a');
          }
        } catch (e) {}
      } else if (m.type === 'banned') {
        try {
          var until = m.until ? new Date(m.until).toLocaleString() : '永久';
          setStatus('账号已被封禁（' + until + '）' + (m.reason ? ('：' + m.reason) : ''), 'err');
          showToast('账号已被封禁：' + (m.reason || '违反规则'));
        } catch (e) {}
      } else if (m.type === 'admin_ok') {
        try { var o1 = document.getElementById('dol-ban-out'); if (o1) o1.textContent = m.msg || '完成'; } catch (e) {}
        try { showToast(m.msg || '完成'); } catch (e) {}
      } else if (m.type === 'ban_list') {
        try {
          var o2 = document.getElementById('dol-ban-out');
          if (o2) {
            var arr = m.list || [];
            o2.innerHTML = arr.length ? arr.map(function (x) {
              return esc(x.n) + '　' + (x.until ? new Date(x.until).toLocaleDateString() : '永久') + (x.reason ? ('　' + esc(x.reason)) : '');
            }).join('<br>') : '（没有封禁记录）';
          }
        } catch (e) {}
      } else if (m.type === 'ver_warn') {
        try {
          window.__dolOldVer = m.ver || '';
          showToast('你的版本 ' + (m.ver || '未知') + ' 过旧，市场与排行榜已禁用，请更新到 ' + m.min);
        } catch (e) {}
      } else if (m.type === 'lb_data') {
        lbData = m; try { renderLb(); } catch (e) {}
      } else if (m.type === 'market_bought') {
        try {
          var v = VV(); if (v) { if (!Array.isArray(v.mpBag)) v.mpBag = []; v.mpBag.push(ensureUid(m.item)); }
          try { window.dolCodexEquip(m.item && m.item.n); } catch (e) {}
          showToast('买到：' + (m.item && m.item.n));
          renderBag();
        } catch (e) {}
      } else if (m.type === 'market_sold') {
        showToast('卖出：' + (m.item && m.item.n) + '　到账 ' + fmtMoney(m.price || 0));
        try { ws.send(JSON.stringify({ type: 'market_payout' })); } catch (e) {}
      } else if (m.type === 'market_payout_done') {
        try {
          var v2 = VV();
          if (v2) {
            if (Number(m.amount) > 0) v2.money = (Number(v2.money) || 0) + Number(m.amount);
            if (Number(m.cat) > 0) v2.mpCat = (Number(v2.mpCat) || 0) + Number(m.cat);
          }
        } catch (e) {}
        try { renderCatBalance(); } catch (e) {}
        showToast('市场收入到账 ' + (Number(m.amount) > 0 ? fmtMoney(m.amount) : '') + (Number(m.cat) > 0 ? (Number(m.amount) > 0 ? ' + ' : '') + m.cat + ' 猫猫币' : ''));
      } else if (m.type === 'market_return') {
        try { var v3 = VV(); if (v3) { if (!Array.isArray(v3.mpBag)) v3.mpBag = []; v3.mpBag.push(ensureUid(m.item)); } } catch (e) {}
        showToast('已下架并退回背包'); renderBag();
      } else if (m.type === 'market_err') {
        window.__dolListingItem = null;
        showToast(m.msg || '市场操作失败');
      } else if (m.type === 'market_ok') {
        try {
          var it0 = window.__dolListingItem;
          if (it0) {
            var v0 = VV();
            if (v0 && Array.isArray(v0.mpBag)) {
              for (var kk = v0.mpBag.length - 1; kk >= 0; kk--) {
                var b0 = v0.mpBag[kk];
                if (b0 === it0 || (b0 && b0.n === it0.n && b0.dur === it0.dur && b0.atk === it0.atk)) { v0.mpBag.splice(kk, 1); break; }
              }
            }
            window.__dolListingItem = null;
            try { renderBag(); } catch (e) {}
          }
        } catch (e) {}
        showToast(m.msg || '已上架');
        try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'market_data' })); } catch (e) {}
      } else if (m.type === 'announce') {
        showAnnounce(m.text || '');
      } else if (m.type === 'pvp_invite') {
        if (window.confirm(m.from + ' 向你发起决斗，接受吗？')) {
          try { ws.send(JSON.stringify({ type: 'pvp_accept', from: m.from })); } catch (e) {}
        }
      } else if (m.type === 'pvp_state') {
        renderPvp(m.pvp, m.msg);
      } else if (m.type === 'pvp_end') {
        var _res = (m.winner === USERNAME ? '你赢了！' : '你输了…') + (m.reason ? '（' + m.reason + '）' : '');
        renderPvp(m.pvp, _res);
        try { if (!m.winner) pvpState = null; } catch (e) {}
        setTimeout(function () { try { renderPvp(null); } catch (e) {} }, 4000);
      } else if (m.type === 'party_gear') {
        if (m.from && m.from !== USERNAME) { partyGear[m.from] = Array.isArray(m.gear) ? m.gear : []; renderPartyGear(); }
      } else if (m.type === 'party_event_state') {
        try {
          if (m.event && m.event.kind === 'dungeon' && m.event.active) {
            showToast('队伍副本开启：' + (m.event.monName || '') + ' Lv.' + (m.event.monLevel || 1));
          }
        } catch (e) {}
        renderPartyEvent(m.event);
      } else if (m.type === 'party_action') {
        showToast(' ' + m.from + '：' + (m.action || '行动') + (m.value ? '（+' + m.value + '）' : ''));
      } else if (m.type === 'trade_offer') {
        var acc = window.confirm(m.from + ' 想和你交易：给你 £' + m.amount + '，接受吗？');
        try { ws.send(JSON.stringify({ type: 'trade_reply', to: m.from, amount: m.amount, accept: acc })); } catch (e) {}
      } else if (m.type === 'trade_result') {
        if (m.accept) {
          var vt = VV();
          if (m.role === 'payer') { vt.money = Math.max(0, (Number(vt.money) || 0) - m.amount); showToast(' 你支付了 £' + m.amount); }
          else { vt.money = (Number(vt.money) || 0) + m.amount; showToast(' 你收到 £' + m.amount); }
        } else { showToast(' 交易被拒绝'); }
      } else if (m.type === 'combat_snapshots') {
        try {
          var ss = m.snapshots || {};
          for (var un in ss) {
            if (Object.prototype.hasOwnProperty.call(ss, un) && un !== USERNAME) {
              peerCombatSnapshot = ss[un];
            }
          }
          try { if (document.getElementById('dol-peer-model')) renderPeerModel(); } catch (e) {}
        } catch (e) {}
      } else if (m.type === 'settings_update') {
        if (m.icon) applyIconLocal(m.icon);
      } else if (m.type === 'chat_cleared') {
        try { el.msg.innerHTML = ''; } catch (e) {}
        setStatus('公屏已清空', 'ok');
      } else if (m.type === 'chat') {
        appendChat(m.from, m.text, m.ts, m.from === USERNAME);
        if (m.from !== USERNAME && el.panel && !el.panel.classList.contains('open')) {
          unreadChat++; updateBadge();
        }
      } else if (m.type === 'world_update') {
        if (m.worldId === worldId) {
          if (m.lastEditor && m.lastEditor === USERNAME) { worldVersion = m.version; worldLatestVersion = m.version; }
          else {
          worldLatestVersion = m.version;
          setWorldStatus(' 世界已更新到 v' + m.version + '（' + (m.lastEditor || '某人') + '），点「载入世界存档」获取最新进度', 'err');
          setStatus('世界有新进度', 'ok');
          }
        }
      } else if (m.type === 'world_screen') {
        if (m.from && m.from !== USERNAME) {
          mirrorScreens[m.from] = { passage: m.passage, html: m.html, ts: m.ts || Date.now() };
          renderMirrorPlayers(); renderMirror();
        }
      } else if (m.type === 'global_presence') {
        if (m.from && m.from !== USERNAME) { globalPresence[m.from] = { passage: m.passage, mapLocation: m.mapLocation, lv: m.lv, money: m.money, ts: m.ts }; renderWorldPresence(); }
      } else if (m.type === 'global_presence_leave') {
        if (m.from) { delete globalPresence[m.from]; renderWorldPresence(); }
      } else if (m.type === 'world_presence') {
        worldPresences[m.from] = { passage: m.passage, day: m.day, money: m.money, lv: m.lv, mapLocation: m.mapLocation, timeStamp: m.timeStamp, ts: m.ts };
        renderMapMarkers();
        renderWorldPresence();
        try { renderCoLocated(); } catch (e) {}
        updateTimeBadge();
        renderCheatList();
      } else if (m.type === 'world_presence_leave') {
        delete worldPresences[m.from];
        renderWorldPresence();
      } else if (m.type === 'world_action') {
        appendWorldAction(m.from, m.action, m.ts);
      } else if (m.type === 'combat_state') {
        try {
          if (m.combat && m.combat.players) {
            for (var _i = 0; _i < m.combat.players.length; _i++) {
              if (m.combat.players[_i].name !== USERNAME) { combatPeerName = m.combat.players[_i].name; break; }
            }
          }
        } catch (e) {}
        combatState = m.combat;
        try { var _cb = document.getElementById('dol-combat'); if (_cb) _cb.style.display = 'none'; } catch (e) {}
      } else if (m.type === 'cheat_perms') {
        worldHost = m.host || worldHost;
        cheatAllow = Array.isArray(m.cheatAllow) ? m.cheatAllow : [];
        renderCheatList();
        try { refreshAdminUI(); } catch (e) {}
      } else if (m.type === 'interact') {
        handleInteract(m);
      } else if (m.type === 'world_screen') {
        mirrorScreens[m.from] = { passage: m.passage, html: m.html, ts: Date.now() };
        renderMirrorPlayers();
        if (mirrorSelected === '' || mirrorSelected === m.from) renderMirror(mirrorSelected || m.from);
      } else if (m.type === 'error') {
        setStatus(m.msg, 'err');
        try { showToast('⚠ ' + (m.msg || '操作失败')); } catch (e) {}
      }
    };
    ws.onopen = (function (prev) {
      return function (ev) {
        try { startPing(); } catch (e) {}
        if (prev) try { prev.call(ws, ev); } catch (e) {}
      };
    })(ws.onopen);
    ws.onclose = function (ev) {
      stopPing();
      stopPresence();
      var code = (ev && ev.code) || 0;
      var reason = (ev && ev.reason) || '';
      window.__dolDc = (window.__dolDc || 0) + 1;
      var idleS = lastMsgAt ? Math.round((Date.now() - lastMsgAt) / 1000) : -1;
      var hidden = false;
      try { hidden = (document.visibilityState === 'hidden'); } catch (e) {}
      window.__dolDcInfo = 'code=' + code + (reason ? (' ' + reason) : '') +
        ' 第' + window.__dolDc + '次' +
        (idleS >= 0 ? (' 静默' + idleS + 's') : '') +
        (hidden ? ' 后台中' : '');
      setStatus('已断开（' + window.__dolDcInfo + '），重连中…', 'err');
      scheduleReconnect();
    };
    ws.onerror = function () {
      var msg = '连接失败（可能是明文网络被系统拦截）';
      try {
        if (location.protocol === 'https:' && /^ws:\/\//i.test(SERVER.replace(/^http/i, 'ws'))) {
          msg = '连接失败：当前页面是 HTTPS，无法连接 ws://，服务器需要开启 wss（TLS）或换成 https 地址';
        }
      } catch (e) {}
      setStatus(msg, 'err');
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    var delay = 2500 + Math.floor(Math.random() * 2500);
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      if (TOKEN && (!ws || ws.readyState === 3 || ws.readyState === 2)) connectWS();
    }, delay);
  }
  window.dolSpeedTest = function () {
    try {
      var t0 = Date.now();
      var times = [];
      var done = 0;
      var finish = function () {
        done++;
        if (done < 3) return;
        times.sort(function (a, b) { return a - b; });
        var best = times[0], avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length);
        try {
          var pe = document.getElementById('dol-ping');
          if (pe) {
            pe.textContent = 'HTTP ' + best + 'ms · WS ' + (pingMs || '—') + 'ms';
            pe.style.color = best < 100 ? '#7ec98a' : (best < 300 ? '#e8c97a' : '#e07a7a');
          }
        } catch (e) {}
      };
      for (var i = 0; i < 3; i++) {
        fetch(SERVER + '/api/ping?_=' + Date.now() + i, { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function () { times.push(Date.now() - t0); })
          .catch(function () { times.push(9999); })
          .then(finish);
      }
      try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping', ts: Date.now() })); } catch (e) {}
    } catch (e) {}
  };
  function startPing() {
    stopPing();
    lastPongAt = Date.now();
    var beat = function () {
      try {
        if (!ws || ws.readyState !== 1) return;
        // 超过 45 秒没收到 pong，认为连接已死，主动断开重连
        if (Date.now() - lastPongAt > 35000) { try { ws.close(); } catch (e) {} return; }
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      } catch (e) {}
    };
    beat();
    pingTimer = setInterval(beat, 15000);
  }
  function stopPing() { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }
  // 回到前台/恢复网络时立刻尝试重连
  document.addEventListener('visibilitychange', function () {
    try {
      if (document.visibilityState === 'visible' && TOKEN && (!ws || ws.readyState > 1)) connectWS();
    } catch (e) {}
  });
  window.addEventListener('online', function () {
    try { if (TOKEN && (!ws || ws.readyState > 1)) connectWS(); } catch (e) {}
  });

  function fmtMoney(pence) {
    var x = Number(pence) || 0;
    if (Math.abs(x) < 0.5) x = 0;
    return '£' + (x / 100).toFixed(2);
  }
  var REPAIR_RATE = { common: 400, fine: 600, rare: 900, epic: 1400, legend: 2000, myth: 2800, divine: 4000 };
  window.dolRepairCost = function (it) {
    try {
      if (!it) return 0;
      var max = Number(it.maxDur) || 100;
      var dur = (it.dur == null) ? max : (Number(it.dur) || 0);
      var miss = Math.max(0, max - dur);
      var rate = REPAIR_RATE[it.rarity || 'common'] || 150;
      return Math.max(rate * 3, Math.round(miss * rate));
    } catch (e) { return 200; }
  };
  window.dolFmtMoney = function (pence) { try { return fmtMoney(pence); } catch (e) { return '£?'; } };
  function toPence(pounds) { return Math.round((Number(pounds) || 0) * 100); }
  function VV() {
    try {
      var SC = window.SugarCube;
      if (SC && SC.State && SC.State.variables) return SC.State.variables;
      if (SC && SC.Variables) return SC.Variables;
      if (window.State && window.State.variables) return window.State.variables;
    } catch (e) {}
    return null;
  }
  var serverAdmins = [];
  var serverIsAdmin = false;
  // 离线（单人）时管理功能可用；连上服务器后由服务端授权决定
  function canManage() {
    try {
      if (!TOKEN || !ws || ws.readyState !== 1) return true;
      return !!serverIsAdmin;
    } catch (e) { return true; }
  }
  function isAdminUser() { return canManage(); }
  window.dolSetAdmin = function () {};
  function refreshAdminUI() {
    try {
      var adm = canCheat();
      var sec = document.getElementById('dol-admin-sec');
      var hint = document.getElementById('dol-admin-hint');
      if (sec) sec.style.display = adm ? 'block' : 'none';
      if (hint) hint.style.display = adm ? 'none' : 'block';
      var deny = document.getElementById('dol-admin-deny');
      if (deny) deny.style.display = adm ? 'none' : 'block';
      try {
        var grant = document.getElementById('dol-cheat-grant');
        if (grant) grant.style.display = (adm && serverIsAdmin) ? 'block' : 'none';
      } catch (e) {}
      try {
        var gs = document.getElementById('dol-give-sec');
        if (gs) gs.style.display = adm ? 'block' : 'none';
        var shops = document.getElementById('dol-shops');
        if (shops) shops.style.display = adm ? 'block' : 'none';
      } catch (e) {}
      try { renderCheatList(); } catch (e) {}
      try { window.__dolRefreshBanBox && window.__dolRefreshBanBox(); } catch (e) {}
      try { enforceCheatGate(); } catch (e) {}
    } catch (e) {}
  }
  function setupPanelTabs() {
    try {
      var panel = document.getElementById('dolonline-panel');
      if (!panel || panel.__tabsReady) return;
      var body = panel.querySelector('.dob');
      if (!body) return;
      var map = {
        '地下城': 'adv', '委托': 'adv', '图鉴': 'adv', '冒险': 'adv',
        '好友 / CP / 队伍 / 队友': 'social', '市场': 'social', '猫猫抽奖': 'social',
        '存档 / 世界': 'set', '杂项': 'set', '工具': 'set'
      };
      // 顶部区块按标签归组
      var curLabel = '';
      Array.prototype.forEach.call(body.children, function (ch) {
        if (ch.tagName === 'DETAILS') {
          var sum = ch.querySelector('summary');
          var t = sum ? sum.textContent.trim() : '';
          ch.__dolGroup = map[t] || 'adv';
          return;
        }
        var txt = (ch.textContent || '').trim();
        if (ch.classList && ch.classList.contains('lbl')) {
          curLabel = txt.split('　')[0];
          ch.__dolGroup = (curLabel.indexOf('屏幕镜像') >= 0) ? 'all' : 'social';
          return;
        }
        if (curLabel.indexOf('屏幕镜像') >= 0) ch.__dolGroup = 'all';
        else ch.__dolGroup = 'social';
      });
      var bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:4px;margin:0 0 6px';
      [['social','联机'],['adv','冒险'],['set','设置']].forEach(function (t) {
        var b = document.createElement('button');
        b.textContent = t[1];
        b.setAttribute('data-ptab', t[0]);
        b.style.cssText = 'flex:1;padding:6px;font-size:12px;border-radius:6px;background:#16181e;border:1px solid #2a2a34;color:#9a9a9a';
        bar.appendChild(b);
      });
      body.insertBefore(bar, body.firstChild);
      function apply(tab) {
        Array.prototype.forEach.call(body.children, function (ch) {
          if (ch === bar) return;
          var g = ch.__dolGroup || 'adv';
          ch.style.display = (g === tab || g === 'all') ? '' : 'none';
          if (ch.tagName === 'DETAILS' && g === tab) ch.open = true;
        });
        bar.querySelectorAll('[data-ptab]').forEach(function (b) {
          var on = b.getAttribute('data-ptab') === tab;
          b.style.background = on ? 'rgba(232,201,122,.22)' : '#16181e';
          b.style.border = '1px solid ' + (on ? 'rgba(232,201,122,.6)' : '#2a2a34');
          b.style.color = on ? '#f0d060' : '#9a9a9a';
        });
      }
      bar.querySelectorAll('[data-ptab]').forEach(function (b) {
        b.onclick = function () { apply(b.getAttribute('data-ptab')); };
      });
      apply('social');
      panel.__tabsReady = true;
    } catch (e) {}
  }

  function setOnEl(id, fn) {
    try { var e = document.getElementById(id); if (e) e.onclick = fn; } catch (err) {}
  }
  function buildUI() {
    var style = document.createElement('style');
    style.textContent =
      '#dolonline-btn{position:fixed;right:10px;bottom:90px;z-index:2147483000;width:46px;height:46px;' +
      'border-radius:50%;background:#20242e;color:#e8c97a;border:1px solid #4a4030;font-size:13px;' +
      'font-weight:bold;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);line-height:46px;text-align:center;user-select:none;touch-action:manipulation}' +
      '#dolonline-btn:hover{background:#2b3040}' +
      '#dolonline-btn .dolonline-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;' +
      'border-radius:8px;background:#e23b3b;color:#fff;font-size:11px;line-height:16px;text-align:center;' +
      'padding:0 3px;box-sizing:border-box;display:none;font-weight:bold;border:1px solid #fff}' +
      '#dolonline-btn .dolonline-timebadge{position:absolute;bottom:-6px;left:-6px;max-width:60px;height:18px;' +
      'border-radius:9px;background:#e8a33b;color:#111;font-size:10px;line-height:18px;text-align:center;' +
      'padding:0 4px;box-sizing:border-box;display:none;font-weight:bold;border:1px solid #fff;white-space:nowrap;cursor:pointer}' +
      '#dol-onboard{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483660;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0);opacity:0;transition:opacity .25s;pointer-events:none}' +
      '#dol-onboard.show{opacity:1;background:rgba(0,0,0,.45);pointer-events:auto}' +
      '#dol-onboard .ob-card{width:min(86vw,330px);padding:20px 18px;border-radius:16px;background:linear-gradient(160deg,#1c1a1c,#171612);border:1px solid rgba(200,170,110,.4);box-shadow:0 16px 48px rgba(0,0,0,.7);text-align:center;color:#ded6d0;font-family:sans-serif}' +
      '#dol-onboard .ob-tag{display:inline-block;font-size:11px;letter-spacing:2px;color:#e8c97a;border:1px solid rgba(232,201,122,.4);border-radius:999px;padding:2px 10px;margin-bottom:10px}' +
      '#dol-onboard .ob-title{font-size:19px;font-weight:bold;color:#f0e6d8;margin-bottom:8px;letter-spacing:1px}' +
      '#dol-onboard .ob-desc{font-size:13px;line-height:1.7;color:#a89e96;margin-bottom:12px}' +
      '#dol-onboard .ob-online{font-size:12px;color:#9ac7ff;margin-bottom:14px}' +
      '#dol-onboard .ob-online b{color:#7ec98a;font-size:15px}' +
      '#dol-onboard .ob-btns{display:flex;gap:8px}' +
      '#dol-onboard .ob-btns button{flex:1;padding:10px 0;border-radius:10px;font-size:14px;cursor:pointer;border:1px solid rgba(232,201,122,.45);background:linear-gradient(180deg,#3a3220,#2a2518);color:#f0d060}' +
      '#dol-onboard .ob-btns button:last-child{background:transparent;color:#a89e96;border-color:rgba(255,255,255,.15)}' +
      '#dol-onboard .ob-btns button[disabled]{opacity:.6}' +
      '@keyframes dolMarquee{0%{transform:translateX(100vw)}100%{transform:translateX(-100%)}}' +
      '#dol-announce{position:fixed;left:0;right:0;top:calc(32px + env(safe-area-inset-top,0px));height:24px;overflow:hidden;' +
      'z-index:2147483650;pointer-events:none;display:none}' +
      '#dol-announce .txt{display:inline-block;white-space:nowrap;font-size:13px;line-height:24px;color:#f0d060;' +
      'text-shadow:0 0 8px rgba(240,208,96,.6),0 1px 3px rgba(0,0,0,.9);animation:dolMarquee 9s linear}' +
      '#dolonline-panel{touch-action:auto;-webkit-user-select:none;position:fixed;right:8px;top:1.5vh;bottom:6vh;z-index:2147483000;width:min(94vw,330px);max-width:96vw;max-height:92vh;' +
      'background:linear-gradient(160deg,#1c1a1c 0%,#1c1b17 100%);color:#d4cdd0;border:1px solid rgba(150,130,140,.45);border-radius:14px;font:14px/1.55 sans-serif;' +
      'box-shadow:0 12px 40px rgba(120,40,80,.35),inset 0 1px 0 rgba(255,255,255,.6);display:none;flex-direction:column;overflow:hidden}' +
      '#dolonline-panel.open{display:flex}' +
      '#dolonline-panel .dol-rainbow{animation:dolHue 3s linear infinite}' +
      '@keyframes dolHue{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}' +
      '@keyframes dolLegendPulse{0%,100%{opacity:1}50%{opacity:.65}}' +
      '@keyframes dolDivineShift{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}' +
      '@keyframes dolFloatUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-46px);opacity:0}}' +
      '@keyframes dolPillarIn{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}' +
      '#dol-float-layer{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:2147483662}' +
      '#dol-float-layer .dol-float{position:absolute;font-weight:bold;font-size:21px;letter-spacing:1px;text-shadow:0 2px 8px rgba(0,0,0,.95),0 0 12px rgba(0,0,0,.6);animation:dolFloatUp 1.1s ease-out forwards}' +
      '#dol-pillar{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483664;pointer-events:none;display:none;align-items:center;justify-content:center;flex-direction:column}' +
      '#dol-pillar .dol-pillar-beam{width:120px;height:70vh;filter:blur(18px);opacity:.85}' +
      '#dol-pillar .dol-pillar-text{position:absolute;font-size:22px;font-weight:bold;letter-spacing:2px}' +
      '#dolonline-panel .doh{flex:0 0 auto;background:linear-gradient(90deg,#2a2628,#2a2820);padding:12px 14px;font-weight:bold;color:#c8bcc0;display:flex;' +
      'justify-content:space-between;align-items:center;border-bottom:1px solid rgba(224,120,160,.35);letter-spacing:1px;font-size:15px}' +
      '#dolonline-panel .dob{flex:1 1 auto;min-height:0;padding:14px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;display:flex;flex-direction:column;gap:12px}' +
      '#dolonline-panel .dob::-webkit-scrollbar{width:6px}' +
      '#dolonline-panel .dob::-webkit-scrollbar-thumb{background:rgba(224,120,160,.4);border-radius:3px}' +
      '#dolonline-panel .dob > *{flex-shrink:0}' +
      '#dolonline-panel .dob > .lbl:first-child{margin-top:0;padding-top:0;border-top:0}' +
      '#dolonline-panel .msg,#dolonline-panel .roomlist,#dolonline-panel .mirror{flex-shrink:0}' +
      '#dolonline-panel input,#dolonline-panel textarea{background:#141314;color:#d4cdd0;border:1px solid rgba(150,130,140,.3);' +
      'border-radius:8px;padding:8px 10px;font-size:13px;width:100%;box-sizing:border-box;outline:none;transition:border-color .2s}' +
      '#dolonline-panel input:focus,#dolonline-panel textarea:focus{border-color:rgba(232,201,122,.6)}' +
      '#dolonline-panel .dor{display:flex;gap:6px}' +
      '#dolonline-panel button{background:linear-gradient(180deg,#2c282a,#2c2a24);color:#cfc6c8;border:1px solid rgba(150,130,140,.3);border-radius:8px;' +
      'padding:8px 12px;cursor:pointer;font-size:13px;transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.3)}' +
      '#dolonline-panel button:hover{background:linear-gradient(180deg,#383234,#38342c);border-color:rgba(150,130,140,.55)}' +
      '#dolonline-panel button:active{background:#3a4152}' +
      '#dolonline-panel .msg{max-height:40vh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;' +
      'background:#141314;border:1px solid rgba(150,130,140,.22);border-radius:6px;padding:8px 10px 8px 8px;' +
      'display:flex;flex-direction:column;gap:3px;min-height:120px}' +
      '#dolonline-panel .msg::-webkit-scrollbar{width:10px}' +
      '#dolonline-panel .msg::-webkit-scrollbar-track{background:rgba(255,255,255,.04);border-radius:5px}' +
      '#dolonline-panel .msg::-webkit-scrollbar-thumb{background:rgba(200,170,140,.45);border-radius:5px}' +
      '#dolonline-panel .msg::-webkit-scrollbar-thumb:active{background:rgba(232,201,122,.7)}' +
      '#dolonline-panel .msg .m{margin:1px 0;word-break:break-word}' +
      '#dolonline-panel .msg .t{color:#8a8a8a;font-size:11px}' +
      '#dolonline-panel .myname{color:#e8c97a}' +
      '#dolonline-panel .st{font-size:12px;color:#8a8082;min-height:16px}' +
      '#dolonline-panel .st.ok{color:#7ec98a}' +
      '#dolonline-panel .st.err{color:#e07a7a}' +
      '#dolonline-panel .lbl{font-size:12px;color:#b4a6a8;font-weight:bold;letter-spacing:.5px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(150,130,140,.18);opacity:.95}' +
      '#dolonline-panel details{border:1px solid rgba(150,130,140,.22);border-radius:8px;padding:0 10px;background:rgba(255,255,255,.02)}' +
      '#dolonline-panel[data-theme="pink"]{background:linear-gradient(160deg,#241a20,#241f14);border-color:rgba(200,130,165,.55);color:#e8dce4}' +
      '#dolonline-panel[data-theme="pink"] .doh{background:linear-gradient(90deg,#5a2a3e,#5a4a21);color:#f0c8dc}' +
      '#dolonline-panel[data-theme="pink"] .lbl{color:#e8a0c0}' +
      '#dolonline-panel[data-theme="pink"] button{background:linear-gradient(180deg,#3a2a34,#3a3220);color:#f0c8dc}' +
      '#dolonline-panel[data-theme="pink"] summary{color:#e8a0c0}' +
      '#dolonline-panel[data-theme="blue"]{background:linear-gradient(160deg,#161a24,#141c20);border-color:rgba(130,170,200,.55);color:#dce4ec}' +
      '#dolonline-panel[data-theme="blue"] .doh{background:linear-gradient(90deg,#1e2e4a,#1e3a3a);color:#c0d8f0}' +
      '#dolonline-panel[data-theme="blue"] .lbl{color:#a0c0e8}' +
      '#dolonline-panel[data-theme="blue"] button{background:linear-gradient(180deg,#24303a,#202e34);color:#c0d8f0}' +
      '#dolonline-panel[data-theme="blue"] summary{color:#a0c0e8}' +
      '#dolonline-panel[data-theme="purple"]{background:linear-gradient(160deg,#1e1a24,#1a1a26);border-color:rgba(160,140,200,.55);color:#e0dce8}' +
      '#dolonline-panel[data-theme="purple"] .doh{background:linear-gradient(90deg,#3a2a5a,#2a2a4a);color:#d8c8f0}' +
      '#dolonline-panel[data-theme="purple"] .lbl{color:#b8a0e8}' +
      '#dolonline-panel[data-theme="purple"] button{background:linear-gradient(180deg,#302a3a,#2a2836);color:#d8c8f0}' +
      '#dolonline-panel[data-theme="purple"] summary{color:#b8a0e8}' +
      '#dolonline-panel[data-theme="bright"]{background:linear-gradient(160deg,#ffe6f2,#fff6e0);border-color:rgba(224,120,160,.55);color:#3a2a30}' +
      '#dolonline-panel[data-theme="bright"] .doh{background:linear-gradient(90deg,#ffb8d8,#ffe6a0);color:#7a2a4a}' +
      '#dolonline-panel[data-theme="bright"] .lbl{color:#c2457a}' +
      '#dolonline-panel[data-theme="bright"] button{background:linear-gradient(180deg,#ffd0e4,#ffe8b8);color:#7a2a4a}' +
      '#dolonline-panel[data-theme="bright"] summary{color:#c2457a}' +
      '#dolonline-panel[data-theme="bright"] input,#dolonline-panel[data-theme="bright"] textarea{background:#fffafc;color:#3a2a30}' +
      '#dolonline-panel[data-theme="bright"] details{background:rgba(255,255,255,.55)}' +
      '#dolonline-panel[data-theme="bright"] .msg{background:#fffafc}' +
      '#dolonline-panel[data-theme="soft"]{background:linear-gradient(160deg,#e8ccd8,#e8dcc4);border-color:rgba(180,90,130,.55);color:#2e2026}' +
      '#dolonline-panel[data-theme="soft"] .doh{background:linear-gradient(90deg,#d894b3,#d8c482);color:#4a1a2e}' +
      '#dolonline-panel[data-theme="soft"] .lbl{color:#a03a68}' +
      '#dolonline-panel[data-theme="soft"] button{background:linear-gradient(180deg,#e8b8cc,#e6d4a0);color:#5a1a30}' +
      '#dolonline-panel[data-theme="soft"] summary{color:#a03a68}' +
      '#dolonline-panel[data-theme="soft"] input,#dolonline-panel[data-theme="soft"] textarea{background:#f4e6ee;color:#2e2026}' +
      '#dolonline-panel[data-theme="soft"] details{background:rgba(255,255,255,.35)}' +
      '#dolonline-panel[data-theme="soft"] .msg{background:#f4e6ee}' +
      '#dolonline-panel[data-theme="darkpink"]{background:linear-gradient(160deg,#241a20,#241f14);border-color:rgba(200,130,165,.55);color:#e8dce4}' +
      '#dolonline-panel[data-theme="darkpink"] .doh{background:linear-gradient(90deg,#5a2a3e,#5a4a21);color:#f0c8dc}' +
      '#dolonline-panel[data-theme="darkpink"] .lbl{color:#e8a0c0}' +
      '#dolonline-panel[data-theme="darkpink"] button{background:linear-gradient(180deg,#3a2a34,#3a3220);color:#f0c8dc}' +
      '#dolonline-panel[data-theme="darkpink"] summary{color:#e8a0c0}' +
      '#dolonline-panel summary{cursor:pointer;padding:10px 2px;color:#b4a6a8;font-weight:bold;font-size:13px;list-style:none;display:flex;align-items:center;justify-content:space-between}' +
      '#dolonline-panel summary::-webkit-details-marker{display:none}' +
      '#dolonline-panel summary::after{content:"+ ";color:#8a8a8a}' +
      '#dolonline-panel details[open] summary::after{content:"- "}' +
      '#dolonline-panel details > *:not(summary){margin-bottom:8px}' +
      '#dolonline-panel .onlinelist{font-size:12px;color:#b8aab0;word-break:break-all}' +
      '#dolonline-panel .onlinelist .pname{cursor:pointer;color:#b8aab0;text-decoration:underline;padding:0 3px}' +
      '#dolonline-panel .onlinelist .pname.me{color:#8a8a8a;cursor:default;text-decoration:none}' +
      '#dolonline-panel .interactmenu{background:#11141a;border:1px solid #4a4030;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px}' +
      '#dolonline-panel #dol-action-log{height:110px}' +
      '#dol-colocated{margin-top:10px;padding-top:8px;border-top:1px dashed #666}' +
      '#dol-peer-model{display:flex;align-items:center;justify-content:center;height:140px;background:#0c0e12;border:1px solid #2a2a30;border-radius:4px;overflow:hidden;color:#666;font-size:13px}' +
      '#dol-peer-model canvas{max-width:100%;max-height:140px}' +
      '#dol-colocated .dol-colocated-title{font-size:14px;color:#b8b8b8;margin-bottom:6px}' +
      '#dol-colocated .dol-colocated-btn{display:inline-block;margin:3px 8px 3px 0;padding:4px 10px;border:1px solid #7a6a4a;' +
      'border-radius:6px;background:#2a2418;color:#e8c97a;font-size:14px;cursor:pointer;text-decoration:none}' +
      '#dol-colocated .dol-colocated-btn:hover{background:#3a3220}' +
      '#dolonline-panel .mirrorlist{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;font-size:15px}' +
      '#dolonline-panel .mirrorlist .mp{cursor:pointer;padding:3px 9px;border-radius:4px;background:#1a2030;color:#9ac7ff;border:1px solid #2a2a30}' +
      '#dolonline-panel .mirrorlist .mp.on{background:#2a3a2a;color:#b8f0c0;border-color:#3a5a3a}' +
      '#dolonline-panel .mirror{background:#0c0e12;border:1px solid #2a2a30;' +
      'border-radius:4px;padding:0;font-size:13px;line-height:1.4;color:#eee;word-break:break-word;overflow:hidden}' +
      '#dolonline-panel .mirror .mirror-vp{position:relative;width:100%;height:min(56vh,520px);overflow:hidden}' +
      '#dolonline-panel .mirror .mirror-stage{position:absolute;left:0;top:0;transform-origin:top left;width:390px}' +
      '#dolonline-panel .mirror *{font-size:inherit !important;line-height:inherit}' +
      '#dolonline-panel .mirror img,#dolonline-panel .mirror video,#dolonline-panel .mirror canvas{max-width:100% !important;height:auto !important}' +
      '#dolonline-panel .mirror table{max-width:100%}' +
      '#dolonline-panel .mirror-content{overflow-x:hidden;position:relative}' +
      '#dolonline-panel .mirror a{color:#e8c97a;pointer-events:none}' +
      '#dol-mirror-full-body img,#dol-mirror-full-body video,#dol-mirror-full-body canvas{max-width:100% !important;height:auto !important}' +
      '#dol-mirror-full-body table{max-width:100%}' +
      '#dol-mirror-full-body a{color:#e8c97a;pointer-events:none}' +
      '#dolonline-panel .roomlist{height:200px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:#0c0e12;border:1px solid #2a2a30;' +
      'border-radius:4px;padding:10px;font-size:22px}' +
      '#dolonline-panel .room{border-bottom:1px solid #222;padding:9px 6px;cursor:pointer}' +
      '#dolonline-panel .room:hover{background:#1a2030}' +
      '#dolonline-panel .room:last-child{border-bottom:none}' +
      '#dolonline-panel .room .rname{color:#e8c97a;font-size:26px;font-weight:bold}' +
      '#dolonline-panel .room .rmeta{color:#9a9a9a;font-size:17px}' +
      '#dolonline-panel .room .rcount{color:#7ec98a;font-size:22px}' +
      '#dolonline-panel .room.empty{color:#8a8a8a;cursor:default}';
    document.head.appendChild(style);

    var btn = document.createElement('div');
    btn.id = 'dolonline-btn';
    var _icon = localStorage.getItem('dolon_btn_icon') || '联机';
    btn.innerHTML = (/^(https?:|data:)/i.test(_icon) ? '<img src="' + _icon + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : _icon) + '<span class="dolonline-badge" id="dol-badge"></span><span class="dolonline-timebadge" id="dol-time-badge"></span>';
    btn.title = '联机 & 地下城';
    var _savedPos = null;
    try { _savedPos = JSON.parse(localStorage.getItem('dolon_btn_pos') || 'null'); } catch (e) {}
    if (_savedPos && typeof _savedPos.left === 'number' && typeof _savedPos.top === 'number') {
      btn.style.left = _savedPos.left + 'px';
      btn.style.top = _savedPos.top + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
    var _drag = null, _justDragged = false;
    var _startDrag = function (x, y) {
      var r = btn.getBoundingClientRect();
      _drag = { sx: x, sy: y, ox: r.left, oy: r.top, moved: false };
      btn.style.right = 'auto'; btn.style.bottom = 'auto';
      btn.style.left = r.left + 'px'; btn.style.top = r.top + 'px';
    };
    var _moveDrag = function (x, y) {
      if (!_drag) return;
      var dx = x - _drag.sx, dy = y - _drag.sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) _drag.moved = true;
      if (!_drag.moved) return;
      var nx = Math.max(0, Math.min(window.innerWidth - 46, _drag.ox + dx));
      var ny = Math.max(0, Math.min(window.innerHeight - 46, _drag.oy + dy));
      btn.style.left = nx + 'px'; btn.style.top = ny + 'px';
    };
    var _endDrag = function () {
      var moved = _drag && _drag.moved;
      if (moved) {
        _justDragged = true;
        setTimeout(function () { _justDragged = false; }, 350);
        try { localStorage.setItem('dolon_btn_pos', JSON.stringify({ left: parseInt(btn.style.left, 10) || 0, top: parseInt(btn.style.top, 10) || 0 })); } catch (e) {}
      }
      _drag = null;
      return moved;
    };
    btn.addEventListener('touchstart', function (e) { var t = e.touches[0]; _startDrag(t.clientX, t.clientY); }, { passive: true });
    btn.addEventListener('touchmove', function (e) { var t = e.touches[0]; _moveDrag(t.clientX, t.clientY); if (_drag && _drag.moved) e.preventDefault(); }, { passive: false });
    btn.addEventListener('touchend', function (e) { if (_endDrag()) e.preventDefault(); });
    btn.addEventListener('mousedown', function (e) { _startDrag(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) { if (_drag) _moveDrag(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function () { if (_drag) _endDrag(); });
    btn.onclick = function () {
      if (_justDragged) return;
      var p = document.getElementById('dolonline-panel');
      if (!p) { showToast('面板元素不存在（被移除了）'); return; }
      p.classList.toggle('open');
      var _opened = p.classList.contains('open');
      // 不再只依赖 CSS 类，直接写内联样式，避免样式表被冲掉
      try {
        p.style.display = _opened ? 'flex' : 'none';
        if (_opened) {
          p.style.visibility = 'visible';
          p.style.opacity = '1';
          p.style.zIndex = '2147483600';
          if (!p.style.width) p.style.width = 'min(94vw,330px)';
          if (!p.style.maxHeight) p.style.maxHeight = '88vh';
        }
      } catch (e) {}
      if (_opened) {
        try { trackMaxFloor(); lbSendMe(); } catch (e) {}
        try { window.__dolSrvProbe && window.__dolSrvProbe(); } catch (e) {}
        try {
          if (!window.__dolLbTimer) {
            window.__dolLbTimer = setInterval(function () {
              try { var pnl = document.getElementById('dolonline-panel'); if (pnl && pnl.classList.contains('open')) lbSendMe(); } catch (e) {}
            }, 120000);
          }
        } catch (e) {}
        unreadChat = 0; updateBadge();
        try { fixPanelZoom(); } catch (e) {}
        // 缩放/位置算错时面板会跑到屏幕外，这里兜底重置
        try {
          var r = p.getBoundingClientRect();
          var vw = window.innerWidth || document.documentElement.clientWidth;
          var vh = window.innerHeight || document.documentElement.clientHeight;
          var off = (!r.width || !r.height || r.right < 30 || r.bottom < 30 || r.left > vw - 30 || r.top > vh - 30);
          if (off) {
            p.style.zoom = ''; p.style.transform = ''; p.style.width = ''; p.style.maxHeight = '';
            p.style.left = ''; p.style.top = '1.5vh'; p.style.right = '8px'; p.style.bottom = '6vh';
            try { localStorage.removeItem('dolon_ui_scale'); localStorage.removeItem('dolon_panel_pos'); } catch (e) {}
            showToast('面板跑出屏幕了，已重置位置与缩放');
          }
        } catch (e) {}
        try { renderDungeonLock(); } catch (e) {}
        setTimeout(function () { try { loadLanInfo(); } catch (e) {} }, 200);
        setTimeout(function () {
          try {
            var q = document.getElementById('dolonline-panel');
            var r = q ? q.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
            var cs = q ? window.getComputedStyle(q) : null;
            var vw = window.innerWidth || 360, vh = window.innerHeight || 640;
            var bad = !q || !r.width || !r.height || r.left > vw - 20 || r.top > vh - 20 || (r.left + r.width) < 20 || (r.top + r.height) < 20;
            if (bad) showPanelDebug(q, cs, r);
          } catch (e) {}
        }, 300);
      }
    };
    (document.documentElement || document.body).appendChild(btn);
    setTimeout(function () { try { setupPanelTabs(); } catch (e) {} }, 300);
    setTimeout(function () { try { renderQuests(); } catch (e) {} }, 1200);
    setTimeout(function () { try { showOnboarding(); } catch (e) {} }, 2200);

    var panel = document.createElement('div');
    panel.id = 'dolonline-panel';
    panel.innerHTML =
      '<div class="doh"><span>联机 &amp; 地下城</span>' +
      '<span id="dol-ping" style="flex:1;text-align:right;font-size:11px;font-weight:normal;color:#9a8a8c;margin-right:6px">延迟 —</span>' +
      '<span id="dol-close" style="cursor:pointer;font-size:20px;line-height:1;padding:0 4px">×</span></div>' +
      '<div class="dob">' +
      '  <div class="lbl">服务器地址</div>' +
      '  <input id="dol-server" placeholder="http://127.0.0.1:8787">' +
      '  <div style="display:flex;gap:6px;margin:5px 0 6px">' +
      '    <button data-srv="https://47-118-55-194.sslip.io:8443" style="flex:1;padding:6px 4px;font-size:12px">直连 <span id="dol-srv-a" style="color:#9a9a9a">—</span></button>' +
      '    <button data-srv="https://dol.qiubai.xyz" style="flex:1;padding:6px 4px;font-size:12px">隧道 <span id="dol-srv-b" style="color:#9a9a9a">—</span></button>' +
      '  </div>' +
      '  <div style="font-size:11px;color:#9a7a6a;line-height:1.5;margin:-4px 0 6px">' +
      '    默认公共服可直接用。<br>' +
      '    自建服务器必须走 <span style="color:#e8c97a">https://</span> —— 本应用禁止明文 http，' +
      '    局域网 / IP 直连会被系统拦截，填了也连不上。' +
      '  </div>' +
      '  <div id="dol-lan" style="font-size:11px;color:#7ec98a;margin:-4px 0 6px;line-height:1.5"></div>' +
      '  <div class="lbl">交流群</div>' +
      '  <div class="dor"><button id="dol-qq" style="width:100%">QQ 群：1128025686（点击复制）</button></div>' +
      '  <div class="lbl">联机按钮图标</div>' +
      '  <input id="dol-btn-icon" placeholder="联机">' +
      '  <div id="dol-auth">' +
      '    <div class="dor"><input id="dol-user" placeholder="用户名" style="flex:1"><input id="dol-pass" type="password" placeholder="密码" style="flex:1"></div>' +
      '    <div class="dor"><button id="dol-reg">注册</button><button id="dol-login">登录</button></div>' +
      '    <div class="dor"><button id="dol-guest" style="width:100%">一键联机（游客）</button></div>' +
      '  </div>' +
      '  <div id="dol-userbar" style="display:none">' +
      '    <div class="st ok">已登录：<span id="dol-username"></span></div>' +
      '    <div class="dor"><button id="dol-logout">登出</button><button id="dol-check-update">检查更新</button></div>' +
      '    <div id="dol-latest-ver" style="font-size:12px;color:#9a9a9a;text-align:center">最新版本：查询中…</div>' +
      '  </div>' +
      '  <div class="st" id="dol-status">未连接</div>' +
      '  <div class="lbl">在线玩家</div>' +
      '  <div class="onlinelist" id="dol-online">—</div>' +
      '  <div id="dol-users-count" style="font-size:12px;color:#9ac7ff;margin:2px 0 2px">注册用户：查询中…</div>' +
      '  <div class="lbl" style="margin-top:2px">决斗</div>' +
      '  <div id="dol-pvp" style="font-size:12px">（暂无决斗）</div>' +
      '  <div class="lbl" style="margin-top:2px">经验</div>' +
      '  <div id="dol-panel-exp" style="font-size:12px;color:#8a8a92">—</div>' +
      '  <div class="onlinelist" id="dol-world-presence" style="min-height:16px">—</div>' +
      '  <div class="interactmenu" id="dol-interact" style="display:none">' +
      '    <div class="st">互动对象：<span id="dol-interact-target"></span></div>' +
      '    <div class="dor"><button id="dol-int-greet">打招呼</button><button id="dol-int-money">送钱</button></div>' +
      '    <div class="dor"><button id="dol-int-pm">私信</button><button id="dol-int-loc">位置</button><button id="dol-int-cancel">取消</button></div>' +
      '    <div class="dor"><button id="dol-int-duel" style="width:100%">⚔ 发起决斗</button></div>' +
      '  </div>' +
      '  <div class="msg" id="dol-msg"></div>' +
      '  <div class="dor" style="flex-wrap:wrap;gap:4px"><button id="dol-quick-party" class="dol-quick">求组队</button><button id="dol-quick-help" class="dol-quick">缺个输出</button><button id="dol-quick-boss" class="dol-quick">来打 Boss</button><button id="dol-quick-gg" class="dol-quick">辛苦了</button></div>' +
      '  <div class="dor"><input id="dol-chat-input" placeholder="说点什么…" style="flex:1"><button id="dol-send">发送</button></div>' +
      '  <div class="dor"><button id="dol-msg-latest" style="flex:1">↓ 最新</button><button id="dol-clear-chat" style="flex:1">清空公屏</button></div>' +
      '  <details><summary>排行榜</summary>' +
      '    <div id="dol-lb-tabs" style="display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 5px"></div>' +
      '    <div id="dol-lb" style="font-size:12px">（点这里刷新）</div>' +
      '    <div class="dor" style="margin-top:4px"><button id="dol-lb-refresh" style="width:100%">刷新排行榜</button></div>' +
      '  </details>' +
      '  <div class="lbl" style="margin-top:2px">屏幕镜像（队友当前画面）</div>' +
      '  <div class="mirrorlist" id="dol-mirror-players">—</div>' +
      '  <div class="mirror" id="dol-mirror">—</div>' +
      '  <details><summary>好友 / CP / 队伍 / 队友</summary>' +
      '    <div class="lbl">CP</div><div id="dol-cp" style="font-size:13px"></div>' +
      '    <div class="dor"><input id="dol-cp-input" placeholder="输入玩家名申请CP" style="flex:1"><button id="dol-cp-apply">申请</button></div>' +
      '    <div class="lbl">好友</div><div id="dol-friends" style="font-size:13px"></div>' +
      '    <div class="dor"><input id="dol-friend-input" placeholder="输入玩家名加好友" style="flex:1"><button id="dol-friend-add">加好友</button></div>' +
      '    <div class="lbl">队伍</div><div id="dol-party" style="font-size:13px">（未组队）</div>' +
      '    <div class="dor"><button id="dol-party-leave" style="width:100%">退出小队</button></div>' +
      '    <div class="dor"><button id="dol-role-dps" style="flex:1">输出</button><button id="dol-role-tank" style="flex:1">坦克</button><button id="dol-role-healer" style="flex:1">治疗</button></div>' +
      '    <div class="dor"><button id="dol-party-event-btn" style="width:100%">发起共享事件</button></div>' +
      '    <div class="dor"><button id="dol-party-dg-btn" style="width:100%">组队副本</button></div>' +
      '    <div class="lbl">共享怪物</div>' +
      '    <div id="dol-party-run" style="font-size:12px">（未开始）</div>' +
      '    <div id="dol-party-event" style="display:none"></div>' +
      '    <div class="lbl">队友装备</div><div id="dol-party-gear" style="font-size:12px">（暂无数据）</div>' +
      '    <div class="lbl">队友面板</div><div id="dol-peer-stats" style="font-size:13px">（暂无数据）</div>' +
      '    <div id="dol-peer-model"></div>' +
      '  </details>' +
      '  <details><summary>地下城</summary>' +
      '    <div id="dol-dg-buttons">' +
      '    <div class="dor" style="margin-bottom:6px"><button id="dol-dg-enter" style="width:100%">⬇ 进入地下世界</button></div>' +
      '    <div class="dor" style="margin-bottom:6px"><button id="dol-dg-party" style="width:100%">与队伍一起下本（需组队）</button></div>' +
      '    <div class="dor" style="margin-bottom:6px"><button id="dol-dg-grid" style="width:100%">🗺 自由探索（网格地图）</button></div>' +
      '    <div class="dor" style="margin-bottom:6px"><button id="dol-skill-btn" style="width:100%">🌿 技能树</button></div>' +
      '    </div>' +
      '    <div id="dol-dg-locked" style="display:none;font-size:12px;color:#9a7a6a;line-height:1.7;padding:8px;background:#14161c;border:1px solid #2a2a30;border-radius:6px">' +
      '      🔒 地下世界尚未解锁<br>' +
      '      解锁条件：在「丰收街」点击「未知之处」，给受伤的灰 £520 买药，听完她讲的路，跟她下去一次。' +
      '    </div>' +
      '    <div id="dol-dg-grid-box" style="font-size:12px;margin-bottom:6px"></div>' +
      '    <div id="dol-equip-sec"><div class="lbl">装备栏</div><div id="dol-equip"></div></div>' +
      '    <div id="dol-dg-sec" style="display:none"><div class="lbl">地图</div><div id="dol-dg"></div></div>' +
      '    <div id="dol-dg-hint" style="font-size:12px;color:#9a6a7a;padding:8px">入口在丰收街的地点列表里（灰会带你下去）</div>' +
      '    <div id="dol-cat" style="font-size:12px;color:#c8b8a8;margin:2px 0">猫猫币 0</div>' +
      '    <div id="dol-bars" style="margin:4px 0"></div>' +
      '    <div id="dol-monster-sec"><div class="lbl">怪物</div><div id="dol-monster"></div></div>' +
      '    <div id="dol-bag-sec"><div class="lbl">背包</div><div id="dol-bag"></div></div>' +
      '  </details>' +
      '  <details><summary>冒险</summary>' +
      '    <div style="font-size:12px;color:#c8b8a8" id="dol-mat-line">（材料）</div>' +
      '    <div class="dor" style="margin-top:4px"><button id="dol-gather-herb" style="width:100%">采药</button></div>' +
      '    <div class="dor" style="margin-top:4px"><button id="dol-map-btn" style="width:100%">🗺 地下地图</button></div>' +
      '    <div id="dol-dg-items-sec" style="display:none"><div class="lbl">随身物（材料 / 药水 / 食物）</div><div id="dol-dg-items" style="font-size:12px"></div></div>' +
      '    <div class="lbl">每日委托</div><div id="dol-daily" style="font-size:12px"></div>' +
      '    <div class="lbl">伙伴</div><div id="dol-pet" style="font-size:12px"></div>' +
      '    <div class="lbl">状态</div><div id="dol-status-line" style="font-size:11px">—</div>' +
      '    <div class="lbl">职业</div><div id="dol-class" style="font-size:12px"></div>' +
      '    <div class="lbl">羁绊</div><div id="dol-npc" style="font-size:12px"></div>' +
      '  </details>' +
      '  <details><summary>图鉴</summary>' +
      '    <div id="dol-codex" style="font-size:12px">（载入中…）</div>' +
      '  </details>' +
      '  <details><summary>市场</summary>' +
      '    <div id="dol-market-list" style="font-size:12px">（连接中…）</div>' +
      '    <div class="dor" style="margin-top:4px"><button id="dol-market-sell" style="flex:1">出售背包物品</button>' +
      '    <button id="dol-market-refresh" style="flex:0 0 auto">刷新</button></div>' +
      '    <div id="dol-market-sellbox" style="display:none;margin-top:6px;padding:6px;background:#16181e;border-radius:8px">' +
      '      <div style="font-size:12px;color:#8a8a8a;margin-bottom:4px">选择物品</div>' +
      '      <select id="dol-market-item" style="width:100%;padding:8px;border-radius:6px;background:#241f16;color:#f0d060;border:1px solid rgba(232,201,122,.4);font-size:13px"></select>' +
      '      <div style="font-size:12px;color:#8a8a8a;margin:6px 0 4px">收什么（金币 / 猫猫币 / 都要）</div>' +
      '      <select id="dol-market-cur" style="width:100%;padding:8px;border-radius:6px;background:#241f16;color:#f0d060;border:1px solid rgba(232,201,122,.4);font-size:13px">' +
      '        <option value="money">金币</option><option value="cat">猫猫币</option><option value="any">两种都要（买家自选一种付）</option></select>' +
      '      <div style="font-size:12px;color:#8a8a8a;margin:6px 0 4px">金币售价（£）</div>' +
      '      <input id="dol-market-price" type="number" step="0.01" min="1" value="1.00" style="width:100%;padding:8px;border-radius:6px;background:#1a1c22;color:#ddd;border:1px solid #3a3a4a;font-size:13px">' +
      '      <div id="dol-market-catbox" style="display:none">' +
      '        <div style="font-size:12px;color:#8a8a8a;margin:6px 0 4px">猫猫币售价</div>' +
      '        <input id="dol-market-price-cat" type="number" step="1" min="1" value="50" style="width:100%;padding:8px;border-radius:6px;background:#1a1c22;color:#ddd;border:1px solid #3a3a4a;font-size:13px">' +
      '      </div>' +
      '      <div class="dor" style="margin-top:6px"><button id="dol-market-confirm" style="flex:1">上架</button><button id="dol-market-cancel" style="flex:0 0 auto">取消</button></div>' +
      '    </div>' +
      '    <div class="lbl">邮件</div>' +
      '    <div id="dol-mail" style="font-size:12px">（未加载）</div>' +
      '    <div class="dor" style="margin-top:4px"><button id="dol-mail-claim" style="flex:1">全部领取</button>' +
      '    <button id="dol-mail-refresh" style="flex:0 0 auto">刷新</button></div>' +
      '  </details>' +
      '  <details><summary>猫猫抽奖</summary>' +
      '    <div id="dol-lottery-panel" style="font-size:12px">（载入中…）</div>' +
      '    <div id="dol-lottery-result" style="display:none;margin-top:6px;padding:6px;background:#16181e;border-radius:8px"></div>' +
      '  </details>' +
      '  <details><summary>委托</summary>' +
      '    <div id="dol-quests" style="font-size:13px;color:#c8b8a8">（载入中…）</div>' +
      '  </details>' +
      '  <details><summary>存档 / 世界</summary>' +
      '    <div class="lbl">云存档</div>' +
      '    <div class="dor"><button id="dol-up">上传存档</button><button id="dol-down">恢复进度</button></div>' +
      '    <div class="st" id="dol-save-status">尚未同步</div>' +
      '    <div class="dor"><button id="dol-save-backups" style="width:100%">存档备份</button></div>' +
      '    <div id="dol-backup-list" style="display:none;font-size:12px"></div>' +
      '    <div class="lbl">世界</div>' +
      '    <div id="dol-rooms" class="roomlist">—</div>' +
      '    <div class="dor"><button id="dol-rooms-refresh" style="width:100%">刷新房间列表</button></div>' +
      '    <div class="dor"><input id="dol-world-id" placeholder="世界ID" style="flex:1"><button id="dol-world-join">加入/创建</button></div>' +
      '    <div class="dor" style="margin-top:4px"><button id="dol-restore-bk" style="width:100%">恢复我的进度（进入别人世界前）</button></div>' +
      '    <div class="st" id="dol-world-status">未加入世界</div>' +
      '    <div class="dor"><button id="dol-world-load">载入世界存档</button><button id="dol-world-save">保存到世界</button></div>' +
      '    <div class="dor"><button id="dol-world-sync-day" style="width:100%">同步世界天数</button></div>' +
      '    <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#ddd"><input type="checkbox" id="dol-time-sync" style="width:18px;height:18px">时间同步</label>' +
      '    <div class="lbl">世界Boss</div>' +
      '    <div id="dol-boss" style="font-size:13px">查询中…</div>' +
      '    <div class="lbl">服务器在线</div><div id="dol-server-stats" style="font-size:12px">查询中…</div>' +
      '    <div class="dor"><button id="dol-server-refresh" style="flex:1">刷新在线</button><button id="dol-ping-test" style="flex:0 0 auto">测速</button></div>' +
      '  </details>' +
      '  <details><summary>杂项</summary>' +
      '    <div class="lbl">主题配色</div>' +
      '    <div class="dor" style="flex-wrap:wrap">' +
      '      <button data-set-theme="low" style="flex:1;min-width:70px">低饱和</button>' +
      '      <button data-set-theme="pink" style="flex:1;min-width:70px">粉</button>' +
      '      <button data-set-theme="blue" style="flex:1;min-width:70px">蓝</button>' +
      '      <button data-set-theme="purple" style="flex:1;min-width:70px">紫</button>' +
      '      <button data-set-theme="bright" style="flex:1;min-width:70px">亮粉黄</button>' +
      '      <button data-set-theme="soft" style="flex:1;min-width:70px">柔粉黄</button>' +
      '      <button data-set-theme="darkpink" style="flex:1;min-width:70px">暗粉黄</button>' +
      '    </div>' +
      '    <div class="lbl">音效</div>' +
      '    <div class="dor"><button id="dol-sfx-toggle" style="width:100%">开关音效</button></div>' +
      '    <div id="dol-sfx-diag" style="font-size:10px;color:#6a6a72">音效：未播放过</div>' +
      '    <div id="dol-toast-err" style="font-size:10px;color:#8a6a6a;white-space:pre-wrap;word-break:break-all"></div>' +
      '    <div id="dol-zoom-diag" style="font-size:10px;color:#6a6a72">缩放：—</div>' +
      '    <div class="lbl">面板缩放</div>' +
      '    <div class="dor" style="flex-wrap:wrap">' +
      '      <button data-ui-scale="1" style="flex:1;min-width:60px">100%</button>' +
      '      <button data-ui-scale="1.15" style="flex:1;min-width:60px">115%</button>' +
      '      <button data-ui-scale="1.3" style="flex:1;min-width:60px">130%</button>' +
      '    </div>' +
      '    <div style="font-size:11px;color:#8a8a8a;margin:2px 0 4px">游戏整体缩小时，用这里单独把面板放大；默认 100%</div>' +
      '    <div class="dor"><button id="dol-reset-panel" style="width:100%">重置面板位置 / 缩放</button></div>' +
      '    <div class="dor"><button id="dol-zoom-comp" style="width:100%">抵消游戏缩放：关</button></div>' +
      '    <div style="font-size:11px;color:#8a8a8a;margin:2px 0 4px">游戏页面缩小时，打开这个会把面板放大回原尺寸（代价是触控可能轻微偏）</div>' +
      '    <div class="lbl">成就（<span id="dol-ach-count">0/11</span>）</div>' +
      '    <div id="dol-achs" style="font-size:13px"></div>' +
      '  </details>' +
      '  <details><summary>工具</summary>' +
      '    <div id="dol-admin-sec" style="display:none">' +
      '      <div class="lbl">商店快捷入口</div>' +
      '      <div id="dol-shops" style="font-size:13px">' +
      '        <div class="dor"><button data-shop="Adult Shop">成人用品店</button><button data-shop="Clothing Shop">服装店</button></div>' +
      '        <div class="dor"><button data-shop="Toy Shop">玩具店</button><button data-shop="Cosmetics Store">化妆品店</button></div>' +
      '        <div class="dor"><button data-shop="Shopping Centre">购物中心</button><button data-shop="Pet Shop">宠物店</button></div>' +
      '        <div class="dor"><button data-shop="Supermarket">超市</button><button data-shop="Pharmacy">药店</button></div>' +
      '        <div class="dor"><button data-shop="Tailor Shop">裁缝店</button><button data-shop="Shopping Centre Top">购物中心入口</button></div>' +
      '      </div>' +
      '      <div class="lbl">发放道具</div>' +
      '      <div id="dol-give-sec" style="display:none">' +
      '        <div class="dor"><button data-give="money">£ +5</button><button data-give="condoms">避孕套+10</button></div>' +
      '        <div class="dor"><button data-give="pills">药+10</button><button data-give="spray">喷雾+1</button></div>' +
      '        <div class="dor"><button data-give="lube">润滑液+10</button><button data-give="tampons">卫生巾+10</button></div>' +
      '        <div class="dor"><button data-give="cat" style="width:100%">猫猫币 +500</button></div>' +
      '        <div class="dor"><button data-give="skill" style="width:100%">技能点 +5</button></div>' +
      '        <div class="dor"><button data-give="staff" style="width:100%">发放 · 星辰杖</button></div>' +
      '        <div class="dor"><button data-give="morningafter">紧急避孕+5</button><button data-give="bandage">绷带+10</button></div>' +
      '        <div class="lbl">发放装备</div>' +
      '        <div class="dor" style="margin-bottom:4px"><select id="dol-give-tier" style="flex:1;font-size:12px">' +
      '          <option value="-1">随机档次</option>' +
      '          <option value="0">普通</option><option value="1">精良</option><option value="2">稀有</option>' +
      '          <option value="3">史诗</option><option value="4">传说</option><option value="5">神话</option><option value="6">神圣</option>' +
      '        </select></div>' +
      '        <div class="dor"><button data-give-equip="helmet">头盔</button><button data-give-equip="chest">衣服</button><button data-give-equip="legs">裤子</button><button data-give-equip="gloves">手套</button></div>' +
      '        <div class="dor"><button data-give-equip="boots">鞋子</button><button data-give-equip="weapon">武器</button><button data-give-equip="offhand">副手</button><button data-give-equip="neck">饰品</button></div>' +
      '      </div>' +
      '      <div class="lbl">作弊（需作弊权限）</div>' +
      '      <div id="dol-cheat-sec" style="display:none">' +
      '        <div class="dor"><button data-cheat="money">£ +100</button><button data-cheat="cat">猫猫币 +500</button></div>' +
      '        <div class="dor"><button data-cheat="exp">地下城经验 +200</button><button data-cheat="sp">技能点 +3</button></div>' +
      '        <div class="dor"><button data-cheat="heal">回满体力 / 法力</button><button data-cheat="unlock">解锁地下城</button></div>' +
      '        <div class="dor"><button data-cheat="drop">给一件装备</button><button data-cheat="clear">清负面状态</button></div>' +
      '        <div class="dor"><button data-cheat="floor">层数 +1</button><button data-cheat="maxhp">体力上限 +50</button></div>' +
      '        <div class="dor"><button data-cheat="power">攻击 / 防御 +20</button><button data-cheat="pity">抽奖保底清零</button></div>' +
      '      </div>' +
      '      <div id="dol-cheat-deny" style="display:none;font-size:12px;color:#9a7a6a;line-height:1.6">' +
      '        作弊面板需要作弊权限：由服主或世界主机授权后可用。' +
      '      </div>' +
      '      <div id="dol-cheat-grant" style="display:none">' +
      '        <div class="lbl">作弊权限（勾选后该玩家可用整个工具区）</div>' +
      '        <div id="dol-cheat-list" style="font-size:13px">—</div>' +
      '        <div id="dol-admin-banbox" style="display:none;margin-top:8px">' +
      '          <div class="lbl" style="margin-top:0">封号（仅管理员）</div>' +
      '          <input id="dol-ban-user" placeholder="用户名" style="width:100%;padding:6px;border-radius:6px;background:#1a1c22;color:#ddd;border:1px solid #3a3a4a;font-size:13px">' +
      '          <input id="dol-ban-reason" placeholder="原因（可空）" style="width:100%;padding:6px;border-radius:6px;background:#1a1c22;color:#ddd;border:1px solid #3a3a4a;font-size:13px;margin-top:4px">' +
      '          <input id="dol-ban-days" type="number" min="0" value="0" placeholder="天数，0=永久" style="width:100%;padding:6px;border-radius:6px;background:#1a1c22;color:#ddd;border:1px solid #3a3a4a;font-size:13px;margin-top:4px">' +
      '          <input id="dol-ban-ip" placeholder="要封的 IP（可空）" style="width:100%;padding:6px;border-radius:6px;background:#1a1c22;color:#ddd;border:1px solid #3a3a4a;font-size:13px;margin-top:4px">' +
      '          <div class="dor" style="margin-top:5px"><button id="dol-ban-do" style="flex:1">封号</button><button id="dol-ban-ipdo" style="flex:0 0 auto">封IP</button><button id="dol-ban-undo" style="flex:0 0 auto">解封</button><button id="dol-ban-list" style="flex:0 0 auto">名单</button></div>' +
      '          <div id="dol-ban-out" style="font-size:11px;color:#9a9a9a;margin-top:4px"></div>' +
      '        </div>' +
      '      </div>' +
      '      <div class="lbl">MapleBirch 接口</div>' +
      '      <div id="dol-mb-info" style="font-size:11px;color:#8a8a92;line-height:1.6">检测中…</div>' +
      '      <div id="dol-admin-deny" style="display:block;font-size:12px;color:#9a7a6a;line-height:1.7">' +
      '        🔒 工具区需要作弊权限<br>' +
      '        整个工具区（商店快捷入口 / 发放道具 / 发放装备 / 作弊 / MapleBirch 接口）统一走作弊权限：' +
      '服务器管理员在「作弊权限」里勾选你之后才会显示。<br>' +
      '        线下也一样：只有这台设备上被授权过的账号才看得到。' +
      '      </div>' +
      '    </div>' +
      '  </details>' +
      '  <div class="dor"><button id="dol-addpoints-btn" style="width:100%">加点面板</button></div>' +
      '</div>' +
    (document.documentElement || document.body).appendChild(panel);
    try { startObjCleaner(); } catch (e) {}
    (function () {
      var t = document.getElementById('dol-scroll-test');
      if (t) {
        var arr = [];
        for (var i = 1; i <= 40; i++) arr.push('<div style="padding:6px 0;border-bottom:1px solid #222;color:#888;font-size:12px">滚动测试行 ' + i + '</div>');
        t.innerHTML = arr.join('');
      }
    })();
    setTimeout(function () { try { enablePanelScroll(); } catch (e) {} }, 300);
    el = {
      panel: panel,
      server: document.getElementById('dol-server'),
      btnIcon: document.getElementById('dol-btn-icon'),
      auth: document.getElementById('dol-auth'),
      userbar: document.getElementById('dol-userbar'),
      user: document.getElementById('dol-user'),
      pass: document.getElementById('dol-pass'),
      username: document.getElementById('dol-username'),
      status: document.getElementById('dol-status'),
      online: document.getElementById('dol-online'),
      interact: document.getElementById('dol-interact'),
      interactTarget: document.getElementById('dol-interact-target'),
      msg: document.getElementById('dol-msg'),
      chatInput: document.getElementById('dol-chat-input'),
      saveStatus: document.getElementById('dol-save-status'),
      worldId: document.getElementById('dol-world-id'),
      worldStatus: document.getElementById('dol-world-status'),
      rooms: document.getElementById('dol-rooms'),
      worldPresence: document.getElementById('dol-world-presence'),
      cheatList: document.getElementById('dol-cheat-list'),
      actionLog: document.getElementById('dol-action-log'),
      mirrorPlayers: document.getElementById('dol-mirror-players'),
      mirror: document.getElementById('dol-mirror'),
    };

    el.server.value = SERVER;
    setOnEl('dol-close', closePanel);
    // 标题栏也可以点两下关闭，关闭按钮被挡住时还有退路
    (function () {
      var p = document.getElementById('dolonline-panel');
      var h = p && p.querySelector('.doh');
      if (!h) return;
      var lastTap = 0;
      h.addEventListener('click', function () {
        var now = Date.now();
        if (now - lastTap < 500) { closePanel(); }
        lastTap = now;
      });
    })();
    setOnEl('dol-reg', doRegister);
    setOnEl('dol-login', doLogin);
    setOnEl('dol-ann-send', function () {
      try {
        var inp = document.getElementById('dol-ann-input');
        var t = inp ? String(inp.value || '').trim() : '';
        if (!t) { showToast('请输入内容'); return; }
        api('POST', '/api/announce', { token: TOKEN, text: t }).then(function (r) {
          if (r && r.ok) { showToast('已发送给 ' + (r.online || 0) + ' 人'); if (inp) inp.value = ''; }
          else showToast('发送失败：' + ((r && r.error) || '无权限'));
        });
      } catch (e) {}
    });
    setOnEl('dol-dg-enter', function () {
      if (!dgUnlocked()) { showToast('地下城尚未解锁：去丰收街找灰'); return; }
      try { closePanel(); } catch (e) {}
      setTimeout(function () {
        try {
          var SC = window.SugarCube;
          if (!SC || !SC.Engine || typeof SC.Engine.play !== 'function') { showToast('无法进入，请从丰收街拱门进入'); return; }
          if (SC.Dialog && SC.Dialog.isOpen && SC.Dialog.isOpen()) { try { SC.Dialog.close(); } catch (e) {} }
          SC.Engine.play('DoLOnlineDungeonEntry');
        } catch (e) { showToast('进入失败：' + (e && e.message ? e.message : '未知错误')); }
      }, 120);
    });
    function sharePartyMonster() {
      try {
        if (!partyMembers || partyMembers.length < 2) { showToast('先组队（至少 2 人）'); return; }
        ws.send(JSON.stringify({ type: 'party_run_start' }));
        showToast('已请求共享怪物…');
      } catch (e) {}
    }
    function startPartyDungeon() {
      try {
        if (!dgUnlocked()) { showToast('地下城尚未解锁：去丰收街找灰'); return; }
        if (!TOKEN) { showToast('请先登录'); return; }
        if (!ws || ws.readyState !== 1) { showToast('连接已断开，请重新登录'); return; }
        ws.send(JSON.stringify({ type: 'party_run_start' }));
        showToast('正在开启共同副本…');
        try { closePanel(); } catch (e) {}
        setTimeout(function () {
          try {
            var SC = window.SugarCube;
            if (SC && SC.Engine && SC.Engine.play) SC.Engine.play('DoLOnlinePartyRun');
          } catch (e) {}
        }, 150);
      } catch (e) { showToast('开本失败：' + (e && e.message ? e.message : '')); }
    }
    setOnEl('dol-party-dg-btn', startPartyDungeon);
    setOnEl('dol-sfx-toggle', function () { window.dolSfxToggle && dolSfxToggle(); });
    setOnEl('dol-party-leave', function () {
      try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'party_leave' })); } catch (e) {}
      partyMembers = []; partyId = ''; partyRun = null;
      try { renderParty(); } catch (e) {}
      try { renderPartyRun(); } catch (e) {}
      try { renderPartyEvent(null); } catch (e) {}
      showToast('已退出小队');
    });
    setOnEl('dol-dg-party', startPartyDungeon);
    setOnEl('dol-skill-btn', openSkillTree);
    setOnEl('dol-market-sell', openSellDialog);
    setOnEl('dol-map-btn', function () {
      try { window.SugarCube.Engine.play('DoLOnlineTownMap'); } catch (e) { openTownMap(); }
    });
    setOnEl('dol-gather-herb', function () { gather('herb'); });
    setOnEl('dol-gather-fish', function () { gather('fish'); });
    (function () {
      var curSel = document.getElementById('dol-market-cur');
      var catBox = document.getElementById('dol-market-catbox');
      if (curSel && catBox) curSel.onchange = function () { catBox.style.display = (curSel.value === 'any') ? 'block' : 'none'; };
    })();
    setOnEl('dol-market-cancel', function () {
      var b = document.getElementById('dol-market-sellbox'); if (b) b.style.display = 'none';
    });
    setOnEl('dol-market-confirm', function () {
      try {
        var v = VV(); if (!v) return;
        var sel = document.getElementById('dol-market-item');
        var pr = document.getElementById('dol-market-price');
        if (!sel || !pr) return;
        var i = Number(sel.value);
        var curSel2 = document.getElementById('dol-market-cur');
        var cur = curSel2 ? curSel2.value : 'money';
        var pence = Math.round(Number(pr.value) * 100);
        var catPriceEl = document.getElementById('dol-market-price-cat');
        var catPrice = catPriceEl ? Math.floor(Number(catPriceEl.value) || 0) : 0;
        if (cur === 'cat') {
          catPrice = Math.max(1, Math.floor(Number(pr.value) || 0));
          if (!(catPrice >= 1)) { showToast('猫猫币售价至少 1'); return; }
        } else if (cur === 'any') {
          if (!(pence >= 100)) { showToast('金币最低 £1.00'); return; }
          if (!(catPrice >= 1)) { showToast('猫猫币售价至少 1'); return; }
        } else if (!(pence >= 100)) { showToast('最低 £1.00'); return; }
        var bagArr = Array.isArray(v.mpBag) ? v.mpBag : [];
        if (!(i >= 0 && i < bagArr.length)) { showToast('物品不存在'); return; }
        if (!ws || ws.readyState !== 1) { showToast('未连接服务器，先登录'); return; }
        var item = bagArr[i];
        window.__dolListingItem = item;
        try { ws.send(JSON.stringify({ type: 'market_list', item: item, uid: item.uid || '', price: pence, priceCat: catPrice, cur: cur })); }
        catch (e) { window.__dolListingItem = null; showToast('发送失败'); return; }
        var b = document.getElementById('dol-market-sellbox'); if (b) b.style.display = 'none';
        showToast('正在上架 ' + (item && item.n) + '…');
      } catch (e) {}
    });
    setOnEl('dol-market-refresh', function () { try { ws.send(JSON.stringify({ type: 'market_data' })); } catch (e) {} });
    setOnEl('dol-mail-refresh', loadMailbox);
    setOnEl('dol-mail-claim', function () { try { ws.send(JSON.stringify({ type: 'mail_claim_all' })); } catch (e) {} });
    setOnEl('dol-dg-rogue', function () {
      if (!dgUnlocked()) { showToast('地下城尚未解锁：去丰收街找灰'); return; }
      try { closePanel(); } catch (e) {}
      setTimeout(function () { try { window.dolRogueOpen(); } catch (e) { showToast('打开失败：' + (e && e.message ? e.message : '')); } }, 120);
    });
    setOnEl('dol-dg-grid', function () { if (!dgUnlocked()) { showToast('地下城尚未解锁：去丰收街找灰'); return; } try { closePanel(); } catch (e) {} setTimeout(function () { try { dgEnter(); } catch (e) { showToast('无法进入：' + (e && e.message ? e.message : '')); } }, 120); });
    setOnEl('dol-guest', function () { guestLogin(function (ok) { showToast(ok ? '已联机' : '联机失败'); }); });
    setOnEl('dol-logout', doLogout);
    (function () {
      var bi = document.getElementById('dol-btn-icon');
      if (!bi) return;
      try {
        if (localStorage.getItem('dolon_btn_icon_custom') === '1') bi.value = localStorage.getItem('dolon_btn_icon') || '';
      } catch (e) {}
      bi.onchange = function () {
        var v2 = String(bi.value || '').trim();
        try {
          if (!v2) {
            localStorage.removeItem('dolon_btn_icon_custom');
            localStorage.removeItem('dolon_btn_icon');
            loadServerIcon();
            showToast('已恢复服务器图标');
            return;
          }
          localStorage.setItem('dolon_btn_icon_custom', '1');
        } catch (e) {}
        applyIconLocal(v2);
        showToast('按钮图标已更新');
      };
    })();
    setOnEl('dol-check-update', checkModUpdate);
    (function () {
      var cheatBtns = document.querySelectorAll('[data-cheat]');
      function needAdmin() {
        if (!canCheat()) { showToast('需要管理员权限'); return true; }
        return false;
      }
      cheatBtns.forEach(function (b) {
        b.onclick = function () {
          if (needAdmin()) return;
          var v = VV(); if (!v) return;
          var k = b.getAttribute('data-cheat');
          try {
            if (k === 'money') { v.money = (Number(v.money) || 0) + 10000; showToast('£ +100.00'); }
            else if (k === 'cat') { v.mpCat = (Number(v.mpCat) || 0) + 500; showToast('猫猫币 +500'); }
            else if (k === 'exp') { window.dolGainExp && dolGainExp(200); showToast('地下城经验 +200'); }
            else if (k === 'sp') { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + 3); showToast('技能点 +3'); }
            else if (k === 'heal') {
              v.dgHp = (window.dolStaminaMax ? dolStaminaMax() : 100);
              v.dgMana = Number(v.dgManaMax) || 100;
              showToast('体力 / 法力 已回满');
            }
            else if (k === 'unlock') {
              v.mpDgUnlocked = 1; DGAC.set(v, 'dgFloor', (Number(v.dgFloor) || 1));
              showToast('地下城已解锁');
            }
            else if (k === 'drop') { window.dolGrantEquip && dolGrantEquip(undefined, undefined); }
            else if (k === 'floor') {
              DGAC.set(v, 'dgFloor', (Number(v.dgFloor) || 1) + 1);
              showToast('层数 → 第 ' + v.dgFloor + ' 层');
            }
            else if (k === 'maxhp') {
              v.mpDgHp = Math.min(100, (Number(v.mpDgHp) || 0) + 50);
              showToast('地下城体力上限 +50（现 ' + v.mpDgHp + '）');
            }
            else if (k === 'power') {
              v.mpDgAtk = Math.min(60, (Number(v.mpDgAtk) || 0) + 20);
              v.mpDgDef = Math.min(60, (Number(v.mpDgDef) || 0) + 20);
              showToast('地下城攻防 +20');
            }
            else if (k === 'pity') {
              v.mpLotterySinceRare = 0; v.mpLotterySinceLegend = 0;
              showToast('抽奖保底已清零');
            }
            else if (k === 'clear') {
              v.pain = 0; v.stress = 0; v.trauma = 0; v.arousal = 0;
              v.dgPoison = 0; v.dgBurn = 0; v.dgFrozen = 0; v.dgStun = 0;
              showToast('负面状态已清空');
            }
            try { renderCatBalance(); renderBag(); renderExpBar(); } catch (e) {}
          } catch (e) { showToast('执行失败：' + (e && e.message ? e.message : '')); }
        };
      });
    })();
    setOnEl('dol-reset-panel', function () {
      try {
        localStorage.removeItem('dolon_ui_scale');
        localStorage.removeItem('dolon_panel_pos');
      } catch (e) {}
      var p = document.getElementById('dolonline-panel');
      if (p) {
        p.style.zoom = ''; p.style.transform = ''; p.style.width = ''; p.style.maxHeight = '';
        p.style.left = ''; p.style.top = '1.5vh'; p.style.right = '8px'; p.style.bottom = '6vh';
      }
      var b = document.getElementById('dolonline-btn');
      if (b) {
        b.style.zoom = ''; b.style.transform = ''; b.style.left = ''; b.style.top = ''; b.style.right = '10px'; b.style.bottom = '12vh';
      }
      showToast('已重置');
      try { fixPanelZoom(); } catch (e) {}
    });
    (function () {
      var zb = document.getElementById('dol-zoom-comp');
      function paintZ() {
        if (!zb) return;
        var on = false;
        try { on = localStorage.getItem('dolon_zoom_comp') === '1'; } catch (e) {}
        zb.textContent = '抵消游戏缩放：' + (on ? '开' : '关');
      }
      paintZ();
      if (zb) zb.onclick = function () {
        var on = false;
        try { on = localStorage.getItem('dolon_zoom_comp') === '1'; } catch (e) {}
        try { localStorage.setItem('dolon_zoom_comp', on ? '0' : '1'); } catch (e) {}
        paintZ();
        try { fixPanelZoom(); } catch (e) {}
        showToast(on ? '已恢复跟随游戏缩放' : '已开启抵消（面板会放大）');
      };
    })();
    setOnEl('dol-qq', function () {
      var num = '1128025686';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(num).then(function () { showToast('群号已复制：' + num); },
            function () { showToast('群号：' + num); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = num; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); showToast('群号已复制：' + num); }
          catch (e) { showToast('群号：' + num); }
          document.body.removeChild(ta);
        }
      } catch (e) { showToast('群号：' + num); }
    });
    setOnEl('dol-server-refresh', function () { loadServerStats(); loadUserCount(); });
    setOnEl('dol-lb-refresh', function () { lbRequest(); });
    setOnEl('dol-ping-test', function () { dolSpeedTest(); });
    (function () {
      var box = document.getElementById('dol-admin-banbox');
      window.__dolRefreshBanBox = function () {
        try { if (box) box.style.display = serverIsAdmin ? 'block' : 'none'; } catch (e) {}
      };
      window.__dolRefreshBanBox();
      setOnEl('dol-ban-do', function () {
        var u = (document.getElementById('dol-ban-user') || {}).value || '';
        var r = (document.getElementById('dol-ban-reason') || {}).value || '';
        var d = Number((document.getElementById('dol-ban-days') || {}).value || 0) || 0;
        if (!u.trim()) { showToast('填用户名'); return; }
        try { ws.send(JSON.stringify({ type: 'admin_ban', to: u.trim(), reason: r, days: d })); showToast('提交中…'); } catch (e) {}
      });
      setOnEl('dol-ban-ipdo', function () {
        var ip = (document.getElementById('dol-ban-ip') || {}).value || '';
        var r = (document.getElementById('dol-ban-reason') || {}).value || '';
        var d = Number((document.getElementById('dol-ban-days') || {}).value || 0) || 0;
        if (!ip.trim()) { showToast('填 IP'); return; }
        try { ws.send(JSON.stringify({ type: 'admin_ban_ip', ip: ip.trim(), reason: r, days: d })); showToast('提交中…'); } catch (e) {}
      });
      setOnEl('dol-ban-undo', function () {
        var u = (document.getElementById('dol-ban-user') || {}).value || '';
        if (!u.trim()) { showToast('填用户名'); return; }
        try { ws.send(JSON.stringify({ type: 'admin_unban', to: u.trim() })); } catch (e) {}
      });
      setOnEl('dol-ban-list', function () {
        try { ws.send(JSON.stringify({ type: 'admin_banlist' })); } catch (e) {}
      });
    })();
    // 时间同步开关：之前只读 localStorage，勾选框既没绑定也没回显，看着是关的其实一直开着
    (function () {
      var cb = document.getElementById('dol-time-sync');
      if (!cb) return;
      cb.checked = !!timeSyncOn;
      cb.onchange = function () {
        try { setTimeSync(cb.checked); } catch (e) {}
        try { showToast(cb.checked ? '时间同步：开' : '时间同步：关'); } catch (e) {}
      };
    })();
    setTimeout(function () { try { refreshAdminUI(); } catch (e) {} }, 500);
    setTimeout(function () { try { loadUserCount(); } catch (e) {} }, 900);
    setTimeout(function () { try { startObjectScan(); } catch (e) {} }, 1600);
    setTimeout(function () { try { renderLotteryPanel(); } catch (e) {} renderPanelExp(); }, 1000);
    setTimeout(function () {
      try {
        var sb = document.getElementById('dol-sfx-toggle');
        if (sb) sb.textContent = (window.dolSfxOn && window.dolSfxOn()) ? '音效：开（点击关闭）' : '音效：关（点击开启）';
        var sd = document.getElementById('dol-sfx-diag');
        if (sd) sd.textContent = '音效：' + (window.__dolSfxLast || '未播放过');
        var te = document.getElementById('dol-toast-err');
        if (te) te.textContent = window.__dolToastErr ? ('提示异常：' + window.__dolToastErr.slice(0, 400)) : '';
        var zd = document.getElementById('dol-zoom-diag');
        if (zd) {
          var z1 = 1; try { z1 = pageZoomFactor(); } catch (e) {}
          zd.textContent = '缩放：游戏 x' + (Number(z1).toFixed(2)) + '　面板 x' + uiScaleVal().toFixed(2);
        }
      } catch (e) {}
    }, 1100);
    setTimeout(function () { try { injectDungeonLink(); renderMbInfo(); } catch (e) {} }, 1500);
    setTimeout(function () { try { migrateDgUnlock(); renderDungeonLock(); } catch (e) {} }, 2000);
    setInterval(function () { try { migrateDgUnlock(); } catch (e) {} }, 5000);
    document.querySelectorAll('[data-ui-scale]').forEach(function (b) {
      b.onclick = function () {
        try {
          var s2 = Number(b.getAttribute('data-ui-scale')) || 1;
          localStorage.setItem('dolon_ui_scale', String(s2));
          fixPanelZoom();
          showToast('面板缩放 ' + Math.round(s2 * 100) + '%');
          document.querySelectorAll('[data-ui-scale]').forEach(function (x) {
            var on = x === b;
            x.style.borderColor = on ? 'rgba(232,201,122,.7)' : '';
            x.style.color = on ? '#f0d060' : '';
          });
        } catch (e) {}
      };
    });
    document.querySelectorAll('[data-give-equip]').forEach(function (b) {
      b.onclick = function () {
        if (!canCheat()) { showToast('需要作弊权限'); return; }
        var sel = document.getElementById('dol-give-tier');
        var tv = sel ? Number(sel.value) : -1;
        try { window.dolGrantEquip(b.getAttribute('data-give-equip'), tv); } catch (e) {}
      };
    });
    document.querySelectorAll('button[data-set-theme]').forEach(function (b) {
      b.onclick = function () {
        var th = b.getAttribute('data-set-theme');
        try { panel.setAttribute('data-theme', th); localStorage.setItem('dolTheme', th); } catch (e) {}
        showToast('主题：' + ({low:'低饱和',pink:'粉',blue:'蓝',purple:'紫',bright:'亮粉黄',soft:'柔粉黄',darkpink:'暗粉黄'})[th]);
      };
    });
    try { var savedTheme = localStorage.getItem('dolTheme'); if (savedTheme) panel.setAttribute('data-theme', savedTheme); } catch (e) {}
    setOnEl('dol-addpoints-btn', openAddPoints);
    setOnEl('dol-role-dps', function () { setRole('dps'); });
    setOnEl('dol-role-tank', function () { setRole('tank'); });
    setOnEl('dol-role-healer', function () { setRole('healer'); });
    (function () {
      var sec = document.getElementById('dol-give-sec');
      if (sec) sec.style.display = canCheat() ? 'block' : 'none';
      document.querySelectorAll('[data-give]').forEach(function (b) {
        b.onclick = function () {
          if (!canCheat()) { showToast('需要作弊权限'); return; }
          var k = b.getAttribute('data-give');
          var amt = (k === 'money') ? 500 : (k === 'cat') ? 500 : (k === 'skill') ? 5 : (k === 'spray' ? 1 : (k === 'morningafter' ? 5 : 10));
          grantItem(k, amt);
        };
      });
    })();
    document.querySelectorAll('[data-shop]').forEach(function (b) {
      b.onclick = function (ev) {
        if (ev) ev.preventDefault();
        if (!canCheat()) { showToast('需要作弊权限'); return; }
        var p = b.getAttribute('data-shop');
        try {
          if (window.SugarCube && SugarCube.Engine) SugarCube.Engine.play(p);
          else if (window.SugarCube && SugarCube.Engine) {}
          showToast(' 进入 ' + p);
        } catch (e) { showToast(' 无法进入 ' + p); }
      };
    });
    (function () {
    })();
    (function () {
      var admin = canCheat();
      var sec = document.getElementById('dol-admin-sec');
      var hint = document.getElementById('dol-admin-hint');
      if (sec) sec.style.display = admin ? 'block' : 'none';
      if (hint) hint.style.display = admin ? 'none' : 'block';
      var deny2 = document.getElementById('dol-admin-deny');
      if (deny2) deny2.style.display = admin ? 'none' : 'block';
    })();
    setOnEl('dol-cp-apply', function () {
      var inp = document.getElementById('dol-cp-input');
      var name = inp ? inp.value.trim() : '';
      if (!name) return;
      try { ws.send(JSON.stringify({ type: 'cp_apply', to: name })); } catch (e) {}
      if (inp) inp.value = '';
      showToast('已向 ' + name + ' 申请CP');
    });
    setOnEl('dol-friend-add', function () {
      var inp = document.getElementById('dol-friend-input');
      requestFriend(inp ? inp.value.trim() : '');
      if (inp) inp.value = '';
    });
    setOnEl('dol-party-event-btn', function () {
      try {
        if (!partyMembers || partyMembers.length < 2) { showToast('先组队（至少 2 人）'); return; }
        ws.send(JSON.stringify({ type: 'party_event_start', npc: '贝利' }));
        showToast('已发起共享事件');
      } catch (e) {}
      if (!partyMembers.length) { showToast('先组队'); return; }
      try { ws.send(JSON.stringify({ type: 'party_event_start', npc: '贝利' })); } catch (e) {}
    });
    setOnEl('dol-send', sendChat);
    setOnEl('dol-msg-latest', function () { try { el.msg.scrollTop = el.msg.scrollHeight; } catch (e) {} });
    setOnEl('dol-clear-chat', function () {
      if (!confirm('确定清空所有人的公屏聊天记录？')) return;
      try { ws.send(JSON.stringify({ type: 'clear_chat' })); } catch (e) {}
    });
    setOnEl('dol-save-backups', function () {
      var box = document.getElementById('dol-backup-list');
      if (!box) return;
      if (box.style.display === 'block') { box.style.display = 'none'; return; }
      box.style.display = 'block';
      box.innerHTML = '查询中…';
      fetch(serverURL() + '/api/save/backups', { headers: { 'Authorization': 'Bearer ' + TOKEN } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var list = d.backups || [];
          if (!list.length) { box.innerHTML = '<span style="color:#888">（暂无备份）</span>'; return; }
          box.innerHTML = list.map(function (b) {
            var dt = new Date(b.updatedAt).toLocaleString();
            return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #222">' +
              '<span style="color:#9ac7ff">' + dt + '（' + Math.round(b.size / 1024) + 'KB）</span>' +
              '<a href="#" data-restore="' + b.index + '" style="color:#7ec98a">恢复</a></div>';
          }).join('');
          box.querySelectorAll('[data-restore]').forEach(function (a) {
            a.onclick = function (ev) {
              ev.preventDefault();
              if (!window.confirm('恢复这个备份？当前存档会被覆盖。')) return;
              fetch(serverURL() + '/api/save/restore', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: Number(a.getAttribute('data-restore')) })
              }).then(function (r) { return r.json(); }).then(function (r2) {
                if (r2.ok) { showToast(' 已恢复，重新载入游戏生效'); box.style.display = 'none'; }
                else showToast(' ' + (r2.error || '恢复失败'));
              }).catch(function () { showToast(' 网络错误'); });
            };
          });
        })
        .catch(function () { box.innerHTML = '<span style="color:#e25a5a">查询失败</span>'; });
    });
    setOnEl('dol-up', uploadSave);
    setOnEl('dol-down', downloadSave);
    setOnEl('dol-world-join', joinWorld);
    setOnEl('dol-restore-bk', restoreMyBackup);
    setOnEl('dol-rooms-refresh', refreshRooms);
    setOnEl('dol-world-load', loadWorld);
    (function bindQuick() {
      var map = { 'dol-quick-party': '有人组队吗？', 'dol-quick-help': '队里还缺个输出', 'dol-quick-boss': '来打世界 Boss！', 'dol-quick-gg': '辛苦了' };
      Object.keys(map).forEach(function (id) {
        setOnEl(id, function () {
          try { ws.send(JSON.stringify({ type: 'chat', text: map[id] })); } catch (e) {}
        });
      });
    })();
    setOnEl('dol-int-greet', function () { doGreet(); });
    setOnEl('dol-int-money', function () { doGiveMoney(); });
    setOnEl('dol-int-duel', function () { try { ws.send(JSON.stringify({ type: 'pvp_challenge', to: interactTarget })); showToast('已向 ' + interactTarget + ' 发起决斗'); } catch (e) {} });
    setOnEl('dol-int-loc', function () { doViewLoc(); });
    setOnEl('dol-int-cancel', closeInteract);
    el.chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
    (function () {
      var srvBtns = document.querySelectorAll('[data-srv]');
      srvBtns.forEach(function (b) {
        b.onclick = function () {
          el.server.value = b.getAttribute('data-srv');
          el.server.dispatchEvent(new Event('change'));
          showToast('已切换到 ' + (b.getAttribute('data-srv').indexOf('sslip') >= 0 ? '直连线路' : '隧道线路'));
        };
      });
      var probe = function () {
        try {
          var pnl = document.getElementById('dolonline-panel');
          if (!pnl || !pnl.classList.contains('open')) return;
        } catch (e) { return; }
        var targets = [
          { url: 'https://47-118-55-194.sslip.io:8443', el: 'dol-srv-a' },
          { url: 'https://dol.qiubai.xyz', el: 'dol-srv-b' }
        ];
        // 用 WebSocket 握手测延迟（和实际连游戏是同一条路径），并记录最小值
        window.__dolSrvMin = window.__dolSrvMin || {};
        targets.forEach(function (t) {
          var t0 = Date.now();
          var sock = null, done = false;
          var finish = function (ok) {
            if (done) return; done = true;
            try { if (sock) sock.close(); } catch (e) {}
            var e2 = document.getElementById(t.el);
            if (!e2) return;
            if (ok) {
              var ms = Date.now() - t0;
              var prev = window.__dolSrvMin[t.el];
              var best = (prev && prev > 0) ? Math.min(prev, ms) : ms;
              window.__dolSrvMin[t.el] = best;
              e2.textContent = ms + 'ms';
              e2.style.color = best < 300 ? '#7ec98a' : (best < 800 ? '#e8c97a' : '#e07a7a');
            } else {
              e2.textContent = '×'; e2.style.color = '#e07a7a';
            }
          };
          try {
            sock = new WebSocket(t.url.replace(/^http/i, 'ws'));
            sock.onopen = function () { finish(true); };
            sock.onerror = function () { finish(false); };
            setTimeout(function () { finish(false); }, 6000);
          } catch (e) { finish(false); }
        });
      };
      window.__dolSrvProbe = probe;
      probe();
      if (!window.__dolSrvTimer) window.__dolSrvTimer = setInterval(probe, 25000);
    })();
    el.server.addEventListener('change', function () {
      SERVER = (el.server.value || '').trim().replace(/\/+$/, '');
      if (SERVER && !/^https?:\/\//i.test(SERVER)) SERVER = 'http://' + SERVER;
      localStorage.setItem(LS.server, SERVER);
      setStatus('服务器已保存，重新连接中…');
      try { if (ws) ws.close(); } catch (e) {}
      connectWS();
    });

    if (USERNAME) {
      el.userbar.style.display = '';
      el.auth.style.display = 'none';
      el.username.textContent = USERNAME;
      setStatus('正在连接…');
      connectWS();
    }
  }

  function updateBadge() {
    var b = document.getElementById('dol-badge');
    if (!b) return;
    if (unreadChat > 0) { b.textContent = unreadChat > 99 ? '99+' : String(unreadChat); b.style.display = 'block'; }
    else { b.style.display = 'none'; }
  }
  function setStatus(t, cls) {
    statusText = t;
    if (el.status) { el.status.textContent = t; el.status.className = 'st' + (cls ? ' ' + cls : ''); }
  }
  function setSaveStatus(t, cls) {
    if (el.saveStatus) { el.saveStatus.textContent = t; el.saveStatus.className = 'st' + (cls ? ' ' + cls : ''); }
  }

  var MAP_LOCATION_NAMES = {
    domus: 'Domus 街', barb: 'Barb 街', danube: 'Danube 街', connudatus: 'Connudatus 街',
    cliff: 'Cliff 街', wolf: 'Wolf 街', high: 'High 街', starfish: 'Starfish 街',
    nightingale: 'Nightingale 街', oxford: 'Oxford 街', mer: 'Mer 街', elk: 'Elk 街',
    harvest: 'Harvest 街', residential: 'Residential 巷', commercial: 'Commercial 巷',
    park: 'Park', industrial: 'Industrial 巷'
  };
  var interactTarget = '';
  function handleInteract(m) {
    if (!m || !m.from) return;
    if (m.action === 'greet') {
      appendChat(m.from, '（向你打招呼 ）', m.ts || Date.now(), false);
      setStatus('玩家 ' + m.from + ' 向你打招呼', 'ok');
    } else if (m.action === 'money') {
      var amt = Number(m.amount) || 0;
      if (amt > 0) {
        try { var v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables; if (v) v.money = (Number(v.money) || 0) + amt; } catch (e) {}
        appendChat(m.from, '（送了你 ' + fmtMoney(amt) + '）', m.ts || Date.now(), false);
        setStatus('收到 ' + m.from + ' 的 ' + fmtMoney(amt), 'ok');
      }
    } else if (m.action === 'fight') {
      try { showToast(' ' + m.from + ' 向你发起战斗'); } catch (e) {}
      try { appendChat(m.from, '（向你发起战斗）', m.ts || Date.now(), false); } catch (e) {}
    }
  }
  function friendAvatar(u) {
    return 'https://dl.qiubai.xyz/avatar_' + encodeURIComponent(u) + '.png?t=1';
  }
  function playerLvMoney(u) {
    var lv = null, lvG = null, money = null;
    try {
      if (u === USERNAME) {
        var v = VV();
        if (v) {
          lv = Number(v.mpDLv) || 1;
          lvG = Number(v.mpDgLv) || 1;
          money = Number(v.money) || 0;
        }
      } else {
        var p = (worldPresences && worldPresences[u]) || (typeof globalPresence !== 'undefined' && globalPresence[u]) || null;
        if (p) {
          if (p.lv != null) {
            var raw = Number(p.lv);
            if (raw >= 100) { lv = Math.floor(raw / 100); lvG = raw % 100; }
            else { lv = raw; }
          }
          if (p.money != null) money = Number(p.money);
        }
      }
    } catch (e) {}
    return { lv: lv, lvG: lvG, money: money };
  }
  function renderOnline(users) {
    if (!users || !users.length) { el.online.textContent = '（暂无）'; return; }
    var html = '';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var me = (u === USERNAME);
      loadAvatar(u, function (src) {
        if (!src) return;
        if (window.__dolAvatarTimer) return;
        window.__dolAvatarTimer = setTimeout(function () {
          window.__dolAvatarTimer = null;
          try { renderOnline(lastOnline || []); } catch (e) {}
          try { _lastFriendsHtml = ''; renderFriends(); } catch (e) {}
        }, 400);
      });
      var av = AVATARS[u] || '';
      var initial = av ? '' : esc(u.slice(0, 1));
      var title = TITLES[u] || '';
      var titleHtml = '';
      if (title) {
        if (title === '腐竹' || title === '炫彩') {
          var cols = ['#ff5a5a','#ffb03b','#f0e040','#5ae06a','#4ac8f0','#a06af0','#ff5aa0'];
          titleHtml = '<span class="dol-rainbow" style="display:inline-block;font-size:10px;margin-left:4px;padding:1px 5px;border-radius:6px;background:#222;font-weight:bold">' +
            title.split('').map(function (ch, ii) { return '<span style="color:' + cols[ii % cols.length] + '">' + esc(ch) + '</span>'; }).join('') + '</span>';
        } else {
          titleHtml = '<span style="font-size:10px;margin-left:4px;padding:1px 5px;border-radius:6px;background:#4a3a1a;color:#f0c070">' + esc(title) + '</span>';
        }
      }
      var info = playerLvMoney(u);
      var lvHtml = '<span style="font-size:11px"><span style="color:#8ae0a0">Lv.</span>' +
        '<span style="color:#8ad0ff">' + (info.lv != null ? info.lv : '?') + '</span>' +
        '<span style="color:#8a8a92">/</span>' +
        '<span style="color:#c9a0e2">' + (info.lvG != null ? info.lvG : '?') + '</span></span>';
      var moneyHtml = '<span style="font-size:11px;color:#e8c97a">' + (info.money != null ? fmtMoney(info.money) : '—') + '</span>';
      html += '<div class="dol-op" data-user="' + esc(u) + '" style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 8px;background:' + (me ? '#2a2a1a' : '#1a2030') + ';border-radius:10px;cursor:pointer">' +
        '<div style="width:24px;height:24px;border-radius:50%;border:1px solid #3a3a4a;flex:0 0 auto;background:#1a1a1a center/cover no-repeat;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#9ac7ff;' + (av ? ("background-image:url('" + av + "')") : '') + '">' + initial + '</div>' +
        '<span class="pname' + (me ? ' me' : '') + '" style="flex:1;color:' + (me ? '#e8c97a' : '#9ac7ff') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(u) + '</span>' +
        titleHtml +
        '<span style="flex:0 0 auto;margin-left:6px;display:inline-flex;gap:8px">' + lvHtml + moneyHtml + '</span>' +
        '</div>';
    }
    el.online.innerHTML = html;
    var nodes = el.online.querySelectorAll('.dol-op[data-user]');
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].onclick = (function (node) { return function () { openInteract(node.getAttribute('data-user')); }; })(nodes[j]);
    }
  }
  function loadUserCount() {
    var box = document.getElementById('dol-users-count');
    if (!box) return;
    fetch(SERVER + '/api/users', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || typeof d.count !== 'number') { box.textContent = '注册用户：查询失败'; return; }
        box.textContent = '注册用户：' + d.count + ' 人　在线：' + (d.online || 0) + ' 人';
      })
      .catch(function () { box.textContent = '注册用户：查询失败'; });
  }
  function openInteract(user) {
    if (!user || user === USERNAME) return;
    interactTarget = user;
    if (el.interactTarget) el.interactTarget.textContent = user;
    if (el.interact) el.interact.style.display = 'block';
  }
  function closeInteract() {
    interactTarget = '';
    if (el.interact) el.interact.style.display = 'none';
  }
  function doGreet() {
    if (!interactTarget || !ws || ws.readyState !== 1) { setStatus('未连接', 'err'); return; }
    try { ws.send(JSON.stringify({ type: 'interact', to: interactTarget, action: 'greet' })); } catch (e) {}
    appendChat(USERNAME, '（向 ' + interactTarget + ' 打招呼 ）', Date.now(), true);
    setStatus('已向 ' + interactTarget + ' 打招呼', 'ok');
    closeInteract();
  }
  function doGiveMoney() {
    if (!interactTarget || !ws || ws.readyState !== 1) { setStatus('未连接', 'err'); return; }
    var v = null;
    try { v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables; } catch (e) {}
    if (!v) { setStatus('读不到金币', 'err'); return; }
    var cur = Number(v.money) || 0;
    var input = prompt('你有 ' + fmtMoney(cur) + '。送多少给 ' + interactTarget + '？（单位：镑，可带小数，如 2.50）');
    if (input == null) return;
    var amountP = toPence(input);
    if (amountP <= 0) { setStatus('金额无效', 'err'); return; }
    if (amountP > cur) { setStatus('金额不够（你有 ' + fmtMoney(cur) + '）', 'err'); return; }
    var amount = amountP;
    try { ws.send(JSON.stringify({ type: 'interact', to: interactTarget, action: 'money', amount: amount })); } catch (e) {}
    appendChat(USERNAME, '（送给 ' + interactTarget + ' ' + fmtMoney(amount) + '）', Date.now(), true);
    setStatus('已送出 ' + fmtMoney(amount) + ' 给 ' + interactTarget, 'ok');
    closeInteract();
  }
  function doViewLoc() {
    if (!interactTarget) return;
    var pl = worldPresences[interactTarget];
    if (pl && pl.mapLocation) {
      setStatus(interactTarget + ' 在：' + (MAP_LOCATION_NAMES[pl.mapLocation] || pl.mapLocation), 'ok');
    } else {
      setStatus('暂无 ' + interactTarget + ' 的位置信息', 'err');
    }
    closeInteract();
  }
  function renderHistory(hist) {
    el.msg.innerHTML = '';
    for (var i = 0; i < hist.length; i++) {
      appendChat(hist[i].from, hist[i].text, hist[i].ts, hist[i].from === USERNAME);
    }
  }
  function msgNearBottom() {
    try {
      var m = el.msg;
      return (m.scrollHeight - m.scrollTop - m.clientHeight) < 80;
    } catch (e) { return true; }
  }
  function appendChat(from, text, ts, mine) {
    var stick = msgNearBottom();
    var d = new Date(ts || Date.now());
    var time = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var div = document.createElement('div');
    div.className = 'm';
    div.innerHTML = '<span class="t">[' + time + '] </span>' +
      (mine ? '<span class="myname">我</span>' : '<span class="myname">' + esc(from) + '</span>') +
      ': ' + esc(text);
    el.msg.appendChild(div);
    while (el.msg.childNodes.length > 150) { try { el.msg.removeChild(el.msg.firstChild); } catch (e) { break; } }
    if (stick) el.msg.scrollTop = el.msg.scrollHeight;
  }

  function doRegister() {
    var u = el.user.value.trim(), p = el.pass.value;
    if (!u || !p) { setStatus('请输入用户名和密码', 'err'); return; }
    setStatus('注册中…');
    api('POST', '/api/register', { username: u, password: p }).then(function (r) {
      if (r.token) {
        TOKEN = r.token; USERNAME = r.username;
        localStorage.setItem(LS.token, TOKEN); localStorage.setItem(LS.user, USERNAME);
        onLoggedIn();
      } else { setStatus(r.error || '注册失败', 'err'); }
    });
  }
  function doLogin() {
    var u = el.user.value.trim(), p = el.pass.value;
    if (!u || !p) { setStatus('请输入用户名和密码', 'err'); return; }
    setStatus('登录中…');
    api('POST', '/api/login', { username: u, password: p }).then(function (r) {
      if (r.token) {
        TOKEN = r.token; USERNAME = r.username;
        localStorage.setItem(LS.token, TOKEN); localStorage.setItem(LS.user, USERNAME);
        onLoggedIn();
      } else { setStatus(r.error || '登录失败', 'err'); }
    });
  }
  function guestLogin(cb) {
    if (TOKEN) { onLoggedIn(); if (cb) cb(true); return; }
    var name = '旅人' + String(Math.floor(Math.random() * 9000) + 1000);
    var pass = 'g' + Math.random().toString(36).slice(2, 12);
    setStatus('正在创建账号…');
    api('POST', '/api/register', { username: name, password: pass }).then(function (r) {
      if (r && r.token) {
        TOKEN = r.token; USERNAME = r.username;
        try {
          localStorage.setItem(LS.token, TOKEN);
          localStorage.setItem(LS.user, USERNAME);
          localStorage.setItem('dolon_pass', pass);
        } catch (e) {}
        onLoggedIn();
        if (cb) cb(true);
      } else if (r && r.error && r.error.indexOf('存在') >= 0) {
        guestLogin(cb);
      } else {
        setStatus((r && r.error) || '创建账号失败', 'err');
        if (cb) cb(false);
      }
    });
  }
  window.dolGuestLogin = guestLogin;

  function showOnboarding() {
    try {
      if (localStorage.getItem('dolon_onboarded') === '1') return;
      if (TOKEN) return;
      if (document.getElementById('dol-onboard')) return;
      var box = document.createElement('div');
      box.id = 'dol-onboard';
      box.innerHTML =
        '<div class="ob-card">' +
        '  <div class="ob-tag">联机模块已载入</div>' +
        '  <div class="ob-title">和真人一起玩 DoL</div>' +
        '  <div class="ob-desc">进游戏就能看到别人在哪个场景、<br>在公屏说话、结伴下地下城。</div>' +
        '  <div class="ob-online" id="dol-ob-online">正在查询在线人数…</div>' +
        '  <div class="ob-btns">' +
        '    <button id="dol-ob-go">一键联机</button>' +
        '    <button id="dol-ob-skip">先自己看看</button>' +
        '  </div>' +
        '</div>';
      document.body.appendChild(box);
      setTimeout(function () { box.classList.add('show'); }, 60);
      api('GET', '/api/ping').then(function (r) {
        var n = (r && typeof r.online === 'number') ? r.online : 0;
        var elx = document.getElementById('dol-ob-online');
        if (elx) elx.innerHTML = '当前在线 <b>' + n + '</b> 人';
      });
      var close = function () {
        try { localStorage.setItem('dolon_onboarded', '1'); } catch (e) {}
        box.classList.remove('show');
        setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
      };
      document.getElementById('dol-ob-skip').onclick = close;
      document.getElementById('dol-ob-go').onclick = function () {
        var btn = document.getElementById('dol-ob-go');
        if (btn) { btn.disabled = true; btn.textContent = '连接中…'; }
        guestLogin(function (ok) {
          close();
          if (ok) {
            try { panel.classList.add('open'); } catch (e) {}
            showToast('已联机 · 在公屏打个招呼吧');
          } else {
            showToast('联机失败，可在面板里手动登录');
          }
        });
      };
    } catch (e) {}
  }
  function serializeGame() {
    try {
      if (window.SugarCube && SugarCube.Save && SugarCube.Save.serialize) return SugarCube.Save.serialize();
      if (window.SugarCube && SugarCube.State) return JSON.stringify(SugarCube.State);
    } catch (e) {}
    return null;
  }
  function deserializeGame(str) {
    try {
      if (window.SugarCube && SugarCube.Save && SugarCube.Save.deserialize) {
        SugarCube.Save.deserialize(str);
        if (SugarCube.Engine && SugarCube.Engine.play) SugarCube.Engine.play();
        return true;
      }
    } catch (e) {}
    return false;
  }
  function getMeta() {
    try {
      var v = window.SugarCube && SugarCube.State && SugarCube.State.variables;
      var st = window.SugarCube && SugarCube.State;
      return {
        passage: (st && st.active && st.active.title) || '',
        day: v ? Number(v.day) || 0 : 0,
        money: v ? Number(v.money) || 0 : 0
      };
    } catch (e) { return {}; }
  }
  function setWorldStatus(t, cls) {
    var e = document.getElementById('dol-world-status');
    if (e) { e.textContent = t; e.className = 'st' + (cls ? ' ' + cls : ''); }
  }
  function sendChat() {
    try {
      var inp = document.getElementById('dol-chat-input');
      if (!inp) return;
      var t = String(inp.value || '').trim();
      if (!t) return;
      if (!ws || ws.readyState !== 1) { setStatus('未连接', 'err'); return; }
      ws.send(JSON.stringify({ type: 'chat', text: t }));
      inp.value = '';
    } catch (e) {}
  }
  function uploadSave() {
    if (!TOKEN) { setStatus('请先登录', 'err'); return; }
    var save = serializeGame();
    if (!save) { setStatus('无法读取存档', 'err'); return; }
    var e = document.getElementById('dol-save-status');
    if (e) e.textContent = '上传中…';
    api('POST', '/api/save', { save: save, meta: getMeta() }).then(function (r) {
      var st = document.getElementById('dol-save-status');
      if (st) st.textContent = (r && r.ok) ? ('已上传 ' + new Date().toLocaleTimeString()) : ((r && r.error) || '上传失败');
    });
  }
  function downloadSave() {
    if (!TOKEN) { setStatus('请先登录', 'err'); return; }
    var st = document.getElementById('dol-save-status');
    if (st) st.textContent = '下载中…';
    api('GET', '/api/save').then(function (r) {
      if (r && r.save) {
        var ok = deserializeGame(r.save);
        if (st) st.textContent = ok ? ('已恢复 ' + new Date().toLocaleTimeString()) : '恢复失败';
        if (ok) showToast('已回到云端存档');
      } else {
        if (st) st.textContent = (r && r.error) || '云端没有存档';
      }
    });
  }
  function refreshRooms() {
    var box = document.getElementById('dol-rooms');
    if (!box) return;
    box.textContent = '查询中…';
    api('GET', '/api/world/list').then(function (r) {
      var list = (r && r.worlds) ? r.worlds : [];
      if (!list.length) { box.textContent = '（暂无房间）'; return; }
      box.innerHTML = list.map(function (w) {
        var on = (w.online || 0);
        return '<div style="margin:2px 0;font-size:12px"><a href="#" data-room="' + esc(w.id) + '" style="color:#9ac7ff">' +
          esc(w.id) + '</a> <span style="color:#8a8a8a">v' + (w.version || 0) + ' · ' + on + ' 人 · 最近 ' + esc(w.lastEditor || '-') + '</span></div>';
      }).join('');
      box.querySelectorAll('[data-room]').forEach(function (a) {
        a.onclick = function (ev) {
          ev.preventDefault();
          var id = a.getAttribute('data-room');
          var inp = document.getElementById('dol-world-id');
          if (inp) inp.value = id;
          try { joinWorld(); } catch (e) {}
        };
      });
    });
  }
  function checkModUpdate() {
    var e = document.getElementById('dol-latest-ver');
    if (e) e.textContent = '查询中…';
    api('GET', '/api/mod/latest').then(function (r) {
      var latest = (r && (r.version || r.latest)) || '';
      var elx = document.getElementById('dol-latest-ver');
      if (elx) {
        elx.innerHTML = latest
          ? ('最新版本 v' + esc(String(latest)) + '　当前 v' + MOD_VERSION)
          : '查询失败';
      }
    });
  }
  function doLogout() {
    try { if (ws) ws.close(); } catch (e) {}
    TOKEN = ''; USERNAME = '';
    try { localStorage.removeItem(LS.token); localStorage.removeItem(LS.user); } catch (e) {}
    worldId = ''; worldVersion = 0; worldLatestVersion = 0;
    partyMembers = []; partyId = '';
    try {
      if (el.auth) el.auth.style.display = '';
      if (el.userbar) el.userbar.style.display = 'none';
    } catch (e) {}
    setStatus('已登出');
    showToast('已登出');
  }
  var TITLES = {};
  var peerCombatSnapshot = null;
  var combatPeerName = '';
  var dolLastCombat = 0;
  var lastOnline = [];
  var cpPartner = '';
  var partyMembers = [];
  var partyId = '';
  var partyEvent = null;
  var partyGear = {};
  function renderPartyGear() {
    var box = document.getElementById('dol-party-gear');
    if (!box) return;
    var names = Object.keys(partyGear);
    var lines = [];
    for (var i = 0; i < names.length; i++) {
      var n = names[i], g = partyGear[n] || [];
      if (!g.length) continue;
      lines.push('<div style="margin:2px 0"><b style="color:#e8c97a">' + esc(n) + '</b>：' + g.map(function (it) {
        var r = RARITY.filter(function (x) { return x.k === it.r; })[0] || RARITY[0];
        return '<span style="' + rarityStyle(r) + '">' + esc(it.n) + '</span>';
      }).join('、') + '</div>');
    }
    box.innerHTML = lines.length ? lines.join('') : '（暂无数据）';
  }
  function renderMirrorPlayers() {
    var box = document.getElementById('dol-mirror-players');
    if (!box) return;
    var names = Object.keys(mirrorScreens).filter(function (n) { return n !== USERNAME; });
    if (!names.length) { box.textContent = '（暂无队友画面 · 需与对方在同一个世界）'; return; }
    box.innerHTML = names.map(function (n) {
      var on = (n === mirrorSelected);
      return '<span class="mp' + (on ? ' on' : '') + '" data-mirror="' + esc(n) + '">' + esc(n) + '</span>';
    }).join('');
    box.querySelectorAll('[data-mirror]').forEach(function (el2) {
      el2.onclick = function () { mirrorSelected = el2.getAttribute('data-mirror'); renderMirrorPlayers(); renderMirror(); };
    });
  }
  function renderMirror() {
    var box = document.getElementById('dol-mirror');
    if (!box) return;
    var names = Object.keys(mirrorScreens);
    var pick = mirrorSelected && mirrorScreens[mirrorSelected] ? mirrorSelected : null;
    if (!pick) {
      var latest = null;
      names.forEach(function (n) {
        if (n === USERNAME) return;
        var it = mirrorScreens[n];
        if (!latest || it.ts > latest.ts) { latest = it; pick = n; }
      });
    }
    if (!pick) { box.textContent = '（暂无队友画面 · 需与对方在同一个世界）'; return; }
    var sc = mirrorScreens[pick];
    box.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#8a8a8a;margin-bottom:2px">' +
      '<span class="mirror-head-name" style="flex:1">' + esc(pick) + ' · ' + esc(sc.passage || '') + '</span>' +
      '<button id="dol-mirror-zoom" style="padding:2px 8px;font-size:11px;background:#20242e;color:#9ac7ff;border:1px solid #2a2a30;border-radius:6px">⤢ 放大</button>' +
      '</div><div class="mirror-vp"><div class="mirror-stage"><div class="mirror-content">' + (sc.html || '') + '</div></div></div>';
    fitMirror();
    setTimeout(fitMirror, 80);
    setTimeout(fitMirror, 400);
    try {
      var fb = document.getElementById('dol-mirror-full-body');
      if (fb) {
        var keep = fb.scrollTop;
        fb.innerHTML = sc.html || '';
        fb.scrollTop = keep;
        var tt2 = document.getElementById('dol-mirror-full-title');
        if (tt2) tt2.textContent = '屏幕镜像 · ' + pick + ' · ' + (sc.passage || '') + '（上下滑动）';
      }
    } catch (e) {}
    var zb = document.getElementById('dol-mirror-zoom');
    if (zb) zb.onclick = function () { openMirrorFull(); };
  }
  function fitMirror() {
    try {
      if (!window.__dolMirrorResize) {
        window.__dolMirrorResize = 1;
        try { window.addEventListener('resize', function () { setTimeout(function () { try { fitMirror(); } catch (e) {} }, 200); }); } catch (e) {}
      }
      var box = document.getElementById('dol-mirror');
      if (!box) return;
      var vp = box.querySelector('.mirror-vp');
      var st = box.querySelector('.mirror-stage');
      if (!vp || !st) return;
      st.style.transform = 'none';
      var vw = vp.clientWidth || 1, vh = vp.clientHeight || 1;
      var sw = st.scrollWidth || 390, sh = st.scrollHeight || 1;
      var k = Math.min(vw / sw, vh / sh, 1);
      if (!isFinite(k) || k <= 0) k = 1;
      k = Math.max(0.2, k);
      st.style.transform = 'scale(' + k.toFixed(4) + ')';
      st.style.left = Math.max(0, Math.round((vw - sw * k) / 2)) + 'px';
      window.__dolMirrorScale = k;
    } catch (e) {}
  }
  window.dolMapGo = function (key) {
    try {
      var E = window.SugarCube && window.SugarCube.Engine;
      var P = {
        harvest: 'Harvest Street',
        dungeon: 'DoLOnlineDungeonGate',
        catshop: 'DoLOnlineCatShop',
        campfire: 'DoLOnlineCampfire',
        merchant: 'DoLOnlineMerchant',
        fish: 'DoLOnlineDungeonFish'
      };
      if (P[key]) { if (E) E.play(P[key]); return; }
      var panel = document.getElementById('dolonline-panel');
      if (key === 'rogue') { if (window.dolRogueOpen) window.dolRogueOpen(); return; }
      var openPanelAt = function (matchText) {
        if (!panel) return;
        panel.classList.add('open');
        panel.style.display = 'flex';
        panel.style.zIndex = '2147483600';
        try { fixPanelZoom(); } catch (e) {}
        var ds = panel.querySelectorAll('details');
        for (var i = 0; i < ds.length; i++) {
          var sum = ds[i].querySelector('summary');
          if (sum && (sum.textContent || '').indexOf(matchText) >= 0) { ds[i].open = true; }
        }
        var lab = null, els = panel.querySelectorAll('.lbl');
        for (var j = 0; j < els.length; j++) {
          if ((els[j].textContent || '').indexOf(matchText) >= 0) { lab = els[j]; break; }
        }
        if (lab && lab.scrollIntoView) setTimeout(function () { try { lab.scrollIntoView({ block: 'center' }); } catch (e) {} }, 120);
      };
      if (key === 'market') { openPanelAt('市场'); return; }
      if (key === 'lottery') { openPanelAt('猫猫抽奖'); return; }
      if (key === 'smith') { openPanelAt('铁匠'); return; }
      if (key === 'online') { openPanelAt('屏幕镜像'); return; }
    } catch (e) { showToast('前往失败：' + (e && e.message ? e.message : '')); }
  };
  window.DOL_MAP_ICONS = {"harvest": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAFNElEQVR42u2Zy4scVRTGf/Xo13RnJmVeo3kQ4ogxEtBsIoIBFSUIbhPwD8jOgAiuIgjBjSCKghDF+IBAkAgiQgQhiGiMoIiieZNkkslMkpmenumenu7proeL71Sk22k3cWOo2tyuurdOF+c75/vOudcJgiDhDi7XdQFoVqsAfLZ/PwD5b37UgoIPwO9TUwBEzQ4AJV/PO24MgOcWNcayF0WR7NvXebaua/evz1/WPP/zy/+vDKWeSFx5OHh8m577OQB2ovuRrv7yyq9/AnB54ioAD25cD8CSJ0tJGALQyMvzUaxxZvwmAEN9/5shENs4l3eUC+d+BuCWXwKgXKkAsHGiDsDThTUAhK2uPqTeBODLshCcXRsA8Mje52Q4p+CfPfixcuFWhsDyCCTllQBM5QsAnF87DIATLgBQLMmT9VZLyHh5ACqJPmX1y88r1tevAODrIbFRkzYA2/LKjSTLgQHXQkuepuzJk3l5bve+vQA8dm5R84dPyJNtzecc+XJmRO9dG9Gykn1iJVEuFRGrORkCAwwVLRue3LNbSrtFjH21oFieK2j+HlvvWDD7lkTljizll3T/7ZFjstsSUlvb4bL6kyGQslDki4WqJZm2jCAolqXEjni/Yn/ddRXTiSn2ySPHAfhjVFG+fkbIDRlbFR2t8zIEBiAQ+lLSEQ3sWBB7HH/vQwA2jCvoR1vi+flQbzY6UuLNtr4xqZgvuPJ82BFySaT1YYbAgGp0ZF5RX//kNwAe9qXE91cVu5uX5NHVOSFwvaTciMv6lFXnJgF4dEgW21adOo6ifuWS1/N/GQL9V2CdVjChWqe4pGg9OzshpW2JVWYjdWC5YUnuhavXANjkCyE6WrfgK2e8tuwW7XmmxAPZKJaExtYyPfXmPo0t5cCJ196R5zuqVjtW2xRdIRGZMu96+0XrA2Tv4AsHZNea4jhDYKAe5OxH0TyoXKArSELrbX3k2VJkHVmcN4WNbP0NK0dj252w92Lv7kLAudN9oSSxmAzlufZCQ72vze8L1qmWGVH9ORdaf/DsLulGLJaa+kH7PKduan9pyRTdQ0h+NHtGNVbq+cpwlgOmkGJkL2c8Paxq9FZduw9bHhgD4PsZ6cCJiXHVOF8o9retuQ+ASzekwIcaWrdn01bZM2SbrmI/HLJq1PQmQ+B2LqTSmNOPyHgiDotWdcqD47bsXVPmyMaUVWbsi3aOrgJg8qLtgcZCInCEcN3YKmOhv8tRq2ESqyJrcwCsSKQD87Zs3b3aA201mz21TmL8no8btlPX7QmRuo2jwahyImpnCCybAwu1GgAfvKRa5ruvTgLw6flfFOvmsiTut5B2uVHP00M7ntGuxuVpAN6vnZad4UrGQr1QGo4FG+s/XQBg+5xqnlc2PATAYnry4jg974fmStceVxzl1FhTULW6spMghY7crBZa/lqcF1/kjLfTk5TU32Hf/T9yyWbS0CiZj0PLjWl7Xly5OsuBnmrU8eW50E5oOrYvtGg+CgKduHS74vf0dNPpywXPdqldq3WuTOtMLO+pBopCvZ83xc8QSD0YVqW8xw68CsDnh48CcPT6eSlxrWodWS97pABEfi+bOb2b0Ly14wnlwKTOm9+YOJMh0BPLkeUCM6plxqwn3mrraub5bn8va68l3V52cnqnGWtYh9aQHlSyXQmnt5hJQ/bUxUuKeWOj7ZukwIWKFKFrJ/CeO8h3dlIfG7uZNJ8O9KlnTZmb85kSG4TG17XqtHVO1pj1Qdxettb8F33pywX39r6TzRfuEgT+AkwBzLAOg1/NAAAAAElFTkSuQmCC", "market": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAA+UlEQVR42mNgGAWjYBSMgoEEjMicFUZa/3Ep9DuwB6chmxxcGOipj4tPCu5upqEeAyzIHEMJUbIMobc+ZDDkY2DUA6MeGOkeYKGWQV9qKrGKX79yCau4po7eaAwMCw+gNCV4eYX+DwVHf/78jnH4ZuJaX8VB7eDmzfdHQDF65cHbQelYHQXh0WJ0aCQhbFE1GgMD1RZCL7bQi1xay1OlMfdihwGGmITHBTj7jK0uhrzJ4ctwduK+HAz5+U5TiDZ/tDE36oFRD1CYiQllKOQMiw0gZ1hyzCepPzAUWqPDqj8w6oFRD4x6YNQDox4Y2R4Y8iNzo2AUjHQAAKFFQ1r6GygLAAAAAElFTkSuQmCC", "dungeon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAA4klEQVR42mNgGAWjYBSMgoEEjMgcXl6h/0PB0Z8/v4O7mwVdctXGLYPa8WH+Pih8FmyKxDg+DUrHv/rBhyHGNNTzANYYcHCPgrMP7Fw2oA5Edgu25I0zBp61aA2aUMbnFhZi0x165qE1ILYwGfJ5YNQDox6glQekaq4NGkficwvWUmhPswSc/W6AHU/ILaN5YFA2Jd7pzRk0DiTkFhZKLfj8mbJcwssrNFqMjnpg1AOjHhj1wKgHRj0w6oFRD4x6YNQDox4Y9cCoBwYCoMyR1bb2DYk5subqIsbRJDQKRsEwAQB7mSo1nurXaQAAAABJRU5ErkJggg==", "catshop": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABm0lEQVR42u1Zu23DMBClCLVq3KhQkwHkzpUBw4C7bJAlMkAm8ABewhukC+AmlUsP4MaFGzceQKkYEI4s3OcdpQB8JXEi39N9eCc5l5GRQUJVzbopnuenKIJzDkvA9XJyVTXrrISEva+XE/mZkntI2Lxu2u5+vxVI8hziIg/0eWNM8ioBKBEa8moBWhFa8hABkuSWJCssiSnJTbVFACagbloSwbppf20n4QEumdgOIaTUktccHoWdS15GteQfhcQhaOoBZPw+E8HZm9wKxCUSTf5ZMaC0KuQQCptZko/3p/ZZnuMBa/KS2927f45RLjJkLnlE+ISSGtd1jR0njDzyzQ+tU+0mEUIIu6Tt9JiADDSUdaodF38ui8+v797EWS9eklahw/Hcu/66WRamA03KYYbdC6W6iYOnKO1EaUnA+u2bVqFA9riam3awrG4UXcO14cPKAWkucCc3DnmRAMuE5pIXCxgSsd3tB5/7eH+DkVclMTInpORVHniclSUhFV6A5jM99Ps+t5VA/F8onAGGBhHkT5GMjIyMDDV+AJNqA6vbAt0pAAAAAElFTkSuQmCC", "campfire": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABTklEQVR42mNgGAWjYBSMgmENeHmF/g9px3+eaPOflp5gGuoxzETL0H/WosXAwMDA8KxFi2ZJiYnWjocBWnliNAkRE/q0jAW6xwC1PUGyB74edfr/9ajTf2JDn8mEbWgkIXxJh5axwEKqBm7rfYxEhw409JlM2Bj+nfk1eGOAlNCndiww0crx6GkfW17A5gl8eWxY1gOM9Ah9ZIAtL0jVXGP4/Pkd44CWQsOmJiZU7qPLUxL6FHvg8+d3jFI114ZPDBBb61Kzdh7yeYCFXI2wslrC4wJKCQMLXUbdJSjq/1+OwSiJKE3/VImBgc4HZMcAKW2iIdknHrIeINTqJDb9E9smoooHBjIfUC0dk9M0prQEGhaA6BDoijKm6xhn2bKzjAOSiUeL0dG2EBTEWSkM6Lg+uv2Ljj1gpKgpceXB29EkNOqB4eiBUTAKRsEQBwB9bYwfTx756wAAAABJRU5ErkJggg==", "smith": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABNElEQVR42mNgGAUDCxgJKeDlFfpPiQWfP79jpKUHWIhRtGrjFrIMD/P3oXkMsBCrUIzjEwr/1Q8+ovTx8gr9p2UsMA31PDDkPUB0EiI2yYzGwGArRmldlFLdYF5eof+1vooMVx68ZWBgYGBYf/kTw2gpNOqBUQ8QD74edfr/9ajT/xETAyyDzUHc1vsYR/PAqAdGPUB8qTRaClEzpLGVQoRKpdEYwAV0FIThrVFalP80bU4PaH+AGh0YagBiPY01CZE7DkQtQMp4Es48cOz4iQFxvJWlxciqiVmoFRKjTYmRWgoRXT7T0mOU1BMk1cQFFTVUd/yEjhb65IHPn98xUmoZNsdTWkuPrA4NNWOBGqE/MruU1IgFaoX+yO3UUxIL1Ax9ijo0lFRstJ47HgWjYBQMIQAA6/V1UG+p9M4AAAAASUVORK5CYII=", "lottery": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAApElEQVR42mNgGAWjYBSMglEwCkbBKBi5gBHG4Obm/z+UHP7160dGBgYGBqahHgMs6ALPn1wf1A6WlNFE4Q+/GICBfxejBpVDmfSXYRcf6jEw6oFBmwcoBdLe51H4T7cajsYAVWIAPWTJDWFqmTOaiUc9MOqBkVYKUas8p5Y5ozUxrUN4NBOPemCg8gCuHtBoDFAZjI4LjYJRMApGwSgYBaNgJAMADeIdeU7Kz4oAAAAASUVORK5CYII=", "merchant": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACB0lEQVR42u1aMUvDQBR+kayxEBG6CGZWoRTcpVOXDm5dHNz1J8RBf0K7d+ji1sGlk3QvhEJ1jpClEBRsf0Ac5NrLeXe5mLv0BfKglF6O9vvuvu/de0kB6qijUFgmvtRx3ER0bbP50vqbtgngfs8Tznl6gUQnEass4H+JhFp2xNIBPg9wHpEiJA6qbuKaQCXSqCwtmgwVbyin0euLw1LBT5brWkKVkJC2Y91x3OTkeHcezMcNuLz5Ts2hx6I41HIaG5HQfNxIvYvG0KZRssr0DvDGUFWjrISyAqWEojjUOq90AoN+kAkuikMY9AOc/QAhcf/cBp6cWPD/Sc+s7GwTJiYkeON05C3DSQ9hnAANdv4++80+Z1fCuW8fnwAAcH56ZM4DjuMm7Iu+llfXg37AXVGjHmg/7lYxeJgZKyFoYlkyMyahIuBX09b2c7O7kJKwVeXDW3XdRR4LHgBgNW1JSSjvwO3rHXd81BlWp6UcdYZ7B4y6ofF7HjS7i9SYFg/skwTqLERObLbfznNC5yIgMrLO4qzSHqgJVDGUPVBm/meLvMJpVNa7mrpnRDJT1h06tBKaLNdb8LKy28YCln7nSUZEotBtDZVGRqUjI+0nDZwAZsmwT3TQSEj19PV7Xsp3NlYPqBIyTkAmHR1R2ANlrzrrAQuTbGTPm0XPlS2M+uftrO6/KKCJH3SJ6GO8PJSZAAAAAElFTkSuQmCC", "rogue": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABKElEQVR42u2aMQ6CMBSG+4xrFxZMunCAHsB4GhYnz+PkQuI9XEyIB2ByYiGRQZYeoE5FIEhCeK2tvn+CEuD9r/0eaQtjpO8KzEF50zqkwJMtQK8hJAPdWFehD6HgDaw/Xcj2pVdDKj0lMMvA1E2uNZVMYsBbBoY67DKnTBzzFFANzHnoUs1JFjEQDAND7TYpKhP5IwOnBpa8FDMZxAAZoCpkUZxHLZxKNRCMARN4XRVtWyyktmHEWg9cz092v7zP66pgsZD+M8B5pLuZ76quit6wIoipCo1IqQZiIUeHUSwkOsTWemAIrA2ArVUhk2VTOoP7DtgOmqoQGfCFAexppVMDWNNJYuCvGHC9vIhqwNWyIjHwUwz4ts00KdpmJQYQGAjtdwOSD3oB3Q9ovb21APYAAAAASUVORK5CYII=", "online": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABWUlEQVR42u2YsQ6CMBCGOeLK4sTu6kBMTJydfB+fw/dxcjYxMQyu7k4sfQBcvIRgPe6OFjDcP1qD/9e/tH9NEpPJZDLNWSD5cpYt6/ZnzlUweQA0/joXX2P5oRwVBDjmfcZ9IFqIPslCCPNaCDS+P92/xi7HDQsEQpmXQmTZsvYZ94FQz0vHWLdc85iOb4mRANrZxxed+kGJeQ7EKAmEVDrVpcNNwRKYJIBzFeAJG2sbtQS6ADQpdM2+cxXgCSvVrwONTEACMfTSUbdRBMKDTtNGpdspVSfExauP8RhdCKTGQ94Hmm0U3w2ECtJGKeOhQNqVmmv8J4DUuBaEuguoE+jTQrkgXcalINEA2lur1DgXZDH1Ftpsox+Qugnyd1WiPRGsBB63Fzm+3uZWp7ViJRBrhp/llRxfFTtLIKo4MzzfC40BGIABGMDwl3rqX2WtnKsg1nMTk6m/3siz67c5aCvfAAAAAElFTkSuQmCC", "fish": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABsElEQVR42u2YMW6DMBSGH1ZWpCpTl84dunOB+AqWeoHcoGunrLlBj8AVyAHivZU6s7P4AO7kioKN3zMG2ar/icXk+/DDeQ+AkpISVE73mz7dbzo1LoaFt11nI1BKKFXYFKRYaL2n8l6wf13vWb0XqaWujzrbEjLwAACHGDdxRamh2gL+6f0N+suVJjAFbrrWu0ZyoWMKGfhxDlhwDPA00zVGKETEBu8VqOujDgH3CUkuNEXCBb8ogIU/P7+QRc79FwCABgB4fXisQuGdp1DsJx+z5r07sAQvuZjV9sf352pIWzlh4Gc7gIGfXmPjWtN07eyEw8Kj/8hsP06VaLoWJBfedRT4PwJ71H3Ttb8itl2gwqN3wCa2hSwVntQLjYHXwk93QXIRBE9u5kwJbFFaprfJeqAJkWDjRivkeIwRyQUoNVRKDRVVIrl5gCrBpov32AXJxbixm3WnFAlmewJ7lZINnirBXIu3kDD/xOYY9bXUGAm2tDimhAHHwmMlvDdZM5G5+qcYE1l/uYJSQ0WaigJm4qhD/liCLJDiV4kt7r/bpIZ5gNl83CopKSkpKck2PyGzMCgvfbQJAAAAAElFTkSuQmCC", "guild": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAB0ElEQVR42u2ZLW7DMBSA7Sk0pMhsFxiYJk3jRWU9QDU6ELojBJcOlEa7w0A0PlL1CAsbCvEBMlC5cp3YfrbfyxbJD0XNT7/P7/knDmM5/jY45cPLcjWoYyl7vggBHXq9P15+/3x9YBQynBLaFpgyfC5on0ysCI8FD21p3/WxWeHYra2D/HzcX47F5kQiw7Ghb5/fWNdUV/C6hDqPJVPElogJHRL69b4yM0aywRQppv7ABp8CjSWjX2MVsIGHQIvNadQHfPdPyfgqoYhpKUi0tbjquDGZ0ftKskBMtLVgd49iNAphxs3SF3NZIAskRnQn/tod7Cd341n4PKTa73l6f8kllAUW1QdcNds1FWvr8wSmT2RY66dcQlkgCwQKrPdH0NIWM7qmAm0cgDMwpwQUflJAyp6br22mBJWIerbrldZ8sZ/MgE+CIhsKPATeWUJKwpcN6pJRDLb9IWcfkLLnkJKihFcMSZ2YSiK03pNGIWwJDPjgiQxLAguescjtddf2o03QlMWAjxbQRVww+vLZ1+oqw6EMyV9oIBKYJYMuAJGggkcT8ElQwaMup10jFBU8agZCRqh/95kVUlKYrT5blOVq2B6+B/172+Ji0fA5APEL6lFdWaNzMaoAAAAASUVORK5CYII=", "bank": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABaklEQVR42mNgGAUDCxhpaTgvr9B/GPvz53eMQ8YDMIe/fHoFLiYurUMTjzDS2uHogNoeYaRmMsHm8OtXLjFo6ujh9AilnmGkRWhfv3IJpz58niHHI4zUcjg+RxPrGXI8wkhuMiHHwcR6iJTkxUhKaNPC0cR6BpdHGAk5nJ6OxucZXB5hxJVUBjugVcU4OJoS2GIC2ccDLY8MWHD5DFszYDDJwwDTUE9Cox4Y9cBI9wALrQxGLzl4eYX+06LyoZkHXuwwwBCT8LhAdU9Q3QO8vEL/X+wwYGDUXYIi/v9yDMOLHQYMEh4X/g/aPABzPKkxM5qJaQH+X44ZLUZHPUBOJ0PC4wJeNYTkBzwG8HlCwuMCw6CvB/CF9JCqidE7JHQd3B1KXcohOSqB7BmMJLRq45ZB7fgwfx/CeeDY8ROD0vFWlhbEZWJsCgcrGPJ5YPi1Rgsqaga1gyd0tAyvxtyQzwOjYBSMglEwsAAAfrfSP0/NCr4AAAAASUVORK5CYII=", "inn": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABOUlEQVR42mNgGAWjYBSMglEwkgHjYHYcL6/Qfxj78+d3jEPGAzCHP2vRgotJ1VzD6hGmwRr6yI7Hxh+0HuDlFfqPy7HPWrRQktWgjgFiwZD3ACOuXD/Y8gCujIzhgZdPrwy448WldRhwlULoHmAZjMkCFogwj+ASwxkD169cGpTpXVNHj0FcWmdwxYCDexRR6g7sXIZVfFAkoVpfRbzyzZvv45RjoTSEcIUMvQALrrSGLVNhKy3Q1ZILrjx4i1VcR0EYq5uGTUU2aIpRWEiPuKYEC6HaEFvlgUsdKZUUqXmArCR0+/I+qoaWqq7TaB4Ydnlg1AODrkMDKyVo1SJFr1GJLcWQm9ODqjVKaQdqNA+MeoBWFRmxPSV6p3miPTAYRidG88CoBwaiJh4KjsY12TEKRsEoGAX0BwD9QmnGiBoGdQAAAABJRU5ErkJggg==", "plaza": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABRElEQVR42u1ZuwrCMBRNgmuWbg7+hq/FxVFw0i9xdXL1S+pU6Oji4us3BN06GHCNixFaUjXNo0m9BwJNofSce+69SVqEAAAAAAAANBCURvxxv/LH/copjbit95DQA9UyGXFxzViGgxJAacS72817fh7PuCsBxDR5hBAqzmXPiOFNCum4pZNypE7ywi0dJ7QFMJbh83iWu1ece1/ELxG5LmSz91tJIcYyLIaqWzo14LyIZW4F1YVML3TBbyWCF6Bspe3uoppelWqgs1xYIX9Zrd0VcXvUM0r+tjtBEf/Xgaaq5eAACAABIKDaVsLVAUV1W4F/JR0nqfPozqeTr2LwJ/JxkqL94VhrigwH/bcYmQgiIy7I+4Q4SZHsWxIui7yvKDpBvuWeb+SVa8DXyDe/C/26DpgQVpay2uuAqwXO5f8EAKCAJ0umn5wnJbFmAAAAAElFTkSuQmCC", "alley": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABvklEQVR42u2asWrCUBiFT8qdBBdx0EAXQYUWoSB0KOQFOvQB+iwZ+yIuHTu00BcIdBAKQkloKqQUpd2kGDunS28ardGb3Bu9Kf+ZoiZyvvufo5grQCLJq1qtRWX1bawChOHMKNOCM35wcmoBAEZDJ9IVhBtvdY8BAIHv/gKoBrk8P4sA4Pr+wVBtPCmWdpEOE9lkfCvAPkFEjAsD7BIki/FUgNHQSTVfFEge4xsnMHEu4uND6zbXRO6c59hcGqSM8cwREo0W13xyAwBYDGyYtrf2i1LGONeBqvwmY/Z+dbT0Gn9s9Tuw+h1l5pVMoCgFvis0sbUAabnPosXAln4PkS6yTVHIql67CQAwbW8pRqbtoddu4nMexud9KZqU0gg9jT9+cl6FaXvx8zz3XM7jC1rdmt4dWDVdlLQtsWgXtQUQ/ZhVCpAs6rbztC7xNqks8QFKLgLYt6jEVGICoBJTiakDBEAlphJTB/5BB0ZDB416BeO3qdD5ge8qub3IZE1zheHMaNQrQrud/G514LtR1h/x0gCrpmUWIHl9Xhim0vT4dWrsGobtYqWLhGG6mM4Ls7RTX4Zdeq6y/j3ij74BPyz8OEl2g1kAAAAASUVORK5CYII="};
  window.dolMapIcon = function (k) {
    var u = (window.DOL_MAP_ICONS || {})[k];
    if (!u) return '';
    return '<img class="icon" alt="" src="' + u + '" style="width:auto;height:30px;max-width:34px;vertical-align:middle;margin:0 4px 0 0;border:0;border-radius:0;background:none">';
  };
  /* ===== 小镇地点网络（只能走到相邻地点） ===== */
  window.DOL_TOWN_ARROW = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAA20lEQVR42u3asQ3CMBAF0IAYgIIhmIApMgvDMAtTMAFDULAB1HGBdXLOQfL7bRQFPd19CdnTJCIjZ5f9gdft/Gl5/3R9pv7G/egTAGB0gEPvDx4v88/n78fdBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsH6qZ++t5/v/lvK+gRUAoANiKTuhdt7fO+X9gtodIysAQAe0ZetOiO68CQAAYN0OiP53iHZE7d5g611iKwBAB+Qm2gnZO28CAADo2wHRTsjeeRMAAMC2HVDrhOydNwEAACzyBXoWL3N8dZ5lAAAAAElFTkSuQmCC';
  window.DOL_TOWN = {
    harvest:  { n: '丰收街', icon: 'harvest', d: '这里有卖农产品的店铺，也有条路直通镇外。',
                to: [['market', 2], ['inn', 1]], acts: [] },
    market:   { n: '市场', icon: 'market', d: '摊位挤在路两边，讨价声一直没停。',
                to: [['harvest', 2], ['smith', 2], ['plaza', 1]], acts: [['打开市场', 'market', 'panel']] },
    smith:    { n: '铁匠铺', icon: 'smith', d: '炉火没熄，铁砧上还留着上一件活。',
                to: [['market', 2], ['guild', 2], ['online', 1]], acts: [['打开铁匠铺', 'smith', 'js']] },
    guild:    { n: '公会', icon: 'guild', d: '木牌上钉着委托单，角落里有人在小声谈价。',
                to: [['smith', 2], ['bank', 2], ['fish', 2]], acts: [['看公告板', 'guild', 'js']] },
    bank:     { n: '银行', icon: 'bank', d: '柜台很高，玻璃后面的人一直没抬头。',
                to: [['guild', 2], ['catshop', 1]], acts: [['查看余额', 'bank', 'js']] },
    inn:      { n: '旅馆', icon: 'inn', d: '楼下是桌子，楼上几间房，老板娘在算账。',
                to: [['harvest', 1], ['plaza', 2], ['merchant', 1]], acts: [['休息一会 (1:00)', 'inn', 'js']] },
    plaza:    { n: '广场', icon: 'plaza', d: '中间一座小喷泉，几条街都从这里过。',
                to: [['market', 1], ['inn', 2], ['online', 2], ['campfire', 1]], acts: [] },
    online:   { n: '联机 · 世界', icon: 'online', d: '这里能和别的玩家连上同一个世界。',
                to: [['smith', 1], ['plaza', 2], ['dungeon', 1], ['catshop', 2]], acts: [['打开联机面板', 'online', 'panel']] },
    catshop:  { n: '猫猫商店', icon: 'catshop', d: '柜台后探出一只猫，盯着你手里的猫猫币。',
                to: [['bank', 1], ['rogue', 1], ['online', 2]], acts: [['进店', 'catshop', 'js'], ['猫猫抽奖', 'lottery', 'panel']] },
    merchant: { n: '地下商人', icon: 'merchant', d: '兜帽压得很低，摊子上摆着看不出用途的东西。',
                to: [['inn', 1], ['campfire', 2]], acts: [['看货', 'DoLOnlineMerchant', 'passage']] },
    campfire: { n: '篝火', icon: 'campfire', d: '火堆还温着，旁边散着些材料和锅。',
                to: [['plaza', 1], ['merchant', 2], ['dungeon', 2]], acts: [['做饭', 'DoLOnlineCampfire', 'passage']] },
    dungeon:  { n: '地下世界', icon: 'dungeon', d: '拱门后的石阶被水浸得发黑，往下什么都看不见。',
                to: [['online', 1], ['campfire', 2], ['fish', 2]], acts: [['进入地下城', 'DoLOnlineDungeonEntry', 'passage']] },
    fish:     { n: '水潭 · 钓鱼', icon: 'fish', d: '水面很静，偶尔有鱼翻上来。',
                to: [['dungeon', 2], ['rogue', 2], ['guild', 2]], acts: [['垂钓', 'DoLOnlineDungeonFish', 'passage']] },
    rogue:    { n: '深渊回廊', icon: 'rogue', d: '越往前走，墙壁越像在呼吸。',
                to: [['catshop', 1], ['fish', 2]], acts: [['进入回廊', 'rogue', 'panel']] }
  };
  function townAt() {
    try { var v = VV(); return (v && v.mpTownAt) || 'harvest'; } catch (e) { return 'harvest'; }
  }
  window.dolTownGo = function (id) {
    try { var v = VV(); if (!v || !window.DOL_TOWN[id]) return; v.mpTownAt = id; } catch (e) {}
  };
  /* ===== 走路随机事件 ===== */
  var TOWN_EVENTS = [
    { id: 'thug', t: '路口的混混',
      text: ['两个混混从巷口挤过来，手一直插在兜里。', '「钱包。」其中一个抬了抬下巴，「不然别想走。」'],
      choices: [
        { label: '把身上的零钱给他', res: '你把口袋里的零钱都掏了出来，他掂了掂，挥手让你走。', rw: { money: [-5, -2], stress: 120, trauma: 40 } },
        { label: '硬顶回去', res: '你顶了两句，换来一记闷拳，最后还是被搜走了几张零钱。', rw: { pain: 140, stress: 260, control: 60, money: [-2, -1] } },
        { label: '转身就跑', res: '你转身冲进巷子深处，跑出一段才敢回头，人没跟上来。', rw: { tiredness: 160, stress: 90 } }
      ] },
    { id: 'drunk', t: '醉汉',
      text: ['一个醉汉靠在墙上，看见你就摇摇晃晃地凑过来。', '酒气混着香水味，他说了句谁也不明白的话。'],
      choices: [
        { label: '推开他自己走', res: '你侧身推开他，他的呼吸擦过你的耳朵。你快步走开。', rw: { arousal: 200, control: 50, stress: 80 } },
        { label: '陪他胡扯两句', res: '你陪他扯了两句，他忽然笑起来，塞给你几枚猫猫币。', rw: { stress: -100, cat: [1, 3], tiredness: 40 } }
      ] },
    { id: 'dog', t: '野狗',
      text: ['一条瘦狗挡在路中间，喉咙里发出低吼。', '它盯着你手里，也在盯着你。'],
      choices: [
        { label: '站着不动，慢慢退开', res: '你缓慢地后退，那条狗一直盯着你，直到你退到路口。', rw: { stress: 140, tiredness: 40 } },
        { label: '扔点吃的过去', res: '你把兜里的零钱换成一块面饼扔过去，狗低头闻了闻。', rw: { money: [-1, -1], stress: -60 } },
        { label: '直接冲过去', res: '你硬冲过去，小腿被咬了一口，血渗出来。', rw: { pain: 110, stress: 140 } }
      ] },
    { id: 'busk', t: '街角的琴声',
      text: ['墙角有人低着头拉琴，曲子慢得像在下雨。', '路过的人都放轻了脚步。'],
      choices: [
        { label: '站着听完', res: '你站在墙角把曲子听完，胸口松了一块。', rw: { stress: -200, trauma: -60 } },
        { label: '放点钱再走', res: '你放了点钱，拉琴的人朝你点了点头。', rw: { money: [-2, -1], stress: -260, trauma: -90 } }
      ] },
    { id: 'beggar', t: '蹲着的乞丐',
      text: ['有人蹲在墙根，面前放着个破碗。', '他没抬头，只是把手伸出来。'],
      choices: [
        { label: '给点钱', res: '你把零钱放进碗里，他低声说了句谢谢。', rw: { money: [-2, -1], stress: -140, trauma: -40 } },
        { label: '当没看见', res: '你绕开那只手走了过去，心里有点发闷。', rw: { stress: 60 } }
      ] },
    { id: 'whisper', t: '暗处的低语',
      text: ['墙后有两个声音在说话，压得很低。', '你只听见「第五层」「别下去」几个词。'],
      choices: [
        { label: '贴着墙再听一会儿', res: '你贴上去，只听到半句，剩下的被自己的心跳盖过去。', rw: { trauma: 160, stress: 120, awareness: 30 } },
        { label: '快点离开这条巷子', res: '你加快脚步走出巷子，背后的声音停了。', rw: { tiredness: 70, stress: 40 } }
      ] },
    { id: 'cat', t: '巷子里的猫',
      text: ['一只猫蹲在台阶上，尾巴缓慢地摆。', '它盯着你，没有跑。'],
      choices: [
        { label: '蹲下摸摸它', res: '它先躲了一下，又主动把头送到你手里，喉咙里滚着呼噜。', rw: { stress: -150, tiredness: -60, cat: [1, 3] } },
        { label: '继续走', res: '你继续往前走，它没有跟上来。', rw: {} }
      ] },
    { id: 'purse', t: '地上的钱袋',
      text: ['路中间有个钱袋，扎口松开了一点，露出里面的纸钞。', '附近没有人。'],
      choices: [
        { label: '捡起来收好', res: '你捡起来塞进兜里，边走边回头看。', rw: { money: [3, 8], stress: 70 } },
        { label: '绕过去', res: '你从钱袋边上绕了过去，没再多看一眼。', rw: { stress: -40 } }
      ] },
    { id: 'flower', t: '墙缝里的花',
      text: ['石墙的裂缝里开了一朵小花，白得有点不真实。', '底下是烂泥，它还是开了。'],
      choices: [
        { label: '看一会儿', res: '你蹲下来看了会儿那朵花，起身时肩膀轻了。', rw: { stress: -180, trauma: -40 } }
      ] },
    { id: 'shadow', t: '身后的脚步',
      text: ['你停下，脚步也停了。', '回头，只有一段空巷子和一盏忽明忽暗的灯。'],
      choices: [
        { label: '加快脚步', res: '你加快脚步，拐过两个弯才把那点凉意甩掉。', rw: { stress: 120, tiredness: 60 } },
        { label: '站在原地等', res: '你站着没动，直到灯再闪一下，才确认后面没有人。', rw: { stress: 200, awareness: 20 } }
      ] }
  ];
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  window.dolTownRollEvent = function () {
    try {
      var v = VV(); if (!v) return;
      var last = Number(v.mpTownEvAt) || 0;
      var p = 0.2;
      if (Date.now() - last > 120000) p = 0.45;
      if (Math.random() > p) return;
      var e = TOWN_EVENTS[Math.floor(Math.random() * TOWN_EVENTS.length)];
      v.mpTownEv = e.id;
      v.mpTownEvAt = Date.now();
    } catch (e) {}
  };
  var EV_LABEL = { pain: '疼痛', stress: '压力', trauma: '创伤', control: '自控', arousal: '性奋',
    tiredness: '疲劳', awareness: '觉察', hp: '体力', money: '£', cat: '猫猫币', ore: '矿石', potion: '药水', exp: '经验' };
  function addStat(v, k, n) {
    var cur = Number(v[k]) || 0;
    var val = cur + n;
    if (k === 'pain') val = Math.max(0, Math.min(100, val));
    else if (k === 'stress') val = Math.max(0, Math.min(Number(v.stressmax) || 10000, val));
    else if (k === 'trauma') val = Math.max(0, Math.min(Number(v.traumamax) || 5000, val));
    else if (k === 'control') val = Math.max(0, Math.min(Number(v.controlmax) || 1000, val));
    else if (k === 'arousal') val = Math.max(0, Math.min(Number(v.arousalmax) || 10000, val));
    else if (k === 'tiredness') val = Math.max(0, Math.min(1000, val));
    else if (k === 'awareness') val = Math.max(0, Math.min(1000, val));
    v[k] = val;
  }
  function applyTownEvent(e) {
    try {
      var v = VV(); if (!v || !e || !e.rw) return;
      var got = [];
      Object.keys(e.rw).forEach(function (k) {
        var r = e.rw[k];
        var n;
        if (Array.isArray(r)) n = rnd(r[0], r[1]);
        else n = Number(r) || 0;
        if (k === 'cat') { v.mpCat = Math.max(0, (Number(v.mpCat) || 0) + n); }
        else if (k === 'ore') { try { var m = mats(); m.ore = Math.max(0, (Number(m.ore) || 0) + n); } catch (err) {} }
        else if (k === 'money') { v.money = Math.max(0, (Number(v.money) || 0) + n * 100); }
        else if (k === 'hp') { v.dgHp = Math.max(0, (Number(v.dgHp) || 100) + n); }
        else if (k === 'potion') { try { window.dolDgAdd && window.dolDgAdd('potion_small', n); } catch (err) {} }
        else if (k === 'exp') { try { window.dolGainExp && window.dolGainExp(n); } catch (err) {} }
        else {
          if (k === 'pain') n = Math.round(n / 20);
          else n = Math.round(n * 0.5);
          if (!n) n = (Number(e.rw[k]) >= 0 ? 1 : -1);
          addStat(v, k, n);
        }
        var lbl = EV_LABEL[k] || k;
        if (k === 'money') got.push('£' + (n > 0 ? '+' : '') + n);
        else got.push(lbl + ' ' + (n > 0 ? '+' : '') + n);
      });
      try { renderCatBalance(); renderExpBar(); } catch (err) {}
      window.__dolTownEvGot = got.join('，');
    } catch (err) {}
  }
  function signOf(n, isMoney) {
    var a = Math.abs(Number(n) || 0);
    var lv;
    if (isMoney) lv = a < 5 ? 1 : (a < 15 ? 2 : 3);
    else lv = a < 80 ? 1 : (a < 200 ? 2 : 3);
    return (Number(n) > 0 ? '+' : '-').repeat(lv);
  }
  function effectsText(rw) {
    var out = [];
    Object.keys(rw || {}).forEach(function (k) {
      var r = rw[k];
      var n = Array.isArray(r) ? (Math.abs(r[0]) > Math.abs(r[1]) ? r[0] : r[1]) : r;
      var lbl = EV_LABEL[k] || k;
      var isMoney = (k === 'money');
      out.push('<span style="color:' + (Number(n) > 0 ? '#7ec0ff' : '#e07070') + '">' + lbl + ' ' + signOf(n, isMoney) + '</span>');
    });
    return out.join('　');
  }
  window.dolTownEvHtml = function () {
    var v = VV() || {};
    if (!v.mpTownEv) return '';
    var e = TOWN_EVENTS.filter(function (x) { return x.id === v.mpTownEv; })[0];
    if (!e) { v.mpTownEv = ''; return ''; }
    var h = '<div style="line-height:1.9">';
    (e.text || []).forEach(function (p) { h += '<div style="margin-bottom:10px;color:#e6e0d8">' + p + '</div>'; });
    h += '</div><div style="margin-top:14px">';
    (e.choices || []).forEach(function (c, i) {
      h += '<div style="margin:8px 0"><span style="color:#9ac7ff;cursor:pointer;font-size:16px" ' +
        'onclick="window.dolTownChoose(' + i + ');return false">(' + (i + 1) + ') ' + c.label + '</span></div>';
    });
    h += '</div>';
    return h;
  };
  window.dolTownChoose = function (i) {
    try {
      var v = VV(); if (!v || !v.mpTownEv) return;
      var e = TOWN_EVENTS.filter(function (x) { return x.id === v.mpTownEv; })[0];
      if (!e) { v.mpTownEv = ''; return; }
      var c = (e.choices || [])[i];
      if (!c) return;
      applyTownEvent({ rw: c.rw });
      v.mpTownEv = '';
      v.mpTownEvRes = (e.text || []).join('\u0002') + '\u0001' + (c.res || '') + '\u0001' + effectsText(c.rw || {});
      var E = window.SugarCube && window.SugarCube.Engine;
      if (E) E.play('DoLOnlineDungeonGate');
    } catch (err) {}
  };
  window.dolTownResHtml = function () {
    var v = VV() || {};
    if (!v.mpTownEvRes) return '';
    var parts = String(v.mpTownEvRes).split('\u0001');
    var pre = (parts[0] || '').split('\u0002');
    var res = parts[1] || '', ef = parts[2] || '';
    var html = '<div style="line-height:1.9">';
    pre.forEach(function (p) { if (p) html += '<div style="margin-bottom:10px;color:#e6e0d8">' + p + '</div>'; });
    if (res) html += '<div style="margin-bottom:10px;color:#e6e0d8">' + res +
      (ef ? ' <span style="color:#6a6a72">|</span> ' + ef : '') + '</div>';
    html += '</div><div style="margin-top:16px"><span style="color:#9ac7ff;cursor:pointer;font-size:16px" ' +
      'onclick="window.dolTownResDone();return false">(1) 继续</span></div>';
    return html;
  };
  window.dolTownResDone = function () {
    try {
      var v = VV(); if (v) v.mpTownEvRes = '';
      var E = window.SugarCube && window.SugarCube.Engine;
      if (E) E.play('DoLOnlineDungeonGate');
    } catch (e) {}
  };
  window.dolTownMapClick = function (id) {
    try {
      var cur = townAt(), n = window.DOL_TOWN[cur] || window.DOL_TOWN.harvest;
      var m = null;
      (n.to || []).forEach(function (t) { if (t[0] === id) m = t[1]; });
      if (m == null) { showToast('不能直接走到那里，先从附近地点过去'); return; }
      window.dolTownWalk(id, m, false);
    } catch (e) {}
  };
  window.dolTownWalk = function (id, min, ext) {
    try {
      var _v0 = VV();
      if (_v0 && _v0.mpTownEv) { showToast('先把眼前的事处理掉'); return; }
      if (!ext && window.DOL_TOWN[id]) { var v = VV(); if (v) v.mpTownAt = id; }
      var m = Number(min) || 0;
      if (m > 0) { try { if (typeof passTime === 'function') passTime(m, 'min'); } catch (e) {} }
      if (!ext) { try { window.dolTownRollEvent(); } catch (e) {} }
      var E = window.SugarCube && window.SugarCube.Engine;
      if (E) E.play(ext ? 'Harvest Street' : 'DoLOnlineDungeonGate');
    } catch (e) {}
  };
  /* ===== 旅馆 / 银行 / 公会 ===== */
  function townModal(title, bodyHtml) {
    try {
      var old = document.getElementById('dol-town-modal');
      if (old) old.remove();
      var ov = document.createElement('div');
      ov.id = 'dol-town-modal';
      ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483660;background:rgba(6,7,10,.82);display:flex;align-items:center;justify-content:center;padding:16px';
      var box = document.createElement('div');
      box.style.cssText = 'width:min(92vw,360px);max-height:80vh;overflow:auto;background:#14161c;border:1px solid #6a5a3a;border-radius:12px;padding:14px;color:#ddd;font:14px/1.6 sans-serif';
      box.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<b style="flex:1;color:#e8c97a">' + title + '</b>' +
        '<button id="dol-town-modal-x" style="padding:4px 10px;background:#2a2028;color:#e0a0b0;border:1px solid #5a3a4a;border-radius:6px">关闭</button></div>' +
        '<div id="dol-town-modal-body">' + bodyHtml + '</div>';
      ov.appendChild(box);
      (document.documentElement || document.body).appendChild(ov);
      box.querySelector('#dol-town-modal-x').onclick = function () { ov.remove(); };
      ov.addEventListener('click', function (ev) { if (ev.target === ov) ov.remove(); });
      return box.querySelector('#dol-town-modal-body');
    } catch (e) { return null; }
  }
  function btnHtml(id, text, col) {
    return '<button id="' + id + '" style="padding:8px 12px;margin:4px 4px 0 0;background:' + (col || '#2a2a34') + ';color:#e8e4dc;border:1px solid #4a4a56;border-radius:8px;font-size:13px">' + text + '</button>';
  }
  function bankState() {
    var v = VV() || {};
    var amt = Number(v.mpBank) || 0;
    var d0 = Number(v.mpBankDay) || 0;
    var days = 0;
    try { days = Math.max(0, (Time.days || 0) - d0); } catch (e) {}
    return { amt: amt, days: days, interest: Math.floor(amt * 0.01 * Math.min(days, 60)) };
  }
  window.dolBankOpen = function () {
    var b = townModal('银行', '');
    if (!b) return;
    function render() {
      var v = VV() || {}; var st = bankState();
      b.innerHTML = '<div style="font-size:13px;color:#c8c2ba">猫猫币：<b style="color:#e8c97a">' + (Number(v.mpCat) || 0) + '</b></div>' +
        '<div style="font-size:13px;color:#c8c2ba">存款：<b style="color:#e8c97a">' + st.amt + '</b>　存了 ' + st.days + ' 天</div>' +
        '<div style="font-size:13px;color:#c8c2ba">利息（每天 1%，上限 60 天）：<b style="color:#7ec98a">' + st.interest + '</b></div>' +
        '<div style="margin-top:8px">' + btnHtml('bank-in100', '存入 100') + btnHtml('bank-inall', '全部存入') +
        btnHtml('bank-out', '本息取回', '#2c3a2c') + '</div>';
      b.querySelector('#bank-in100').onclick = function () { deposit(100); };
      b.querySelector('#bank-inall').onclick = function () { deposit(Infinity); };
      b.querySelector('#bank-out').onclick = function () { withdraw(); };
    }
    function day0() { var v = VV(); if (!v) return 0; if (!Number(v.mpBankDay)) { try { v.mpBankDay = Time.days || 0; } catch (e) { v.mpBankDay = 0; } } return v.mpBankDay; }
    function deposit(n) {
      var v = VV(); if (!v) return;
      var cat = Number(v.mpCat) || 0;
      var amt = n === Infinity ? cat : Math.min(n, cat);
      if (amt <= 0) { showToast('没有猫猫币'); return; }
      day0();
      v.mpCat = cat - amt;
      v.mpBank = (Number(v.mpBank) || 0) + amt;
      showToast('存入 ' + amt + ' 猫猫币');
      try { renderCatBalance(); } catch (e) {}
      render();
    }
    function withdraw() {
      var v = VV(); if (!v) return;
      var st = bankState();
      if (!st.amt) { showToast('没有存款'); return; }
      v.mpCat = (Number(v.mpCat) || 0) + st.amt + st.interest;
      showToast('取回 ' + (st.amt + st.interest) + ' 猫猫币（利息 ' + st.interest + '）');
      v.mpBank = 0; v.mpBankDay = 0;
      try { renderCatBalance(); } catch (e) {}
      render();
    }
    render();
  };
  var GUILD_TASKS = [
    { id: 'floor5',  n: '抵达地下城第 5 层',   need: 5,    rw: { money: 5000 },  get: function (v) { return Number(v.dgFloor) || 0; } },
    { id: 'floor10', n: '抵达地下城第 10 层',  need: 10,   rw: { money: 20000 }, get: function (v) { return Number(v.dgFloor) || 0; } },
    { id: 'boss1',   n: '击败 1 位层主',       need: 1,    rw: { cat: 120 },     get: function (v) { return Number(v.mpBossKills) || 0; } },
    { id: 'cat1k',   n: '持有 1000 猫猫币',    need: 1000, rw: { money: 10000 }, get: function (v) { return Number(v.mpCat) || 0; } },
    { id: 'codex10', n: '收集 10 件装备图鉴',  need: 10,   rw: { money: 15000 }, get: function (v) { try { return Object.keys((v.mpCodex || {}).equip || {}).length; } catch (e) { return 0; } } },
    { id: 'bank',    n: '在银行存入 500 猫猫币', need: 500, rw: { money: 8000 },  get: function (v) { return Number(v.mpBank) || 0; } }
  ];
  window.dolGuildOpen = function () {
    var b = townModal('公会 · 委托', '');
    if (!b) return;
    function render() {
      var v = VV() || {};
      if (!v.mpGuildDone || typeof v.mpGuildDone !== 'object') v.mpGuildDone = {};
      var h = '<div style="font-size:12px;color:#8a8a92;margin-bottom:6px">完成委托领奖励，每项只能领一次</div>';
      GUILD_TASKS.forEach(function (t) {
        var cur = t.get(v), done = !!v.mpGuildDone[t.id];
        var ok = cur >= t.need;
        var rw = [];
        if (t.rw.money) rw.push('£' + (t.rw.money / 100).toFixed(0));
        if (t.rw.cat) rw.push('猫猫币 ' + t.rw.cat);
        h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #222">' +
          '<span style="flex:1;font-size:13px;color:' + (done ? '#5a5a62' : '#ddd') + '">' + t.n +
          '<span style="color:#8a8a92;font-size:11px"> ' + Math.min(cur, t.need) + '/' + t.need + '</span>' +
          '<span style="color:#7ec98a;font-size:11px"> · ' + rw.join(' / ') + '</span></span>' +
          (done ? '<span style="font-size:11px;color:#5a5a62">已领</span>'
                : (ok ? '<button data-claim="' + t.id + '" style="padding:5px 10px;background:#2c3a2c;color:#b8f0c0;border:1px solid #3a5a3a;border-radius:6px;font-size:12px">领取</button>'
                      : '<span style="font-size:11px;color:#6a6a72">未完成</span>')) +
          '</div>';
      });
      b.innerHTML = h;
      b.querySelectorAll('[data-claim]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-claim'), vv = VV();
          var t = GUILD_TASKS.filter(function (x) { return x.id === id; })[0];
          if (!t || !vv || vv.mpGuildDone[id]) return;
          if (t.get(vv) < t.need) { showToast('还没完成'); return; }
          if (t.rw.money) vv.money = (Number(vv.money) || 0) + t.rw.money;
          if (t.rw.cat) vv.mpCat = (Number(vv.mpCat) || 0) + t.rw.cat;
          vv.mpGuildDone[id] = 1;
          showToast('委托完成：' + t.n);
          try { renderCatBalance(); renderExpBar(); } catch (e) {}
          render();
        };
      });
    }
    render();
  };
  window.dolInnRest = function () {
    try {
      var v = VV(); if (!v) return;
      if ((Number(v.money) || 0) < 30000) { showToast('住一晚要 £300，钱不够'); return; }
      v.money = Number(v.money) - 30000;
      v.pain = Math.max(0, (Number(v.pain) || 0) * 0.6);
      v.stress = Math.max(0, (Number(v.stress) || 0) * 0.55);
      v.trauma = Math.max(0, (Number(v.trauma) || 0) * 0.8);
      v.arousal = Math.max(0, (Number(v.arousal) || 0) * 0.25);
      v.tiredness = Math.max(0, (Number(v.tiredness) || 0) * 0.4);
      try { if (typeof passTime === 'function') passTime(60, 'min'); } catch (e) {}
      showToast('休息了一小时：疼痛 -40%，压力 -45%，创伤 -20%，性奋 -75%，疲劳 -60%');
      try { renderExpBar(); } catch (e) {}
      // 立刻刷新页面，让顶部时间/状态跟原版一样马上变
      try {
        var SC = window.SugarCube;
        var cur = SC && SC.State && SC.State.passage;
        if (cur) setTimeout(function () { try { SC.Engine.play(cur); } catch (e) {} }, 80);
      } catch (e) {}
    } catch (e) {}
  };
  window.dolTownAct = function (key, kind) {
    try {
      var E = window.SugarCube && window.SugarCube.Engine;
      if (kind === 'passage') { if (E) E.play(key); return; }
      if (kind === 'js') {
        if (key === 'bank') { window.dolBankOpen(); return; }
        if (key === 'inn') { window.dolInnRest(); return; }
        if (key === 'guild') { window.dolGuildOpen(); return; }
        if (key === 'smith') { window.dolSmithOpen(); return; }
        if (key === 'catshop') {
          try { var vv = VV(); if (vv) vv.mpShopTown = 1; } catch (e) {}
          if (E) E.play('DoLOnlineCatShop');
          return;
        }
        return;
      }
      window.dolMapGo(key);
    } catch (e) {}
  };
  window.dolTownPageHtml = function () {
    var id = townAt(), n = window.DOL_TOWN[id] || window.DOL_TOWN.harvest;
    var linkStyle = 'display:inline-block;color:#9ac7ff;text-decoration:none;padding:2px 0;font-size:16px;line-height:1.5';
    var icon = function (k) { return window.dolMapIcon(k); };
    var _vv = VV() || {};
    if (_vv.mpTownEvRes) {
      return '<div class="dol-town-page">' + window.dolTownResHtml() + '</div>';
    }
    if (_vv.mpTownEv) {
      return '<div class="dol-town-page">' + window.dolTownEvHtml() + '</div>';
    }
    var h = '<div class="dol-town-page"><div class="lbl">你现在在</div>' +
      '<h3 style="color:#e8c97a;margin:2px 0 6px">' + n.n + '</h3>' +
      '<div style="color:#c8c2ba">' + n.d + '</div>';
    h += '<div class="lbl">可访问地点</div>';
    var i = 0;
    (n.to || []).forEach(function (t) {
      var m = window.DOL_TOWN[t[0]]; if (!m) return;
      i++;
      h += icon(m.icon) + '<span class="dol-town-link" style="' + linkStyle + 'cursor:pointer" ' +
        'onclick="window.dolTownWalk(\'' + t[0] + '\',' + t[1] + ',false);return false">(' +
        i + ') ' + m.n + ' (0:0' + t[1] + ')</span><br>';
    });
    if ((n.acts || []).length) {
      h += '<div class="lbl">这里可以做的事</div>';
      var j = 0;
      n.acts.forEach(function (a) {
        j++;
        h += icon(n.icon) + '<span class="dol-town-link" style="' + linkStyle + 'cursor:pointer" ' +
          'onclick="window.dolTownAct(\'' + a[1] + '\',\'' + a[2] + '\');return false">(' +
          j + ') ' + a[0] + '</span><br>';
      });
    }
    h += '<div class="lbl">道路</div>' + icon('harvest') +
      '<span class="dol-town-link" style="' + linkStyle + 'cursor:pointer" ' +
      'onclick="window.dolTownWalk(\'harvest\',2,true);return false">回到外面 · 丰收街 (0:02)</span>';
    h += '<div class="lbl" style="margin-top:12px">地下地图</div>' + window.dolTownMapHtml() + '</div>';
    return h;
  };
  var TOWN_MAP_B64 = 'data:image/png;base64,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';
  window.dolTownMapHtml = function (opts) {
    var spots = {"harvest": [12.5, 22.14], "market": [31.07, 22.14], "smith": [49.64, 22.14], "guild": [68.21, 22.14], "bank": [86.79, 22.14], "inn": [12.5, 53.57], "plaza": [31.07, 53.57], "online": [49.64, 53.57], "catshop": [86.79, 53.57], "merchant": [12.5, 85.0], "campfire": [31.07, 85.0], "dungeon": [49.64, 85.0], "fish": [68.21, 85.0], "rogue": [86.79, 85.0]};
    var out = '<div class="dol-townmap-wrap" style="position:relative;display:block;width:100%;max-width:820px;margin:0 auto;line-height:0">' +
      '<img src="' + TOWN_MAP_B64 + '" style="width:100%;height:auto;display:block">';
    var keys = Object.keys(spots);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], t = spots[k];
      out += '<span class="dol-map-hot" style="position:absolute;left:' + (t[0] - 8) + '%;top:' + (t[1] - 13) +
        '%;width:16%;height:26%;display:block;background:transparent;border:0;cursor:pointer" ' +
        'onclick="window.dolTownMapClick(\'' + k + '\');return false"></span>';
    }
    var at = 'harvest';
    try { at = townAt(); } catch (e) {}
    if (spots[at]) {
      out += '<img class="dol-town-arrow" alt="" src="' + window.DOL_TOWN_ARROW + '" style="position:absolute;left:' + spots[at][0] +
        '%;top:' + (spots[at][1] - 15) + '%;width:7%;height:auto;pointer-events:none;transform:translateX(-50%)">';
    }
    out += '</div>';
    return out;
  };
  // 把我们的地图放到原版小镇地图（#divmap）的位置上。
  // 只隐藏 #divmap 里的地图图片，绝不动整个容器——入口链接等也可能在里头
  function installTownMapInPlace() {
    try {
      var divmap = document.getElementById('divmap');
      var existing = document.getElementById('dol-townmap-inplace');
      if (!divmap) { if (existing) existing.remove(); return; }
      if (existing && existing.parentNode === divmap && existing.__forPassage === ((window.State && window.State.passage) || '')) return;
      if (existing) existing.remove();
      var imgs = divmap.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) imgs[i].style.display = 'none';
      var wrap = document.createElement('div');
      wrap.id = 'dol-townmap-inplace';
      wrap.__forPassage = (window.State && window.State.passage) || '';
      wrap.innerHTML = window.dolTownMapHtml();
      divmap.insertBefore(wrap, divmap.firstChild);
      var tg = document.createElement('div');
      tg.style.cssText = 'font-size:11px;color:#8a8a8a;line-height:1.6;margin:2px 0 6px';
      tg.innerHTML = '<a href="javascript:void 0" id="dol-map-toggle" style="color:#9ac7ff">显示/隐藏原版地图</a>';
      wrap.parentNode.insertBefore(tg, wrap.nextSibling);
      var btn = document.getElementById('dol-map-toggle');
      if (btn) btn.onclick = function (ev) {
        if (ev) ev.preventDefault();
        var show = (imgs[0] && imgs[0].style.display === 'none');
        for (var m = 0; m < imgs.length; m++) imgs[m].style.display = show ? '' : 'none';
        wrap.style.display = show ? 'none' : 'block';
      };
    } catch (e) {}
  }
  function bindMapHotspots() {
    if (window.__dolMapBound) return;
    window.__dolMapBound = 1;
    document.addEventListener('click', function (ev) {
      var a = ev.target;
      var hit = null;
      while (a && a !== document) {
        if (a.getAttribute) {
          if (a.getAttribute('data-dolmap')) { hit = ['map', a]; break; }
          if (a.getAttribute('data-townwalk')) { hit = ['walk', a]; break; }
          if (a.getAttribute('data-townact')) { hit = ['act', a]; break; }
          if (a.getAttribute('data-townext')) { hit = ['ext', a]; break; }
        }
        a = a.parentNode;
      }
      if (!hit) return;
      ev.preventDefault();
      var el = hit[1];
      if (hit[0] === 'map') window.dolMapGo(el.getAttribute('data-dolmap'));
      else if (hit[0] === 'walk') window.dolTownWalk(el.getAttribute('data-townwalk'), el.getAttribute('data-min'), false);
      else if (hit[0] === 'act') window.dolTownAct(el.getAttribute('data-townact'), el.getAttribute('data-kind'));
      else window.dolTownWalk('harvest', 2, true);
    }, true);
  }
  function openTownMap() {
    try {
      var old = document.getElementById('dol-townmap');
      if (old) old.remove();
      var ov = document.createElement('div');
      ov.id = 'dol-townmap';
      ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483660;background:#0b0d11;display:flex;flex-direction:column;font:14px/1.5 sans-serif';
      var head = document.createElement('div');
      head.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #2a2a30';
      head.innerHTML = '<span style="flex:1;font-size:12px;color:#8a8a8a">小镇地图 · 双指/滑动查看</span>' +
        '<button id="dol-townmap-zoom" style="padding:6px 10px;background:#20242e;color:#9ac7ff;border:1px solid #2a2a30;border-radius:6px;font-size:12px">放大</button>' +
        '<button id="dol-townmap-close" style="padding:6px 12px;background:#2a2028;color:#e0a0b0;border:1px solid #5a3a4a;border-radius:6px;font-size:12px">关闭</button>';
      var body = document.createElement('div');
      body.id = 'dol-townmap-body';
      body.style.cssText = 'flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px;text-align:center';
      var im = document.createElement('img');
      im.src = 'img/dol-town-map.png';
      im.style.cssText = 'width:100%;max-width:100%;height:auto;border-radius:8px;border:1px solid #2a2a30';
      body.appendChild(im);
      ov.appendChild(head); ov.appendChild(body);
      (document.documentElement || document.body).appendChild(ov);
      var big = false;
      document.getElementById('dol-townmap-zoom').onclick = function () {
        big = !big;
        im.style.width = big ? '190%' : '100%';
        im.style.maxWidth = big ? 'none' : '100%';
        this.textContent = big ? '缩小' : '放大';
      };
      document.getElementById('dol-townmap-close').onclick = function () { try { ov.remove(); } catch (e) {} };
      ov.addEventListener('click', function (ev) { if (ev.target === ov) try { ov.remove(); } catch (e) {} });
    } catch (e) { showToast('地图打开失败：' + (e && e.message ? e.message : '')); }
  }
  function openMirrorFull() {
    try {
      var src = document.querySelector('#dol-mirror .mirror-content');
      if (!src) return;
      var old = document.getElementById('dol-mirror-full');
      if (old) old.remove();
      var ov = document.createElement('div');
      ov.id = 'dol-mirror-full';
      ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483660;background:#0b0d11;color:#ddd;display:flex;flex-direction:column;font:14px/1.5 sans-serif';
      var head = document.createElement('div');
      head.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #2a2a30';
      head.innerHTML = '<span id="dol-mirror-full-title" style="flex:1;font-size:12px;color:#8a8a8a">屏幕镜像 · 放大（上下滑动）</span>' +
        '<button id="dol-mirror-full-close" style="padding:6px 14px;background:#2a2028;color:#e0a0b0;border:1px solid #5a3a4a;border-radius:6px;font-size:13px">关闭</button>';
      var body = document.createElement('div');
      body.id = 'dol-mirror-full-body';
      body.style.cssText = 'flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:10px;font-size:14px;line-height:1.45;word-break:break-word';
      body.innerHTML = src.innerHTML;
      ov.appendChild(head); ov.appendChild(body);
      (document.documentElement || document.body).appendChild(ov);
      var fab = document.createElement('div');
      fab.id = 'dol-mirror-full-x';
      fab.textContent = '✕ 退出';
      fab.style.cssText = 'position:fixed;right:12px;bottom:90px;z-index:2147483665;padding:11px 18px;background:#2a2028;' +
        'color:#f0c0d0;border:1px solid #7a4a5a;border-radius:24px;font:14px/1 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.65);user-select:none';
      (document.documentElement || document.body).appendChild(fab);
      var closeFull = function () {
        try { ov.remove(); } catch (e) { ov.style.display = 'none'; }
        try { fab.remove(); } catch (e) { fab.style.display = 'none'; }
        window.__dolMirrorFullOpen = 0;
      };
      try {
        var tt = document.getElementById('dol-mirror-full-title');
        var cur = document.querySelector('#dol-mirror .mirror-head-name');
        if (tt && cur) tt.textContent = '屏幕镜像 · ' + cur.textContent + '（上下滑动）';
      } catch (e) {}
      var cb = document.getElementById('dol-mirror-full-close');
      if (cb) cb.onclick = closeFull;
      fab.onclick = closeFull;
      ov.addEventListener('click', function (ev) { if (ev.target === ov) closeFull(); });
      try { document.addEventListener('keydown', function (e3) { if (e3.key === 'Escape' || e3.keyCode === 27) closeFull(); }); } catch (e) {}
      window.__dolMirrorFullOpen = 1;
    } catch (e) { showToast('放大失败：' + (e && e.message ? e.message : '')); }
  }
  function startScreenSync() {
    stopScreenSync();
    screenTimer = setInterval(function () {
      try {
        if (!ws || ws.readyState !== 1 || !TOKEN || !worldId) return;
        // 只有面板开着（有人在看镜像）才上传画面，省流量、降延迟
        try {
          var _pnl = document.getElementById('dolonline-panel');
          if (!_pnl || !_pnl.classList.contains('open')) return;
          var _mb = document.getElementById('dol-mirror');
          if (!_mb) return;
        } catch (e) { return; }
        var host = document.getElementById('passages') || document.getElementById('passage') ||
          document.querySelector('.passage') || document.getElementById('story') || document.body;
        var html = (host && host.innerHTML) ? host.innerHTML : '';
        if (!html) return;
        html = html.replace(/src="data:image\/[^"]{30000,}"/g, 'src="" data-big="1"');
        if (html.length > 90000) html = html.slice(0, 90000);
        // 把 body 上的浮层（别的 mod 的面板、气泡、特效层）也带上，这样能看到对方装 mod 后的画面
        var layers = '';
        try {
          var kids = document.body.children;
          for (var i = 0; i < kids.length; i++) {
            var e2 = kids[i];
            if (!e2 || e2.nodeType !== 1) continue;
            var id2 = e2.id || '';
            if (/^dol/i.test(id2)) continue;                       // 自家 UI 不发，避免镜像套镜像
            if (id2 === 'passages' || id2 === 'passage' || id2 === 'story' || id2 === 'sidebar') continue;
            if (e2.querySelector && e2.querySelector('#dol-mirror')) continue;
            var cs = getComputedStyle(e2);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
            if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
            var rr = e2.getBoundingClientRect();
            if (rr.width < 8 || rr.height < 8) continue;
            layers += '<div style="position:absolute;left:' + Math.round(rr.left) + 'px;top:' + Math.round(rr.top) +
              'px;width:' + Math.max(8, Math.round(rr.width)) + 'px;pointer-events:none">' + e2.outerHTML + '</div>';
            if (layers.length > 90000) break;
          }
        } catch (e) {}
        if (layers) {
          html += '<div style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9">' + layers + '</div>';
        }
        var bgc = '';
        try { bgc = getComputedStyle(document.body).backgroundColor || ''; } catch (e) {}
        if (bgc && bgc !== 'rgba(0, 0, 0, 0)' && bgc !== 'transparent') {
          html = '<div style="position:absolute;left:0;top:0;width:100%;height:100%;background:' + bgc + ';z-index:-1"></div>' + html;
        }
        if (html.length > 190000) html = html.slice(0, 190000);
        var st = window.SugarCube && window.SugarCube.State;
        var psg = (st && st.active && st.active.title) || '';
        ws.send(JSON.stringify({ type: 'screen', passage: psg, html: html }));
      } catch (e) {}
    }, 8000);
  }
  function stopScreenSync() { if (screenTimer) { clearInterval(screenTimer); screenTimer = null; } }
  function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function dclone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } }
  function normalizeTransformParts(v) { return v; }
  function dolUnlockAch(id) { try { unlockAch(id); } catch (e) {} }
  function captureScreen() { /* 设备不支持截图 */ }
  function setupNativeCombat() { /* 原生战斗对接已停用 */ }
  function enhanceNativeCombat() { /* 同上 */ }
  function sendCombatSnapshot() { /* 同上 */ }
  function sendCombatTurn() { /* 同上 */ }
  function hookMultiCanvas() { /* 同上 */ }
  function renderMapMarkers() {
    try {
      var old = document.querySelectorAll('.dolonline-map-marker');
      for (var i = 0; i < old.length; i++) { try { old[i].remove(); } catch (e) {} }
      var svg = null, svgs = document.querySelectorAll('svg');
      for (var si = 0; si < svgs.length && !svg; si++) {
        var imgs = svgs[si].querySelectorAll('image');
        for (var j = 0; j < imgs.length; j++) {
          var href = imgs[j].getAttribute('xlink:href') || imgs[j].getAttribute('href') || '';
          if (/map/i.test(href)) { svg = svgs[si]; break; }
        }
      }
      if (!svg) return;
      var NS = 'http://www.w3.org/2000/svg';
      var src = globalPresence;
      var names = Object.keys(src);
      var perLoc = {};
      for (var k = 0; k < names.length; k++) {
        var u = names[k];
        if (u === USERNAME) continue;
        var pl = src[u];
        if (!pl || !pl.mapLocation) continue;
        var c = MAP_COORDS[pl.mapLocation];
        if (!c) continue;
        var n = (perLoc[pl.mapLocation] = (perLoc[pl.mapLocation] || 0) + 1);
        var g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'dolonline-map-marker');
        g.style.pointerEvents = 'none';
        var cx = c[0] + 15, cy = c[1] + 17 - (n - 1) * 11;
        var circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', '7'); circle.setAttribute('fill', '#ff5c5c');
        circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '1.5');
        g.appendChild(circle);
        var text = document.createElementNS(NS, 'text');
        text.setAttribute('x', String(cx)); text.setAttribute('y', String(cy + 3));
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '8');
        text.setAttribute('fill', '#fff'); text.setAttribute('font-weight', 'bold');
        text.textContent = u.slice(0, 2);
        g.appendChild(text);
        svg.appendChild(g);
      }
    } catch (e) {}
  }

  function openAddPointsRefresh() {
    try {
      // 只在面板已经打开时刷新，避免打怪后自动弹窗
      var box = document.getElementById('dol-addpoints');
      if (box || window.__dolAddPointsOpen) openAddPoints();
    } catch (e) {}
  }
  function dgNext() {
    var v = VV(); if (!v) return;
    var m = dgEnsure();
    var fl = m.floor || 1;
    if (fl % 5 === 0) {
      v.money = (Number(v.money) || 0) + 50000;
      try { gainExp(200); } catch (e) {}
      showToast('击败本段层主！+£500.00');
      v.dgHp = Math.min(window.dolStaminaMax ? dolStaminaMax() : 100, (Number(v.dgHp) || 100) + 40);
    }
    var gotPt = 0;
    if (fl % 5 === 0) { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + 1); gotPt = 1; }
    else if (Math.random() < 0.2) { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + 1); gotPt = 1; }
    var next = fl + 1;
    v.dgMap = dgGen(next);
    dgReveal(v.dgMap);
    showToast('进入第 ' + next + ' 层' + (gotPt ? '（技能点 +1）' : ''));
    dgRender();
  }

  function dgEnter() {
    var v = VV(); if (!v) return;
    v.dgMap = dgGen(1);
    v.dgHp = 100;
    v.dgMana = 100;
    window.__dolInDungeon = true;
    dgRender();
    showToast(' 进入地下城（第 1 层，地图随机）');
  }


  /* ===== 发放道具 ===== */
  function hookActionClicks() {
    try {
      if (hookActionClicks.__bound) return;
      hookActionClicks.__bound = true;
      document.addEventListener('click', function (ev) {
        try {
          if (!ws || ws.readyState !== 1 || !TOKEN) return;
          var a = ev.target && ev.target.closest ? ev.target.closest('a, button') : null;
          if (!a) return;
          if (a.closest('#dolonline-panel')) return;
          var text = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
          if (!text) return;
          ws.send(JSON.stringify({ type: 'action', worldId: worldId, action: text }));
        } catch (e) {}
      }, true);
    } catch (e) {}
  }
  function loadServerIcon() {
    try {
      var custom = false, icon = '';
      try {
        custom = localStorage.getItem('dolon_btn_icon_custom') === '1';
        icon = localStorage.getItem('dolon_btn_icon') || '';
      } catch (e) {}
      if (custom && icon) { applyIconLocal(icon); return; }
      // 没自定义过就拉服务器的统一图标（新装 / 离线期间改过的也能同步）
      fetch(SERVER + '/api/settings', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.icon) applyIconLocal(d.icon);
          else if (icon) applyIconLocal(icon);
        })
        .catch(function () { if (icon) applyIconLocal(icon); });
    } catch (e) {}
  }
  function loadLatestVersion() {
    try {
      api('GET', '/api/mod/latest').then(function (r) {
        var e = document.getElementById('dol-latest-ver');
        var latest = (r && (r.version || r.latest)) || '';
        if (e) e.innerHTML = latest ? ('最新版本 v' + esc(String(latest)) + '　当前 v' + MOD_VERSION) : '查询失败';
      });
    } catch (e) {}
  }
  function pushPartyGear() {
    try {
      if (!ws || ws.readyState !== 1) return;
      var v = VV(); if (!v) return;
      var eq = v.mpEquip || {};
      var list = [];
      ['helmet', 'chest', 'legs', 'gloves', 'boots', 'weapon', 'offhand', 'neck'].forEach(function (k) {
        var it = eq[k]; if (!it) return;
        list.push({ slot: k, n: it.n, r: it.rarity || 'common' });
      });
      ws.send(JSON.stringify({ type: 'gear_update', gear: list }));
    } catch (e) {}
  }
  var nativeLeader = '';
  var nativeCombat = null;
  function nativeEnemy() {
    try {
      var SC = window.SugarCube; var V = SC && SC.State && SC.State.variables;
      if (!V) return null;
      var hp = Number(V.enemyhealth), mx = Number(V.enemyhealthmax);
      if (isFinite(hp) && isFinite(mx) && mx > 0) {
        return { name: (V.enemyName || V.enemyname || V.enemy || '敌人'), hp: Math.max(0, hp), hpMax: mx, ref: V, field: 'enemyhealth' };
      }
    } catch (e) {}
    return null;
  }
  // ===== 启动自检：关键函数/变量是否还在 =====
  var SELF_CHECK_NAMES = [
    'VV','esc','api','setStatus','showToast','fmtMoney','toPence',
    'renderOnline','renderFriends','renderParty','renderPartyGear','renderPartyDungeon','renderWorldBoss',
    'renderRooms','renderQuests','renderDaily','renderSmith','renderPet','renderCodex','renderMarket',
    'renderEquip','renderBag','renderExpBar','renderCatBalance','renderPvp','renderWorldPresence',
    'uploadSave','downloadSave','serializeGame','deserializeGame','autoLoadWorld','doAutoSave',
    'playerCombatStats','affixStatsOf','setBonusOf','rollAffixes','pickItemByTier','rollSlotWeighted','rollDurability',
    'dolStaminaMax','injectDungeonCss','dungeonPassageEnhance','ensureOverlayTab','setupPanelTabs',
    'grantItem','equipFromBag','dismantleItem','gather','dailyQuests','upgradeEquip',
    'nativeEnemy','syncNativeCombat','renderNativeCombat','renderSelfCombatHud',
    'openAddPoints','openSkillTree','openSellDialog','joinWorld','connectWS','onLoggedIn',
    'dgGen','dgRender','dgMove','dgFight','dgNext','dgOpen','dgRest','dgEnter','dgReveal',
    'roStart','roRender','roStats','roGen','roReveal','roMove','roFight','roNextFloor','roDraft','roPickRelic','roDeath','roBuyPerk','roMeta',
    'classDef','classId','pickClass','renderClass','setStatOf','setCounts','rollItemSet','renderNpc','npcChoose','npcState','CLASSES','CLASS_SETS','NPC_CHAINS',
    'announceItem','showAnnounce','petBonus','marketItems','partyMembers','cheatAllow','lastOnline','TITLES'
  ];
  function runSelfCheck() {
    var missing = [];
    for (var i = 0; i < SELF_CHECK_NAMES.length; i++) {
      var n = SELF_CHECK_NAMES[i];
      var t = 'undefined';
      try { t = eval('typeof ' + n); } catch (e) { t = 'undefined'; }
      if (t === 'undefined') missing.push(n);
    }
    window.__dolSelfCheck = { missing: missing, checked: SELF_CHECK_NAMES.length };
    if (missing.length) {
      try { console.error('[DoLOnline] 自检缺失:', missing.join(', ')); } catch (e) {}
      try { showToast('自检发现 ' + missing.length + ' 处缺失：' + missing.slice(0, 3).join('、') + '…'); } catch (e) {}
    } else {
      try { console.log('[DoLOnline] 自检通过：' + SELF_CHECK_NAMES.length + ' 项'); } catch (e) {}
    }
    return missing;
  }
  window.dolSelfCheck = runSelfCheck;
  function hasExternalHpDisplay() {
    try {
      var txt = ((document.getElementById('passages') || document.body).innerText || '');
      return /\d+\s*\/\s*\d+/.test(txt) && /\(|\（/.test(txt);
    } catch (e) { return false; }
  }
  function renderSelfCombatHud() {
    try {
      var e = nativeEnemy();
      var box = document.getElementById('dol-self-combat');
      if (!box) {
        box = document.createElement('div');
        box.id = 'dol-self-combat';
        box.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(30px + env(safe-area-inset-top,0px));' +
          'z-index:2147482870;width:min(62vw,220px);padding:2px 7px;background:rgba(10,10,14,.75);' +
          'border:1px solid rgba(232,201,122,.28);border-radius:8px;display:none;font:10px/1.2 sans-serif;color:#ccc;pointer-events:none';
        (document.documentElement || document.body).appendChild(box);
      }
      var _p = '';
      try { _p = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || ''; } catch (er) {}
      var _inCombat = /combat/i.test(_p);
      if (!_inCombat || !e || hasExternalHpDisplay()) { box.style.display = 'none'; return; }
      var pct = Math.max(0, Math.min(100, Math.round(e.hp / e.hpMax * 100)));
      box.innerHTML = '<div style="display:flex;justify-content:space-between"><span>' + esc(e.name) + '</span><span>' + Math.round(e.hp) + '/' + Math.round(e.hpMax) + '</span></div>' +
        '<div style="height:4px;background:#1a1a22;border-radius:2px;overflow:hidden;margin-top:1px"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#e05a5a,#a02a2a)"></div></div>';
      box.style.display = 'block';
    } catch (err) {}
  }
  function syncNativeCombat() {
    try {
      if (!ws || ws.readyState !== 1) return;
      if (!partyMembers || partyMembers.length < 2) { return; }
      var p = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
      var inCombat = /combat/i.test(p);
      var e = inCombat ? nativeEnemy() : null;
      if (e) {
        ws.send(JSON.stringify({ type: 'combat_sync', name: e.name, hp: e.hp, hpMax: e.hpMax }));
      } else if (nativeCombat) {
        ws.send(JSON.stringify({ type: 'combat_sync', name: '', hp: 0, hpMax: 1, over: true }));
      }
      nativeCombat = e ? { name: e.name, hp: e.hp, hpMax: e.hpMax } : null;
    } catch (err) {}
  }
  function renderNativeCombat() {
    var box = document.getElementById('dol-combat-hud');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dol-combat-hud';
      box.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(58px + env(safe-area-inset-top,0px));z-index:2147482880;' +
        'width:min(70vw,240px);padding:3px 8px;background:rgba(10,10,14,.8);border:1px solid rgba(232,201,122,.3);' +
        'border-radius:8px;display:none;font:10px/1.25 sans-serif;color:#ccc;pointer-events:auto';
      document.body.appendChild(box);
    }
    if (!nativeCombat || !nativeLeader) { box.style.display = 'none'; return; }
    var pct = Math.max(0, Math.min(100, Math.round(nativeCombat.hp / nativeCombat.hpMax * 100)));
    box.innerHTML = '<div style="display:flex;justify-content:space-between"><span>' + esc(nativeCombat.name) + '</span><span>' + nativeCombat.hp + '/' + nativeCombat.hpMax + '</span></div>' +
      '<div style="height:4px;background:#1a1a22;border-radius:2px;overflow:hidden;margin-top:1px"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#e05a5a,#a02a2a);transition:width .3s"></div></div>' +
      '<button id="dol-assist" style="width:100%;margin-top:3px;padding:2px;font-size:10px">协助攻击</button>';
    box.style.display = 'block';
    var b = document.getElementById('dol-assist');
    if (b) b.onclick = function () {
      try {
        var ps = playerCombatStats();
        var dmg = Math.floor((ps.atk || 10) * 1.2 + Math.random() * 8);
        ws.send(JSON.stringify({ type: 'combat_assist', to: nativeLeader, value: dmg }));
      } catch (e) {}
    };
  }
  var partyRun = null;
  window.dolPartyAlign = function () {
    try {
      var r = partyRun;
      if (!r || !r.active || !r.mon) return false;
      var v = VV(); if (!v) return false;
      v.dgEHp = r.mon.hp; v.dgEHpMax = r.mon.hpMax;
      v.dgEnemyName = r.mon.name; v.dgELvl = r.mon.level;
      v.dgEAtk = r.mon.atk; v.dgEDef = Math.floor(r.mon.atk * 0.6); v.dgEMDef = Math.floor(r.mon.atk * 0.15);
      v.dgPartyFloor = r.floor;
      return true;
    } catch (e) { return false; }
  };
  window.dolPartyAttackSend = function (dmg) {
    try {
      if (!partyRun || !partyRun.active) return;
      ws.send(JSON.stringify({ type: 'party_run_attack', value: Math.max(1, Math.floor(dmg || 1)) }));
    } catch (e) {}
  };
  window.dolPartyRunStart = function () {
    try { ws.send(JSON.stringify({ type: 'party_run_start' })); } catch (e) {}
  };

  function renderPartyRun() {
    var box = document.getElementById('dol-party-run');
    if (!box) return;
    var r = partyRun;
    if (!r) { box.innerHTML = '<span style="color:#888">' + ((partyMembers && partyMembers.length) ? '（还没开打，点上方「与队伍共享怪物」）' : '（未组队）') + '</span>'; return; }
    var pct = Math.max(0, Math.min(100, Math.round(r.mon.hp / r.mon.hpMax * 100)));
    var parts = [];
    for (var u in (r.contributions || {})) parts.push(esc(u) + ' ' + r.contributions[u]);
    var html = '<div style="font-size:13px;color:#e8c97a;margin-bottom:4px">第 ' + r.floor + ' 层</div>' +
      '<div style="font-size:13px;color:#ddd">' + esc(r.mon.name) + ' <span style="font-size:11px;color:#8a8a8a">' + esc(r.mon.trait || '') + ' Lv.' + r.mon.level + '</span></div>' +
      '<div style="height:9px;background:#222;border-radius:5px;overflow:hidden;margin:5px 0"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#e05a5a,#a02a2a);transition:width .3s"></div></div>' +
      '<div style="font-size:12px;color:#8a8a8a">' + r.mon.hp + ' / ' + r.mon.hpMax + '</div>' +
      (parts.length ? '<div style="font-size:11px;color:#9ac7ff;margin:4px 0">贡献：' + parts.join(' · ') + '</div>' : '') +
      (r.log && r.log.length ? '<div style="font-size:11px;color:#8a8a8a;line-height:1.5;margin:4px 0">' + r.log.slice(-5).map(esc).join('<br>') + '</div>' : '');
    var order = r.order || r.members || [];
    if (r.teamHpMax) {
      var tpct = Math.max(0, Math.min(100, Math.round((r.teamHp || 0) / r.teamHpMax * 100)));
      html += '<div style="font-size:12px;color:#9ac7ff;margin-top:6px">队伍体力 ' + (r.teamHp || 0) + ' / ' + r.teamHpMax + '</div>' +
        '<div style="height:8px;background:#222;border-radius:4px;overflow:hidden;margin:3px 0 4px"><div style="height:100%;width:' + tpct + '%;background:linear-gradient(90deg,#4ae06a,#2aa04a);transition:width .3s"></div></div>' +
        '<div style="font-size:11px;color:#8a8a8a">怪物的群体技能会打到全队，看到「全队 -N 体力」就是它放的</div>';
    }
    html += '<div style="font-size:12px;color:#7ec98a;margin-top:4px">随时可以出手（伤害按人统计）</div>' +
      (order.length ? '<div style="font-size:11px;color:#666">队伍：' + order.map(function (n) { return esc(n); }).join(' · ') + '</div>' : '');
    if (r.active && r.mon.hp > 0) {
      html += '<div class="dor" style="margin-top:8px;flex-wrap:wrap">' +
        '<button id="dol-run-atk" style="flex:1;min-width:80px">攻击</button>' +
        '<button id="dol-run-skill" style="flex:1;min-width:80px">法术</button>' +
        '<button id="dol-run-leave" style="flex:0 0 auto">离开</button></div>';
    } else {
      html += '<div class="dor" style="margin-top:8px"><button id="dol-run-leave" style="width:100%">离开</button></div>';
    }
    box.innerHTML = html;
    var a = document.getElementById('dol-run-atk');
    if (a) a.onclick = function () {
      try {
        var ps = playerCombatStats();
        var dmg = Math.floor((ps.atk || 10) * 1.6 + Math.random() * 12);
        ws.send(JSON.stringify({ type: 'party_run_attack', value: dmg }));
      } catch (e) {}
    };
    var sk = document.getElementById('dol-run-skill');
    if (sk) sk.onclick = function () {
      try {
        var ps = playerCombatStats();
        var sp = (window.dolSpellPower ? dolSpellPower() : 0);
        var dmg = Math.floor(((ps.atk || 10) * 2.2 + 40) * (1 + sp / 100));
        ws.send(JSON.stringify({ type: 'party_run_attack', value: dmg }));
      } catch (e) {}
    };
    var lv = document.getElementById('dol-run-leave');
    if (lv) lv.onclick = function () { try { ws.send(JSON.stringify({ type: 'party_run_end' })); } catch (e) {} try { Engine.play('DoLOnlineDungeonEntry'); } catch (e) {} };
  }
  function renderPartyDungeon(ev) {
    var box = document.getElementById('dol-party-event');
    if (!box) return;
    if (!ev) { box.style.display = 'none'; return; }
    var hpPct = Math.max(0, Math.round(ev.hp / ev.hpMax * 100));
    var tpPct = Math.max(0, Math.round(ev.teamHp / ev.teamHpMax * 100));
    var parts = [];
    for (var u in (ev.contributions || {})) parts.push(esc(u) + ' ' + ev.contributions[u]);
    var html = '<div style="font-weight:bold;color:#e8c97a;margin-bottom:4px">队伍副本 · 第 ' + ev.floor + ' 层' + (ev.active ? '' : '（已结束）') + '</div>' +
      '<div style="font-size:12px;color:#ddd;margin-bottom:3px">' + esc(ev.monName) + ' <span style="color:#8a8a8a">' + esc(ev.monTrait || '') + ' Lv.' + ev.monLevel + '</span></div>' +
      '<div style="height:8px;background:#222;border-radius:4px;overflow:hidden;margin-bottom:5px"><div style="height:100%;width:' + hpPct + '%;background:linear-gradient(90deg,#e05a5a,#a02a2a);transition:width .3s"></div></div>' +
      '<div style="font-size:11px;color:#8a8a8a;margin-bottom:2px">队伍体力 ' + ev.teamHp + '/' + ev.teamHpMax + '</div>' +
      '<div style="height:6px;background:#222;border-radius:3px;overflow:hidden;margin-bottom:5px"><div style="height:100%;width:' + tpPct + '%;background:linear-gradient(90deg,#4ae06a,#2aa04a);transition:width .3s"></div></div>';
    if (parts.length) html += '<div style="font-size:11px;color:#9a9a9a;margin-bottom:4px">贡献：' + parts.join(' · ') + '</div>';
    if (ev.log && ev.log.length) html += '<div style="font-size:11px;color:#8a8a8a;max-height:74px;overflow-y:auto;line-height:1.5">' + ev.log.slice(-5).map(esc).join('<br>') + '</div>';
    if (ev.active) {
      html += '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<button id="dol-dgp-atk" style="flex:1">攻击</button>' +
        '<button id="dol-dgp-skill" style="flex:1">技能</button>' +
        '<button id="dol-dgp-flee" style="flex:0 0 auto">撤退</button></div>';
    }
    box.innerHTML = html;
    box.style.display = 'block';
    var val = Math.floor((playerCombatStats().atk || 10) * 3);
    var send = function (act) { try { ws.send(JSON.stringify({ type: 'party_dungeon_action', action: act, role: getRole(), value: val })); } catch (e) {} };
    var a = document.getElementById('dol-dgp-atk'); if (a) a.onclick = function () { send('attack'); };
    var k = document.getElementById('dol-dgp-skill'); if (k) k.onclick = function () { send('skill'); };
    var f = document.getElementById('dol-dgp-flee'); if (f) f.onclick = function () { send('flee'); };
  }
  window.dolStaminaMax = function () {
    try {
      var v = VV(); if (!v) return 100;
      var pain = Number(v.pain) || 0;
      var pct = Math.max(0, Math.min(100, pain));
      var bonus = Number(v.mpDgHp) || 0;
      var gearHp = 0;
      try {
        var eq = v.mpEquip || {};
        ['helmet','chest','legs','gloves','boots','weapon','offhand','neck'].forEach(function (k) {
          var it = eq[k];
          if (it) gearHp += Number(it.hp) || 0;
        });
        try { gearHp += (setBonusOf(v).hp || 0); } catch (e) {}
        try { gearHp += (affixStatsOf(v).hp || 0); } catch (e) {}
      } catch (e) {}
      try { gearHp += (Number((v.mpSkill || {}).hp) || 0) * 10; } catch (e) {}
      gearHp = Math.min(300, Math.max(0, gearHp));
      return Math.max(10, Math.round(100 - pct) + bonus + gearHp);
    } catch (e) { return 100; }
  };
  window.dolAddPain = function (n) {
    try {
      var v = VV(); if (!v) return;
      v.pain = Math.max(0, Math.min(100, (Number(v.pain) || 0) + n));
      try { showToast('疼痛 ' + Math.round(v.pain) + '/100'); } catch (e) {}
    } catch (e) {}
  };
  var _lastFriendsHtml = '';
  var pmHistory = [];
  function appendWorldAction(from, action, ts) {
    try {
      var box = document.getElementById('dol-world-action');
      if (!box) return;
      var line = '<div style="font-size:11px;color:#9a9a9a">' + esc(from || '') + ' · ' + esc(action || '') + '</div>';
      box.innerHTML = (box.innerHTML === '—' ? '' : box.innerHTML) + line;
      if (box.childNodes.length > 20 && box.firstChild) box.removeChild(box.firstChild);
    } catch (e) {}
  }
  function applyPeerCombatTurn(m) { try { peerCombatSnapshot = m.combat || peerCombatSnapshot; } catch (e) {} }
  function renderPeerModel() {
    try {
      var box = document.getElementById('dol-peer-model');
      if (!box) return;
      var st = document.getElementById('dol-peer-stats');
      var snap = peerCombatSnapshot;
      if (!snap || !snap.player) { if (st && !st.textContent.trim()) st.textContent = '（暂无数据）'; return; }
      var p = snap.player;
      if (st) st.innerHTML = '<b style="color:#e8c97a">' + esc(p.name || '队友') + '</b>　' +
        'HP ' + Math.round(p.hp || 0) + '/' + Math.round(p.max || 0);
      box.innerHTML = '<div style="font-size:12px;color:#8a8a8a;text-align:center;padding:20px">队友立绘同步中…</div>';
    } catch (e) {}
  }
  var friendList = [];
  var friendReqs = [];
  var cpReqs = [];
  var cps = {};
  function renderRooms(worlds) {
    var box = document.getElementById('dol-rooms');
    if (!box) return;
    var list = Array.isArray(worlds) ? worlds : [];
    // 常驻服：永远置顶，不因空房间而隐藏
    var pinned = { id: 'main', name: '常驻服', online: 0, version: 0, lastEditor: '-', pinned: true };
    var found = false;
    list.forEach(function (w) { if ((w.id || w.worldId) === 'main') { found = true; pinned.online = w.online || 0; pinned.version = w.version || 0; pinned.lastEditor = w.lastEditor || '-'; } });
    if (!found) list = [pinned].concat(list);
    list.sort(function (a, b) { return ((b.id || b.worldId) === 'main' ? 1 : 0) - ((a.id || a.worldId) === 'main' ? 1 : 0); });
    if (!list.length) { box.textContent = '（暂无房间）'; return; }
    box.innerHTML = list.map(function (w) {
      var id = w.id || w.worldId || '';
      var on = (typeof w.online === 'number') ? w.online : 0;
      var isMain = (id === 'main');
      return '<div style="margin:2px 0;font-size:12px' + (isMain ? ';padding:3px 5px;background:#1a2030;border-radius:6px' : '') + '">' +
        '<a href="#" data-room="' + esc(id) + '" style="color:' + (isMain ? '#f0d060' : '#9ac7ff') + ';font-weight:' + (isMain ? 'bold' : 'normal') + '">' +
        (isMain ? '📌 常驻服' : esc(id)) + '</a> ' +
        '<span style="color:#8a8a8a">v' + (w.version || 0) + ' · ' + on + ' 人 · ' + esc(w.lastEditor || '-') + '</span></div>';
    }).join('');
    box.querySelectorAll('[data-room]').forEach(function (a) {
      a.onclick = function (ev) {
        ev.preventDefault();
        var id = a.getAttribute('data-room');
        var inp = document.getElementById('dol-world-id');
        if (inp) inp.value = id;
        try { joinWorld(); } catch (e) {}
      };
    });
  }
  window.dolCatRepairShop = function () {
    try {
      var v = VV(); if (!v) return;
      var cost = 150;
      var cat = Number(v.mpCat) || 0;
      if (cat < cost) { showToast('猫猫币不够（需要 ' + cost + '）'); return; }
      var eq = v.mpEquip || {};
      var fixed = 0, noTough = 0;
      ['helmet','chest','legs','gloves','boots','weapon','offhand','neck'].forEach(function (k) {
        var it = eq[k]; if (!it) return;
        var max = Number(it.maxDur) || 100;
        var tough = (it.tough == null) ? 3 : Number(it.tough);
        if (tough <= 0) { noTough++; return; }
        if ((Number(it.dur) || 0) >= max) return;
        it.dur = max;
        it.tough = tough - 1;
        fixed++;
      });
      if (!fixed) { showToast(noTough ? '这些装备坚固已耗尽，修不了' : '装备都是完好的，不用修'); return; }
      v.mpCat = cat - cost;
      showToast('保养了 ' + fixed + ' 件装备（坚固 -1）');
      try { renderBag(); renderEquip(); renderCatBalance(); } catch (e) {}
    } catch (e) {}
  };
  window.dolCat = function (delta) {
    try {
      var v = VV(); if (!v) return 0;
      var cur = Number(v.mpCat) || 0;
      if (delta) { v.mpCat = Math.max(0, cur + Number(delta)); cur = v.mpCat; }
      try { renderCatBalance(); } catch (e) {}
      return cur;
    } catch (e) { return 0; }
  };
  function renderCatBalance() {
    try {
      var v = VV(); if (!v) return;
      var n = Number(v.mpCat) || 0;
      var box = document.getElementById('dol-cat');
      if (box) box.innerHTML = '猫猫币 <b style="color:#f0c060">' + n + '</b>';
    } catch (e) {}
  }
  var pvpState = null;
  function showAnnounce(text) {
    // 顶部跑马灯照旧；聊天栏只记传说及以上的装备播报
    try {
      if (/获得了【/.test(text) && /(传说|神话|神圣)/.test(text)) appendChat('系统', text, Date.now(), false);
    } catch (e) {}
    try {
      var box = document.getElementById('dol-announce');
      if (!box) {
        box = document.createElement('div');
        box.id = 'dol-announce';
        document.body.appendChild(box);
      }
      box.innerHTML = '<span class="txt">' + esc(text) + '</span>';
      box.style.display = 'block';
      var sp = box.querySelector('.txt');
      if (sp) {
        sp.style.animation = 'none';
        void sp.offsetWidth;
        sp.style.animation = 'dolMarquee 9s linear';
        sp.onanimationend = function () {
          clearTimeout(box._t);
          box._t = setTimeout(function () { box.style.display = 'none'; }, 600);
        };
      }
      clearTimeout(box._t);
      box._t = setTimeout(function () { box.style.display = 'none'; }, 12000);
    } catch (e) {}
  }
  function renderPvp(state, msg) {
    var box = document.getElementById('dol-pvp');
    if (!box) return;
    if (state) pvpState = state;
    var st = pvpState;
    if (!st) { box.textContent = '（暂无决斗）'; return; }
    var myHp = st.hp[USERNAME] || 0, myMax = st.max[USERNAME] || 1;
    var foe = (st.a === USERNAME) ? st.b : st.a;
    var fHp = st.hp[foe] || 0, fMax = st.max[foe] || 1;
    var myMp = (st.mp && st.mp[USERNAME]) || 0;
    var mine = (st.turn === USERNAME);
    var atk = (playerCombatStats().atk || 10);
    var html = '<div style="color:#e8c97a;font-weight:bold;margin-bottom:3px">⚔ 与 ' + esc(foe) + ' 决斗</div>' +
      barHtml('我', myHp, myMax, 'linear-gradient(90deg,#4ae06a,#2aa04a)') +
      barHtml(foe, fHp, fMax, 'linear-gradient(90deg,#e05a5a,#a02a2a)') +
      '<div style="font-size:11px;color:#8a9ae2;margin:2px 0">法力 ' + myMp + '/100</div>' +
      '<div style="font-size:11px;color:' + (mine ? '#7ec98a' : '#8a8a8a') + ';margin:3px 0">' + (mine ? '轮到你了' : '等待对方…') + '</div>';
    if (st.active && mine) {
      html += '<div class="dor" style="flex-wrap:wrap;gap:4px">' +
        '<button data-pvp="normal" style="flex:1;min-width:60px">攻击</button>' +
        '<button data-pvp="fire" style="flex:1;min-width:60px">火球15</button>' +
        '<button data-pvp="thunder" style="flex:1;min-width:60px">雷击25</button>' +
        '<button data-pvp="drain" style="flex:1;min-width:60px">吸取22</button>' +
        '<button data-pvp="shield" style="flex:1;min-width:60px">护盾20</button>' +
        '<button id="dol-pvp-flee" style="flex:1;min-width:60px;background:#3a2020">撤退</button>' +
        '</div>' +
        '<div style="font-size:10px;color:#6a6a72;margin-top:3px">撤退＝认输；60 秒不出手自动判负</div>';
    } else if (st.active) {
      html += '<div class="dor" style="margin-top:4px"><button id="dol-pvp-flee" style="width:100%;background:#3a2020">撤退（认输）</button></div>';
    } else {
      html += '<div class="dor" style="margin-top:4px"><button id="dol-pvp-close" style="width:100%">关闭</button></div>';
    }
    if (msg) html += '<div style="font-size:11px;color:#e8a33b">' + esc(msg) + '</div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-pvp]').forEach(function (b) {
      b.onclick = function () {
        try { ws.send(JSON.stringify({ type: 'pvp_attack', kind: b.getAttribute('data-pvp'), value: Math.floor(atk * 1.5) })); } catch (e) {}
      };
    });
    var fl = box.querySelector('#dol-pvp-flee');
    if (fl) fl.onclick = function () {
      if (!window.confirm('撤退算认输，确定？')) return;
      try { ws.send(JSON.stringify({ type: 'pvp_flee' })); } catch (e) {}
    };
    var cl = box.querySelector('#dol-pvp-close');
    if (cl) cl.onclick = function () { pvpState = null; renderPvp(null, ''); };
  }

  var mailList = [];
  function renderMailbox() {
    try {
      var box = document.getElementById('dol-mail');
      if (!box) return;
      if (!mailList.length) { box.innerHTML = '<span style="color:#6a6a72">（没有邮件）</span>'; return; }
      box.innerHTML = mailList.map(function (m) {
        var money = m.kind === 'money' ? fmtMoney(m.amount) : '';
        var t = new Date(m.ts || Date.now());
        var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
        return '<div data-mailrow="' + m.id + '" style="display:flex;align-items:center;gap:6px;margin:2px 0;padding:3px 6px;background:#16181e;border-radius:5px;cursor:pointer">' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.text || '邮件') +
          '<span style="font-size:10px;color:#6a6a72"> · ' + hh + '</span></span>' +
          (money ? '<span style="color:#e8c97a">' + money + '</span>' : '') +
          '<button data-mail="' + m.id + '" style="padding:2px 9px;font-size:11px;background:#2c3a2c;color:#b8f0c0;border:1px solid #3a5a3a;border-radius:6px">领取</button></div>';
      }).join('');
      var claim = function (id) {
        try {
          if (!ws || ws.readyState !== 1) { showToast('未连接服务器，先登录'); return; }
          ws.send(JSON.stringify({ type: 'mail_claim', id: id }));
          showToast('领取中…');
        } catch (e) { showToast('领取失败：' + (e && e.message ? e.message : '')); }
      };
      box.querySelectorAll('[data-mailrow]').forEach(function (row) {
        row.onclick = function (ev) { if (ev) ev.preventDefault(); claim(row.getAttribute('data-mailrow')); };
      });
      box.querySelectorAll('[data-mail]').forEach(function (a) {
        a.onclick = function (ev) {
          if (ev) ev.preventDefault();
          try {
            if (!ws || ws.readyState !== 1) { showToast('未连接服务器，先登录'); return; }
            ws.send(JSON.stringify({ type: 'mail_claim', id: a.getAttribute('data-mail') }));
            showToast('领取中…');
          } catch (e) { showToast('领取失败：' + (e && e.message ? e.message : '')); }
        };
      });
    } catch (e) {}
  }
  function loadMailbox() {
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'mail_list' })); } catch (e) {}
  }
  var marketWorldOnly = false;
  /* ===== 排行榜 ===== */
  var lbData = null, lbTab = 'floor';
  var LB_TABS = [['floor','层数'],['codex','图鉴'],['money','财富'],['cat','猫猫币']];
  function lbSendMe() {
    try {
      if (!ws || ws.readyState !== 1) return;
      var v = VV(); if (!v) return;
      var p = codexProgress();
      var tot = p.wt + p.et, has = p.w + p.e;
      var pct = tot ? Math.round(has / tot * 100) : 0;
      var fl = Math.max(Number(v.mpMaxFloor) || 0, Number(v.dgFloor) || 0);
      try { v.mpMaxFloor = fl; } catch (e) {}
      ws.send(JSON.stringify({
        type: 'lb_update',
        floor: fl,
        codex: pct,
        money: Number(v.money) || 0,
        cat: Number(v.mpCat) || 0,
        lv: Number(v.mpDLv) || 1,
        lvG: Number(v.mpDgLv) || 1
      }));
    } catch (e) {}
  }
  function lbRequest() {
    try {
      if (!ws || ws.readyState !== 1) { showToast('未连接服务器'); return; }
      lbSendMe();
      ws.send(JSON.stringify({ type: 'lb_get' }));
    } catch (e) {}
  }
  function renderLb() {
    var tabsBox = document.getElementById('dol-lb-tabs');
    var box = document.getElementById('dol-lb');
    if (!box) return;
    if (tabsBox) {
      tabsBox.innerHTML = LB_TABS.map(function (t) {
        var on = (lbTab === t[0]);
        return '<button data-lbtab="' + t[0] + '" style="padding:2px 9px;font-size:11px;border-radius:6px;' +
          (on ? 'background:rgba(232,201,122,.22);border:1px solid rgba(232,201,122,.6);color:#f0d060'
              : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">' + t[1] + '</button>';
      }).join('');
      tabsBox.querySelectorAll('[data-lbtab]').forEach(function (b) {
        b.onclick = function () { lbTab = b.getAttribute('data-lbtab'); renderLb(); };
      });
    }
    if (!lbData) { box.innerHTML = '<span style="color:#888">（点「刷新排行榜」加载）</span>'; return; }
    var rows = (lbData[lbTab] || []).filter(function (x) { return lbTab !== 'floor' || Number(x.v) > 0; });
    if (!rows.length) { box.innerHTML = '<span style="color:#888">（暂无数据）</span>'; return; }
    box.innerHTML = rows.map(function (x, i) {
      var me = (x.n === USERNAME);
      var val;
      if (lbTab === 'money') val = fmtMoney(x.v);
      else if (lbTab === 'cat') val = x.v + ' 猫猫币';
      else if (lbTab === 'codex') val = x.v + '%';
      else val = x.v > 0 ? ('第 ' + x.v + ' 层') : '—';
      return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;padding:2px 6px;border-radius:5px;background:' + (me ? '#2a2a1a' : '#16181e') + '">' +
        '<span style="width:18px;color:' + (i < 3 ? '#e8c97a' : '#6a6a72') + '">' + (i + 1) + '</span>' +
        '<span style="flex:1;color:' + (me ? '#e8c97a' : '#c8c2ba') + '">' + esc(x.n) + '</span>' +
        '<span style="color:#9ac7ff;font-size:11px">Lv.' + (x.lv || 0) + '/' + (x.lvG || 0) + '</span>' +
        '<span style="color:#e8c97a">' + val + '</span></div>';
    }).join('');
  }
  function renderMarket() {
    var box = document.getElementById('dol-market-list');
    if (!box) return;
    if (!marketItems.length) { box.innerHTML = '（暂无上架物品）'; return; }
    var bar = '<div style="display:flex;gap:4px;margin-bottom:4px">' +
      [['0','全部世界'],['1','本世界']].map(function (t) {
        var on = ((t[0] === '1') === marketWorldOnly);
        return '<button data-mworld="' + t[0] + '" style="padding:2px 8px;font-size:11px;border-radius:6px;' +
          (on ? 'background:rgba(154,199,255,.18);border:1px solid rgba(154,199,255,.5);color:#9ac7ff'
              : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">' + t[1] + '</button>';
      }).join('') + '<span style="font-size:10px;color:#6a6a72;align-self:center">跨世界交易：别的世界的挂单也能买</span></div>';
    var shown = marketWorldOnly ? marketItems.filter(function (x) { return !x.world || x.world === worldId; }) : marketItems;
    box.innerHTML = bar + (shown.length ? '' : '<span style="color:#888">（这个世界没有挂单）</span>') + shown.map(function (x) {
      var it = x.item || {};
      var rar = RARITY.filter(function (r) { return r.k === it.rarity; })[0] || RARITY[0];
      var mine = (x.seller === USERNAME);
      return '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:4px 6px;background:#16181e;border-radius:6px">' +
        '<div style="flex:1;font-size:12px"><span style="' + rarityStyle(rar) + '">' + esc(it.n || '?') + '</span>' +
        '<span style="color:#8a8a8a;font-size:11px"> · ' + esc(x.seller) +
        (x.world && x.world !== worldId ? '　<span style="color:#7a9ac0">[跨世界]</span>' : (x.world ? '　<span style="color:#6a8a70">[本世界]</span>' : '')) + '</span></div>' +
        '<span style="font-size:12px;color:#e8c97a">' + ((x.cur === 'cat') ? ('猫猫币 ' + (x.priceCat || x.price)) : ((x.cur === 'any') ? ('£' + ((x.price || 0) / 100).toFixed(2) + ' / 猫 ' + x.priceCat) : fmtMoney(x.price))) + '</span>' +
        (mine ? '<button data-mcancel="' + x.id + '" style="padding:2px 8px;font-size:11px">下架</button>'
              : ((x.cur === 'any')
                  ? ('<button data-mbuy="' + x.id + '" data-pay="money" data-mprice="' + x.price + '" style="padding:2px 8px;font-size:11px">£买</button>' +
                     '<button data-mbuy="' + x.id + '" data-pay="cat" data-mprice="' + (x.priceCat || 0) + '" style="padding:2px 8px;font-size:11px">猫买</button>')
                  : '<button data-mbuy="' + x.id + '" data-pay="' + (x.cur === 'cat' ? 'cat' : 'money') + '" data-mprice="' + ((x.cur === 'cat') ? (x.priceCat || x.price) : x.price) + '" style="padding:2px 8px;font-size:11px">买</button>')) +
        '</div>';
    }).join('');
    box.querySelectorAll('[data-mworld]').forEach(function (b) {
      b.onclick = function () { marketWorldOnly = (b.getAttribute('data-mworld') === '1'); renderMarket(); };
    });
    box.querySelectorAll('[data-mbuy]').forEach(function (b) {
      b.onclick = function () {
        var pay = b.getAttribute('data-pay') || 'money';
        var price = Number(b.getAttribute('data-mprice')) || 0;
        var v = VV(); if (!v) return;
        if (pay === 'cat') {
          if ((Number(v.mpCat) || 0) < price) { showToast('猫猫币不够'); return; }
          if (!confirm('花费 ' + price + ' 猫猫币 购买？')) return;
          v.mpCat = (Number(v.mpCat) || 0) - price;
          try { renderCatBalance(); } catch (e) {}
        } else {
          if ((Number(v.money) || 0) < price) { showToast('金币不够'); return; }
          if (!confirm('花费 ' + fmtMoney(price) + ' 购买？')) return;
          v.money = (Number(v.money) || 0) - price;
        }
        try { ws.send(JSON.stringify({ type: 'market_buy', id: b.getAttribute('data-mbuy'), pay: pay })); } catch (e) {}
      };
    });
    box.querySelectorAll('[data-mcancel]').forEach(function (b) {
      b.onclick = function () { try { ws.send(JSON.stringify({ type: 'market_cancel', id: b.getAttribute('data-mcancel') })); } catch (e) {} };
    });
  }
  function openSellDialog() {
    try {
      var v = VV(); if (!v) return;
      var bagArr = Array.isArray(v.mpBag) ? v.mpBag : [];
      var box = document.getElementById('dol-market-sellbox');
      var sel = document.getElementById('dol-market-item');
      if (!box || !sel) return;
      if (!bagArr.length) { showToast('背包是空的'); return; }
      sel.innerHTML = bagArr.map(function (it, i) {
        var r = RARITY.filter(function (x) { return x.k === it.rarity; })[0] || RARITY[0];
        return '<option value="' + i + '">' + (i + 1) + '. [' + r.n + '] ' + it.n + '</option>';
      }).join('');
      box.style.display = 'block';
    } catch (e) {}
  }

  var QUESTS = [
    { id: 'mail', name: '失踪的送信人', start: 'DoLQuestMailStart' },
    { id: 'umb',  name: '雨夜的伞',     start: 'DoLQuestUmbrellaStart' },
    { id: 'echo', name: '地下城的回声', start: 'DoLQuestEchoStart' },
    { id: 'key',  name: '旧校舍的钥匙', start: 'DoLQuestKeyStart' }
  ];
  function renderQuests() {
    var box = document.getElementById('dol-quests');
    if (!box) return;
    var v = VV(); if (!v) { box.textContent = '（未登录）'; return; }
    var q = v.mpQ || {};
    var mainDone = (Number(q.mail) === 2 && Number(q.umb) === 2 && Number(q.echo) === 2 && Number(q.key) === 2);
    var chapters = [
      { k: 'main', name: '第一章 · 那些没寄出去的东西', start: 'DoLMainStart', ok: mainDone },
      { k: 'main2', name: '第二章 · 信里没写的事', start: 'DoLMain2Start', ok: (Number(q.main) || 0) === 2 },
      { k: 'main3', name: '第三章 · 那些钱', start: 'DoLMain3Start', ok: (Number(q.main2) || 0) === 2 },
      { k: 'main4', name: '第四章 · 往下数', start: 'DoLMain4Start', ok: (Number(q.main3) || 0) === 2 },
      { k: 'main5', name: '终章 · 回信', start: 'DoLMain5Start', ok: (Number(q.main4) || 0) === 2 }
    ];
    var html = '';
    var cp = 0;
    chapters.forEach(function (c) {
      var st = Number(q[c.k]) || 0;
      if (st === 2) cp++;
      var label = st === 2 ? '已完成' : (c.ok ? '可进行' : '未解锁');
      var color = st === 2 ? '#7ec98a' : (c.ok ? '#e8c97a' : '#8a8a8a');
      html += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 6px;' +
        (st !== 2 && c.ok ? 'background:#241f16;border:1px solid rgba(232,201,122,.3);' : 'background:#16181e;') +
        'border-radius:6px">' +
        '<span style="flex:1;color:#d8d0c8;font-size:12px">' + c.name + '</span>' +
        '<span style="font-size:11px;color:' + color + '">' + label + '</span>' +
        (st !== 2 && c.ok ? '<a href="#" data-quest="' + c.start + '" style="color:#9ac7ff">前往</a>' : '') +
        '</div>';
    });
    html = '<div style="font-size:11px;color:#e8c97a;margin:2px 0 4px">主线进度 ' + cp + '/5</div>' + html;
    var huiCh = Number(v.npcCh) || 0;
    var huiSt = Number(q.hui) || 0;
    html += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 6px;background:#16181e;border-radius:6px">' +
      '<span style="flex:1;color:#d8d0c8">灰 · 没说完的半句话</span>' +
      '<span style="font-size:11px;color:' + (huiSt === 2 ? '#7ec98a' : (huiCh >= 3 ? '#e8c97a' : '#8a8a8a')) + '">' +
      (huiSt === 2 ? '已完成' : (huiCh >= 3 ? '可接取' : '需看完灰的剧情')) + '</span>' +
      (huiSt !== 2 && huiCh >= 3 ? '<a href="#" data-quest="DoLHuiPastStart" style="color:#9ac7ff">前往</a>' : '') +
      '</div>';
    html += QUESTS.map(function (it) {
      var st = Number(q[it.id]) || 0;
      var label = st === 0 ? '未开始' : (st === 1 ? '进行中' : '已完成');
      var color = st === 2 ? '#7ec98a' : (st === 1 ? '#e8c97a' : '#8a8a8a');
      return '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 6px;background:#16181e;border-radius:6px">' +
        '<span style="flex:1;color:#d8d0c8">' + esc(it.name) + '</span>' +
        '<span style="font-size:11px;color:' + color + '">' + label + '</span>' +
        (st !== 2 ? '<a href="#" data-quest="' + it.start + '" style="color:#9ac7ff">前往</a>' : '') +
        '</div>';
    }).join('');
    box.innerHTML = html;
    box.querySelectorAll('[data-quest]').forEach(function (a) {
      a.onclick = function (ev) {
        ev.preventDefault();
        var target = a.getAttribute('data-quest');
        try { closePanel(); } catch (e) {}
        setTimeout(function () {
          try {
            var SC = window.SugarCube;
            if (SC && SC.Engine && SC.Engine.play) SC.Engine.play(target);
          } catch (e) {}
        }, 120);
      };
    });
  }
  function serverURL() { return SERVER; }
  function onLoggedIn() {
    try {
      if (el.auth) el.auth.style.display = 'none';
      if (el.userbar) el.userbar.style.display = 'block';
      if (el.username) el.username.textContent = USERNAME;
    } catch (e) {}
    setStatus('已登录：' + USERNAME, 'ok');
    try { connectWS(); } catch (e) {}
    setTimeout(function () {
      try {
        if (!worldId) {
          // 默认进入「个人世界」：每个账号独立存档，互不影响
          var personal = 'u_' + USERNAME;
          var last = '';
          try { last = localStorage.getItem('dolon_world') || ''; } catch (e) {}
          if (last === 'main') last = '';
          worldId = last || personal;
          try { ws.send(JSON.stringify({ type: 'watch_world', worldId: worldId })); } catch (e) {}
          try { localStorage.setItem('dolon_world', worldId); } catch (e) {}
          // 自动载入已关闭：需要同步请手动点「载入世界存档」
        }
      } catch (e) {}
      try { loadServerStats(); } catch (e) {}
      try { refreshRooms(); } catch (e) {}
      try { pushPartyGear(); } catch (e) {}
      try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'world_boss_state' })); } catch (e) {}
    }, 500);
  }
  function enablePanelScroll() {
    var panel = document.getElementById('dolonline-panel');
    if (!panel || panel.__scrollBound) return;
    panel.__scrollBound = true;
    var body = panel.querySelector('.dob');
    if (!body) return;
    var startY = 0, startScroll = 0, dragging = false;
    body.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY; startScroll = body.scrollTop; dragging = true;
    }, { passive: true });
    body.addEventListener('touchmove', function (e) {
      if (!dragging || e.touches.length !== 1) return;
      var dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > 4) { body.scrollTop = startScroll - dy; if (e.cancelable) e.preventDefault(); }
    }, { passive: false });
    body.addEventListener('touchend', function () { dragging = false; }, { passive: true });
  }
  function grantItem(kind, n) {
    try {
      var v = VV(); if (!v) return;
      n = Number(n) || 1;
      if (kind === 'money') v.money = (Number(v.money) || 0) + Math.round(n * 100);
      else if (kind === 'condoms') v.condoms = (Number(v.condoms) || 0) + n;
      else if (kind === 'pills') v.pills = (Number(v.pills) || 0) + n;
      else if (kind === 'spray') { v.spray = (Number(v.spray) || 0) + n; v.spraymax = Math.max(Number(v.spraymax) || 0, v.spray); }
      else if (kind === 'lube') v.lube = (Number(v.lube) || 0) + n;
      else if (kind === 'tampons') v.tampons = (Number(v.tampons) || 0) + n;
      else if (kind === 'morningafter') v.morningafterpill = (Number(v.morningafterpill) || 0) + n;
      else if (kind === 'bandage') v.bandage = (Number(v.bandage) || 0) + n;
      else if (kind === 'cat') { v.mpCat = (Number(v.mpCat) || 0) + n; try { renderCatBalance(); } catch (e) {} }
      else if (kind === 'skill') { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + n); showToast('技能点 +' + n); return; }
      else if (kind === 'staff') { window.dolGrantEquip && dolGrantEquip('weapon', 6); return; }
      showToast('已发放：' + kind + ' +' + n);
    } catch (e) {}
  }
  var AVATARS = {};
  function loadAvatar(name, cb) {
    try {
      if (!name) return cb && cb('');
      if (AVATARS[name]) return cb && cb(AVATARS[name]);
      fetch(SERVER + '/api/avatar/' + encodeURIComponent(name) + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (b) {
          if (!b) return cb && cb('');
          var fr = new FileReader();
          fr.onload = function () { AVATARS[name] = fr.result; cb && cb(fr.result); };
          fr.readAsDataURL(b);
        })
        .catch(function () { cb && cb(''); });
    } catch (e) { cb && cb(''); }
  }
  function requestFriend(name) {
    if (!name) return;
    try { ws.send(JSON.stringify({ type: 'friend_request', to: name })); } catch (e) {}
    showToast('已向 ' + name + ' 发送好友申请');
  }
  function setRole(r) {
    try {
      var v = VV(); if (!v) return;
      v.mpRole = r;
      showToast('职业：' + ({ dps: '输出', tank: '坦克', healer: '治疗' })[r]);
      renderRoleButtons();
    } catch (e) {}
  }
  function getRole() {
    try { var v = VV(); return (v && v.mpRole) || 'dps'; } catch (e) { return 'dps'; }
  }
  function renderRoleButtons() {
    try {
      var r = getRole();
      [['dol-role-dps', 'dps'], ['dol-role-tank', 'tank'], ['dol-role-healer', 'healer']].forEach(function (p) {
        var b = document.getElementById(p[0]);
        if (!b) return;
        b.style.background = (r === p[1]) ? '#3a5a3a' : '';
      });
    } catch (e) {}
  }
  var lastSeenMap = {};      // 用户名 -> 上次在线时间戳
  var lastSeenAt = 0;        // 本地缓存时间
  function fmtSeen(ts) {
    if (!ts) return '很久没上线';
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚还在';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + ' 天前';
    var d = new Date(ts);
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function refreshLastSeen(force) {
    if (!force && Date.now() - lastSeenAt < 60000) return;
    lastSeenAt = Date.now();
    try {
      fetch(SERVER + '/api/users', { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !Array.isArray(d.users)) return;
          d.users.forEach(function (x) { if (x && x.n) lastSeenMap[x.n] = Number(x.last) || 0; });
          lastSeenAt = Date.now();
          try { renderFriends(); } catch (e) {}
        }).catch(function () {});
    } catch (e) {}
  }
  function renderFriends() {
    var box = document.getElementById('dol-friends');
    if (!box) return;
    var list = friendList || [];
    try { refreshLastSeen(false); } catch (e) {}
    if (!list.length) { box.innerHTML = '<span style="color:#888">（暂无好友）</span>'; return; }
    var online = lastOnline || [];
    var html = list.map(function (n, i) {
      var t = (typeof TITLES !== 'undefined' && TITLES[n]) ? TITLES[n] : '';
      var on = online.indexOf(n) >= 0;
      return '<div class="fr" data-fi="' + i + '" style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 6px;background:#16181e;border-radius:6px">' +
        '<span class="fr-av" style="width:30px;height:30px;border-radius:50%;overflow:hidden;background:#20242e;display:inline-block;flex:0 0 auto"></span>' +
        '<span style="color:' + (on ? '#9ac7ff' : '#8a8a8a') + '">' + esc(n) + '</span>' +
        (t ? '<span style="font-size:10px;color:#e8c97a;border:1px solid rgba(232,201,122,.45);border-radius:8px;padding:0 5px">' + esc(t) + '</span>' : '') +
        (on ? '<span style="font-size:10px;color:#7ec98a">在线</span>'
            : '<span style="font-size:10px;color:#6a6a72">上次上线 ' + esc(fmtSeen(lastSeenMap[n])) + '</span>') +
        '</div>';
    }).join('');
    if (html === _lastFriendsHtml) return;
    _lastFriendsHtml = html;
    box.innerHTML = html;
    list.forEach(function (n, i) {
      try {
        loadAvatar(n, function (src) {
          if (!src) return;
          var row = box.querySelector('[data-fi="' + i + '"]');
          var av = row && row.querySelector('.fr-av');
          if (av) av.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover">';
        });
      } catch (e) {}
    });
  }
  function renderCp() {
    var box = document.getElementById('dol-cp');
    if (!box) return;
    var cp = window.__cpPartner || '';
    box.innerHTML = cp ? ('CP：<span style="color:#f0a0c0">' + esc(cp) + '</span>') : '（未绑定 CP）';
  }
  function renderParty() {
    var box = document.getElementById('dol-party');
    if (!box) return;
    if (!partyMembers || !partyMembers.length) { box.textContent = '（未组队）'; return; }
    var online = {};
    try { (lastOnline || []).forEach(function (x) { online[typeof x === 'string' ? x : x.u] = true; }); } catch (e) {}
    var html = '<div style="margin-bottom:3px">队伍（' + partyMembers.length + '/4 人）</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
      partyMembers.map(function (m) {
        var me = (m === USERNAME);
        var on = online[m];
        if (on === undefined) on = true;
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:' +
          (me ? '#2a3a2a' : '#1a2030') + ';color:' + (me ? '#b8f0c0' : '#9ac7ff') + ';font-size:12px">' +
          '<i style="width:6px;height:6px;border-radius:50%;background:' + (on ? '#4ae06a' : '#666') + ';display:inline-block"></i>' +
          esc(m) + '</span>';
      }).join('') + '</div>';
    box.innerHTML = html;
    renderPartyGear();
  }

  function renderPartyHud(ev) {
    try {
      if (!partyHudEl) {
        partyHudEl = document.getElementById('dol-party-hud');
        if (!partyHudEl) {
          partyHudEl = document.createElement('div');
          partyHudEl.id = 'dol-party-hud';
          partyHudEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(30px + env(safe-area-inset-top,0px));' +
            'z-index:2147482890;width:min(62vw,230px);padding:3px 7px;background:rgba(10,10,14,.78);' +
            'border:1px solid rgba(232,201,122,.35);border-radius:8px;pointer-events:none;display:none;' +
            'font:10px/1.2 sans-serif;color:#cfc6bb';
          document.body.appendChild(partyHudEl);
        }
      }
      if (!ev || ev.kind !== 'dungeon' || !ev.active) { partyHudEl.style.display = 'none'; return; }
      var hpPct = Math.max(0, Math.min(100, Math.round(ev.hp / ev.hpMax * 100)));
      var tpPct = Math.max(0, Math.min(100, Math.round(ev.teamHp / ev.teamHpMax * 100)));
      partyHudEl.innerHTML =
        '<div style="display:flex;justify-content:space-between"><span>' + esc(ev.monName || '怪物') + ' Lv.' + (ev.monLevel || 1) + '</span><span>' + ev.hp + '/' + ev.hpMax + '</span></div>' +
        '<div style="height:4px;background:#1a1a22;border-radius:2px;overflow:hidden;margin-top:1px"><div style="height:100%;width:' + hpPct + '%;background:linear-gradient(90deg,#e05a5a,#a02a2a);transition:width .35s"></div></div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:3px"><span>队伍体力</span><span>' + ev.teamHp + '/' + ev.teamHpMax + '</span></div>' +
        '<div style="height:4px;background:#1a1a22;border-radius:2px;overflow:hidden;margin-top:1px"><div style="height:100%;width:' + tpPct + '%;background:linear-gradient(90deg,#4ae06a,#2aa04a);transition:width .35s"></div></div>' +
        '<div style="font-size:9px;color:#8a8a8a;margin-top:2px">第 ' + ev.floor + ' 层 · 打开面板「队伍」可攻击</div>';
      partyHudEl.style.display = 'block';
    } catch (e) {}
  }
  function renderPartyEvent(ev) {
    partyEvent = ev;
    if (ev && ev.kind === 'dungeon') { try { renderPartyDungeon(ev); } catch (e) {} try { renderPartyHud(ev); } catch (e) {} return; }
    try { renderPartyHud(null); } catch (e) {}
    var box = document.getElementById('dol-party-event');
    if (!box) return;
    if (!ev) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var hpPct = Math.max(0, Math.round(ev.hp / ev.hpMax * 100));
    var html = '<div style="font-weight:bold;color:#e8c97a;margin-bottom:4px">共享事件：' + esc(ev.npcName || '') + (ev.active ? '' : '（已结束）') + '</div>' +
      '<div style="height:8px;background:#222;border-radius:4px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:' + hpPct + '%;background:#e05a5a"></div></div>' +
      '<div style="font-size:11px;color:#8a8a8a">HP ' + ev.hp + '/' + ev.hpMax + (ev.teamHp != null ? '　队伍 ' + ev.teamHp + '/' + ev.teamHpMax : '') + '</div>';
    if (ev.log && ev.log.length) html += '<div style="font-size:11px;color:#8a8a8a;margin-top:3px;line-height:1.5">' + ev.log.slice(-4).map(esc).join('<br>') + '</div>';
    if (ev.active && ev.members && ev.members.indexOf(USERNAME) >= 0) {
      html += '<div class="dor" style="margin-top:6px">' +
        '<button id="dol-pe-atk" style="flex:1">攻击</button>' +
        '<button id="dol-pe-aro" style="flex:1">撩拨</button>' +
        '<button id="dol-pe-heal" style="flex:1">治疗</button></div>';
    }
    box.innerHTML = html;
    var peAtk = document.getElementById('dol-pe-atk');
    if (peAtk) peAtk.onclick = function () {
      try {
        var ps = playerCombatStats();
        var dmg = Math.floor((ps.atk || 10) * 1.6 + Math.random() * 12);
        ws.send(JSON.stringify({ type: 'party_event_action', action: 'attack', role: getRole(), value: dmg }));
      } catch (e) {}
    };
    var peAro = document.getElementById('dol-pe-aro');
    if (peAro) peAro.onclick = function () {
      try { ws.send(JSON.stringify({ type: 'party_event_action', action: 'arousal', role: getRole(), value: 30 + Math.floor(Math.random() * 30) })); } catch (e) {}
    };
    var peHeal = document.getElementById('dol-pe-heal');
    if (peHeal) peHeal.onclick = function () {
      try { ws.send(JSON.stringify({ type: 'party_event_action', action: 'heal', role: getRole(), value: 0 })); } catch (e) {}
    };
    box.style.display = 'block';
  }
  function bossSaveHp() {
    try { var v = VV(); if (v) v.mpBossHp = Math.round(bossFight.hp); } catch (e) {}
  }
  var bossLog = [];
  var bossFight = { hp: 0, max: 0, mana: 100, manaMax: 100, round: 0, inFight: false, shield: 0, poison: 0, stun: 0, phase: 1 };
  function bossInitHp() {
    try {
      var max = (window.dolStaminaMax ? dolStaminaMax() : 100);
      if (!bossFight.max || bossFight.max !== max) { bossFight.max = max; bossFight.hp = max; }
    } catch (e) {}
  }
  function bossReset(b) {
    bossFight.inFight = false;
    bossFight.hp = bossFight.max;
    bossFight.mana = bossFight.manaMax;
    bossFight.round = 0; bossFight.shield = 0; bossFight.poison = 0; bossFight.stun = 0;
    bossFight.phase = 1;
    bossLog = [];
  }
  function bossAct(b, kind) {
    var ps = playerCombatStats(), af = affixStatsOf(VV());
    var atk = ps.atk || 10, def = ps.def || 3;
    var dmg = 0, txt = '';
    if (kind === 'fire') {
      if (bossFight.mana < 15) return bossLog.push('法力不足');
      bossFight.mana -= 15; dmg = Math.floor(atk * 2.2 + Math.random() * 10); txt = '火球造成 ' + dmg;
    } else if (kind === 'thunder') {
      if (bossFight.mana < 25) return bossLog.push('法力不足');
      bossFight.mana -= 25; dmg = Math.floor(atk * 3 + Math.random() * 15); bossFight.stun = 1; txt = '雷击造成 ' + dmg + '（麻痹）';
    } else if (kind === 'drain') {
      if (bossFight.mana < 22) return bossLog.push('法力不足');
      bossFight.mana -= 22; dmg = Math.floor(atk * 1.8 + Math.random() * 10);
      bossFight.hp = Math.min(bossFight.max, bossFight.hp + Math.floor(dmg / 5));
      bossFight.mana = Math.min(bossFight.manaMax, bossFight.mana + 10);
      txt = '吸取造成 ' + dmg + '（回血回蓝）';
    } else if (kind === 'shield') {
      if (bossFight.mana < 20) return bossLog.push('法力不足');
      bossFight.mana -= 20; bossFight.shield = 3; return bossLog.push('护盾展开（3 回合减伤 40%）');
    } else if (kind === 'poison') {
      if (bossFight.mana < 18) return bossLog.push('法力不足');
      bossFight.mana -= 18; bossFight.poison = 3; return bossLog.push('毒雾散开（3 回合持续伤害）');
    } else {
      dmg = Math.floor(atk * 1.5 + Math.random() * 8); txt = '攻击造成 ' + dmg;
    }
    if (Math.random() * 100 < (af.crit || 0)) { dmg = Math.floor(dmg * 2); txt += '（暴击）'; }
    if (af.lifesteal) bossFight.hp = Math.min(bossFight.max, bossFight.hp + Math.floor(dmg * af.lifesteal / 100));
    bossLog.push(txt);
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'world_boss_attack', value: dmg })); } catch (e) {}
    try { window.dolWearWeapon && dolWearWeapon(); } catch (e) {}
    bossSaveHp();
    if (b) bossFight.phase = (b.hp / b.hpMax <= 0.5) ? 2 : 1;
  }
  function bossTakeTurn(b) {
    bossFight.round++;
    if (bossFight.poison > 0) {
      bossFight.poison--;
      var pd = 8 + Math.floor(Math.random() * 5);
      try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'world_boss_attack', value: pd })); } catch (e) {}
      bossLog.push('毒素造成 ' + pd);
    }
    if (bossFight.stun > 0) { bossFight.stun--; bossLog.push('它被电得动不了'); return; }
    var ps = playerCombatStats(), af = affixStatsOf(VV());
    var base = Math.max(1, (10 + (b ? b.level : 5) * 3) - Math.floor((ps.def || 3) * 0.5));
    var isSkill = (bossFight.round % 3 === 0);
    var dmg = isSkill ? Math.floor(base * 1.8) : base;
    if (bossFight.phase >= 2) dmg = Math.floor(dmg * 1.3);
    if (Math.random() * 100 < (af.dodge || 0)) { bossLog.push('你闪开了它的攻击'); return; }
    if (bossFight.shield > 0) { bossFight.shield--; dmg = Math.floor(dmg * 0.6); }
    if (af.block) dmg = Math.max(1, Math.floor(dmg * (1 - Math.min(60, af.block) / 100)));
    bossFight.hp = Math.max(0, bossFight.hp - dmg);
    bossLog.push((isSkill ? '★ 它放出大招，' : '它反击 ') + '你受到 ' + dmg + (bossFight.phase >= 2 ? '（狂暴）' : ''));
    try { window.dolWearArmor && dolWearArmor(); } catch (e) {}
    bossSaveHp();
  }
  function renderWorldBoss(b, msg) {
    var box = document.getElementById('dol-boss');
    if (!box || !b) return;
    bossInitHp();
    var parts = [];
    for (var u in (b.contributions || {})) parts.push(esc(u) + ' ' + b.contributions[u]);

    if (!bossFight.inFight) {
      var html = '<div style="font-weight:bold;color:#e8c97a;margin-bottom:3px">' + esc(b.name) +
        ' <span style="color:#8a8a8a;font-size:11px">Lv.' + b.level + '</span></div>' +
        '<div style="font-size:12px;color:#d8c8e8">剩余血量 <b style="color:#c060f0">' + b.hp + '</b> / ' + b.hpMax + '</div>' +
        '<div style="font-size:11px;color:#8a8a8a;margin-top:2px">' + (b.alive ? ('已损失 ' + (b.hpMax - b.hp) + ' 点') : '已被击败，5 分钟后重生') + '</div>' +
        (parts.length ? '<div style="font-size:11px;color:#9ac7ff;margin-top:3px">贡献榜：' + parts.join(' · ') + '</div>' : '');
      if (b.alive) html += '<div class="dor" style="margin-top:6px"><button id="dol-boss-enter" style="width:100%">进入战斗</button></div>';
      box.innerHTML = html;
      var eb = document.getElementById('dol-boss-enter');
      if (eb) eb.onclick = function () { bossFight.inFight = true; bossFight.mana = bossFight.manaMax; bossFight.round = 0; bossFight.shield = 0; bossFight.poison = 0; bossFight.stun = 0; bossLog = []; bossFight.phase = (b.hp / b.hpMax <= 0.5) ? 2 : 1; renderWorldBoss(b); };
      return;
    }

    var html2 = '<div style="font-weight:bold;color:#e8c97a;margin-bottom:3px">' + esc(b.name) +
      ' <span style="color:#8a8a8a;font-size:11px">Lv.' + b.level + (bossFight.phase >= 2 ? ' · 狂暴' : '') + '</span></div>' +
      barHtml(b.name, b.hp, b.hpMax, 'linear-gradient(90deg,#c060f0,#5a2a8a)') +
      '<div style="font-size:11px;color:#8a8a8a;margin:2px 0">剩余 ' + b.hp + ' / ' + b.hpMax + '</div>' +
      barHtml('我', bossFight.hp, bossFight.max, 'linear-gradient(90deg,#4ae06a,#2aa04a)') +
      '<div style="font-size:11px;color:#8a9ae2;margin:2px 0">法力 ' + bossFight.mana + '/' + bossFight.manaMax + (bossFight.shield ? '　护盾 ' + bossFight.shield : '') + (bossFight.poison ? '　毒 ' + bossFight.poison : '') + '</div>' +
      (msg ? '<div style="font-size:11px;color:#e8c97a">' + esc(msg) + '</div>' : '') +
      (bossLog.length ? '<div style="font-size:11px;color:#8a8a8a;margin-top:3px;line-height:1.5">' + bossLog.slice(-4).map(esc).join('<br>') + '</div>' : '');

    if (bossFight.hp > 0) {
      html2 += '<div class="dor" style="margin-top:6px;flex-wrap:wrap">' +
        '<button data-bact="attack" style="flex:1;min-width:70px">攻击</button>' +
        '<button data-bact="fire" style="flex:1;min-width:70px">火球15</button>' +
        '<button data-bact="thunder" style="flex:1;min-width:70px">雷击25</button>' +
        '<button data-bact="drain" style="flex:1;min-width:70px">吸取22</button>' +
        '<button data-bact="shield" style="flex:1;min-width:70px">护盾20</button>' +
        '<button data-bact="poison" style="flex:1;min-width:70px">毒雾18</button>' +
        '</div><div class="dor" style="margin-top:6px"><button id="dol-boss-retreat" style="width:100%">撤退</button></div>';
    } else {
      html2 += '<div style="font-size:11px;color:#e25a5a;margin-top:4px">你倒下了</div><div class="dor" style="margin-top:6px"><button id="dol-boss-retreat" style="width:100%">撤退</button></div>';
    }
    box.innerHTML = html2;

    box.querySelectorAll('[data-bact]').forEach(function (btn) {
      btn.onclick = function () {
        try {
          bossAct(b, btn.getAttribute('data-bact'));
          if (bossFight.hp > 0) bossTakeTurn(b);
          if (bossFight.hp <= 0) bossLog.push('你撑不住了');
          renderWorldBoss(b);
        } catch (e) {}
      };
    });
    var rb = document.getElementById('dol-boss-retreat');
    if (rb) rb.onclick = function () {
      if (bossFight.hp <= 0) { bossFight.hp = bossFight.max; bossLog.push('你被抬了回去（体力恢复）'); }
      bossFight.inFight = false;
      bossSaveHp();
      renderWorldBoss(b);
    };
  }
  function doPrivateMsg() {
    if (!interactTarget) return;
    var t = prompt('给 ' + interactTarget + ' 发私信');
    if (!t) return;
    try { ws.send(JSON.stringify({ type: 'pm', to: interactTarget, text: t })); } catch (e) {}
    showToast('已发送私信');
    closeInteract();
  }
  function dgFight() {
    var v = VV(); if (!v) return;
    var m = dgEnsure();
    var MONSTERS = [
      { n: '野狼',  hp: 0.85, atk: 1.15, def: 0.85, trait: '迅捷：更容易闪避' },
      { n: '黑熊',  hp: 1.4,  atk: 1.25, def: 1.1,  trait: '厚皮：高生命高攻击' },
      { n: '野猪',  hp: 1.15, atk: 1.3,  def: 0.9,  trait: '冲锋：首击双倍伤害' },
      { n: '野猫',  hp: 0.7,  atk: 0.9,  def: 0.8,  trait: '灵巧：闪避极高' },
      { n: '怨灵',  hp: 0.8,  atk: 1.0,  def: 0.6,  trait: '吸魂：攻击时吸取法力' },
      { n: '史莱姆',hp: 1.1,  atk: 0.85, def: 1.0,  trait: '再生：每回合回血' },
      { n: '触手',  hp: 1.0,  atk: 1.1,  def: 1.0,  trait: '缠绕：降低你的敏捷' }
    ];
    var _forceBoss = !!v.dgForceBoss;
    v.dgForceBoss = false;
    var BOSSES = [
      { n: '矿坑看守', hp: 2.4, atk: 1.5, def: 1.4, trait: '重击：每三回合压倒性一击' },
      { n: '骨庙祭司', hp: 2.0, atk: 1.7, def: 1.1, trait: '召魂：会召唤亡魂' },
      { n: '深渊之影', hp: 2.8, atk: 1.6, def: 1.3, trait: '吞噬：血量过半后狂暴' }
    ];
    var mon = _forceBoss ? BOSSES[randomInt(0, BOSSES.length - 1)] : MONSTERS[randomInt(0, MONSTERS.length - 1)];
    var monName = mon.n;
    try { v.dgEnemyName = monName; } catch (e) {}
    var fl = Math.max(1, m.floor || 1);
    var lvl = Math.max(1, Math.min(20, fl + randomInt(-1, 1) - 1));
    var scale = fl <= 3 ? 0.55 : (fl <= 8 ? 1 : 1.15 + (fl - 8) * 0.12);
    var atk = Math.round((6 + lvl * 2) * scale * mon.atk * (_forceBoss ? 1.4 : 1));
    var def = Math.round((2 + lvl * 0.8) * scale * mon.def);
    var ehp = Math.round((30 + lvl * 22) * scale * mon.hp + randomInt(0, 8));
    var ehpMax = ehp;
    var hp = Number(v.dgHp) || 100;
    var mana = Number(v.dgMana) || 100;
    var pAtk = 5 + Math.floor(Math.min(100, Number(v.physique) || 0) / 10) + (Number(v.mpDgAtk) || 0);
    var pDef = 3 + Math.floor(Math.min(100, Number(v.physique) || 0) / 20) + (Number(v.mpDgDef) || 0);
    var pAgi = 3 + Math.floor(Math.min(100, Number(v.physique) || 0) / 15) + (Number(v.mpDgAgi) || 0);
    var dodge = Math.min(60, pAgi * 2);
    var af = affixStatsOf(v);
    pAtk += af.atk; pDef += af.def;
    dodge = Math.min(80, dodge + af.dodge);
    var totalLifesteal = 0;
    var rounds = 0;
    var log = [];
    var bindDebuff = 0;
    while (ehp > 0 && hp > 0 && rounds < 30) {
      rounds++;
      var myDmg = Math.max(1, pAtk - def + randomInt(-2, 3));
      if (af.crit > 0 && randomInt(1, 100) <= af.crit) { myDmg *= 2; log.push('暴击！'); }
      ehp -= myDmg;
      log.push('你对 ' + monName + ' 造成 ' + myDmg + ' 伤害');
      if (af.lifesteal > 0) totalLifesteal += Math.max(1, Math.floor(myDmg * af.lifesteal / 100));
      try { window.dolWearWeapon(); } catch (e) {}
      if (ehp <= 0) break;
      if (mon.n === '史莱姆') {
        var regen = 3 + Math.floor(lvl / 2);
        ehp = Math.min(ehpMax, ehp + regen);
        log.push('史莱姆再生 +' + regen);
      }
      var myDodge = Math.max(0, dodge - bindDebuff);
      if (randomInt(1, 100) <= myDodge) { log.push('你闪避了'); continue; }
      var monDmg = Math.max(1, atk - pDef + randomInt(-2, 2));
      if (af.block > 0) monDmg = Math.max(1, Math.floor(monDmg * (1 - af.block / 100)));
      if (mon.n === '野猪' && rounds === 1) { monDmg *= 2; log.push('野猪冲锋！'); }
      hp -= monDmg;
      log.push(monName + ' 反击 ' + monDmg + ' 伤害');
      try { window.dolWearArmor(1); } catch (e) {}
      if (mon.n === '怨灵') {
        var drain = 3 + Math.floor(lvl / 2);
        mana = Math.max(0, mana - drain);
        log.push('怨灵吸取 ' + drain + ' 法力');
      }
      if (mon.n === '触手') { bindDebuff = Math.min(20, bindDebuff + 3); }
    }
    try { checkFloorAch(v); } catch (e) {}
    try { renderBars(hp, 100, ehp, ehpMax, monName); } catch (e) {}
    try { playCombatFloats(log); } catch (e) {}
    v.dgHp = Math.max(0, hp);
    if (ehp <= 0) {
      var gold = randomInt(15, 35);
      v.money = (Number(v.money) || 0) + gold * 100;
      try { gainExp(20); } catch (e) {}
      if (Math.random() < 0.45 && window.dolDropItem) window.dolDropItem();
      showToast('击败 ' + monName + '（' + mon.trait + '），+' + fmtMoney(gold * 100));
      m.map[m.py][m.px] = '.';
    } else if (hp <= 0) {
      showToast(' 你倒下了……');
      v.dgMap = dgGen(1);
      v.dgHp = 100; v.dgMana = 100;
      window.__dolInDungeon = false;
    } else {
      showToast('⏱ 30 回合未分胜负，撤退');
    }
    v.dgMana = mana;
    dgRender();
  }
  function dgOpen() {
    var v = VV(); if (!v) return;
    var m = dgEnsure();
    var gold = randomInt(10, 40);
    v.money = (Number(v.money) || 0) + gold * 100;
    showToast(' 宝箱：+' + fmtMoney(gold * 100));
    m.map[m.py][m.px] = '.';
    v.dgMap = m;
    dgRender();
  }
  function dgRest() {
    var v = VV(); if (!v) return;
    v.dgHp = Math.min(100, (Number(v.dgHp) || 100) + 30);
    v.dgMana = Math.min(100, (Number(v.dgMana) || 100) + 40);
    showToast(' 恢复 30 体力 / 40 法力');
    dgRender();
  }
  /* ================= 肉鸽模式 · 深渊回廊 ================= */
  var RO_RARITY = {
    common: { n: '普通', c: '#9aa0a8' },
    rare: { n: '稀有', c: '#5aa8e2' },
    epic: { n: '史诗', c: '#c07ae8' },
    legend: { n: '传说', c: '#e8c97a' }
  };
  var RO_RELICS = [
    { id: 'r01', n: '铁拳', rar: 'common', d: '攻击 +4', eff: { atk: 4 } },
    { id: 'r02', n: '皮甲', rar: 'common', d: '防御 +5', eff: { def: 5 } },
    { id: 'r03', n: '血袋', rar: 'common', d: '体力上限 +20', eff: { hpMax: 20 } },
    { id: 'r04', n: '磨刀石', rar: 'common', d: '暴击 +8%', eff: { crit: 8 } },
    { id: 'r05', n: '獠牙', rar: 'common', d: '吸血 +8%', eff: { lifesteal: 8 } },
    { id: 'r06', n: '木盾', rar: 'common', d: '减伤 +7%', eff: { block: 7 } },
    { id: 'r07', n: '轻靴', rar: 'common', d: '闪避 +8%', eff: { dodge: 8 } },
    { id: 'r08', n: '火种', rar: 'common', d: '攻击附带 3 点灼烧', eff: { burn: 3 } },
    { id: 'r09', n: '兽骨', rar: 'common', d: '攻击 +2，暴击 +4%', eff: { atk: 2, crit: 4 } },
    { id: 'r10', n: '石壳', rar: 'common', d: '防御 +3，体力 +10', eff: { def: 3, hpMax: 10 } },

    { id: 'r11', n: '双刃', rar: 'rare', d: '攻击 +8', eff: { atk: 8 } },
    { id: 'r12', n: '铁壁', rar: 'rare', d: '防御 +12', eff: { def: 12 } },
    { id: 'r13', n: '巨心', rar: 'rare', d: '体力上限 +50', eff: { hpMax: 50 } },
    { id: 'r14', n: '刺客', rar: 'rare', d: '暴击 +18%', eff: { crit: 18 } },
    { id: 'r15', n: '血契', rar: 'rare', d: '吸血 +18%', eff: { lifesteal: 18 } },
    { id: 'r16', n: '荆棘', rar: 'rare', d: '受击反弹 8 点', eff: { thorns: 8 } },
    { id: 'r17', n: '再生', rar: 'rare', d: '每回合回复 4 体力', eff: { regen: 4 } },
    { id: 'r18', n: '贪婪', rar: 'rare', d: '金币 +50%', eff: { gold: 50 } },
    { id: 'r19', n: '猎手', rar: 'rare', d: '遗物品阶提升', eff: { drop: 12 } },
    { id: 'r20', n: '先手', rar: 'rare', d: '每场战斗第一击 ×1.8', eff: { firstStrike: 1 } },

    { id: 'r21', n: '战意', rar: 'epic', d: '攻击 +14', eff: { atk: 14 } },
    { id: 'r22', n: '龙鳞', rar: 'epic', d: '防御 +18，减伤 +10%', eff: { def: 18, block: 10 } },
    { id: 'r23', n: '不灭', rar: 'epic', d: '体力 +80，每回合回 3', eff: { hpMax: 80, regen: 3 } },
    { id: 'r24', n: '处决', rar: 'epic', d: '敌人低于 25% 血时伤害 ×1.6', eff: { execute: 1 } },
    { id: 'r25', n: '狂血', rar: 'epic', d: '攻击 +10，吸血 +15%', eff: { atk: 10, lifesteal: 15 } },
    { id: 'r26', n: '秘银', rar: 'epic', d: '攻击 +8，防御 +8，暴击 +8%', eff: { atk: 8, def: 8, crit: 8 } },
    { id: 'r27', n: '毒囊', rar: 'epic', d: '攻击附带 7 点毒性', eff: { burn: 7 } },
    { id: 'r28', n: '财宝', rar: 'epic', d: '金币 +80%，品阶提升', eff: { gold: 80, drop: 20 } },

    { id: 'r29', n: '弑神', rar: 'legend', d: '攻击 +25', eff: { atk: 25 } },
    { id: 'r30', n: '永恒', rar: 'legend', d: '体力 +150，每回合回 6', eff: { hpMax: 150, regen: 6 } },
    { id: 'r31', n: '虚无', rar: 'legend', d: '暴击 +35%，暴击伤害 ×2.5', eff: { crit: 35, critMul: 150 } },
    { id: 'r32', n: '轮回', rar: 'legend', d: '攻击 +15，防御 +15，体力 +30', eff: { atk: 15, def: 15, hpMax: 30 } }
  ];
  var RO_RELIC_BY = {};
  RO_RELICS.forEach(function (x) { RO_RELIC_BY[x.id] = x; });

  var RO_CURSES = [
    { id: 'c1', n: '虚弱', d: '攻击 -6', eff: { atk: -6 } },
    { id: 'c2', n: '破甲', d: '防御 -6', eff: { def: -6 } },
    { id: 'c3', n: '迟缓', d: '闪避 -12%', eff: { dodge: -12 } },
    { id: 'c4', n: '侵蚀', d: '体力上限 -25', eff: { hpMax: -25 } },
    { id: 'c5', n: '霉运', d: '金币 -40%', eff: { gold: -40 } }
  ];
  var RO_CURSE_BY = {};
  RO_CURSES.forEach(function (x) { RO_CURSE_BY[x.id] = x; });

  var RO_PERKS = [
    { k: 'hp', n: '体魄', d: '开局体力上限 +15', max: 10, base: 3 },
    { k: 'atk', n: '锋锐', d: '开局攻击 +3', max: 10, base: 3 },
    { k: 'def', n: '坚壁', d: '开局防御 +3', max: 10, base: 3 },
    { k: 'crit', n: '洞察', d: '开局暴击 +3%', max: 8, base: 4 },
    { k: 'luck', n: '运势', d: '遗物品阶提升', max: 5, base: 6 },
    { k: 'soul', n: '魂收', d: '魂币获取 +10%', max: 5, base: 5 },
    { k: 'revive', n: '残魂', d: '每局复活一次（半血）', max: 1, base: 30 }
  ];
  function roPerkCost(p, lv) { return p.base * (lv + 1); }

  function roMeta() {
    var v = VV(); if (!v) return { soul: 0, best: 0, runs: 0, perks: {} };
    if (!v.roMeta || typeof v.roMeta !== 'object') v.roMeta = {};
    var m = v.roMeta;
    if (typeof m.soul !== 'number') m.soul = 0;
    if (typeof m.best !== 'number') m.best = 0;
    if (typeof m.runs !== 'number') m.runs = 0;
    if (!m.perks || typeof m.perks !== 'object') m.perks = {};
    return m;
  }

  function roStats() {
    var v = VV(); var r = v && v.roRun;
    if (!r) return null;
    var m = roMeta(), P = m.perks || {};
    var s = {
      atk: 12 + (Number(P.atk) || 0) * 3 + (Number(r.growth) || 0) * 2,
      def: 5 + (Number(P.def) || 0) * 3 + (Number(r.growth) || 0) * 1,
      hpMax: 130 + (Number(P.hp) || 0) * 15 + (Number(r.growth) || 0) * 7,
      crit: 5 + (Number(P.crit) || 0) * 3,
      critMul: 100,
      lifesteal: 0, block: 0, dodge: 5, thorns: 0, regen: 0,
      gold: 0, drop: 0, burn: 0, firstStrike: 0, execute: 0
    };
    function apply(list, pool) {
      (list || []).forEach(function (id) {
        var d = pool[id]; if (!d) return;
        var e = d.eff || {};
        for (var k in e) s[k] = (Number(s[k]) || 0) + Number(e[k]);
      });
    }
    apply(r.relics, RO_RELIC_BY);
    apply(r.curses, RO_CURSE_BY);
    try {
      var _b = r.bonus || {};
      s.atk += Number(_b.atk) || 0;
      s.def += Number(_b.def) || 0;
      s.hpMax += Number(_b.hpMax) || 0;
      s.crit += Number(_b.crit) || 0;
    } catch (e) {}
    s.atk = Math.max(1, Math.round(s.atk));
    s.def = Math.max(0, Math.round(s.def));
    s.hpMax = Math.max(20, Math.round(s.hpMax));
    s.crit = Math.max(0, Math.min(90, s.crit));
    s.dodge = Math.max(0, Math.min(70, s.dodge));
    return s;
  }

  function roGen(floor) {
    var W = 9, H = 9, map = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) {
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { row.push('#'); continue; }
        var q = Math.random();
        if (q < 0.15) row.push('#');
        else if (q < 0.32) row.push('M');
        else if (q < 0.44) row.push('C');
        else if (q < 0.54) row.push('?');
        else if (q < 0.62) row.push('+');
        else row.push('.');
      }
      map.push(row);
    }
    for (var cx = 1; cx <= W - 2; cx++) if (map[H - 2][cx] === '#') map[H - 2][cx] = '.';
    for (var cy = H - 2; cy >= 1; cy--) if (map[cy][W - 2] === '#') map[cy][W - 2] = '.';
    map[H - 2][1] = 'S';
    map[1][W - 2] = 'L';
    if (floor % 5 === 0) map[2][W - 2] = 'B';
    return { map: map, px: 1, py: H - 2, floor: floor, seen: {} };
  }
  function roReveal(m) {
    try {
      if (!m.seen) m.seen = {};
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3) continue;
          var x = m.px + dx, y = m.py + dy;
          if (x < 0 || y < 0 || x > 8 || y > 8) continue;
          m.seen[x + ',' + y] = 1;
        }
      }
    } catch (e) {}
  }

  function roStart() {
    try {
      var v = VV(); if (!v) return;
      var m = roMeta();
      m.runs = (Number(m.runs) || 0) + 1;
      v.roRun = {
        on: true, screen: 'map', floor: 1, hp: 0, kills: 0, gold: 0,
        relics: [], curses: [], revive: 0, fight: null, evt: null, evtMsg: '',
        map: roGen(1)
      };
      var s = roStats();
      v.roRun.hp = s.hpMax;
      roReveal(v.roRun.map);
      window.__dolRoOpen = true;
      roRender();
      showToast('进入深渊回廊：第 1 层');
    } catch (e) { showToast('开局失败：' + (e && e.message ? e.message : '')); }
  }

  function roGiveRandomRelic(r, minRank) {
    try {
      var s = roStats() || { drop: 0 };
      var have = r.relics || [];
      var pool = RO_RELICS.filter(function (x) { return have.indexOf(x.id) < 0; });
      if (!pool.length) return null;
      var rank = { common: 0, rare: 1, epic: 2, legend: 3 };
      var minR = Number(minRank) || 0;
      var filtered = pool.filter(function (x) { return rank[x.rar] >= minR; });
      if (!filtered.length) filtered = pool;
      var w = filtered.map(function (x) {
        var base = { common: 50, rare: 28, epic: 16, legend: 6 }[x.rar] || 10;
        if (x.rar === 'rare') base += (Number(s.drop) || 0) * 0.6;
        if (x.rar === 'epic') base += (Number(s.drop) || 0) * 0.5;
        if (x.rar === 'legend') base += (Number(s.drop) || 0) * 0.3;
        return base;
      });
      var tot = w.reduce(function (a, b) { return a + b; }, 0);
      var t = Math.random() * tot, idx = 0;
      for (var i = 0; i < filtered.length; i++) { t -= w[i]; if (t <= 0) { idx = i; break; } }
      var pick = filtered[idx];
      r.relics = (r.relics || []).concat([pick.id]);
      return pick;
    } catch (e) { return null; }
  }
  function roAddCurse(r) {
    try {
      var have = r.curses || [];
      var pool = RO_CURSES.filter(function (x) { return have.indexOf(x.id) < 0; });
      if (!pool.length) return null;
      var pick = pool[randomInt(0, pool.length - 1)];
      r.curses = have.concat([pick.id]);
      showToast('获得诅咒：' + pick.n);
      return pick;
    } catch (e) { return null; }
  }

  function roDraft(n, boost) {
    try {
      var v = VV(); var r = v && v.roRun; if (!r) return;
      var s = roStats() || { drop: 0 };
      var count = Number(n) || 3;
      var have = r.relics || [];
      var pool = RO_RELICS.filter(function (x) { return have.indexOf(x.id) < 0; });
      if (!pool.length) { r.screen = 'map'; return; }
      var rank = { common: 0, rare: 1, epic: 2, legend: 3 };
      var minR = 0;
      if (r.luckNext || boost) minR = 1;
      if (r.luckNext && boost) minR = 2;
      var filtered = pool.filter(function (x) { return rank[x.rar] >= minR; });
      if (filtered.length < count) filtered = pool;
      var picks = [];
      for (var i = 0; i < count && filtered.length; i++) {
        var w = filtered.map(function (x) {
          var base = { common: 50, rare: 28, epic: 16, legend: 6 }[x.rar] || 10;
          if (x.rar === 'rare') base += (Number(s.drop) || 0) * 0.6;
          if (x.rar === 'epic') base += (Number(s.drop) || 0) * 0.5;
          if (x.rar === 'legend') base += (Number(s.drop) || 0) * 0.3;
          return base;
        });
        var tot = w.reduce(function (a, b) { return a + b; }, 0);
        var t = Math.random() * tot, idx = 0;
        for (var j = 0; j < filtered.length; j++) { t -= w[j]; if (t <= 0) { idx = j; break; } }
        picks.push(filtered.splice(idx, 1)[0]);
      }
      r.draft = picks.map(function (x) { return x.id; });
      r.screen = 'draft';
      roRender();
    } catch (e) {}
  }

  function roMove(dir) {
    try {
      var v = VV(); var r = v && v.roRun;
      if (!r || !r.on || r.screen !== 'map') return;
      var m = r.map; if (!m) return;
      var dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0;
      var dy = dir === 'u' ? -1 : dir === 'd' ? 1 : 0;
      var nx = m.px + dx, ny = m.py + dy;
      if (nx < 0 || ny < 0 || nx > 8 || ny > 8) return;
      var c = (m.map[ny] && m.map[ny][nx]) || '#';
      if (c === '#') { showToast('走不通'); return; }
      m.px = nx; m.py = ny;
      roReveal(m);
      // 碰到标记直接触发互动（楼梯 L 除外）
      if (c === 'M') { roFight(false); return; }
      if (c === 'C') { roChest(); return; }
      if (c === '?') { roEventOpen(); return; }
      if (c === '+') { roRest(); return; }
      if (c === 'B') { roFight(true); return; }
      roRender();
    } catch (e) {}
  }

  function roFight(forceBoss) {
    try {
      var v = VV(); var r = v && v.roRun;
      if (!r || !r.on || r.screen !== 'map') return;
      var m = r.map; if (!m) return;
      var s = roStats();
      var fl = Number(r.floor) || 1;
      var isBoss = !!forceBoss;
      var names = ['腐鼠', '骸骨兵', '石像鬼', '血蝠', '沼泽蜥', '游荡骑士', '深渊蠕虫', '无面者', '晶簇守卫', '堕落祭司'];
      var bosses = ['矿坑之主', '骨庙大祭司', '深渊守望者'];
      var name = isBoss ? bosses[Math.max(0, Math.min(2, Math.floor(fl / 5) - 1))] : names[randomInt(0, names.length - 1)];
      var eliteTag = '';

      var elite = !isBoss && Math.random() < 0.12;
      var ehp = Math.round((30 + fl * 15 + fl * fl * 1.5) * (isBoss ? 2.0 : 1) * (elite ? 1.5 : 1) * (1 + Math.random() * 0.1));
      var ehpMax = ehp;
      var eatk = Math.round((6 + fl * 2.0 + fl * fl * 0.28) * (isBoss ? 1.3 : 1) * (elite ? 1.2 : 1));
      var edef = Math.round(2 + fl * 1.1);

      var php = Number(r.hp) || 0;
      var rounds = 0, log = [];
      while (ehp > 0 && php > 0 && rounds < 40) {
        rounds++;
        var dmg = Math.max(1, s.atk - edef + randomInt(-2, 2));
        var crit = randomInt(1, 100) <= s.crit;
        if (crit) dmg = Math.round(dmg * (1 + s.critMul / 100));
        if (s.execute && ehp / ehpMax < 0.25) dmg = Math.round(dmg * 1.6);
        if (s.firstStrike && rounds === 1) dmg = Math.round(dmg * 1.8);
        ehp -= dmg;
        log.push('你造成 ' + dmg + ' 伤害' + (crit ? '（暴击）' : ''));
        if (s.burn > 0) { ehp -= s.burn; log.push('灼烧 ' + s.burn); }
        if (s.lifesteal > 0) {
          var heal = Math.max(1, Math.round(dmg * s.lifesteal / 100));
          php = Math.min(s.hpMax, php + heal);
        }
        if (ehp <= 0) break;
        if (randomInt(1, 100) <= s.dodge) {
          log.push('你闪开了');
        } else {
          var take = Math.max(1, eatk - s.def + randomInt(-2, 2));
          if (s.block > 0) take = Math.max(1, Math.round(take * (1 - Math.min(60, s.block) / 100)));
          php -= take;
          log.push(name + ' 造成 ' + take + ' 伤害');
          if (s.thorns > 0) { ehp -= s.thorns; log.push('荆棘反弹 ' + s.thorns); }
        }
        if (s.regen > 0) php = Math.min(s.hpMax, php + s.regen);
      }

      r.hp = Math.max(0, Math.min(s.hpMax, php));

      if (ehp <= 0) {
        r.kills = (Number(r.kills) || 0) + 1;
        var gold = Math.round((isBoss ? 120 : 25 + fl * 4) * (1 + s.gold / 100) * (elite ? 1.6 : 1));
        r.gold = (Number(r.gold) || 0) + gold;
        log.push('获得 ' + gold + ' 金币');
        var restHp = Math.round(s.hpMax * (isBoss ? 0.25 : 0.15));
        r.hp = Math.min(s.hpMax, r.hp + restHp);
        m.map[m.py][m.px] = '.';
        r.fight = { name: name + (elite ? '·精英' : ''), log: log.slice(-8), win: true, boss: isBoss };
        if (isBoss) { if (!r.noCurse) roAddCurse(r); roDraft(4, 1); return; }
      } else if (php <= 0) {
        r.fight = { name: name, log: log.slice(-8), win: false, boss: isBoss };
        roDeath();
        return;
      } else {
        r.hp = Math.max(1, r.hp - Math.round(s.hpMax * 0.15));
        log.push('缠斗太久，你退开了');
        r.fight = { name: name + (elite ? '·精英' : ''), log: log.slice(-8), win: false, boss: isBoss };
      }
      roRender();
    } catch (e) { showToast('战斗出错：' + (e && e.message ? e.message : '')); }
  }

  function roDeath() {
    try {
      var v = VV(); var r = v && v.roRun; if (!r) return;
      var m = roMeta(), P = m.perks || {};
      var s = roStats() || { hpMax: 60 };
      if ((Number(P.revive) || 0) > 0 && !r.revive) {
        r.revive = 1;
        r.hp = Math.round(s.hpMax * 0.5);
        r.screen = 'map';
        showToast('残魂发动：你从死里爬了回来');
        roRender();
        return;
      }
      var gain = Math.round(((Number(r.floor) || 1) * 8 + (Number(r.kills) || 0) * 2) * (1 + (Number(P.soul) || 0) * 0.1));
      m.soul = (Number(m.soul) || 0) + gain;
      if ((Number(r.floor) || 1) > (Number(m.best) || 0)) m.best = Number(r.floor) || 1;
      r.lastGain = gain;
      r.screen = 'dead';
      r.on = false;
      roRender();
    } catch (e) {}
  }

  function roChest() {
    try {
      var v = VV(); var r = v && v.roRun; if (!r || !r.map) return;
      var m = r.map;
      if (((m.map[m.py] || [])[m.px] || '') !== 'C') return;
      var s = roStats();
      var gold = Math.round((20 + (Number(r.floor) || 1) * 6) * (1 + s.gold / 100) * (1 + Math.random() * 0.5));
      r.gold = (Number(r.gold) || 0) + gold;
      m.map[m.py][m.px] = '.';
      showToast('宝箱：+' + gold + ' 金币');
      roRender();
    } catch (e) {}
  }
  function roRest() {
    try {
      var v = VV(); var r = v && v.roRun; if (!r || !r.map) return;
      var m = r.map, s = roStats();
      if (((m.map[m.py] || [])[m.px] || '') !== '+') { showToast('这里不能休息'); return; }
      if ((Number(r.hp) || 0) >= s.hpMax) { showToast('体力已满，营地留着'); roRender(); return; }
      r.hp = Math.min(s.hpMax, (Number(r.hp) || 0) + Math.round(s.hpMax * 0.35));
      m.map[m.py][m.px] = '.';
      showToast('营地：回复 35% 体力');
      roRender();
    } catch (e) {}
  }
  function roNextFloor() {
    try {
      var v = VV(); var r = v && v.roRun;
      if (!r || !r.on || r.screen !== 'map') return;
      var m = r.map;
      if (!m || ((m.map[m.py] || [])[m.px] || '') !== 'L') { showToast('还没找到向下的楼梯'); return; }
      r.floor = (Number(r.floor) || 1) + 1;
      r.growth = (Number(r.growth) || 0) + 1;
      r.map = roGen(r.floor);
      roReveal(r.map);
      var s = roStats();
      r.hp = Math.min(s.hpMax, (Number(r.hp) || 0) + Math.round(s.hpMax * 0.08));
      r.fight = null;
      var boss = (r.floor % 5 === 0);
      roDraft(3, 0);
      showToast('进入第 ' + r.floor + ' 层');
    } catch (e) {}
  }

  var RO_EVENTS = [
    {
      n: '血泉', t: '石缝里涌出一汪暗红的泉水，散着铁锈味。',
      o: [
        { n: '饮下', d: '回复 40% 体力', f: function (r, s) { r.hp = Math.min(s.hpMax, (Number(r.hp) || 0) + Math.round(s.hpMax * 0.4)); return '体力回复了'; } },
        { n: '装瓶带走', d: '+50 金币，失去 15% 体力', f: function (r, s) { r.gold = (Number(r.gold) || 0) + 50; r.hp = Math.max(1, (Number(r.hp) || 0) - Math.round(s.hpMax * 0.15)); return '金币 +50'; } },
        { n: '离开', d: '', f: function () { return '你退开了'; } }
      ]
    },
    {
      n: '骸骨赌徒', t: '一具骸骨还保持着掷骰的姿势，骰子散在脚边。',
      o: [
        { n: '掷一把', d: '一半 +120 金币，一半失去 20% 体力', f: function (r, s) { if (Math.random() < 0.5) { r.gold = (Number(r.gold) || 0) + 120; return '骰子站在你这边：+120 金币'; } r.hp = Math.max(1, (Number(r.hp) || 0) - Math.round(s.hpMax * 0.2)); return '失手了，失去 20% 体力'; } },
        { n: '拿走他的钱', d: '+60 金币，获得一个诅咒', f: function (r) { r.gold = (Number(r.gold) || 0) + 60; roAddCurse(r); return '你数着钱，背后凉了一下'; } },
        { n: '离开', d: '', f: function () { return '你绕开了骸骨'; } }
      ]
    },
    {
      n: '武器架', t: '一面石墙嵌着生锈的武器架，还没被人搬空。',
      o: [
        { n: '取走一件', d: '获得一件遗物', f: function (r) { roGiveRandomRelic(r, 1); return '你取下了还算完整的那件'; } },
        { n: '拆下来卖', d: '+90 金币', f: function (r) { r.gold = (Number(r.gold) || 0) + 90; return '金币 +90'; } },
        { n: '离开', d: '', f: function () { return '你继续往前走'; } }
      ]
    },
    {
      n: '沉默的祭坛', t: '祭坛中央刻着眼睛的纹路，似乎在等什么。',
      o: [
        { n: '献上鲜血', d: '失去 30% 体力，获得史诗遗物', f: function (r, s) { r.hp = Math.max(1, (Number(r.hp) || 0) - Math.round(s.hpMax * 0.3)); roGiveRandomRelic(r, 2); return '纹路亮起，有什么落进你手里'; } },
        { n: '跪下祈祷', d: '回复 30% 体力', f: function (r, s) { r.hp = Math.min(s.hpMax, (Number(r.hp) || 0) + Math.round(s.hpMax * 0.3)); return '一阵暖意'; } },
        { n: '离开', d: '', f: function () { return '眼睛一直看着你离开'; } }
      ]
    },
    {
      n: '迷雾商人', t: '一个裹在雾里的影子摊开手掌，掌心里是别人的东西。',
      o: [
        { n: '付 80 金币', d: '获得一件遗物', f: function (r) { if ((Number(r.gold) || 0) < 80) return '你付不起，影子散了'; r.gold -= 80; roGiveRandomRelic(r, 1); return '影子收下钱，留下一件东西'; } },
        { n: '用诅咒换', d: '获得一件遗物，附带诅咒', f: function (r) { roGiveRandomRelic(r, 2); roAddCurse(r); return '你拿走的，影子笑了'; } },
        { n: '离开', d: '', f: function () { return '雾散开了'; } }
      ]
    },
    {
      n: '枯井', t: '井底很深，黑洞洞的，没有水声。',
      o: [
        { n: '打水', d: '回复 25% 体力', f: function (r, s) { r.hp = Math.min(s.hpMax, (Number(r.hp) || 0) + Math.round(s.hpMax * 0.25)); return '水是苦的，但有用'; } },
        { n: '丢一枚金币许愿', d: '-30 金币，下层的遗物更好', f: function (r) { r.gold = Math.max(0, (Number(r.gold) || 0) - 30); r.luckNext = 1; return '你许了一个愿'; } },
        { n: '离开', d: '', f: function () { return '你离开了井边'; } }
      ]
    },
    {
      n: '无灯的回廊', t: '前面一段完全没有光，连墙都看不见。',
      o: [
        { n: '摸黑往前走', d: '随机传送到本层某处', f: function (r) {
            var cells = [];
            for (var y = 1; y <= 7; y++) for (var x = 1; x <= 7; x++) {
              var c = (r.map.map[y] || [])[x];
              if (c === '.' || c === 'L') cells.push([x, y]);
            }
            if (cells.length) { var cc = cells[randomInt(0, cells.length - 1)]; r.map.px = cc[0]; r.map.py = cc[1]; roReveal(r.map); }
            return '你在黑暗里走了很久，再睁眼时已经不在原地';
          } },
        { n: '点火把', d: '-20 金币，照亮整层', f: function (r) {
            if ((Number(r.gold) || 0) < 20) return '你没有火，也没有钱';
            r.gold -= 20;
            for (var y = 0; y < 9; y++) for (var x = 0; x < 9; x++) r.map.seen[x + ',' + y] = 1;
            return '火把亮起来，这一层的地形全看清了';
          } },
        { n: '原路退回', d: '', f: function () { return '你退回了有光的地方'; } }
      ]
    },
    {
      n: '铁笼', t: '笼子里蜷着一个人，锁头早就锈死了。',
      o: [
        { n: '砸开锁', d: '获得一件遗物', f: function (r) { var it = roGiveRandomRelic(r, 1); return it ? ('他塞给你一件东西就走了：' + it.n) : '笼子里已经没人了'; } },
        { n: '搜他的包裹', d: '+70 金币', f: function (r) { r.gold = (Number(r.gold) || 0) + 70; return '金币 +70，他没有反抗'; } },
        { n: '离开', d: '', f: function () { return '你走开了，笼子里的人没有出声'; } }
      ]
    },
    {
      n: '断桥', t: '石桥断了一截，下面是看不见底的裂缝。',
      o: [
        { n: '绕路', d: '失去 15% 体力', f: function (r, s2) { r.hp = Math.max(1, (Number(r.hp) || 0) - Math.round(s2.hpMax * 0.15)); return '多走了很远，脚底磨破了'; } },
        { n: '跳过去', d: '一半没事，一半掉 25%', f: function (r, s2) { if (Math.random() < 0.5) { r.gold = (Number(r.gold) || 0) + 60; return '你稳稳落地，还捡到别人掉的钱袋'; } r.hp = Math.max(1, (Number(r.hp) || 0) - Math.round(s2.hpMax * 0.25)); return '你抓着边沿爬上来，手全是血'; } },
        { n: '离开', d: '', f: function () { return '你决定不冒这个险'; } }
      ]
    },
    {
      n: '骸骨堆', t: '一堆骨头里闪着几点金属的反光。',
      o: [
        { n: '翻找', d: '+70 金币，三成概率带诅咒', f: function (r) { r.gold = (Number(r.gold) || 0) + 70; if (Math.random() < 0.3) { roAddCurse(r); return '金币到手，但你带走了不该带走的东西'; } return '你翻出一把金币'; } },
        { n: '一把火烧了', d: '体力上限 +10', f: function (r) { r.bonus = r.bonus || {}; r.bonus.hpMax = (Number(r.bonus.hpMax) || 0) + 10; return '火烧了很久，你觉得自己轻了一点'; } },
        { n: '离开', d: '', f: function () { return '你没有动它们'; } }
      ]
    },
    {
      n: '血书', t: '墙上写满了同一个名字，用的是干掉的血。',
      o: [
        { n: '读下去', d: '本局攻击 +3', f: function (r) { r.bonus = r.bonus || {}; r.bonus.atk = (Number(r.bonus.atk) || 0) + 3; return '你看懂了那些字，手在抖，但挥得更有力'; } },
        { n: '烧掉', d: '+70 金币', f: function (r) { r.gold = (Number(r.gold) || 0) + 70; return '火光里那些字扭曲成一团'; } },
        { n: '离开', d: '', f: function () { return '你没有读完'; } }
      ]
    },
    {
      n: '镜厅', t: '四面都是镜子，但镜子里的你没有跟着动。',
      o: [
        { n: '盯着它', d: '本局暴击 +8%', f: function (r) { r.bonus = r.bonus || {}; r.bonus.crit = (Number(r.bonus.crit) || 0) + 8; return '镜子里的你先笑了'; } },
        { n: '打碎镜子', d: '+120 金币，附带诅咒', f: function (r) { r.gold = (Number(r.gold) || 0) + 120; roAddCurse(r); return '碎片割破手，钱掉了一地'; } },
        { n: '离开', d: '', f: function () { return '你背对着镜子走了出去'; } }
      ]
    },
    {
      n: '老兵墓碑', t: '一块歪掉的石碑，刻着名字和一句「他死在第五层」。',
      o: [
        { n: '敬礼', d: '体力上限 +15', f: function (r) { r.bonus = r.bonus || {}; r.bonus.hpMax = (Number(r.bonus.hpMax) || 0) + 15; return '你站了很久，然后继续往下走'; } },
        { n: '挖开', d: '+150 金币，附带诅咒', f: function (r) { r.gold = (Number(r.gold) || 0) + 150; roAddCurse(r); return '他身上的东西还在'; } },
        { n: '离开', d: '', f: function () { return '你绕过了墓碑'; } }
      ]
    },
    {
      n: '深渊裂隙', t: '地面裂开一道缝，里面传来很低的声音。',
      o: [
        { n: '跳进去', d: '一半得传说遗物，一半掉一半血', f: function (r, s2) {
            if (Math.random() < 0.5) { var it = roGiveRandomRelic(r, 3); return it ? ('你在下面摸到了' + it.n) : '下面什么都没有'; }
            r.hp = Math.max(1, (Number(r.hp) || 0) - Math.round(s2.hpMax * 0.5)); return '你被吐了出来，浑身是血';
          } },
        { n: '往里扔金币', d: '-40 金币，回复 30% 体力', f: function (r, s2) { if ((Number(r.gold) || 0) < 40) return '你没有钱可以扔'; r.gold -= 40; r.hp = Math.min(s2.hpMax, (Number(r.hp) || 0) + Math.round(s2.hpMax * 0.3)); return '声音停了，你觉得暖和了点'; } },
        { n: '离开', d: '', f: function () { return '你退开了'; } }
      ]
    },
    {
      n: '遗忘的商店', t: '柜台后面没有人，东西上贴着价签。',
      o: [
        { n: '买一件（100 金币）', d: '随机遗物', f: function (r) { if ((Number(r.gold) || 0) < 100) return '钱不够，价签上的数字很刺眼'; r.gold -= 100; var it = roGiveRandomRelic(r, 1); return it ? ('柜台下的东西是：' + it.n) : '柜台是空的'; } },
        { n: '买药（50 金币）', d: '回复 50% 体力', f: function (r, s2) { if ((Number(r.gold) || 0) < 50) return '钱不够'; r.gold -= 50; r.hp = Math.min(s2.hpMax, (Number(r.hp) || 0) + Math.round(s2.hpMax * 0.5)); return '味道很怪，但确实有用'; } },
        { n: '拿钱走人', d: '+30 金币', f: function (r) { r.gold = (Number(r.gold) || 0) + 30; return '柜台里还有几枚硬币'; } }
      ]
    },
    {
      n: '死斗场', t: '一个圆形的场地，边上挂着生锈的铁链，还有没干的血。',
      o: [
        { n: '接受挑战', d: '立刻打一场强敌，赢了四选一', f: function (r) { r.fightNext = 'elite'; return '铁链落下来，门在你身后关上了'; } },
        { n: '离开', d: '', f: function () { return '你从侧门走了出去'; } }
      ]
    }
  ];

  function roEventOpen() {
    try {
      var v = VV(); var r = v && v.roRun;
      if (!r || !r.map) return;
      if (((r.map.map[r.map.py] || [])[r.map.px] || '') !== '?') { showToast('这里没有事件'); return; }
      r.evt = randomInt(0, RO_EVENTS.length - 1);
      r.evtMsg = '';
      r.screen = 'event';
      roRender();
    } catch (e) {}
  }
  function roEventOpt(i) {
    try {
      var v = VV(); var r = v && v.roRun; if (!r) return;
      var ev = RO_EVENTS[Number(r.evt) || 0];
      if (!ev || !ev.o || !ev.o[i]) return;
      var s = roStats();
      var msg = '';
      // 先清掉事件格，避免事件里传送后原格子仍可复用
      if (r.map) r.map.map[r.map.py][r.map.px] = '.';
      try { msg = ev.o[i].f(r, s) || ''; } catch (e) { msg = ''; }
      r.evtMsg = msg;
      r.evtDone = 1;
      r.screen = 'event';
      roRender();
    } catch (e) {}
  }
  function roCloseEvent() {
    try {
      var v = VV(); var r = v && v.roRun; if (!r) return;
      r.screen = 'map'; r.evtDone = 0; r.evtMsg = '';
      if (r.fightNext) {
        var _fn = r.fightNext;
        r.fightNext = '';
        r.noCurse = 1;
        roFight(true);
        r.noCurse = 0;
        return;
      }
      roRender();
    } catch (e) {}
  }

  function roBuyPerk(k) {
    try {
      var m = roMeta(), P = m.perks || {};
      var p = null;
      RO_PERKS.forEach(function (x) { if (x.k === k) p = x; });
      if (!p) return;
      var lv = Number(P[k]) || 0;
      if (lv >= p.max) { showToast('已满级'); return; }
      var cost = roPerkCost(p, lv);
      if ((Number(m.soul) || 0) < cost) { showToast('魂币不足（需要 ' + cost + '）'); return; }
      m.soul -= cost;
      P[k] = lv + 1;
      m.perks = P;
      showToast(p.n + ' 升到 Lv.' + (lv + 1));
      roRender();
    } catch (e) {}
  }

  function roOverlay() {
    var ov = document.getElementById('dol-ro-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'dol-ro-overlay';
      ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147482000;background:#08090c;display:none;' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 12px 40px';
      ov.innerHTML = '<div id="dol-ro-body" style="max-width:430px;margin:0 auto;color:#c8c4bc;font-size:13px"></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-ro]') : null;
        if (!t) return;
        var a = t.getAttribute('data-ro');
        var arg = t.getAttribute('data-arg') || '';
        roAct(a, arg);
      });
    }
    return ov;
  }
  function roAct(a, arg) {
    try {
      if (a === 'start') roStart();
      else if (a === 'close') { window.__dolRoOpen = false; roRender(); }
      else if (a === 'move') roMove(arg);
      else if (a === 'fight') roFight(arg === 'boss');
      else if (a === 'chest') roChest();
      else if (a === 'rest') roRest();
      else if (a === 'event') roEventOpen();
      else if (a === 'next') roNextFloor();
      else if (a === 'pick') roPickRelic(arg);
      else if (a === 'opt') roEventOpt(Number(arg));
      else if (a === 'evtdone') roCloseEvent();
      else if (a === 'perk') roBuyPerk(arg);
      else if (a === 'restart') roStart();
      else if (a === 'menu') { var v = VV(); if (v) v.roRun = null; roRender(); }
    } catch (e) { showToast('操作失败：' + (e && e.message ? e.message : '')); }
  }
  function roPickRelic(id) {
    try {
      var v = VV(); var r = v && v.roRun; if (!r) return;
      if (!RO_RELIC_BY[id]) return;
      if ((r.relics || []).indexOf(id) >= 0) { showToast('已经有了'); return; }
      r.relics = (r.relics || []).concat([id]);
      r.screen = 'map';
      r.draft = null;
      r.luckNext = 0;
      var s = roStats();
      r.hp = Math.min(s.hpMax, (Number(r.hp) || 0) + 0);
      showToast('获得遗物：' + RO_RELIC_BY[id].n);
      roRender();
    } catch (e) {}
  }
  function roBtn(a, label, color, arg) {
    return '<div data-ro="' + a + '"' + (arg ? ' data-arg="' + esc(arg) + '"' : '') +
      ' style="padding:9px 10px;margin:5px 0;border-radius:8px;text-align:center;cursor:pointer;' +
      'border:1px solid ' + (color || '#3a3f4a') + '55;background:' + (color || '#3a3f4a') + '18;color:' + (color || '#c8c4bc') + ';font-size:13px">' +
      label + '</div>';
  }

  function roRender() {
    try {
      var ov = roOverlay();
      var open = !!window.__dolRoOpen;
      ov.style.display = open ? 'block' : 'none';
      if (!open) return;
      var body = document.getElementById('dol-ro-body');
      if (!body) return;
      var v = VV(); var r = v && v.roRun;
      if (!r) { body.innerHTML = roMenuHtml(); return; }
      if (r.screen === 'dead') { body.innerHTML = roDeadHtml(r); return; }
      if (r.screen === 'draft') { body.innerHTML = roDraftHtml(r); return; }
      if (r.screen === 'event') { body.innerHTML = roEventHtml(r); return; }
      body.innerHTML = roMapHtml(r);
    } catch (e) {}
  }

  function roCloseBar() {
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<b style="color:#e8c97a;font-size:15px;letter-spacing:1px">深渊回廊</b>' +
      '<span data-ro="close" style="padding:4px 10px;font-size:12px;color:#8a8a92;border:1px solid #2a2d34;border-radius:6px;cursor:pointer">收起</span></div>';
  }

  function roMenuHtml() {
    var m = roMeta();
    var P = m.perks || {};
    var html = roCloseBar();
    html += '<div style="font-size:12px;color:#7a7a86;line-height:1.7;margin-bottom:10px">' +
      '每局重新开始，遗物随层数累积，死亡即结束。<br>层数与击杀会折算成魂币，用来解锁永久强化。</div>';
    html += '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<div style="flex:1;background:#101218;border:1px solid #1e2129;border-radius:8px;padding:8px;text-align:center">' +
      '<div style="font-size:11px;color:#6a6a74">最高层</div><div style="font-size:17px;color:#c8c4bc">' + (m.best || 0) + '</div></div>' +
      '<div style="flex:1;background:#101218;border:1px solid #1e2129;border-radius:8px;padding:8px;text-align:center">' +
      '<div style="font-size:11px;color:#6a6a74">魂币</div><div style="font-size:17px;color:#e8c97a">' + (m.soul || 0) + '</div></div>' +
      '<div style="flex:1;background:#101218;border:1px solid #1e2129;border-radius:8px;padding:8px;text-align:center">' +
      '<div style="font-size:11px;color:#6a6a74">局数</div><div style="font-size:17px;color:#c8c4bc">' + (m.runs || 0) + '</div></div></div>';
    html += roBtn('start', '开始新一局', '#e8c97a');
    html += '<div style="font-size:11px;color:#6a6a74;margin:14px 0 4px">魂印 · 永久强化</div>';
    RO_PERKS.forEach(function (p) {
      var lv = Number(P[p.k]) || 0;
      var maxed = lv >= p.max;
      var cost = roPerkCost(p, lv);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 9px;margin:4px 0;' +
        'background:#0e1015;border:1px solid #1c1f26;border-radius:7px">' +
        '<div><div style="font-size:12px;color:#c8c4bc">' + esc(p.n) + ' <span style="color:#7a7a86;font-size:10px">Lv.' + lv + '/' + p.max + '</span></div>' +
        '<div style="font-size:10px;color:#6a6a74">' + esc(p.d) + '</div></div>' +
        (maxed ? '<span style="font-size:11px;color:#5a5a64">满级</span>'
          : '<span data-ro="perk" data-arg="' + p.k + '" style="font-size:11px;color:' + ((m.soul || 0) >= cost ? '#e8c97a' : '#5a5a64') + ';border:1px solid #2a2d34;border-radius:6px;padding:3px 8px;cursor:pointer">' + cost + ' 魂币</span>') +
        '</div>';
    });
    html += '<div style="font-size:10px;color:#5a5a64;margin-top:14px;line-height:1.6">' +
      '● 每下一层三选一遗物，Boss 层四选一<br>' +
      '● 遗物叠加生效：攻击 / 防御 / 吸血 / 暴击 / 荆棘 / 灼烧<br>' +
      '● 诅咒会一直跟着你，到本局结束</div>';
    return html;
  }

  function roMapHtml(r) {
    var s = roStats();
    var m = r.map;
    if (!m) { m = roGen(r.floor); r.map = m; roReveal(m); }
    var html = roCloseBar();
    var hpP = Math.max(0, Math.min(100, Math.round((Number(r.hp) || 0) / s.hpMax * 100)));
    html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#8a8a92;margin-bottom:4px">' +
      '<span>第 <b style="color:#c8c4bc">' + r.floor + '</b> 层' + ((r.floor % 5 === 0) ? '<span style="color:#c07ae8"> · 层主</span>' : '') + '</span>' +
      '<span style="color:#e8c97a">' + (r.gold || 0) + ' 金币</span></div>';
    html += '<div style="height:9px;background:#14161c;border-radius:5px;overflow:hidden;border:1px solid #23252c">' +
      '<div style="height:100%;width:' + hpP + '%;background:linear-gradient(90deg,#a83a3a,#d86a6a);transition:width .3s"></div></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#8a8a92;margin:3px 0 9px">' +
      '<span>体力 ' + (r.hp || 0) + '/' + s.hpMax + '</span>' +
      '<span>攻 ' + s.atk + ' · 防 ' + s.def + ' · 暴 ' + s.crit + '%' +
      (s.lifesteal ? ' · 吸 ' + s.lifesteal + '%' : '') +
      (s.block ? ' · 减 ' + s.block + '%' : '') + '</span></div>';

    html += '<div style="font:13px/1.2 monospace;background:#0b0d11;border:1px solid #1b1e25;border-radius:8px;padding:7px 5px;text-align:center;letter-spacing:3px">';
    for (var y = 0; y < 9; y++) {
      for (var x = 0; x < 9; x++) {
        if (x === m.px && y === m.py) { html += '<span style="color:#e8c97a">@</span>'; continue; }
        var c = (m.map[y] && m.map[y][x]) || '#';
        var seen = !!(m.seen && m.seen[x + ',' + y]);
        if (!seen) { html += '<span style="color:#15181e">·</span>'; continue; }
        var ch = c, col = '#2e323b';
        if (c === '#') { ch = '█'; col = '#3a3f4a'; }
        else if (c === 'M') { ch = 'M'; col = '#c85a5a'; }
        else if (c === 'C') { ch = 'C'; col = '#d8b86a'; }
        else if (c === '?') { ch = '?'; col = '#8a9ae2'; }
        else if (c === '+') { ch = '+'; col = '#6ab87a'; }
        else if (c === 'L') { ch = 'L'; col = '#4ac8f0'; }
        else if (c === 'B') { ch = 'B'; col = '#c07ae8'; }
        else if (c === 'S') { ch = 'S'; col = '#5a5a64'; }
        else { ch = '·'; col = '#2e323b'; }
        html += '<span style="color:' + col + '">' + ch + '</span>';
      }
      html += '<br>';
    }
    html += '</div>';
    html += '<div style="font-size:10px;color:#5a5a64;margin-top:3px;text-align:center">@你 M怪 C箱 ?事件 +营地 L楼梯（走到即触发，楼梯除外）</div>';

    html += '<div style="display:flex;gap:6px;justify-content:center;margin:9px 0">' +
      '<div data-ro="move" data-arg="u" style="width:52px;padding:9px 0;text-align:center;border:1px solid #2a2d34;border-radius:7px;cursor:pointer">↑</div>' +
      '<div data-ro="move" data-arg="l" style="width:52px;padding:9px 0;text-align:center;border:1px solid #2a2d34;border-radius:7px;cursor:pointer">←</div>' +
      '<div data-ro="move" data-arg="d" style="width:52px;padding:9px 0;text-align:center;border:1px solid #2a2d34;border-radius:7px;cursor:pointer">↓</div>' +
      '<div data-ro="move" data-arg="r" style="width:52px;padding:9px 0;text-align:center;border:1px solid #2a2d34;border-radius:7px;cursor:pointer">→</div>' +
      '</div>';

    var cur = (m.map[m.py] && m.map[m.py][m.px]) || '.';
    if (cur === 'M') html += roBtn('fight', '战斗', '#c85a5a');
    else if (cur === 'C') html += roBtn('chest', '打开宝箱', '#d8b86a');
    else if (cur === '+') html += roBtn('rest', '在营地休息（回复 35% 体力）', '#6ab87a');
    else if (cur === '?') html += roBtn('event', '看看发生了什么', '#8a9ae2');
    else if (cur === 'L') html += roBtn('next', '下一层', '#4ac8f0');
    else if (cur === 'B') html += roBtn('fight', '挑战层主', '#c07ae8', 'boss');

    if (r.fight) {
      html += '<div style="margin-top:10px;background:#0e1015;border:1px solid #1c1f26;border-radius:8px;padding:8px;font-size:11px;line-height:1.6">' +
        '<div style="color:' + (r.fight.win ? '#7ec98a' : '#c85a5a') + ';margin-bottom:3px">' +
        (r.fight.win ? '击败 ' : '与 ') + esc(r.fight.name) + (r.fight.win ? '' : ' 交手') + (r.fight.boss ? '（层主）' : '') + '</div>' +
        (r.fight.log || []).slice(-5).map(function (l) { return '<div style="color:#8a8a92">' + esc(l) + '</div>'; }).join('') +
        '</div>';
    }

    if ((r.relics || []).length) {
      html += '<div style="font-size:10px;color:#5a5a64;margin-top:10px">遗物 ' + r.relics.length + '</div><div style="margin-top:3px">';
      r.relics.forEach(function (id) {
        var d = RO_RELIC_BY[id]; if (!d) return;
        var rc = RO_RARITY[d.rar] || RO_RARITY.common;
        html += '<span style="display:inline-block;padding:2px 7px;margin:2px 3px 2px 0;border-radius:9px;font-size:10px;' +
          'background:rgba(255,255,255,.03);border:1px solid ' + rc.c + '44;color:' + rc.c + '">' + esc(d.n) + '</span>';
      });
      html += '</div>';
    }
    if ((r.curses || []).length) {
      html += '<div style="margin-top:8px">';
      r.curses.forEach(function (id) {
        var d = RO_CURSE_BY[id]; if (!d) return;
        html += '<span style="display:inline-block;padding:2px 7px;margin:2px 3px 2px 0;border-radius:9px;font-size:10px;' +
          'background:rgba(200,60,60,.08);border:1px solid #6a2a2a;color:#c86a6a">' + esc(d.n) + '</span>';
      });
      html += '</div>';
    }
    if (r.evtMsg) html += '<div style="margin-top:8px;font-size:11px;color:#9a9aa4">' + esc(r.evtMsg) + '</div>';
    return html;
  }

  function roDraftHtml(r) {
    var html = roCloseBar();
    html += '<div style="font-size:12px;color:#8a8a92;margin-bottom:10px">第 ' + r.floor + ' 层 · 选择一件遗物</div>';
    (r.draft || []).forEach(function (id) {
      var d = RO_RELIC_BY[id]; if (!d) return;
      var rc = RO_RARITY[d.rar] || RO_RARITY.common;
      html += '<div data-ro="pick" data-arg="' + id + '" style="cursor:pointer;margin:8px 0;padding:11px 12px;border-radius:9px;' +
        'background:linear-gradient(180deg,' + rc.c + '14,' + rc.c + '06);border:1px solid ' + rc.c + '55">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b style="color:' + rc.c + ';font-size:14px">' + esc(d.n) + '</b>' +
        '<span style="font-size:10px;color:' + rc.c + '99">' + rc.n + '</span></div>' +
        '<div style="font-size:11px;color:#9a9aa4;margin-top:3px">' + esc(d.d) + '</div></div>';
    });
    if (r.luckNext) html += '<div style="font-size:10px;color:#6a8a9a;margin-top:6px">许愿生效：本次品质提升</div>';
    return html;
  }

  function roEventHtml(r) {
    var html = roCloseBar();
    var ev = RO_EVENTS[Number(r.evt) || 0];
    if (!ev) { r.screen = 'map'; return roMapHtml(r); }
    html += '<div style="font-size:13px;color:#c8c4bc;margin:6px 0 2px">' + esc(ev.n) + '</div>';
    html += '<div style="font-size:12px;color:#8a8a92;line-height:1.7;margin-bottom:12px">' + esc(ev.t) + '</div>';
    if (r.evtDone) {
      if (r.evtMsg) html += '<div style="font-size:12px;color:#9ad0a0;margin:8px 0 12px">' + esc(r.evtMsg) + '</div>';
      html += roBtn('evtdone', '继续', '#4ac8f0');
      return html;
    }
    ev.o.forEach(function (o, i) {
      html += '<div data-ro="opt" data-arg="' + i + '" style="cursor:pointer;margin:7px 0;padding:10px 12px;border-radius:8px;' +
        'background:#0e1015;border:1px solid #24272e">' +
        '<div style="font-size:13px;color:#c8c4bc">' + esc(o.n) + '</div>' +
        (o.d ? '<div style="font-size:10px;color:#6a6a74;margin-top:2px">' + esc(o.d) + '</div>' : '') + '</div>';
    });
    return html;
  }

  function roDeadHtml(r) {
    var html = roCloseBar();
    html += '<div style="text-align:center;padding:22px 0 12px">' +
      '<div style="font-size:19px;color:#c85a5a;letter-spacing:3px">你 倒 下 了</div>' +
      '<div style="font-size:11px;color:#6a6a74;margin-top:8px">第 ' + r.floor + ' 层 · 击杀 ' + (r.kills || 0) + ' · 金币 ' + (r.gold || 0) + '</div></div>';
    html += '<div style="display:flex;gap:8px;margin:8px 0 16px">' +
      '<div style="flex:1;background:#101218;border:1px solid #1e2129;border-radius:8px;padding:10px;text-align:center">' +
      '<div style="font-size:10px;color:#6a6a74">获得魂币</div><div style="font-size:18px;color:#e8c97a">+' + (r.lastGain || 0) + '</div></div>' +
      '<div style="flex:1;background:#101218;border:1px solid #1e2129;border-radius:8px;padding:10px;text-align:center">' +
      '<div style="font-size:10px;color:#6a6a74">持有</div><div style="font-size:18px;color:#c8c4bc">' + (roMeta().soul || 0) + '</div></div></div>';
    html += roBtn('restart', '再来一局', '#e8c97a');
    html += roBtn('menu', '返回（花魂币强化）', '#8a8a92');
    return html;
  }

  window.dolRogueOpen = function () {
    try { window.__dolRoOpen = true; roOverlay(); roRender(); } catch (e) {}
  };
  window.dolRogueStart = roStart;
  window.dolRogueReset = function () {
    try { var v = VV(); if (v) { v.roRun = null; v.roMeta = null; } showToast('肉鸽数据已清空'); roRender(); } catch (e) {}
  };

  /* ================= 职业 / 套装 / NPC 羁绊 ================= */
  var CLASSES = {
    warrior: {
      k: 'warrior', n: '剑士', c: '#d06a5a', icon: '剑',
      d: '攻击 +30%，防御 +10%',
      atk: 1.30, def: 1.10, crit: 0, dodge: 0, sp: 1.0, loot: 0,
      skill: '破军斩', cost: 25, sk: '对敌人造成 220% 攻击的伤害'
    },
    mage: {
      k: 'mage', n: '法师', c: '#8a7ae2', icon: '法',
      d: '法术强度 +40%，攻击 -15%',
      atk: 0.85, def: 1.0, crit: 0, dodge: 0, sp: 1.4, loot: 0,
      skill: '奥术洪流', cost: 35, sk: '造成 60 + 法强×3 的伤害'
    },
    ranger: {
      k: 'ranger', n: '游侠', c: '#6ab87a', icon: '弓',
      d: '暴击 +12%，闪避 +10%，掉落 +10%',
      atk: 1.0, def: 1.0, crit: 12, dodge: 10, sp: 1.0, loot: 10,
      skill: '致命射击', cost: 20, sk: '160% 攻击伤害，必定暴击'
    },
    priest: {
      k: 'priest', n: '祭司', c: '#e8c97a', icon: '杖',
      d: '防御 +20%，法术强度 +25%',
      atk: 0.95, def: 1.20, crit: 0, dodge: 0, sp: 1.25, loot: 0,
      skill: '圣愈', cost: 30, sk: '回复 50% 体力并清除负面状态'
    },
    shadow: {
      k: 'shadow', n: '你打不中我信不信', c: '#8ae0d0', icon: '影',
      d: '闪避 +60%，攻击 -90%，暴击 +5%',
      atk: 0.10, def: 1.00, crit: 5, dodge: 60, sp: 1.0, loot: 5,
      skill: '影袭', cost: 22, sk: '150% 攻击伤害，并短时间提高闪避'
    }
  };
  var CLASS_ORDER = ['warrior', 'mage', 'ranger', 'priest', 'shadow'];
  function classId() {
    try { var v = VV(); return (v && v.mpClass) || ''; } catch (e) { return ''; }
  }
  function classDef() { return CLASSES[classId()] || null; }

  var CLASS_SETS = {
    pojun: {
      id: 'pojun', n: '破军', cls: 'warrior', c: '#d06a5a',
      b2: { atkPct: 8, pen: 5 }, b4: { atkPct: 14, crit: 6, pen: 10 }, b6: { atkPct: 26, crit: 10, hp: 120, pen: 18 }
    },
    mifa: {
      id: 'mifa', n: '秘法', cls: 'mage', c: '#8a7ae2',
      b2: { sp: 20 }, b4: { sp: 40, hp: 60 }, b6: { sp: 80, hp: 120 }
    },
    jifeng: {
      id: 'jifeng', n: '疾风', cls: 'ranger', c: '#6ab87a',
      b2: { dodge: 8 }, b4: { dodge: 10, crit: 10 }, b6: { dodge: 14, crit: 18 }
    },
    shenghui: {
      id: 'shenghui', n: '圣辉', cls: 'priest', c: '#e8c97a',
      b2: { defPct: 8 }, b4: { defPct: 12, block: 8 }, b6: { defPct: 16, block: 14, hp: 150 }
    },
    /* ===== 法师扩展套装 ===== */
    hanbing: {
      id: 'hanbing', n: '寒霜', cls: 'mage', c: '#7ad0f0',
      b2: { sp: 18, defPct: 4 }, b4: { sp: 34, defPct: 6, block: 6 }, b6: { sp: 66, hp: 110, block: 10 }
    },
    yanmo: {
      id: 'yanmo', n: '炎魔', cls: 'mage', c: '#e07040',
      b2: { atkPct: 6 }, b4: { atkPct: 10, crit: 6 }, b6: { atkPct: 18, crit: 10, sp: 30 }
    },
    xinghui: {
      id: 'xinghui', n: '星辉', cls: 'mage', c: '#c8b0ff',
      b2: { sp: 26 }, b4: { sp: 44, crit: 8 }, b6: { sp: 92, crit: 12, hp: 90, dodge: 6 }
    },
    xuyan: {
      id: 'xuyan', n: '虚言', cls: 'mage', c: '#8ae0c0',
      b2: { sp: 22, dodge: 4 }, b4: { sp: 40, dodge: 8, hp: 60 }, b6: { sp: 70, dodge: 12, hp: 120 }
    },
    ying: {
      id: 'ying', n: '影袭', cls: 'shadow', c: '#6ad0c0',
      b2: { dodge: 8 }, b4: { dodge: 12, crit: 8 }, b6: { dodge: 18, crit: 16, hp: 80 }
    }
  };
  var SET_ORDER = ['pojun', 'mifa', 'jifeng', 'shenghui', 'hanbing', 'yanmo', 'xinghui', 'xuyan', 'ying'];

  function setCounts(v) {
    var eq = (v && v.mpEquip) || {};
    var counts = {};
    ['helmet', 'chest', 'legs', 'gloves', 'boots', 'weapon', 'offhand', 'neck'].forEach(function (k) {
      var it = eq[k];
      if (!it || !it.set) return;
      counts[it.set] = (counts[it.set] || 0) + 1;
    });
    return counts;
  }
  function setStatOf(v) {
    var out = { atkPct: 0, defPct: 0, crit: 0, dodge: 0, block: 0, hp: 0, sp: 0, pen: 0, sets: [] };
    try {
      var counts = setCounts(v);
      Object.keys(counts).forEach(function (id) {
        var d = CLASS_SETS[id]; if (!d) return;
        var n = counts[id];
        var tier = n >= 6 ? d.b6 : (n >= 4 ? d.b4 : (n >= 2 ? d.b2 : null));
        if (!tier) return;
        var lv = n >= 6 ? 6 : (n >= 4 ? 4 : 2);
        out.atkPct += Number(tier.atkPct) || 0;
        out.defPct += Number(tier.defPct) || 0;
        out.crit += Number(tier.crit) || 0;
        out.dodge += Number(tier.dodge) || 0;
        out.block += Number(tier.block) || 0;
        out.hp += Number(tier.hp) || 0;
        out.sp += Number(tier.sp) || 0;
        out.pen += Number(tier.pen) || 0;
        out.sets.push({ id: id, n: lv, name: d.n, color: d.c });
      });
    } catch (e) {}
    return out;
  }
  function rollItemSet(v, tier) {
    try {
      var t = Number(tier) || 0;
      var chance = t >= 5 ? 0.55 : (t >= 3 ? 0.40 : 0.16);
      if (Math.random() > chance) return null;
      var myCls = (v && v.mpClass) || '';
      var own = SET_ORDER.filter(function (id) { return CLASS_SETS[id].cls === myCls; });
      // 剑士、法师不额外偏向本职业套装，其余职业保留
      var noBias = (myCls === 'warrior' || myCls === 'mage');
      if (!noBias && own.length && Math.random() < 0.75) return own[randomInt(0, own.length - 1)];
      return SET_ORDER[randomInt(0, SET_ORDER.length - 1)];
    } catch (e) { return null; }
  }
  window.dolGrantSetPiece = function (setId, slot) {
    try {
      var v = VV(); if (!v) return;
      if (!CLASS_SETS[setId]) setId = 'pojun';
      var slots = ['helmet', 'chest', 'legs', 'gloves', 'boots', 'weapon', 'offhand', 'neck'];
      var have = setCounts(v);
      var cand = slot || null;
      if (!cand) {
        var own = [];
        slots.forEach(function (s) {
          if (!v.mpEquip || !v.mpEquip[s] || !v.mpEquip[s].set) own.push(s);
        });
        cand = own.length ? own[randomInt(0, own.length - 1)] : slots[randomInt(0, slots.length - 1)];
      }
      var tier = 4;
      var pool = (typeof BAG_POOL !== 'undefined' && BAG_POOL[cand]) || [];
      if (!pool.length) { showToast('没有该部位'); return; }
      var it = pickItemByTier(pool, tier);
      var rar = RARITY[it.tier || 0] || RARITY[0];
      var afx = rollAffixes(it.tier || 0);
      var durs = rollDurability(it.tier || 0);
      if (!Array.isArray(v.mpBag)) v.mpBag = [];
      v.mpBag.push(ensureUid({
        slot: cand, n: it.n, atk: it.atk, def: it.def, hp: it.hp, sp: it.sp || 0,
        rarity: rar.k, affixes: afx, dur: durs.dur, maxDur: durs.maxDur, tough: durs.tough, set: setId
      }));
      showToast('获得【' + CLASS_SETS[setId].n + '】' + it.n);
      try { renderBag(); renderEquip(); } catch (e) {}
    } catch (e) {}
  };

  // 按职业调整掉落倾向：法师给法强，物理职业给攻防
  function tuneGearForClass(obj, tier) {
    try {
      var cls = '';
      try { cls = (typeof classId === 'function') ? classId() : ''; } catch (e) {}
      var t = Number(tier) || 0;
      if (!obj) return obj;
      if (cls === 'mage') {
        var sp = Math.round(6 + t * 7 + Math.random() * 6);
        obj.sp = (Number(obj.sp) || 0) + sp;
        obj.atk = Math.round((Number(obj.atk) || 0) * 0.35);
      } else if (cls === 'priest') {
        obj.sp = (Number(obj.sp) || 0) + Math.round(4 + t * 5 + Math.random() * 4);
        obj.hp = (Number(obj.hp) || 0) + Math.round(4 + t * 6);
      } else if (cls === 'ranger') {
        obj.atk = Math.round((Number(obj.atk) || 0) * 1.1);
      }
    } catch (e) {}
    return obj;
  }
  function renderClass() {
    var box = document.getElementById('dol-class');
    if (!box) return;
    var v = VV(); if (!v) return;
    var cur = classId();
    var html = '';
    if (cur && CLASSES[cur]) {
      var c = CLASSES[cur];
      html += '<div style="padding:7px 9px;border-radius:8px;background:#141720;border:1px solid ' + c.c + '55;margin-bottom:6px">' +
        '<div style="display:flex;justify-content:space-between"><b style="color:' + c.c + '">' + c.n + '</b>' +
        '<span style="font-size:10px;color:#7a7a86">' + esc(c.d) + '</span></div>' +
        '<div style="font-size:11px;color:#9a9aa4;margin-top:3px">' + esc(c.skill) + '　法力 ' + c.cost + '</div></div>';
    } else {
      html += '<div style="font-size:12px;color:#9a6a7a;margin-bottom:6px">还没选职业，选一个开始（免费）</div>';
    }
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
    CLASS_ORDER.forEach(function (k) {
      var d = CLASSES[k];
      var on = (k === cur);
      html += '<button data-cls="' + k + '" style="flex:1;min-width:70px;padding:6px 4px;border-radius:7px;font-size:12px;' +
        'background:' + (on ? d.c + '22' : '#14161c') + ';border:1px solid ' + (on ? d.c : '#2a2d34') + ';color:' + (on ? d.c : '#a8a8b0') + '">' +
        d.n + '</button>';
    });
    html += '</div>';
    if (cur) html += '<div style="font-size:10px;color:#5a5a64;margin-top:4px">转职需要 20000 猫猫币</div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-cls]').forEach(function (b) {
      b.onclick = function () { pickClass(b.getAttribute('data-cls')); };
    });
  }
  function pickClass(k) {
    try {
      var v = VV(); if (!v) return;
      var d = CLASSES[k]; if (!d) return;
      var cur = classId();
      if (cur === k) return;
      if (cur) {
        var cost = 20000;
        if ((Number(v.mpCat) || 0) < cost) { showToast('转职需要 ' + cost + ' 猫猫币'); return; }
        if (!confirm('转职为「' + d.n + '」？消耗 20000 猫猫币')) return;
        v.mpCat = (Number(v.mpCat) || 0) - cost;
      }
      v.mpClass = k;
      showToast('职业：' + d.n);
      try { renderClass(); renderEquip(); renderCatBalance(); } catch (e) {}
    } catch (e) {}
  }
  window.dolClassData = function () {
    try {
      var c = classDef(); if (!c) return null;
      return { k: c.k, n: c.n, cost: c.cost, skill: c.skill, icon: c.icon, c: c.c };
    } catch (e) { return null; }
  };
  window.dolClassPick = pickClass;
  window.dolClassGet = classId;

  /* ---- NPC 羁绊链 ---- */
  var NPC_CHAINS = [
    {
      k: 'hui', n: '灰', c: '#c8b8a8', d: '地下城里最早遇到的人',
      steps: [
        {
          t: '分一半面包', d: '她缩在墙角，看着你手里的东西，没有开口。',
          o: [
            { n: '掰一半给她', d: '猫猫币 -0，好感上升', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) + 2; v.mpCat = (Number(v.mpCat) || 0) + 10; return '她接过去，很小声地说了句谢谢。'; } },
            { n: '收起来', d: '保留食物', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) - 1; return '你没动，她也没再抬头。'; } }
          ]
        },
        {
          t: '她怎么进来的', d: '「你问这个干什么。」她把手缩进袖子里。',
          o: [
            { n: '算了，不问了', d: '好感 +2', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) + 2; return '她松了一口气，话多了一点。'; } },
            { n: '还是要问', d: '好感 -1，情报 +1', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) - 1; v.mpNpc.hui.info = (v.mpNpc.hui.info || 0) + 1; return '她说自己是被卖进来的，然后就闭嘴了。'; } }
          ]
        },
        {
          t: '伤口', cond: { floor: 3 }, d: '她的小腿有一道很深的划伤，一直在渗血。',
          o: [
            { n: '用布条包扎', d: '消耗 150 猫猫币的布，好感 +3', f: function (v) { v.mpCat = Math.max(0, (Number(v.mpCat) || 0) - 150); v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) + 3; return '她咬着牙没出声，最后说了句「你手挺稳」。'; } },
            { n: '让她自己处理', d: '好感 -2', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) - 2; return '她低头摆弄了半天，血止不住。'; } }
          ]
        },
        {
          t: '她认识这个地下城', cond: { floor: 6 }, d: '她突然说：「再往下，第七层有个门，别开。」',
          o: [
            { n: '追问那道门', d: '情报 +2，好感 -1', f: function (v) { v.mpNpc.hui.info = (v.mpNpc.hui.info || 0) + 2; v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) - 1; return '她说那是她姐姐进去以后就没再出来的地方。'; } },
            { n: '答应她不开', d: '好感 +3', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) + 3; return '她盯着你看了很久，点了点头。'; } }
          ]
        },
        {
          t: '最后一层之前', cond: { floor: 10 },
          d: '她把一直攥着的东西递给你，是一枚磨得发亮的锁扣。',
          o: [
            { n: '带她一起走', d: '好感 +5，获得破军部件', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) + 5; v.mpNpc.hui.end = 'with'; try { window.dolGrantSetPiece('pojun'); } catch (e) {} return '她跟在你身后，第一次没有回头看那条走廊。'; } },
            { n: '让她留下守住这里', d: '获得 3000 金币，好感 -3', f: function (v) { v.mpNpc.hui.aff = (v.mpNpc.hui.aff || 0) - 3; v.money = (Number(v.money) || 0) + 300000; v.mpNpc.hui.end = 'stay'; return '她没说话，只是把锁扣收了回去。'; } }
          ]
        }
      ]
    },
    {
      k: 'chen', n: '老陈', c: '#b07a4a', d: '半塌炉子边的老铁匠',
      steps: [
        {
          t: '熄掉的炉子', cond: { floor: 2 }, d: '一个老头蹲在炉边扇风，火星早没了。',
          o: [
            { n: '帮他重新生火', d: '消耗 2 矿石，好感 +2', f: function (v) { var m = mats(); if ((m.ore || 0) < 2) return '你没有矿石，帮不上忙。'; m.ore -= 2; v.mpNpc.chen.aff = (v.mpNpc.chen.aff || 0) + 2; return '炉子亮起来的时候他笑了，露出缺牙。'; } },
            { n: '走开', d: '', f: function (v) { return '你绕过他继续走。'; } }
          ]
        },
        {
          t: '他要材料', cond: { floor: 4 }, d: '「给我块好铁，我给你打点东西。」',
          o: [
            { n: '给他 3 矿石和 2000 金币', d: '获得一件传说装备', f: function (v) { var m = mats(); if ((m.ore || 0) < 3 || (Number(v.money) || 0) < 200000) return '材料或钱不够。'; m.ore -= 3; v.money -= 200000; try { window.dolGrantEquip('weapon', 4); } catch (e) {} return '他敲了一整晚，锤声在地下城里传得很远。'; } },
            { n: '拒绝', d: '', f: function (v) { v.mpNpc.chen.aff = (v.mpNpc.chen.aff || 0) - 1; return '他把铁块收回去了。'; } }
          ]
        },
        {
          t: '他儿子', cond: { floor: 6 }, d: '「我儿子也下过这地方。」他一边敲一边说。',
          o: [
            { n: '听他说完', d: '好感 +3', f: function (v) { v.mpNpc.chen.aff = (v.mpNpc.chen.aff || 0) + 3; v.mpNpc.chen.info = 1; return '他说到一半就不说了，锤子却没停。'; } },
            { n: '打断他', d: '好感 -2', f: function (v) { v.mpNpc.chen.aff = (v.mpNpc.chen.aff || 0) - 2; return '他闭上了嘴，只剩锤声。'; } }
          ]
        },
        {
          t: '打什么', cond: { floor: 8 }, d: '「炉子还能用最后一次，你说打什么。」',
          o: [
            { n: '打一把刀', d: '获得圣辉部件（防具随机）', f: function (v) { v.mpNpc.chen.aff = (v.mpNpc.chen.aff || 0) + 2; try { window.dolGrantSetPiece('shenghui'); } catch (e) {} return '刀锋很薄，他说能切开风。'; } },
            { n: '打一副甲', d: '获得破军部件（防具随机）', f: function (v) { v.mpNpc.chen.aff = (v.mpNpc.chen.aff || 0) + 2; try { window.dolGrantSetPiece('pojun'); } catch (e) {} return '甲片一片片扣上去，沉得压手。'; } }
          ]
        },
        {
          t: '出山', cond: { floor: 12 }, d: '「我不打了。除非你带我出去。」',
          o: [
            { n: '带他出去', d: '消耗 5000 金币，永久攻击 +3', f: function (v) { if ((Number(v.money) || 0) < 500000) return '你拿不出这笔路费。'; v.money -= 500000; v.mpDgAtk = (Number(v.mpDgAtk) || 0) + 3; v.mpNpc.chen.end = 'out'; return '他背着锤子走了，临走前给你留了一手活儿。'; } },
            { n: '让他留下', d: '获得 1500 金币', f: function (v) { v.money = (Number(v.money) || 0) + 150000; v.mpNpc.chen.end = 'stay'; return '他点点头，又蹲回炉边。'; } }
          ]
        }
      ]
    },
    {
      k: 'ya', n: '白鸦', c: '#e0e0e8', d: '戴白面具的商人',
      steps: [
        {
          t: '白面具', cond: { floor: 2 }, d: '一个人坐在箱子上，面具白得像骨头。',
          o: [
            { n: '跟他做买卖', d: '消耗 800 金币，获得秘法部件', f: function (v) { if ((Number(v.money) || 0) < 80000) return '他说你买不起。'; v.money -= 80000; v.mpNpc.ya.aff = (v.mpNpc.ya.aff || 0) + 1; try { window.dolGrantSetPiece('mifa'); } catch (e) {} return '他从箱子里拿出一件东西，来路不明。'; } },
            { n: '不搭理', d: '', f: function (v) { return '你走过去，他没抬头。'; } }
          ]
        },
        {
          t: '情报', cond: { floor: 4 }, d: '「三层的怪不咬戴面具的人。」他说。',
          o: [
            { n: '买这条情报', d: '消耗 1200 金币，获得 2 猫猫币文案提示', f: function (v) { if ((Number(v.money) || 0) < 120000) return '他说你拿不出钱。'; v.money -= 120000; v.mpNpc.ya.info = (v.mpNpc.ya.info || 0) + 2; return '情报到手，真假难辨。'; } },
            { n: '不信', d: '', f: function (v) { return '他耸了耸肩。'; } }
          ]
        },
        {
          t: '死人的东西', cond: { floor: 6 }, d: '箱子里有一枚刻着名字的戒指。',
          o: [
            { n: '质问他', d: '好感 -2，获得证据', f: function (v) { v.mpNpc.ya.aff = (v.mpNpc.ya.aff || 0) - 2; v.mpNpc.ya.evidence = 1; return '「这地方死人比活人多。」他说得很平静。'; } },
            { n: '装作没看见', d: '好感 +2', f: function (v) { v.mpNpc.ya.aff = (v.mpNpc.ya.aff || 0) + 2; return '他把箱子合上了。'; } }
          ]
        },
        {
          t: '合作', cond: { floor: 9 }, d: '「你替我下到最深处，我在上面替你卖。」',
          o: [
            { n: '答应他', d: '好感 +2，猫猫币 +500', f: function (v) { v.mpNpc.ya.aff = (v.mpNpc.ya.aff || 0) + 2; v.mpCat = (Number(v.mpCat) || 0) + 500; return '他伸出手，手很凉。'; } },
            { n: '拒绝', d: '好感 -1', f: function (v) { v.mpNpc.ya.aff = (v.mpNpc.ya.aff || 0) - 1; return '他把手收回去，笑了笑。'; } }
          ]
        },
        {
          t: '最后一场买卖', cond: { floor: 15 }, d: '「最后一件事，你选边吧。」',
          o: [
            { n: '揭穿他', d: '需要证据，获得疾风全套部件', f: function (v) { if (!v.mpNpc.ya.evidence) return '你手里没有证据，只能沉默。'; v.mpNpc.ya.end = 'expose'; try { window.dolGrantSetPiece('jifeng'); window.dolGrantSetPiece('jifeng'); window.dolGrantSetPiece('jifeng'); } catch (e) {} return '你把戒指拍在箱子上，他摘下了面具。'; } },
            { n: '跟他合作到底', d: '获得 5000 金币', f: function (v) { v.money = (Number(v.money) || 0) + 500000; v.mpNpc.ya.end = 'partner'; return '「聪明人。」他说，然后把箱子推给你。'; } }
          ]
        }
      ]
    }
  ];

  function npcState() {
    var v = VV(); if (!v) return {};
    if (!v.mpNpc || typeof v.mpNpc !== 'object') v.mpNpc = {};
    NPC_CHAINS.forEach(function (c) {
      if (!v.mpNpc[c.k]) v.mpNpc[c.k] = { step: 0, aff: 0, end: '' };
      if (!v.mpNpc[c.k].step) v.mpNpc[c.k].step = 0;
    });
    return v.mpNpc;
  }
  function renderNpc() {
    var box = document.getElementById('dol-npc');
    if (!box) return;
    var v = VV(); if (!v) return;
    var st = npcState();
    var html = '';
    NPC_CHAINS.forEach(function (c) {
      var s = st[c.k] || { step: 0, aff: 0, end: '' };
      var idx = Math.min(s.step, c.steps.length - 1);
      var step = c.steps[idx];
      var done = s.step >= c.steps.length;
      var lock = step && step.cond && step.cond.floor && (Number(v.dgFloor) || 1) < step.cond.floor;
      html += '<div style="margin:6px 0;padding:8px;border-radius:8px;background:#12141a;border:1px solid ' + c.c + '33">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b style="color:' + c.c + ';font-size:13px">' + esc(c.n) + '</b>' +
        '<span style="font-size:10px;color:#7a7a86">' + (done ? '已完结' : ('第 ' + (idx + 1) + '/' + c.steps.length + ' 段')) +
        (s.aff ? ' · 好感 ' + s.aff : '') + '</span></div>';
      if (done) {
        html += '<div style="font-size:11px;color:#8a8a92;margin-top:4px">' +
          ({ with: '她跟着你离开了地下城。', stay: '她留下来守着那条走廊。', out: '老陈背着锤子出去了。', expose: '你揭穿了白鸦，箱子归你。', partner: '你和白鸦成了长期生意伙伴。' }[s.end] || '故事到这里结束了。') + '</div>';
      } else if (lock) {
        html += '<div style="font-size:11px;color:#7a6a6a;margin-top:4px">需要到达第 ' + step.cond.floor + ' 层</div>';
      } else {
        html += '<div style="font-size:12px;color:#a8a8b0;margin-top:4px">' + esc(step.t) + '</div>' +
          '<div style="font-size:11px;color:#7a7a86;margin:2px 0 6px">' + esc(step.d) + '</div>';
        step.o.forEach(function (o, i) {
          html += '<div data-npc="' + c.k + '" data-i="' + i + '" style="cursor:pointer;padding:6px 8px;margin:3px 0;border-radius:6px;' +
            'background:#161920;border:1px solid #24272e;font-size:12px;color:#c8c4bc">' + esc(o.n) +
            (o.d ? '<span style="color:#5a5a64;font-size:10px">　' + esc(o.d) + '</span>' : '') + '</div>';
        });
      }
      html += '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-npc]').forEach(function (el) {
      el.onclick = function () { npcChoose(el.getAttribute('data-npc'), Number(el.getAttribute('data-i'))); };
    });
  }
  function npcChoose(k, i) {
    try {
      var v = VV(); if (!v) return;
      var chain = null;
      NPC_CHAINS.forEach(function (c) { if (c.k === k) chain = c; });
      if (!chain) return;
      var st = npcState();
      var s = st[k]; if (!s) return;
      if (s.step >= chain.steps.length) return;
      var step = chain.steps[s.step];
      if (step.cond && step.cond.floor && (Number(v.dgFloor) || 1) < step.cond.floor) { showToast('还没到那一步'); return; }
      var opt = step.o[i]; if (!opt) return;
      var msg = '';
      try { msg = opt.f(v) || ''; } catch (e) { msg = '出了点岔子'; }
      s.step += 1;
      showToast(msg.slice(0, 40));
      try { renderNpc(); renderCatBalance(); renderEquip(); } catch (e) {}
    } catch (e) {}
  }
  window.dolNpcChoose = npcChoose;
  window.dolNpcState = npcState;

  function applyIconLocal(icon) {
    icon = icon || '联机';
    try { localStorage.setItem('dolon_btn_icon', icon); } catch (e) {}
    var b = document.getElementById('dolonline-btn');
    if (!b) return;
    var content = /^(https?:|data:)/i.test(icon)
      ? '<img src="' + icon + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : icon;
    b.innerHTML = content + '<span class="dolonline-badge" id="dol-badge"></span><span class="dolonline-timebadge" id="dol-time-badge"></span>';
  }
  var KNOWN_SERVERS = [
    { name: '阿里云（推荐）', url: 'http://47.118.55.194:8787' },
    { name: '手机隧道', url: 'https://dol.qiubai.xyz' }
  ];
  function dgUnlocked() {
    try {
      var v = VV(); if (!v) return false;
      if (v.mpDgUnlocked) return true;
      // 老存档兼容：只要有过地下城痕迹，就视为已解锁
      if ((Number(v.dgFloor) || 1) > 1) return true;
      if ((Number(v.dgKills) || 0) > 0) return true;
      if ((Number(v.mpDgLv) || 1) > 1) return true;
      if ((Number(v.mpDgAtk) || 0) > 0 || (Number(v.mpDgDef) || 0) > 0 || (Number(v.mpDgAgi) || 0) > 0) return true;
      if (v.mpSkill && typeof v.mpSkill === 'object' && Object.keys(v.mpSkill).length > 0) return true;
      if ((Number(v.mpSkillPts) || 0) > 0) return true;
      return false;
    } catch (e) { return false; }
  }
  function migrateDgUnlock() {
    try {
      var v = VV(); if (!v || v.mpDgUnlocked) return;
      if (dgUnlocked()) { v.mpDgUnlocked = 1; }
    } catch (e) {}
  }
  function renderDungeonLock() {
    try {
      var b = document.getElementById('dol-dg-buttons');
      var l = document.getElementById('dol-dg-locked');
      var on = dgUnlocked();
      if (b) b.style.display = on ? '' : 'none';
      if (l) l.style.display = on ? 'none' : 'block';
    } catch (e) {}
  }
  function mbProbe() {
    var mb = window.maplebirch;
    var t = mb && (mb.tool || mb.Tool);
    return {
      has: !!mb,
      tool: !!t,
      addTo: !!(t && typeof t.addTo === 'function'),
      inject: !!(t && typeof t.inject === 'function'),
      patch: !!(t && t.patch),
      ver: (mb && (mb.version || mb.VERSION)) || ''
    };
  }
  function renderMbInfo() {
    try {
      var box2 = document.getElementById('dol-mb-info');
      if (!box2) return;
      var p = mbProbe();
      box2.innerHTML = 'maplebirch: ' + (p.has ? '<span style="color:#7ec98a">有</span>' : '<span style="color:#c85a5a">无</span>') +
        '　tool: ' + (p.tool ? '有' : '无') +
        '　addTo: ' + (p.addTo ? '有' : '无') +
        '　inject: ' + (p.inject ? '有' : '无') +
        (p.ver ? ('　v' + p.ver) : '') +
        '<br>注入状态：' + (window.__dolLinkInjState || '未尝试') +
        '<br>入口DOM：' + (window.__dolDgDom || '未尝试') +
        '<div style="font-size:10px;color:#6a7a6a;word-break:break-all">' + (window.__dolDgStruct || '结构：未记录') + '</div>' +
        '<div style="font-size:10px;color:#6a7a8a">点击：' + (window.__dolDgClick || '未触发过') + '</div>';
    } catch (e) {}
  }
  var DG_ICON_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAKo0lEQVR4nO1baWxc1RX+zrnvvXkzY3u8ka0sCf2BwAkpEoQqRRV0oZEqBKLyqJWqSiAQbSiCkoLaH9WbkfoDElLFhYRmoSqVitSxEJAWUVECSFUjKpVEjZJgMAmBNsiOE8f27DPv3tMfM2MHx3byZqFU+JPunzd3O98595xzlwEWsYhFLGIRi/jcgv5X44rI7E8gwuyPrZ/IpzGI53kMgAEgkUjqhQRNpVLqyJEjBMAkk0nT6rm1lIBUKqUAIB6P63O/DwwMhHptOzKJSQBALBaDPZIvxDdtyp9bz/M87uvro9ntm4mWEOB5HicAUFWDz+7cdrkv5a8z8XoI1oJoCRG1QwABwEQQSFbEjIngCAh/h1Gv3/2jh4YBQEQokUhQKyyi6QSkUilV09ienVtvsYjuY1bfbm9va7NtG4SK0LN9ABFNT8b3fUxOpUtG69d8bXbes/Gne2f33Sw0lYDaBPc8teUKZastruv2t7dHYYyACBogqY5JIvKJsYkqfpEIBgBExGIi5AsF5LK5V0vl8iP33v/ooVSqX8Xjg00jgZvVked5Vjwe13t2bO53XPvt3t6e/kgkYkREo6JwJSKWiCgRYVSJwAwhDAhX61gARCA6FHJ0d0/3rW4o9I89T2/ZGI8P6qpvaYrymtKJ53lWMpn0d23f/HBXrGOrEwqBmf2qIA2DCFprUWI0To+f/dW9Gx/ZVLU2AzQWOhu2gGnhn3zs4a5YbGvIDWlmNs0SHgBEoJhJlG2Xe7u7Ht791ONb4/G49jxPNdp3QxZQW/O7tz92Z2es6/mQG/IBNM0850HZaG2PnBr7yQ8f+Nm2Rh1j3RbgeR739/ebXbsGLnVs95mQGzJEVFvbFwUROS8aXAQsVspvi0a27NnxxHXxeFynUv11W0LdBBw9epSISFAqDvT0dHUSkak6twVhjIExlXCulIJSCjTr+wVARKBYLGYBZqfneXzkyDV1+4G6CEilUmpwcFA/s/OJmzo62u40EH2hNV/TdjgcRjQaBQBks1lkslkYEUQiEUQikem6C/cFJYDf3d19w6VLo99NJpPG87y6fE6djmqwMhFtHmxri0IEIgs4Y2MMHMcBM+Odo+/g4MGDOHnyY6TTGUAE0WgUy5Yvw9q112L1mjVgJhSLRTDPrx8CyLFtIaEHATwHoK4sMbCz8jyPk8mk+d3TW78AxcPd3V1hVELRnH0ZY+CGwxgbHcXeF1/Eu0ND0FrDsixw1fy1MfDLPogIq65chdvuuB0rV65CLpdbkAQRkUwmS7l8+vp7N/787f7+fjU4GCxJqmcJMAD4Wn+zM9YRrmR4Cwt//P1h7N7xJI69+w7aoy66Ym1oi4QQdhRcR6Et7KArFkVnRwQf//sEfvubHfjXwQMIRyIL+gVm1h0dbYBYtwHAxo3XBFZo3U5QGDfZti3V9Pb830VgOw5OnxrF88/9HqZcQGcsCosBRQKLAVsRbEXT3xQJYm0ROBbhpcHn8OHxYwiFXIjMR4IQM4MI6wHgzTeDL4PABCSTSQ0ARHwtZlLZuTtnxuuv7EW5kEFbxIUiA8fCgkWxQThkw2bBay+/AL9cQiW6ng9jwGIEzHz1wMBAqLpbDGQFQQkgAJJKeY4iWiYCiJw/oIiBE3JxYngIJz94D7H2aFV4uqhikUF71MX4qZMYOnwQoZA751Igqng+Iu5xnHRvZexgETEQAbXOJyc72oioveL55XzGBSAmHBs6BEV6Rjh1kcUiWExwbcbxoUPQRoNoHsWKQCkKu+y2A0AikQhkAXWFwXK5JJYKzUs1MaNULGDqzAgirg1LAcJB/ZNAuQ6yE2PIZzMIuWEYM7e/FQG01nUlQ03bsMxAQKxQzOegixm4tsI8S/jCUAzxCyjkMnAjUYjWmM8Q6kULCKiAANgKEItAgbV/fl+tQssIAABHEdAMAmrnaC1A6wigSpwX1RwCWnVh0NolYFVGqNsHzNFns9EaAqrqciwCNWEJNNh8QbTYCVYJaNh1t46BlvoARxG4CQQ0O/Sdi5ZGAVsBrBoXoIVBoLVLwLEI2nwOLaCmraYS8P+WBxABNhMsRZBGCWjSnOZCa32AVdmoNCrBdCLUAibqIsC2HSJz4ek4iiCGGl7EF2pNRFBK1TVIoByttpYtaypngCyhquG56gKwL/IA5ELlQvwZo4viIwsAiUQikLeoJ0mlu+5KFsToU0QEornPBGt5QDMIWMgGmAhGZPxsgU7XIUtgAqR2IVl9yTF9nz8bte2w04QynwUQwRATtJbhTZs25T3P43kV0iQCpiFG9vtlf8E6zdC+Y9ECiRCJGBEx+i0AuPnm4PLU4wQNABiNVycmp/yurk6FOS9GCLYFEFqXB4gIZ3N5AuPPADA21hf8pjVog+o9HN/34KPH9mzfvI+ZbhURI4LqDS1NT9pmglJUPTatn4S5WhKRAUCZTOZIZ++q/SJC1W+BUFcY7OvrIwAQkV/n84VvhdzQJ36fyQQBRXOeGwfCXAYkgDFaWwLZXn0sYQFYeE3O1Xe9k6rdEe7avvmN5cuW3gyIrlmBgGGZPFaNPAul8wBxQ5nsiWXfR9G+BCTlypSJDEF4dHTsPTWaWXsCKCWTSUEdCXND7wNEhCDmxxNnz5arFyTVhM1AswNYESgWMDMUU+BikYAsF5rDwMz1mECMZLM5aMj9dyWThapF1sVxU5LL3U8+fk93b/du27Y0ESvAQFMYV4y/hJ7cYfgcRtBnwAKCkiLSzmU4dsn3wDXtQ7TRRo2Mnv7lfQ88+otG5143ASJC2xKJWM4p2ZblF2Lhnm093Z13K8syBGGjwojlhrB05CVochBcQQQlBZzp/QbOxNaB/RwEbIzRfHZ84uWpYvYHImBKT5m3jv5nMui1eA2BnWDV20oi8VDMZfeAbVSnKSqM58cLvu8jHHZ5YmICWhuUy2Xse2EchVwOHPhgrxI+v3aHRntsCCIGnZ0x9n2NsxMTNxDRMAEEDuHL131x3eAg3q/5pSCj1L0bdN0woYReVtwOU3nvk06nYYxBLBZDLpdHNpPBqTMZiBhYlg1B5TZ13v0DzQhujEapWEA+X0DPJTbCYRfFYgnpdBq2UktAM/uQQrFQtxwNHVgTpGSMNlpr7fu+EJFkMhmZmJiUcNiVFStWyOovXSsWkxSyaSkX8iLaFyYjivGJwiQixhe/lJdCNi0wvly9erVcfsXlEo1GJJ3OyNTUlBCR+NqI1kYbo40x2lhK1R1kGjoPEEDVTv1r2Z5SCuVyGWfOjMNxbFy//ias+8pXcfKjD/HRB8cxNjqCXCaDUqk03ab2mCISjaJ3yRJctvJKXLZyFYgIpVIJ2VwexhgopSAitbxANcOHN0QAzbwOmU6FKxMkMDMmJybxpz/+AUuXL8dVfWtw3bobEY5GKy/GzLlvGQREDGZGPp/D6dFR/G3fX3Fi+D1s+E4cvUuXwRgz++6/CUctdRBQ220dOHBs6vo1K28UYzFT+bx6YixErBBcJ4R9+w/jlf2H4QC4Zf0abNhwO9becCNKxRIAwAk5eHfoEN7Yuxd/eeOfSANwAFy1oh22E4VRAPvz+7acjnwAVNL0oPJ8SqDqSrlIhQV7cNoQGhql+l+gBZFMJme3aWr9apvPquYXsYjPOv4LXgbAo/3jmqkAAAAASUVORK5CYII=';
  // 直接用 DOM 往链接区插一条，不再依赖 MapleBirch 的 zone 注入
  function dgIconStyle() {
    var st = 'width:30px;height:30px;vertical-align:middle;margin:0 4px 0 0;border:0;background:none';
    try {
      var ri = document.querySelector('#passage-content a.macro-link img');
      if (ri && window.getComputedStyle) {
        var cs = window.getComputedStyle(ri);
        if (cs && cs.width && cs.height && cs.width !== 'auto') {
          st = 'width:' + cs.width + ';height:' + cs.height + ';vertical-align:' + (cs.verticalAlign || 'middle') +
               ';margin:0 ' + (cs.marginRight || '4px') + ' 0 0;border:0;background:none';
        }
      }
    } catch (e) {}
    return st;
  }
  function dgEntryInner(label) {
    return '<img class="dol-dg-ico" alt="" src="data:image/png;base64,' + DG_ICON_B64 + '" style="' + dgIconStyle() + '">' + label;
  }
  function bindDgGlobalClick() {
    try {
      if (window.__dolDgGlobalBound) return;
      window.__dolDgGlobalBound = 1;
      var fire = function (ev) {
        try {
          var t = ev.target;
          if (!t || !t.closest) return;
          if (!t.closest('#dol-dg-entry-link, .dol-dg-hit')) return;
          ev.preventDefault();
          ev.stopPropagation();
          window.__dolDgClick = '命中 ' + new Date().toLocaleTimeString();
          var E = window.Engine || (window.SugarCube && window.SugarCube.Engine);
          if (E && typeof E.play === 'function') {
            try { E.play('DoLOnlineDungeonGate'); }
            catch (e) { window.__dolDgClick = '播放失败：' + (e && e.message ? e.message : ''); }
          } else {
            window.__dolDgClick = '没有 Engine（' + (typeof E) + '）';
          }
        } catch (e) { window.__dolDgClick = '异常：' + (e && e.message ? e.message : ''); }
      };
      document.addEventListener('click', fire, true);
      document.addEventListener('touchend', fire, true);
    } catch (e) {}
  }
  setTimeout(bindDgGlobalClick, 800);
  function bindDgClick(el) {
    try {
      if (!el || el.__dolDgBound) return;
      el.__dolDgBound = 1;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
        try { window.Engine.play('DoLOnlineDungeonGate'); } catch (e) {}
      }, false);
    } catch (e) {}
  }
  function ensureDgEntry(allowFallback) {
    // TweeReplacer 注入成功就不管；没成功（版本差异 / 替换没命中）就自己插进丰收街
    try {
      var SC0 = window.SugarCube || window;
      var psg0 = (SC0 && SC0.State && SC0.State.passage) || '';
      var hasEntry = document.querySelector('a[data-passage="DoLOnlineDungeonGate"]');
      if (psg0 !== 'Harvest Street') { window.__dolDgDom = '非丰收街'; return false; }
      if (hasEntry) { window.__dolDgDom = '已在页面上（TweeReplacer 或 DOM）'; return true; }
    } catch (e) {}
    try {
      var SC = window.SugarCube || window;
      var psg = (SC && SC.State && SC.State.passage) || '';
      if (psg !== 'Harvest Street') { window.__dolDgDom = '非丰收街'; return false; }
      if (document.getElementById('dol-dg-entry-link')) { window.__dolDgDom = '已存在'; return true; }
      var v = {};
      try { v = (SC.State && SC.State.variables) || {}; } catch (e) {}
      var label = v.mpDgUnlocked ? '地下世界' : '未知之处';
      // DoL 的段落容器是 #passages > .passage（id 为 passage-XXX），不一定有 #passage-content
      var pc = document.getElementById('passage-content') ||
        document.querySelector('#passages .passage') ||
        document.querySelector('.passage') ||
        document.getElementById('passages');
      var links = pc ? pc.querySelectorAll('a.macro-link, a.link-internal') : [];
      if (!links.length && !allowFallback) { window.__dolDgDom = '链接区未就绪（容器：' + (pc ? (pc.id || pc.className) : '无') + '），稍后重试'; return false; }
      if (links.length && links.length < 6) { window.__dolDgDom = '疑似事件页，跳过（链接 ' + links.length + ' 条）'; return false; }
      var inner = dgEntryInner(label);
      var placed = '';
      if (links.length) {
        var first = links[0];
        var item = first.parentNode;            // 单条链接的 span
        var groupCont = item && item.parentNode; // 这一组所在的 div
        var lastItem = item;
        for (var i = 1; i < links.length; i++) {
          var p = links[i].parentNode;
          if (p && p.parentNode === groupCont) lastItem = p;
        }
        var lastInGroup = lastItem;
        // 每条链接各自包在一个块里时，整块克隆一份，间距/编号都跟原版一致
        var perItem = !!(item && item !== pc && item.querySelectorAll('a.macro-link').length === 1);
        try {
          var desc = function (n) {
            if (!n) return '-';
            if (n.nodeType === 3) return n.textContent.trim() ? '#text' : '#ws';
            return n.nodeName.toLowerCase() + (n.className ? ('.' + String(n.className).replace(/\s+/g, '.')) : '');
          };
          var kids = [];
          for (var k = 0; k < item.childNodes.length && k < 10; k++) kids.push(desc(item.childNodes[k]));
          window.__dolDgStruct = 'item=' + desc(item) + '{}' + ' | kids=[' + kids.join(', ') + ']' +
            ' | parent=' + desc(item.parentNode) + ' | perItem=' + perItem +
            ' | 链接数=' + links.length;
        } catch (e) { window.__dolDgStruct = '结构诊断失败'; }
        if (perItem) {
          try {
            var block = item.cloneNode(true);
            var ids = block.querySelectorAll('[id]');
            for (var j = 0; j < ids.length; j++) ids[j].removeAttribute('id');
            var ca = block.querySelector('a.macro-link');
            if (ca) {
              // 图标放在 <a> 外面：编号是 .macro-link 的 ::before，必须排在图标之后
              var oldImgs = block.querySelectorAll('img');
              for (var m = 0; m < oldImgs.length; m++) oldImgs[m].parentNode.removeChild(oldImgs[m]);
              ca.id = 'dol-dg-entry-link';
              ca.setAttribute('data-passage', 'DoLOnlineDungeonGate');
              ca.setAttribute('href', '#');
              ca.innerHTML = label;
              var ic = document.createElement('img');
              ic.className = 'dol-dg-ico';
              ic.setAttribute('alt', '');
              ic.src = 'data:image/png;base64,' + DG_ICON_B64;
              ic.setAttribute('style', dgIconStyle());
              block.insertBefore(ic, ca);
              try { block.classList.add('dol-dg-hit'); } catch (e) {}
              bindDgClick(block);
              bindDgClick(ca);
              // 跳到条目后面的换行之后，保证自成一行
              var ref = lastItem.nextSibling;
              while (ref && ref.nodeType === 3 && !String(ref.textContent || '').trim()) ref = ref.nextSibling;
              if (ref && ref.nodeName === 'BR') ref = ref.nextSibling;
              groupCont.insertBefore(block, ref);
              var nb = block.nextSibling;
              while (nb && nb.nodeType === 3 && !String(nb.textContent || '').trim()) nb = nb.nextSibling;
              if (!(nb && nb.nodeName === 'BR')) groupCont.insertBefore(document.createElement('br'), block.nextSibling);
              placed = '克隆条目';
            }
          } catch (e1) { window.__dolDgDom = '克隆失败：' + (e1 && e1.message); }
        }
        if (!placed && item && item !== pc) {
          var a2 = document.createElement('a');
          a2.id = 'dol-dg-entry-link';
          a2.className = 'link-internal macro-link';
          a2.setAttribute('data-passage', 'DoLOnlineDungeonGate');
          a2.setAttribute('href', '#');
          a2.innerHTML = inner;
          try { a2.classList.add('dol-dg-hit'); } catch (e) {}
          groupCont.insertBefore(a2, lastItem.nextSibling);
          bindDgClick(a2);
          placed = '列表内插入';
        }
      }
      if (!placed && pc && allowFallback) {
        var a3 = document.createElement('a');
        a3.id = 'dol-dg-entry-link';
        a3.className = 'link-internal macro-link';
        a3.setAttribute('data-passage', 'DoLOnlineDungeonGate');
        a3.setAttribute('href', '#');
        a3.style.display = 'block';
        a3.innerHTML = inner;
        try { a3.classList.add('dol-dg-hit'); } catch (e) {}
        pc.appendChild(a3);
        bindDgClick(a3);
        placed = '末尾追加';
      }
      window.__dolDgDom = placed ? ('插入成功（' + placed + '）') : '没找到插入点';
      if (placed) {
        setTimeout(function () {
          try {
            if (!document.getElementById('dol-dg-entry-link')) { window.__dolDgDom += ' → 被移除，重插'; ensureDgEntry(); }
          } catch (e) {}
        }, 900);
      }
      return !!placed;
    } catch (e) {
      window.__dolDgDom = '异常：' + (e && e.message ? e.message : '');
      return false;
    }
  }
  function injectDungeonLink() { return ensureDgEntry(true); }

  function loadLanInfo() {
    try {
      var box = document.getElementById('dol-lan');
      if (!box) return;
      if (!SERVER) { box.textContent = ''; return; }
      // 只有连的是本机/局域网服务器时，内网地址才有意义
      var isLocal = /127\.0\.0\.1|localhost|^https?:\/\/192\.168\.|^https?:\/\/10\.|^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(SERVER);
      if (!isLocal) { box.innerHTML = ''; return; }
      api('GET', '/api/ping').then(function (r) {
        try {
          if (!r || !r.ok || !Array.isArray(r.lan) || !r.lan.length) { box.innerHTML = ''; return; }
          var port = 8787;
          var m = String(SERVER).match(/:([0-9]{2,5})/);
          if (m) port = m[1];
          box.innerHTML = '服务器所在机器的内网地址：' +
            r.lan.map(function (ip) { return '<b>http://' + esc(ip) + ':' + port + '</b>'; }).join('　') +
            '<div style="font-size:10px;color:#6a6a72">同一 WiFi / 热点下，把这段发给对方填进服务器地址</div>';
        } catch (e) {}
      });
    } catch (e) {}
  }

  function loadServerStats() {
    var box = document.getElementById('dol-server-stats');
    if (!box) return;
    box.innerHTML = '查询中…';
    var rows = [];
    var done = 0;
    KNOWN_SERVERS.forEach(function (sv) {
      fetch(sv.url + '/api/ping', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        rows.push({ name: sv.name, url: sv.url, online: (d && d.ok) ? d.online : null });
      }).catch(function () {
        rows.push({ name: sv.name, url: sv.url, online: null });
      }).then(function () {
        done++;
        if (done === KNOWN_SERVERS.length) {
          box.innerHTML = rows.map(function (x) {
            var status = x.online === null ? '<span style="color:#e25a5a">离线</span>' : ('<span style="color:#7ec98a">在线 ' + x.online + ' 人</span>');
            return '<div style="margin:2px 0">' + esc(x.name) + '：' + status + '</div>';
          }).join('');
        }
      });
    });
  }


  /* ===== 日常/地下城 双经验池 ===== */
  function dailyNeed(lv) { return 80 + (lv - 1) * 40; }
  function dgNeed(lv) { return 100 + (lv - 1) * 50; }
  function gainExpKind(kind, n) {
    try {
      var v = VV(); if (!v) return;
      var lvKey = kind === 'daily' ? 'mpDLv' : 'mpDgLv';
      var expKey = kind === 'daily' ? 'mpDExp' : 'mpDgExp';
      var spKey = kind === 'daily' ? 'mpDSP' : 'mpDgSP';
      var needFn = kind === 'daily' ? dailyNeed : dgNeed;
      if (!Number(v[lvKey])) DGAC.set(v, lvKey, 1);
      if (!Number(v[expKey])) DGAC.set(v, expKey, 0);
      var add = Math.max(0, Math.floor(n));
      DGAC.set(v, expKey, Number(v[expKey]) + add);
      if (add > 0) { try { showExpFloat(add, kind === 'daily' ? '日+' : '地+'); } catch (e) {} }
      var leveled = false;
      while (v[expKey] >= needFn(v[lvKey]) && v[lvKey] < 99) {
        DGAC.set(v, expKey, v[expKey] - needFn(v[lvKey]));
        DGAC.set(v, lvKey, v[lvKey] + 1);
        DGAC.set(v, spKey, (Number(v[spKey]) || 0) + 1);
        leveled = true;
      }
      if (leveled) {
        var lab = kind === 'daily' ? '日常' : '地下城';
        try { showToast(' ' + lab + '升级！Lv.' + v[lvKey] + '（+1 点数）'); } catch (e) {}
      }
      renderExpBar();
      try { if (typeof openAddPointsRefresh === 'function') openAddPointsRefresh(); } catch (e) {}
    } catch (e) {}
  }
  window.dolGainExp = function (n) { try { gainExpKind('dungeon', n || 0); } catch (e) {} };
  window.dolGainDailyExp = function (n) { try { gainExpKind('daily', n || 0); } catch (e) {} };
  var _wasInCombat = false;
  var _combatEnemyHpMax = 0;
  function dailyCombatCheck() {
    try {
      var v = VV(); if (!v) return;
      var inCombat = (Number(v.combat) === 1);
      if (inCombat) {
        _combatEnemyHpMax = Math.max(_combatEnemyHpMax, Number(v.enemyhealthmax) || 0);
      } else if (_wasInCombat) {
        if (Number(v.mpPlayerFight) !== 1) {
          var exp = Math.min(60, 10 + Math.floor((_combatEnemyHpMax || 100) / 10));
          gainExpKind('daily', exp);
        }
        _combatEnemyHpMax = 0;
      }
      _wasInCombat = inCombat;
    } catch (e) {}
  }
  // 让「疲劳减免」真正生效：包住原版 <<tiredness>> 宏，削减正数增长
  function hookTirednessMacro() {
    try {
      if (window.__dolTirednessHooked) return true;
      var SC = window.SugarCube;
      var M = SC && SC.Macro;
      if (!M || typeof M.has !== 'function' || typeof M.get !== 'function') return false;
      if (!M.has('tiredness')) return false;
      var def = M.get('tiredness');
      var fn = (typeof def === 'function') ? def : (def && typeof def.handler === 'function' ? def.handler : null);
      if (!fn) { window.__dolTirednessHookErr = '取不到原宏'; return false; }
      var restore = (def && typeof def === 'object') ? def : { handler: fn };
      var wasAsync = !!(def && def.isAsync);
      try { M.delete('tiredness'); } catch (e) {}
      try {
        M.add('tiredness', {
          isAsync: wasAsync,
          handler: function () {
            var v = null, cut = 0, before = 0;
            try {
              v = VV();
              cut = Math.min(80, Math.max(0, Number(v && v.mpFatigueCut) || 0));
              before = Number(v && v.tiredness) || 0;
            } catch (e) {}
            var ret = fn.apply(this, arguments);
            try {
              if (v && cut > 0) {
                var d = (Number(v.tiredness) || 0) - before;
                if (d > 0) v.tiredness = before + d * (1 - cut / 100);
              }
            } catch (e) {}
            return ret;
          }
        });
        window.__dolTirednessHooked = true;
        window.__dolTirednessHookErr = '';
        return true;
      } catch (e) {
        try { M.add('tiredness', restore); } catch (e2) {}
        window.__dolTirednessHookErr = '注册失败：' + (e && e.message ? e.message : '');
        return false;
      }
    } catch (e) {
      window.__dolTirednessHookErr = e && e.message ? e.message : 'err';
      return false;
    }
  }
  setTimeout(hookTirednessMacro, 300);
  setTimeout(hookTirednessMacro, 1500);
  setTimeout(hookTirednessMacro, 5000);

  // 只保留一个地下城入口按钮（MapleBirch 有时会把同一区域重复渲染）
  function dedupeDgEntry() {
    try {
      var els = document.querySelectorAll('.dol-dg-e');
      for (var i = 1; i < els.length; i++) { try { els[i].parentNode.removeChild(els[i]); } catch (e) {} }
    } catch (e) {}
  }
  function dedupeDgEntrySoon() {
    setTimeout(dedupeDgEntry, 120);
    setTimeout(dedupeDgEntry, 600);
  }
  function trackMaxFloor() {
    try {
      var SC = window.SugarCube;
      var psg = (SC && SC.State && SC.State.passage) || '';
      if (!/^DoLOnline/.test(psg)) return;
      var v = VV(); if (!v) return;
      var fl = Number(v.dgFloor) || 0;
      if (fl > (Number(v.mpMaxFloor) || 0)) v.mpMaxFloor = fl;
    } catch (e) {}
  }
  function hookPassages() {
    try {
      var SC = window.SugarCube || window;
      if (window.jQuery) {
        jQuery(document).on(':passagedisplay', function (ev, psg) {
      try { scheduleAutoSave(); } catch (e) {} try { renderExpBar(); renderPanelExp(); } catch (e) {} try { dailyCombatCheck(); } catch (e) {} try { dungeonPassageEnhance(psg && psg.name); } catch (e) {}
        try { injectHuiPortrait(psg && psg.name); } catch (e) {} try { dedupeDgEntrySoon(); } catch (e) {} setTimeout(function () { try { ensureDgEntry(false); } catch (e) {} }, 120); setTimeout(function () { try { ensureDgEntry(false); } catch (e) {} }, 600); setTimeout(function () { try { ensureDgEntry(false); } catch (e) {} }, 1100); setTimeout(function () { try { ensureDgEntry(true); } catch (e) {} }, 2000); });
        jQuery(document).on(':passageend', function () { try { dailyCombatCheck(); } catch (e) {} });
      } else if (SC && SC.Engine && SC.Engine.on) {
        SC.Engine.on('passagedisplay', function (psg) {
      try { scheduleAutoSave(); } catch (e) {} try { renderExpBar(); renderPanelExp(); } catch (e) {} try { dailyCombatCheck(); } catch (e) {} try { dungeonPassageEnhance(psg && psg.name); } catch (e) {}
        try { injectHuiPortrait(psg && psg.name); } catch (e) {} try { dedupeDgEntrySoon(); } catch (e) {} setTimeout(function () { try { ensureDgEntry(false); } catch (e) {} }, 120); setTimeout(function () { try { ensureDgEntry(false); } catch (e) {} }, 600); setTimeout(function () { try { ensureDgEntry(false); } catch (e) {} }, 1100); setTimeout(function () { try { ensureDgEntry(true); } catch (e) {} }, 2000); });
      }
    } catch (e) {}
  }
  setTimeout(hookPassages, 500);
  setTimeout(function () { try { runSelfCheck(); } catch (e) {} }, 3000);
  // 兜底轮询：不依赖 passagedisplay 事件，确保血条/飘字一定出现
  setInterval(function () {
    try {
      var SC = window.SugarCube;
      var psg = '';
      try {
        if (SC && SC.State) {
          psg = SC.State.passage || (SC.State.active && SC.State.active.title) || '';
        }
      } catch (e) {}
      if (!psg && window.__dolDg) psg = 'DoLOnlineDungeon';
      dungeonPassageEnhance(psg);
    } catch (e) {}
  }, 600);

  setInterval(function () { try { dailyCombatCheck(); } catch (e) {} }, 400);

  /* ===== 玩家等级/经验系统 ===== */

  function showExpFloat(amount, label) {
    try {
      var lvEl = document.getElementById('dol-expbar');
      var rect = null;
      if (lvEl) rect = lvEl.getBoundingClientRect();
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;z-index:2147482500;pointer-events:none;font:bold 14px sans-serif;' +
        'color:#f0d060;text-shadow:0 1px 3px #000;transition:opacity .6s, transform 1.2s;opacity:1';
      if (rect && rect.width) {
        el.style.left = (rect.right + 4) + 'px';
        el.style.top = (rect.top + 4) + 'px';
      } else {
        el.style.left = '64px';
        el.style.top = '40px';
      }
      el.textContent = (label || '+') + amount;
      document.body.appendChild(el);
      requestAnimationFrame(function () {
        el.style.transform = 'translate(24px, -10px)';
        el.style.opacity = '0';
      });
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 1400);
    } catch (e) {}
  }


  /* ===== 疼痛伤害减免 ===== */
  var _lastPain = null;
  function applyPainReduce() {
    try {
      var v = VV();
      if (!v) return;
      var r = Number(v.mpPainReduce) || 0;
      if (!Number(v.mpSP) && !r) { _lastPain = Number(v.pain) || 0; return; }
      var cur = Number(v.pain) || 0;
      if (_lastPain === null) { _lastPain = cur; return; }
      if (r > 0 && cur > _lastPain) {
        var reduced = _lastPain + (cur - _lastPain) * (1 - r / 100);
        v.pain = Math.max(0, Math.min(100, reduced));
        cur = v.pain;
      }
      _lastPain = cur;
    } catch (e) {}
  }

  function expNeed(lv) { return 100 + (lv - 1) * 50; }
  function gainExp(n) {
    try { gainExpKind('dungeon', n); return; } catch (e) {}
    try {
      var v = VV();
      if (!v) return;
      if (!Number(v.mpLevel)) v.mpLevel = 1;
      if (!Number(v.mpExp)) v.mpExp = 0;
      var _add = Math.max(0, Math.floor(n));
      v.mpExp = Number(v.mpExp) + _add;
      if (_add > 0) { try { showExpFloat(_add, '+'); } catch (e) {} }
      var leveled = false;
      while (v.mpExp >= expNeed(v.mpLevel) && v.mpLevel < 99) {
        v.mpExp -= expNeed(v.mpLevel);
        v.mpLevel += 1;
        v.mpSP = (Number(v.mpSP) || 0) + 1;
        leveled = true;
      }
      if (leveled) { try { showToast(' 升级！Lv.' + v.mpLevel); showExpFloat(v.mpLevel, 'Lv'); } catch (e) {} }
      if (v.mpLevel >= 10 && window.dolUnlockAch) try { dolUnlockAch('lv10'); } catch (e) {}
      renderExpBar();
    } catch (e) {}
  }
  function renderPanelExp() {
    try {
      var box = document.getElementById('dol-panel-exp');
      if (!box) return;
      var v = VV(); if (!v) { box.textContent = '（未登录）'; return; }
      var kind = v.mpBarKind === 'dungeon' ? 'dungeon' : 'daily';
      var lv, exp, need, label, col;
      if (kind === 'daily') {
        lv = Number(v.mpDLv) || 1; exp = Number(v.mpDExp) || 0; need = 80 + (lv - 1) * 40;
        label = '日常'; col = 'linear-gradient(90deg,#3a7ec0,#6ab8f0)';
      } else {
        lv = Number(v.mpDgLv) || 1; exp = Number(v.mpDgExp) || 0; need = 100 + (lv - 1) * 50;
        label = '地下城'; col = 'linear-gradient(90deg,#7a4ac0,#b88ae8)';
      }
      var pct = Math.max(0, Math.min(100, Math.round(exp / need * 100)));
      box.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">' +
        '<span>' + label + ' Lv' + lv + '</span><span>' + exp + ' / ' + need + '</span></div>' +
        '<div style="height:6px;background:#1a1a22;border:1px solid #335;border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div>' +
        '<div style="font-size:10px;color:#666;margin-top:3px;cursor:pointer" id="dol-panel-exp-sw">点这里切换：日常 / 地下城</div>';
      var sw = document.getElementById('dol-panel-exp-sw');
      if (sw) sw.onclick = function () {
        var v2 = VV(); if (!v2) return;
        v2.mpBarKind = (v2.mpBarKind === 'dungeon') ? 'daily' : 'dungeon';
        renderPanelExp();
      };
    } catch (e) {}
  }
  function renderExpBar() {
    var v = VV();
    if (!v) return;
    var box = document.getElementById('mobileStats') || document.querySelector('.mobilestats') || document.getElementById('statsbar');
    if (!box) { window.__dolExpBarState = '找不到 mobileStats 容器'; return; }
    window.__dolExpBarState = '容器：' + (box.id || box.className || box.tagName);
    var el = document.getElementById('dol-expbar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dol-expbar';
      el.className = 'stat';
      el.style.cssText = 'cursor:pointer;font-size:9px;line-height:1.1;padding:2px 0;user-select:none';
      box.appendChild(el);
    } else if (el.parentNode !== box) {
      box.appendChild(el);
    }
    var kind = v.mpBarKind === 'dungeon' ? 'dungeon' : 'daily';
    var lv, exp, need, pct, color, bg, label;
    if (kind === 'daily') {
      lv = Number(v.mpDLv) || 1; exp = Number(v.mpDExp) || 0;
      need = 80 + (lv - 1) * 40;
      color = 'linear-gradient(0deg,#3a7ec0,#6ab8f0)';
      label = '日'; var txt = '#6ab8f0';
    } else {
      lv = Number(v.mpDgLv) || 1; exp = Number(v.mpDgExp) || 0;
      need = 100 + (lv - 1) * 50;
      color = 'linear-gradient(0deg,#7a4ac0,#b88ae8)';
      label = '地'; var txt = '#b88ae8';
    }
    pct = Math.max(0, Math.min(100, Math.round(exp / need * 100)));
    var sig = kind + '|' + lv + '|' + exp + '|' + need;
    if (el._sig === sig) return;
    el._sig = sig;
    el.innerHTML =
      '<div style="color:' + txt + ';font-weight:bold;font-size:10px">' + label + lv + '</div>' +
      '<div style="height:30px;width:9px;margin:1px auto;background:#1a1a22;border:1px solid #335;border-radius:4px;overflow:hidden;position:relative">' +
        '<div style="position:absolute;bottom:0;left:0;width:100%;height:' + pct + '%;background:' + color + '"></div></div>' +
      '<div style="color:#888;font-size:8px">' + exp + '</div>';
    if (!el.__bound) {
      el.__bound = true;
      var _clickTimer = null;
      el.addEventListener('click', function () {
        if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; return; }
        _clickTimer = setTimeout(function () {
          _clickTimer = null;
          var v2 = VV();
          var k2 = v2.mpBarKind === 'dungeon' ? 'dungeon' : 'daily';
          if (k2 === 'daily') {
            var lv2 = Number(v2.mpDLv) || 1, ex2 = Number(v2.mpDExp) || 0;
            showToast(' 日常 Lv' + lv2 + '：' + ex2 + '/' + (80 + (lv2 - 1) * 40) + '（双击切换地下城）');
          } else {
            var lv3 = Number(v2.mpDgLv) || 1, ex3 = Number(v2.mpDgExp) || 0;
            showToast(' 地下城 Lv' + lv3 + '：' + ex3 + '/' + (100 + (lv3 - 1) * 50) + '（双击切换日常）');
          }
        }, 260);
      });
      el.addEventListener('dblclick', function () {
        if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; }
        var v2 = VV();
        v2.mpBarKind = (v2.mpBarKind === 'dungeon') ? 'daily' : 'dungeon';
        renderExpBar();
        showToast(v2.mpBarKind === 'dungeon' ? ' 已切换到地下城经验条' : ' 已切换到日常经验条');
      });
    }
  }


  /* ===== 加点面板 ===== */
  var ATTRS_DAILY = [
    { key: 'stressmax',  label: '压力上限', base: 100, step: 500, target: 'stressmax' },
    { key: 'traumamax',  label: '创伤上限', base: 100, step: 250, target: 'traumamax' },
    { key: 'controlmax', label: '自控上限', base: 100, step: 50, target: 'controlmax' },
    { key: 'mpFatigueCut', label: '疲劳减免', base: 0, suffix: '%', step: 5, max: 80 },
    { key: 'mpPainReduce', label: '疼痛减免', base: 0, suffix: '%', step: 5, max: 80 }
  ];
  var ATTRS_DG = [
    { key: 'mpDgAtk', label: '地下城攻击', base: 0, step: 2, max: 60 },
    { key: 'mpDgDef', label: '地下城防御', base: 0, step: 2, max: 60 },
    { key: 'mpDgAgi', label: '地下城敏捷', base: 0, step: 2, max: 60 },
    { key: 'mpDgHp', label: '地下城体力上限', base: 0, step: 10, max: 100 }
  ];
  var ATTRS = ATTRS_DAILY.concat(ATTRS_DG);
  function openAddPoints() {
    var v = VV();
    if (!v) return;
    var old = document.getElementById('dol-addpoints');
    if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'dol-addpoints';
    box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483670;' +
      'width:min(92vw,320px);max-height:80vh;overflow-y:auto;background:#14161c;color:#ddd;border:1px solid #7a6a4a;' +
      'border-radius:10px;padding:12px;font:14px/1.6 sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.7)';
    window.__dolAddPointsOpen = true;
    function render() {
      var sp = Number(v.mpSP) || 0;
      var dsp = Number(v.mpDSP) || 0;
      var gsp = Number(v.mpDgSP) || 0;
      var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<b style="color:#e8c97a"> 加点面板</b>' +
        '<button id="dol-ap-reset" style="padding:3px 9px;font-size:12px;background:#2a2028;border:1px solid #5a3a4a;color:#e08aa0;border-radius:6px">洗点</button></div>' +
        '<div style="font-size:12px;color:#8a9ae2;margin-bottom:4px"> 日常：Lv' + (v.mpDLv||1) + '　经验点数 <b>' + dsp + '</b></div>' +
        '<div style="font-size:12px;color:#c9a0e2;margin-bottom:4px"> 地下城：Lv' + (v.mpDgLv||1) + '　经验点数 <b>' + gsp + '</b></div>';
      ATTRS.forEach(function (a) {
        var val;
        if (a.key.indexOf('mpDg') === 0 || a.key === 'mpPainReduce' || a.key === 'mpFatigueCut') {
          val = Number(v[a.key]) || 0;
        } else {
          val = (v[a.key] != null ? Number(v[a.key]) : 100);
        }
        var disp = Math.round(val) + (a.suffix || '');
        var isDg = (a.key.indexOf('mpDg') === 0);
        var pts = isDg ? gsp : dsp;
        var color = isDg ? '#c9a0e2' : '#8a9ae2';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #222">' +
          '<span style="color:' + color + '">' + a.label + '：<b>' + disp + '</b></span>' +
          '<button data-attr="' + a.key + '" data-base="' + a.base + '" data-pts="' + (isDg ? 'dg' : 'daily') + '" style="padding:4px 12px;background:' + (pts > 0 ? '#3a5a3a' : '#333') + ';color:#b8f0c0;border:none;border-radius:5px;cursor:' + (pts > 0 ? 'pointer' : 'default') + '">+' + (Number(a.step) || 500) + '</button></div>';
      });
      html += '<button id="dol-ap-close" style="width:100%;margin-top:10px;padding:8px;background:#3a3a4a;color:#ddd;border:none;border-radius:6px">关闭</button>';
      box.innerHTML = html;
      box.querySelectorAll('[data-attr]').forEach(function (b) {
        b.onclick = function () {
          var isDg2 = b.getAttribute('data-pts') === 'dg';
          var pool = isDg2 ? (Number(v.mpDgSP) || 0) : (Number(v.mpDSP) || 0);
          if (pool <= 0) { showToast(isDg2 ? '没有地下城点数' : '没有日常点数'); return; }
          var mul = 1;
          var k = b.getAttribute('data-attr');
          var a = null;
          ATTRS.forEach(function (x) { if (x.key === k) a = x; });
          if (!a) return;
          var step = Number(a.step) || 500;
          if (a.key === 'mpDgAtk' || a.key === 'mpDgDef' || a.key === 'mpDgAgi') {
            var cur2 = Number(v[a.key]) || 0;
            if (cur2 >= 60) { showToast('已满 60'); return; }
            v[a.key] = Math.min(60, cur2 + step * mul);
          } else if (a.key === 'mpDgHp') {
            var cur3 = Number(v.mpDgHp) || 0;
            if (cur3 >= 100) { showToast('已满 100'); return; }
            v.mpDgHp = Math.min(100, cur3 + step * mul);
          } else if (a.key === 'mpPainReduce' || a.key === 'mpFatigueCut') {
            var cur = Number(v[a.key]) || 0;
            if (cur >= 80) { showToast('已满 80%'); return; }
            v[a.key] = Math.min(80, cur + step * mul);
          } else {
            if (!Number(v[a.key]) || Number(v[a.key]) === 100) v[a.key] = 100;
            v[a.key] = Number(v[a.key]) + step * mul;
          }
          if (isDg2) v.mpDgSP = (Number(v.mpDgSP) || 0) - mul; else v.mpDSP = (Number(v.mpDSP) || 0) - mul;
          if (!v.mpApSpent || typeof v.mpApSpent !== 'object') v.mpApSpent = {};
          v.mpApSpent[k] = (Number(v.mpApSpent[k]) || 0) + mul;
          render();
          try { renderExpBar(); } catch (e) {}
        };
      });
      var rb = box.querySelector('#dol-ap-reset');
      if (rb) rb.onclick = function () {
        var STEPS = { stressmax:500, traumamax:250, controlmax:50, mpFatigueCut:5, mpPainReduce:5,
                      mpDgAtk:2, mpDgDef:2, mpDgAgi:2, mpDgHp:10, tirednessmax:5 };
        var BASES = { stressmax:100, traumamax:100, controlmax:100, mpFatigueCut:0, mpPainReduce:0,
                      mpDgAtk:0, mpDgDef:0, mpDgAgi:0, mpDgHp:0, tirednessmax:0 };
        // 老存档没有记录，先按当前数值估算
        if (!v.mpApSpent || typeof v.mpApSpent !== 'object' || !Object.keys(v.mpApSpent).length) {
          var est = {};
          if ((Number(v.stressmax) || 0) > 100) est.stressmax = Math.round(((Number(v.stressmax) || 0) - 100) / 500);
          if ((Number(v.traumamax) || 0) > 100) est.traumamax = Math.round(((Number(v.traumamax) || 0) - 100) / 250);
          if ((Number(v.controlmax) || 0) > 100) est.controlmax = Math.round(((Number(v.controlmax) || 0) - 100) / 50);
          if ((Number(v.mpFatigueCut) || 0) > 0) est.mpFatigueCut = Math.round((Number(v.mpFatigueCut) || 0) / 5);
          if ((Number(v.mpPainReduce) || 0) > 0) est.mpPainReduce = 1;
          ['mpDgAtk','mpDgDef','mpDgAgi'].forEach(function (k) {
            var n2 = Math.round((Number(v[k]) || 0) / 2); if (n2 > 0) est[k] = n2;
          });
          var nh = Math.round((Number(v.mpDgHp) || 0) / 10); if (nh > 0) est.mpDgHp = nh;
          v.mpApSpent = est;
        }
        var refundD = 0, refundG = 0, total = 0;
        var keys = Object.keys(v.mpApSpent);
        keys.forEach(function (k) {
          var n3 = Number(v.mpApSpent[k]) || 0; if (n3 <= 0) return;
          if (!STEPS[k]) return;
          if (k.indexOf('mpDg') === 0) refundG += n3; else refundD += n3;
          total += n3;
        });
        if (!total) { showToast('还没加过点'); return; }
        if (!confirm('洗点：退还 ' + refundD + ' 日常点 / ' + refundG + ' 地下城点，属性回到初始值。确定？')) return;
        keys.forEach(function (k) {
          var n3 = Number(v.mpApSpent[k]) || 0; if (n3 <= 0) return;
          var step = STEPS[k]; if (!step) return;
          var realKey = (k === 'tirednessmax') ? 'mpFatigueCut' : k;
          var base = BASES[k] || 0;
          v[realKey] = Math.max(base, (Number(v[realKey]) || base) - n3 * step);
        });
        v.mpApSpent = {};
        v.mpDSP = (Number(v.mpDSP) || 0) + refundD;
        v.mpDgSP = (Number(v.mpDgSP) || 0) + refundG;
        showToast('已洗点：日常 +' + refundD + '，地下城 +' + refundG);
        render();
        try { renderExpBar(); } catch (e) {}
      };
      var cb = box.querySelector('#dol-ap-close');
      window.__dolAddPointsOpen = true;
      if (cb) cb.onclick = function () { box.remove(); window.__dolAddPointsOpen = false; };
    }
    render();
    document.body.appendChild(box);
  }


  /* ===== 修正游戏缩放导致的面板触摸偏移 ===== */
  function panelOpen() {
    try {
      var p = document.getElementById('dolonline-panel');
      return !!(p && p.classList && p.classList.contains('open'));
    } catch (e) { return true; }
  }
  function uiScaleVal() {
    try {
      var v = Number(localStorage.getItem('dolon_ui_scale'));
      if (v >= 0.8 && v <= 1.6) return v;
    } catch (e) {}
    return 1;
  }
  function pageZoomFactor() {
    try {
      var p = document.getElementById('dol-scale-probe');
      if (!p) {
        p = document.createElement('div');
        p.id = 'dol-scale-probe';
        p.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:44px;height:44px;visibility:hidden;pointer-events:none';
        if (document.body) document.body.appendChild(p);
      }
      p.style.zoom = '';
      var w = p.getBoundingClientRect().width;
      if (!w || !isFinite(w)) return 1;
      return w / 44;
    } catch (e) { return 1; }
  }
  function showPanelDebug(q, cs, r) {
    try {
      var box = document.getElementById('dol-panel-debug');
      if (!box) {
        box = document.createElement('div');
        box.id = 'dol-panel-debug';
        box.style.cssText = 'position:fixed;left:6px;top:6px;right:6px;max-height:60vh;overflow:auto;z-index:2147483666;' +
          'background:#2a1216;color:#ffd0d0;border:2px solid #ff5a5a;border-radius:10px;padding:10px;font:12px/1.6 monospace';
        document.body.appendChild(box);
      }
      var info = '';
      info += 'panel 存在: ' + (!!q) + '\n';
      if (cs) {
        info += 'display: ' + cs.display + ' / visibility: ' + cs.visibility + ' / opacity: ' + cs.opacity + '\n';
        info += 'position: ' + cs.position + ' / zoom: ' + (q.style.zoom || cs.zoom) + '\n';
        info += 'transform: ' + (cs.transform || 'none') + '\n';
      }
      info += 'rect: ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + '\n';
      info += '视口: ' + window.innerWidth + 'x' + window.innerHeight + '\n';
      if (q) info += 'class: ' + q.className + '\ninline: ' + (q.getAttribute('style') || '').slice(0, 160);
      box.innerHTML = '<div style="white-space:pre-wrap;color:#ffd0d0;font-size:11px">面板没显示出来，诊断：\n' + esc(info) + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
        '<button id="dol-dbg-force" style="flex:1;padding:8px;background:#4a2020;color:#ffd0d0;border:1px solid #ff5a5a;border-radius:8px">强制显示</button>' +
        '<button id="dol-dbg-reset" style="flex:1;padding:8px;background:#20304a;color:#d0e0ff;border:1px solid #5a8aff;border-radius:8px">重置并显示</button>' +
        '<button id="dol-dbg-close" style="flex:0 0 auto;padding:8px">关闭</button>' +
        '</div>';
      var force = function (reset) {
        try {
          if (reset) {
            localStorage.removeItem('dolon_ui_scale');
            localStorage.removeItem('dolon_panel_pos');
          }
          var p = document.getElementById('dolonline-panel');
          if (p) {
            p.style.cssText = 'position:fixed;left:8px;top:8vh;right:8px;bottom:auto;width:auto;max-width:none;max-height:80vh;' +
              'zoom:1;transform:none;display:flex;flex-direction:column;overflow:hidden;visibility:visible;opacity:1;' +
              'z-index:2147483660;background:linear-gradient(160deg,#1c1a1c,#1c1b17);color:#d4cdd0;' +
              'border:1px solid rgba(150,130,140,.45);border-radius:14px;font:14px/1.55 sans-serif';
            p.classList.add('open');
          }
          box.style.display = 'none';
          showToast('已强制显示面板');
        } catch (e) { showToast('强制显示失败：' + (e && e.message ? e.message : '')); }
      };
      box.querySelector('#dol-dbg-force').onclick = function () { force(false); };
      box.querySelector('#dol-dbg-reset').onclick = function () { force(true); };
      box.querySelector('#dol-dbg-close').onclick = function () { box.style.display = 'none'; };
      box.style.display = 'block';
    } catch (e) {}
  }
  function closePanel() {
    try {
      var p = document.getElementById('dolonline-panel');
      if (!p) return;
      p.classList.remove('open');
      p.style.display = 'none';   // 之前只删类名，内联 display:flex 还在，所以关不掉
    } catch (e) {}
  }
  window.dolClosePanel = closePanel;
  /* 全局清理 "[object HTMLDivElement]" 这类被字符串化的节点文本。
     扫的是 documentElement（面板挂在 documentElement 上，不在 body 里，老版本漏掉了），
     删掉的同时把来源记到 __dolToastErr，面板 设置→杂项 里能看到。 */
  function cleanObjText() {
    var n = 0;
    try {
      var walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, null);
      var hits = [];
      var t;
      while ((t = walker.nextNode())) {
        var s = t.nodeValue;
        if (s && s.indexOf('[object ') >= 0) hits.push(t);
      }
      for (var i = 0; i < hits.length; i++) {
        var node = hits[i], par = node.parentNode;
        if (!par) continue;
        try {
          window.__dolToastErr = '已清理异常文本：' + String(node.nodeValue).slice(0, 80) +
            '\n父节点：' + par.tagName + ' id=' + (par.id || '—') + ' class=' + (par.className || '—') +
            '\n上层：' + (par.parentNode ? (par.parentNode.tagName + ' id=' + (par.parentNode.id || '—') + ' class=' + (par.parentNode.className || '—')) : '—') +
            '\nHTML：' + String(par.outerHTML || '').slice(0, 300);
        } catch (e) {}
        try { par.removeChild(node); n++; } catch (e) {}
      }
    } catch (e) {}
    return n;
  }
  function startObjCleaner() {
    try {
      if (window.__dolObjClean) return;
      window.__dolObjClean = 1;
      var pending = false, lastRun = 0;
      var run = function () {
        var c = cleanObjText();
        var d = document.getElementById('dol-toast-err');
        if (d && window.__dolToastErr && d.textContent !== window.__dolToastErr) d.textContent = window.__dolToastErr;
        if (c > 0) {
          try {
            if (!window.__dolObjTold) { window.__dolObjTold = 1; showToast('已清理 ' + c + ' 处异常文本'); }
          } catch (e) {}
        }
      };
      var schedule = function () {
        if (pending) return;
        pending = true;
        setTimeout(function () {
          pending = false;
          var now = Date.now();
          if (now - lastRun < 800) { schedule(); return; }
          lastRun = now;
          run();
        }, 120);
      };
      try {
        var obs = new MutationObserver(schedule);
        obs.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
      setInterval(run, 4000);
      setTimeout(run, 600);
    } catch (e) {}
  }
  function scanObjectText() { return cleanObjText(); }
  function startObjectScan() { return startObjCleaner(); }
  function fixPanelZoom() {
    try {
      var user = uiScaleVal();
      var auto = 1;
      try { auto = pageZoomFactor(); } catch (e) {}
      window.__dolGameZoom = auto;
      var panel = document.getElementById('dolonline-panel');
      // 面板一律不用 zoom / transform：任何缩放都会让触控坐标和视觉位置分家。
      // 改成"真的把面板做大"（宽度 + 字号），布局尺度和命中区域始终一致。
      if (panel) {
        panel.style.zoom = '';
        panel.style.transform = '';
        panel.style.transformOrigin = '';
        if (Math.abs(user - 1) < 0.01) {
          panel.style.width = 'min(94vw,330px)';
          panel.style.maxHeight = '88vh';
          panel.style.fontSize = '14px';
        } else {
          panel.style.width = 'min(96vw,' + Math.round(330 * user) + 'px)';
          panel.style.maxHeight = '92vh';
          panel.style.fontSize = (14 * user).toFixed(1) + 'px';
        }
      }
      var btn = document.getElementById('dolonline-btn');
      if (btn) { btn.style.zoom = ''; btn.style.transform = ''; }
      try { fitMirror(); } catch (e) {}
      setTimeout(function () { try { fitMirror(); } catch (e) {} }, 260);
    } catch (e) {}
  }

  /* ===== 装备栏（仅地下城显示） ===== */
  var EQUIP_SLOTS = [
    { key: 'helmet',  label: '头盔' },
    { key: 'chest',   label: '衣服' },
    { key: 'legs',    label: '裤子' },
    { key: 'gloves',  label: '手套' },
    { key: 'boots',   label: '鞋子' },
    { key: 'weapon',  label: '武器' },
    { key: 'offhand', label: '副手' },
    { key: 'neck',    label: '饰品' }
  ];
  var EQUIP_POOL = {
    helmet: [
      {n:'布帽', atk:0, def:1, hp:0, tier:0},
      {n:'布帽·锐', atk:0, def:1, hp:0, tier:0},
      {n:'布帽·坚', atk:0, def:2, hp:0, tier:0},
      {n:'布帽·厚', atk:0, def:1, hp:0, tier:0},
      {n:'皮帽', atk:0, def:2, hp:2, tier:1},
      {n:'皮帽·锐', atk:0, def:1, hp:1, tier:1},
      {n:'皮帽·坚', atk:0, def:3, hp:2, tier:1},
      {n:'皮帽·厚', atk:0, def:2, hp:4, tier:1},
      {n:'锁子盔', atk:0, def:4, hp:8, tier:2},
      {n:'锁子盔·锐', atk:0, def:3, hp:5, tier:2},
      {n:'锁子盔·坚', atk:0, def:6, hp:8, tier:2},
      {n:'锁子盔·厚', atk:0, def:4, hp:15, tier:2},
      {n:'板甲盔', atk:0, def:6, hp:14, tier:3},
      {n:'板甲盔·锐', atk:0, def:4, hp:8, tier:3},
      {n:'板甲盔·坚', atk:0, def:10, hp:14, tier:3},
      {n:'板甲盔·厚', atk:0, def:5, hp:27, tier:3},
      {n:'龙首盔', atk:1, def:8, hp:20, tier:4},
      {n:'龙首盔·锐', atk:2, def:6, hp:12, tier:4},
      {n:'龙首盔·坚', atk:1, def:13, hp:20, tier:4},
      {n:'龙首盔·厚', atk:0, def:7, hp:38, tier:4},
      {n:'秘银冠', atk:2, def:10, hp:28, tier:5},
      {n:'秘银冠·锐', atk:3, def:7, hp:17, tier:5},
      {n:'秘银冠·坚', atk:1, def:16, hp:28, tier:5},
      {n:'秘银冠·厚', atk:1, def:9, hp:53, tier:5},
      {n:'星辰冠', atk:3, def:13, hp:38, tier:6},
      {n:'星辰冠·锐', atk:5, def:9, hp:23, tier:6},
      {n:'星辰冠·坚', atk:2, def:21, hp:38, tier:6},
      {n:'星辰冠·厚', atk:2, def:12, hp:72, tier:6}
    ],
    chest: [
      {n:'布衣', atk:0, def:1, hp:5, tier:0},
      {n:'布衣·锐', atk:0, def:1, hp:3, tier:0},
      {n:'布衣·坚', atk:0, def:2, hp:5, tier:0},
      {n:'布衣·厚', atk:0, def:1, hp:10, tier:0},
      {n:'皮甲', atk:0, def:3, hp:10, tier:1},
      {n:'皮甲·锐', atk:0, def:2, hp:6, tier:1},
      {n:'皮甲·坚', atk:0, def:5, hp:10, tier:1},
      {n:'皮甲·厚', atk:0, def:3, hp:19, tier:1},
      {n:'锁子甲', atk:0, def:5, hp:20, tier:2},
      {n:'锁子甲·锐', atk:0, def:4, hp:12, tier:2},
      {n:'锁子甲·坚', atk:0, def:8, hp:20, tier:2},
      {n:'锁子甲·厚', atk:0, def:4, hp:38, tier:2},
      {n:'板甲', atk:0, def:7, hp:28, tier:3},
      {n:'板甲·锐', atk:0, def:5, hp:17, tier:3},
      {n:'板甲·坚', atk:0, def:11, hp:28, tier:3},
      {n:'板甲·厚', atk:0, def:6, hp:53, tier:3},
      {n:'龙鳞甲', atk:1, def:9, hp:40, tier:4},
      {n:'龙鳞甲·锐', atk:2, def:6, hp:24, tier:4},
      {n:'龙鳞甲·坚', atk:1, def:14, hp:40, tier:4},
      {n:'龙鳞甲·厚', atk:0, def:8, hp:76, tier:4},
      {n:'秘银铠', atk:1, def:12, hp:55, tier:5},
      {n:'秘银铠·锐', atk:2, def:8, hp:33, tier:5},
      {n:'秘银铠·坚', atk:1, def:19, hp:55, tier:5},
      {n:'秘银铠·厚', atk:0, def:11, hp:104, tier:5},
      {n:'星辰铠', atk:2, def:15, hp:70, tier:6},
      {n:'星辰铠·锐', atk:3, def:10, hp:42, tier:6},
      {n:'星辰铠·坚', atk:1, def:24, hp:70, tier:6},
      {n:'星辰铠·厚', atk:1, def:14, hp:133, tier:6}
    ],
    legs: [
      {n:'布裤', atk:0, def:1, hp:4, tier:0},
      {n:'布裤·锐', atk:0, def:1, hp:2, tier:0},
      {n:'布裤·坚', atk:0, def:2, hp:4, tier:0},
      {n:'布裤·厚', atk:0, def:1, hp:8, tier:0},
      {n:'皮裤', atk:0, def:3, hp:8, tier:1},
      {n:'皮裤·锐', atk:0, def:2, hp:5, tier:1},
      {n:'皮裤·坚', atk:0, def:5, hp:8, tier:1},
      {n:'皮裤·厚', atk:0, def:3, hp:15, tier:1},
      {n:'锁甲腿', atk:0, def:5, hp:16, tier:2},
      {n:'锁甲腿·锐', atk:0, def:4, hp:10, tier:2},
      {n:'锁甲腿·坚', atk:0, def:8, hp:16, tier:2},
      {n:'锁甲腿·厚', atk:0, def:4, hp:30, tier:2},
      {n:'板甲腿', atk:0, def:7, hp:22, tier:3},
      {n:'板甲腿·锐', atk:0, def:5, hp:13, tier:3},
      {n:'板甲腿·坚', atk:0, def:11, hp:22, tier:3},
      {n:'板甲腿·厚', atk:0, def:6, hp:42, tier:3},
      {n:'龙鳞腿', atk:1, def:9, hp:32, tier:4},
      {n:'龙鳞腿·锐', atk:2, def:6, hp:19, tier:4},
      {n:'龙鳞腿·坚', atk:1, def:14, hp:32, tier:4},
      {n:'龙鳞腿·厚', atk:0, def:8, hp:61, tier:4},
      {n:'秘银腿甲', atk:1, def:12, hp:44, tier:5},
      {n:'秘银腿甲·锐', atk:2, def:8, hp:26, tier:5},
      {n:'秘银腿甲·坚', atk:1, def:19, hp:44, tier:5},
      {n:'秘银腿甲·厚', atk:0, def:11, hp:84, tier:5},
      {n:'星辰腿甲', atk:2, def:15, hp:56, tier:6},
      {n:'星辰腿甲·锐', atk:3, def:10, hp:34, tier:6},
      {n:'星辰腿甲·坚', atk:1, def:24, hp:56, tier:6},
      {n:'星辰腿甲·厚', atk:1, def:14, hp:106, tier:6}
    ],
    gloves: [
      {n:'布手', atk:0, def:1, hp:0, tier:0},
      {n:'布手·锐', atk:0, def:1, hp:0, tier:0},
      {n:'布手·坚', atk:0, def:2, hp:0, tier:0},
      {n:'布手·厚', atk:0, def:1, hp:0, tier:0},
      {n:'皮手套', atk:1, def:2, hp:2, tier:1},
      {n:'皮手套·锐', atk:2, def:1, hp:1, tier:1},
      {n:'皮手套·坚', atk:1, def:3, hp:2, tier:1},
      {n:'皮手套·厚', atk:0, def:2, hp:4, tier:1},
      {n:'铁护手', atk:2, def:4, hp:6, tier:2},
      {n:'铁护手·锐', atk:3, def:3, hp:4, tier:2},
      {n:'铁护手·坚', atk:1, def:6, hp:6, tier:2},
      {n:'铁护手·厚', atk:1, def:4, hp:11, tier:2},
      {n:'板甲手套', atk:3, def:6, hp:9, tier:3},
      {n:'板甲手套·锐', atk:5, def:4, hp:5, tier:3},
      {n:'板甲手套·坚', atk:2, def:10, hp:9, tier:3},
      {n:'板甲手套·厚', atk:2, def:5, hp:17, tier:3},
      {n:'龙鳞手套', atk:5, def:8, hp:13, tier:4},
      {n:'龙鳞手套·锐', atk:8, def:6, hp:8, tier:4},
      {n:'龙鳞手套·坚', atk:3, def:13, hp:13, tier:4},
      {n:'龙鳞手套·厚', atk:2, def:7, hp:25, tier:4},
      {n:'秘银手套', atk:8, def:10, hp:18, tier:5},
      {n:'秘银手套·锐', atk:14, def:7, hp:11, tier:5},
      {n:'秘银手套·坚', atk:5, def:16, hp:18, tier:5},
      {n:'秘银手套·厚', atk:4, def:9, hp:34, tier:5},
      {n:'星辰手套', atk:12, def:13, hp:24, tier:6},
      {n:'星辰手套·锐', atk:20, def:9, hp:14, tier:6},
      {n:'星辰手套·坚', atk:7, def:21, hp:24, tier:6},
      {n:'星辰手套·厚', atk:6, def:12, hp:46, tier:6}
    ],
    boots: [
      {n:'草鞋', atk:0, def:1, hp:0, tier:0},
      {n:'草鞋·锐', atk:0, def:1, hp:0, tier:0},
      {n:'草鞋·坚', atk:0, def:2, hp:0, tier:0},
      {n:'草鞋·厚', atk:0, def:1, hp:0, tier:0},
      {n:'皮靴', atk:0, def:2, hp:3, tier:1},
      {n:'皮靴·锐', atk:0, def:1, hp:2, tier:1},
      {n:'皮靴·坚', atk:0, def:3, hp:3, tier:1},
      {n:'皮靴·厚', atk:0, def:2, hp:6, tier:1},
      {n:'铁靴', atk:0, def:4, hp:8, tier:2},
      {n:'铁靴·锐', atk:0, def:3, hp:5, tier:2},
      {n:'铁靴·坚', atk:0, def:6, hp:8, tier:2},
      {n:'铁靴·厚', atk:0, def:4, hp:15, tier:2},
      {n:'板甲战靴', atk:1, def:5, hp:10, tier:3},
      {n:'板甲战靴·锐', atk:2, def:4, hp:6, tier:3},
      {n:'板甲战靴·坚', atk:1, def:8, hp:10, tier:3},
      {n:'板甲战靴·厚', atk:0, def:4, hp:19, tier:3},
      {n:'龙鳞靴', atk:0, def:7, hp:18, tier:4},
      {n:'龙鳞靴·锐', atk:0, def:5, hp:11, tier:4},
      {n:'龙鳞靴·坚', atk:0, def:11, hp:18, tier:4},
      {n:'龙鳞靴·厚', atk:0, def:6, hp:34, tier:4},
      {n:'秘银靴', atk:2, def:9, hp:24, tier:5},
      {n:'秘银靴·锐', atk:3, def:6, hp:14, tier:5},
      {n:'秘银靴·坚', atk:1, def:14, hp:24, tier:5},
      {n:'秘银靴·厚', atk:1, def:8, hp:46, tier:5},
      {n:'星辰靴', atk:3, def:11, hp:32, tier:6},
      {n:'星辰靴·锐', atk:5, def:8, hp:19, tier:6},
      {n:'星辰靴·坚', atk:2, def:18, hp:32, tier:6},
      {n:'星辰靴·厚', atk:2, def:10, hp:61, tier:6}
    ],
    weapon: [
      {n:'榆木法杖', atk:4, def:0, hp:0, sp:10, tier:0},
      {n:'白蜡法杖', atk:10, def:0, hp:0, sp:18, tier:1},
      {n:'黑檀法杖', atk:18, def:0, hp:0, sp:28, tier:2},
      {n:'银纹法杖', atk:28, def:0, hp:0, sp:40, tier:3},
      {n:'龙骨法杖', atk:40, def:0, hp:0, sp:55, tier:4},
      {n:'秘银杖', atk:55, def:0, hp:0, sp:72, tier:5},
      {n:'星辰杖', atk:72, def:0, hp:0, sp:95, tier:6},
      {n:'木剑', atk:3, def:0, hp:0, tier:0},
      {n:'木剑·锐', atk:5, def:0, hp:0, tier:0},
      {n:'木剑·坚', atk:2, def:0, hp:0, tier:0},
      {n:'木剑·厚', atk:2, def:0, hp:0, tier:0},
      {n:'铁剑', atk:6, def:0, hp:0, tier:1},
      {n:'铁剑·锐', atk:10, def:0, hp:0, tier:1},
      {n:'铁剑·坚', atk:4, def:0, hp:0, tier:1},
      {n:'铁剑·厚', atk:3, def:0, hp:0, tier:1},
      {n:'钢剑', atk:9, def:1, hp:0, tier:2},
      {n:'钢剑·锐', atk:15, def:1, hp:0, tier:2},
      {n:'钢剑·坚', atk:5, def:2, hp:0, tier:2},
      {n:'钢剑·厚', atk:4, def:1, hp:0, tier:2},
      {n:'火焰大剑', atk:13, def:0, hp:0, tier:3},
      {n:'火焰大剑·锐', atk:22, def:0, hp:0, tier:3},
      {n:'火焰大剑·坚', atk:8, def:0, hp:0, tier:3},
      {n:'火焰大剑·厚', atk:6, def:0, hp:0, tier:3},
      {n:'龙牙剑', atk:17, def:2, hp:5, tier:4},
      {n:'龙牙剑·锐', atk:29, def:1, hp:3, tier:4},
      {n:'龙牙剑·坚', atk:10, def:3, hp:5, tier:4},
      {n:'龙牙剑·厚', atk:8, def:2, hp:10, tier:4},
      {n:'秘银刃', atk:22, def:3, hp:8, tier:5},
      {n:'秘银刃·锐', atk:37, def:2, hp:5, tier:5},
      {n:'秘银刃·坚', atk:13, def:5, hp:8, tier:5},
      {n:'秘银刃·厚', atk:11, def:3, hp:15, tier:5},
      {n:'星辰剑', atk:28, def:4, hp:12, tier:6},
      {n:'星辰剑·锐', atk:48, def:3, hp:7, tier:6},
      {n:'星辰剑·坚', atk:17, def:6, hp:12, tier:6},
      {n:'星辰剑·厚', atk:14, def:4, hp:23, tier:6}
    ],
    offhand: [
      {n:'木盾', atk:0, def:2, hp:0, tier:0},
      {n:'木盾·锐', atk:0, def:1, hp:0, tier:0},
      {n:'木盾·坚', atk:0, def:3, hp:0, tier:0},
      {n:'木盾·厚', atk:0, def:2, hp:0, tier:0},
      {n:'铁盾', atk:0, def:4, hp:5, tier:1},
      {n:'铁盾·锐', atk:0, def:3, hp:3, tier:1},
      {n:'铁盾·坚', atk:0, def:6, hp:5, tier:1},
      {n:'铁盾·厚', atk:0, def:4, hp:10, tier:1},
      {n:'塔盾', atk:0, def:6, hp:10, tier:2},
      {n:'塔盾·锐', atk:0, def:4, hp:6, tier:2},
      {n:'塔盾·坚', atk:0, def:10, hp:10, tier:2},
      {n:'塔盾·厚', atk:0, def:5, hp:19, tier:2},
      {n:'魔法书', atk:3, def:3, hp:8, tier:3},
      {n:'魔法书·锐', atk:5, def:2, hp:5, tier:3},
      {n:'魔法书·坚', atk:2, def:5, hp:8, tier:3},
      {n:'魔法书·厚', atk:2, def:3, hp:15, tier:3},
      {n:'龙鳞盾', atk:0, def:9, hp:16, tier:4},
      {n:'龙鳞盾·锐', atk:0, def:6, hp:10, tier:4},
      {n:'龙鳞盾·坚', atk:0, def:14, hp:16, tier:4},
      {n:'龙鳞盾·厚', atk:0, def:8, hp:30, tier:4},
      {n:'秘银盾', atk:2, def:12, hp:22, tier:5},
      {n:'秘银盾·锐', atk:3, def:8, hp:13, tier:5},
      {n:'秘银盾·坚', atk:1, def:19, hp:22, tier:5},
      {n:'秘银盾·厚', atk:1, def:11, hp:42, tier:5},
      {n:'星辰盾', atk:4, def:15, hp:30, tier:6},
      {n:'星辰盾·锐', atk:7, def:10, hp:18, tier:6},
      {n:'星辰盾·坚', atk:2, def:24, hp:30, tier:6},
      {n:'星辰盾·厚', atk:2, def:14, hp:57, tier:6}
    ],
    neck: [
      {n:'木珠', atk:0, def:0, hp:3, tier:0},
      {n:'木珠·锐', atk:0, def:0, hp:2, tier:0},
      {n:'木珠·坚', atk:0, def:0, hp:3, tier:0},
      {n:'木珠·厚', atk:0, def:0, hp:6, tier:0},
      {n:'银戒', atk:2, def:1, hp:3, tier:1},
      {n:'银戒·锐', atk:3, def:1, hp:2, tier:1},
      {n:'银戒·坚', atk:1, def:2, hp:3, tier:1},
      {n:'银戒·厚', atk:1, def:1, hp:6, tier:1},
      {n:'蓝晶项链', atk:4, def:2, hp:6, tier:2},
      {n:'蓝晶项链·锐', atk:7, def:1, hp:4, tier:2},
      {n:'蓝晶项链·坚', atk:2, def:3, hp:6, tier:2},
      {n:'蓝晶项链·厚', atk:2, def:2, hp:11, tier:2},
      {n:'秘银戒', atk:6, def:4, hp:10, tier:3},
      {n:'秘银戒·锐', atk:10, def:3, hp:6, tier:3},
      {n:'秘银戒·坚', atk:4, def:6, hp:10, tier:3},
      {n:'秘银戒·厚', atk:3, def:4, hp:19, tier:3},
      {n:'龙牙坠', atk:10, def:5, hp:14, tier:4},
      {n:'龙牙坠·锐', atk:17, def:4, hp:8, tier:4},
      {n:'龙牙坠·坚', atk:6, def:8, hp:14, tier:4},
      {n:'龙牙坠·厚', atk:5, def:4, hp:27, tier:4},
      {n:'秘银星坠', atk:15, def:8, hp:20, tier:5},
      {n:'秘银星坠·锐', atk:26, def:6, hp:12, tier:5},
      {n:'秘银星坠·坚', atk:9, def:13, hp:20, tier:5},
      {n:'秘银星坠·厚', atk:8, def:7, hp:38, tier:5},
      {n:'星辰坠', atk:22, def:11, hp:30, tier:6},
      {n:'星辰坠·锐', atk:37, def:8, hp:18, tier:6},
      {n:'星辰坠·坚', atk:13, def:18, hp:30, tier:6},
      {n:'星辰坠·厚', atk:11, def:10, hp:57, tier:6}
    ],
  };

  /* ===== 玩家攻防（含体型 + 装备） ===== */
  window.dolCombatStats = function () {
    try { return playerCombatStats(); } catch (e) { return { atk: 5, def: 3, phy: 0 }; }
  };
  window.dolAffixStats = function () {
    var o = { atk: 0, def: 0, hp: 0, crit: 0, lifesteal: 0, dodge: 0, block: 0, sp: 0, pen: 0 };
    try { o = affixStatsOf(VV()); } catch (e) {}
    return o;
  };
  function playerCombatStats() {
    var v = VV(); if (!v) return { atk: 5, def: 3, hp: 0 };
    var phy = Math.min(100, Number(v.physique) || 0);
    var tiny = Number(v.bodysize) || 0;   // 部分版本有
    var atk = 5 + Math.floor(phy / 10);
    var def = 3 + Math.floor(phy / 20);
    var eq = v.mpEquip || {};
    ['helmet','chest','legs','gloves','boots','weapon','offhand','neck'].forEach(function (k) {
      var it = eq[k];
      if (it) { atk += Number(it.atk)||0; def += Number(it.def)||0; }
    });
    var sb = setBonusOf(v);
    atk += sb.atk; def += sb.def;
    var af0 = affixStatsOf(v);
    atk += af0.atk; def += af0.def;
    atk += Number(v.mpDgAtk) || 0;
    def += Number(v.mpDgDef) || 0;
    try {
      var _db = window.dolDgBuffStats ? dolDgBuffStats() : null;
      if (_db) {
        if (_db.atk) atk = Math.round(atk * (1 + _db.atk / 100));
        if (_db.def) def = Math.round(def * (1 + _db.def / 100));
      }
    } catch (e) {}
    try {
      var sk = v.mpSkill || {};
      atk += (Number(sk.atk) || 0) * 2;
      def += (Number(sk.def) || 0) * 2;
    } catch (e) {}
    try { var pb = petBonus(); atk += pb.atk; def += pb.def; } catch (e) {}
    try {
      var pc = (partyMembers && partyMembers.length) || 0;
      if (pc >= 2) { var pm = 1 + Math.min(3, pc - 1) * 0.05; atk = Math.round(atk * pm); def = Math.round(def * pm); }
    } catch (e) {}
    try {
      var eq2 = v.mpEquip || {}, upSum = 0, upCnt = 0;
      for (var k in eq2) { var e2 = eq2[k]; if (e2) { upSum += Number(e2.up) || 0; upCnt++; } }
      if (upCnt) { var mul = 1 + upSum * 0.01; atk = Math.round(atk * mul); def = Math.round(def * mul); }
    } catch (e) {}
    if (Number(v.mpPainReduce) > 0) def += Math.floor(Number(v.mpPainReduce) / 10);
    try {
      var cp = v.__cpPartner || '';
      if (cp && (lastOnline || []).indexOf(cp) >= 0) {
        atk = Math.floor(atk * 1.15);
        def = Math.floor(def * 1.15);
      }
    } catch (e) {}
    try {
      var _cls = (typeof classDef === 'function') ? classDef() : null;
      if (_cls) { atk = Math.round(atk * _cls.atk); def = Math.round(def * _cls.def); }
    } catch (e) {}
    try {
      var _sbx = (typeof setStatOf === 'function') ? setStatOf(v) : null;
      if (_sbx) {
        atk = Math.round(atk * (1 + (_sbx.atkPct || 0) / 100));
        def = Math.round(def * (1 + (_sbx.defPct || 0) / 100));
      }
    } catch (e) {}
    try {
      var _cb = codexBonus();
      if (_cb) {
        atk = Math.round(atk * (1 + (_cb.atkPct || 0) / 100));
        def = Math.round(def * (1 + (_cb.defPct || 0) / 100));
      }
    } catch (e) {}
    return { atk: atk, def: def, phy: phy };
  }

  function equipStats(v) {
    var t = { atk: 0, def: 0, hp: 0 };
    var eq = v.mpEquip || {};
    EQUIP_SLOTS.forEach(function (s) {
      var it = eq[s.key];
      if (it) { t.atk += Number(it.atk)||0; t.def += Number(it.def)||0; t.hp += Number(it.hp)||0; }
    });
    return t;
  }
  function inDungeon() {
    try {
      var p = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
      return p.indexOf('DoLOnlineDungeon') === 0;
    } catch (e) { return false; }
  }
  function renderEquip() {
    var box = document.getElementById('dol-equip');
    var sec = document.getElementById('dol-equip-sec');
    if (!box || !sec) return;
    sec.style.display = 'block';
    var v = VV(); if (!v) return;
    var eq = v.mpEquip || (v.mpEquip = {});
    var st = equipStats(v);
    var ps = playerCombatStats();

    var sum = '<div style="font-size:12px;color:#b8d0f0;margin-bottom:2px"> 你的攻击 <b style="color:#e25a5a">' + ps.atk +
      '</b>　防御 <b style="color:#5a9ae2">' + ps.def + '</b></div>' +
      '<div style="font-size:11px;color:#8a8a8a;margin-bottom:4px">装备加成：攻击 +' + st.atk + '　防御 +' + st.def +
      '　生命 +' + st.hp + '</div>';
    try {
      var sb = setBonusOf(v);
      if (sb.sets.length) {
        if (sb.sets.some(function (x) { return x.indexOf('(5件)') >= 0 || x.indexOf('(7件)') >= 0; })) unlockAch('set5');
        sum += '<div style="font-size:11px;color:#f0a030;margin-bottom:4px">套装：' + sb.sets.join('、') +
          '（' + (sb.atk ? '攻+' + sb.atk + ' ' : '') + (sb.def ? '防+' + sb.def + ' ' : '') + '血+' + sb.hp + '）</div>';
      }
    } catch (e) {}
    try {
      var af = affixStatsOf(v);
      var parts = [];
      if (af.atk) parts.push('攻+' + af.atk);
      if (af.def) parts.push('防+' + af.def);
      if (af.hp) parts.push('血+' + af.hp);
      if (af.crit) parts.push('暴击+' + af.crit + '%');
      if (af.lifesteal) parts.push('吸血+' + af.lifesteal + '%');
      if (af.dodge) parts.push('闪避+' + af.dodge + '%');
      if (af.block) parts.push('减伤+' + af.block + '%');
      if (parts.length) sum += '<div style="font-size:11px;color:#9ac7ff;margin-bottom:4px">附魔：' + parts.join('　') + '</div>';
    } catch (e) {}

    try {
      var _cc = setCounts(v);
      var _cs = setStatOf(v);
      var _ids = Object.keys(_cc);
      if (_ids.length) {
        sum += '<div style="font-size:11px;margin-bottom:4px">' + _ids.map(function (id) {
          var dd = CLASS_SETS[id] || { n: id, c: '#aaa' };
          var act = _cs.sets.some(function (x) { return x.id === id; });
          return '<span style="color:' + (act ? dd.c : '#6a6a72') + '">' + dd.n + ' ' + _cc[id] + '/6</span>';
        }).join('　') + '</div>';
      }
    } catch (e) {}
    var sumEl = document.getElementById('dol-equip-sum');
    var focused = box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';
    if (focused && sumEl) { sumEl.innerHTML = sum; return; }

    var html = '<div id="dol-equip-sum">' + sum + '</div>';
    EQUIP_SLOTS.forEach(function (s) {
      var cur = eq[s.key];
      var owns = sortItems((bag() || []).filter(function (b) { return b.slot === s.key; }));
      if (cur) {
        var hasCur = owns.some(function (b) { return b.n === cur.n; });
        if (!hasCur) owns = [cur].concat(owns);
      }
      var opts = '<option value="">（无）</option>' + owns.map(function (it) {
        var rr = it.rarity ? (RARITY.filter(function (r) { return r.k === it.rarity; })[0] || RARITY[0]) : rarityByName(it.slot || s.key, it.n);
        return '<option value="' + esc(it.n) + '"' + (cur && cur.n === it.n ? ' selected' : '') + '>' +
          '[' + rr.n + '] ' + esc(it.n) + (it.affixes && it.affixes.length ? ' [' + affixPlain(it) + ']' : '') +
          ' (攻+' + it.atk + ' 防+' + it.def + ' 血+' + it.hp + ')' +
          (it.dur != null ? ' 耐' + it.dur + '/' + (it.maxDur || 0) + ' 固' + (it.tough != null ? it.tough : 0) : '') + '</option>';
      }).join('');
      html += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0">' +
        '<span style="width:34px;color:#e8c97a">' + s.label + '</span>' +
        '<select data-slot="' + s.key + '" style="flex:1;background:#0c0e12;color:#ddd;border:1px solid #3a3428;border-radius:4px;padding:4px;font-size:12px">' + opts + '</select></div>';
    });

    if (box.getAttribute('data-html') !== html) {
      box.setAttribute('data-html', html);
      box.innerHTML = html;
    } else if (sumEl) {
      sumEl.innerHTML = sum;
    }

    box.querySelectorAll('select[data-slot]').forEach(function (sel) {
      sel.onchange = function () {
        var k = sel.getAttribute('data-slot');
        var name = sel.value;
        var item = null;
        var list = bag();
        for (var i = 0; i < list.length; i++) {
          if (list[i].slot === k && list[i].n === name) { item = list[i]; break; }
        }
        if (!item) {
          var pool = EQUIP_POOL[k] || [];
          for (var j = 0; j < pool.length; j++) {
            if (pool[j].n === name) {
              item = { n: pool[j].n, atk: pool[j].atk, def: pool[j].def, hp: pool[j].hp, rarity: RARITY[pool[j].tier || 0].k, affixes: [] };
              break;
            }
          }
        }
        if (!v.mpEquip) v.mpEquip = {};
        if (item && (item.dur != null) && item.dur <= 0) {
          showToast('这件装备耐久为 0，需要先修理');
          return;
        }
        v.mpEquip[k] = item ? {
          n: item.n, atk: item.atk, def: item.def, hp: item.hp,
          rarity: item.rarity, affixes: item.affixes || [],
          dur: (item.dur != null ? item.dur : (item.maxDur || 100)),
          maxDur: item.maxDur || 100,
          tough: (item.tough != null ? item.tough : 3)
        } : null;
        box.setAttribute('data-html', '');
        renderEquip();
        try { if (!window.__gearTimer) { window.__gearTimer = setTimeout(function () { window.__gearTimer = null; pushPartyGear(); }, 3000); } } catch (e) {}
        setTimeout(function () { try { renderEquip(); } catch (e) {} }, 350);
      };
    });
  }

  /* ===== 背包 / 掉落 / 地下城经验 ===== */
  var BAG_POOL = {
    helmet: [
      {n:'布帽', atk:0, def:1, hp:0, tier:0},
      {n:'布帽·锐', atk:0, def:1, hp:0, tier:0},
      {n:'布帽·坚', atk:0, def:2, hp:0, tier:0},
      {n:'布帽·厚', atk:0, def:1, hp:0, tier:0},
      {n:'皮帽', atk:0, def:2, hp:2, tier:1},
      {n:'皮帽·锐', atk:0, def:1, hp:1, tier:1},
      {n:'皮帽·坚', atk:0, def:3, hp:2, tier:1},
      {n:'皮帽·厚', atk:0, def:2, hp:4, tier:1},
      {n:'锁子盔', atk:0, def:4, hp:8, tier:2},
      {n:'锁子盔·锐', atk:0, def:3, hp:5, tier:2},
      {n:'锁子盔·坚', atk:0, def:6, hp:8, tier:2},
      {n:'锁子盔·厚', atk:0, def:4, hp:15, tier:2},
      {n:'板甲盔', atk:0, def:6, hp:14, tier:3},
      {n:'板甲盔·锐', atk:0, def:4, hp:8, tier:3},
      {n:'板甲盔·坚', atk:0, def:10, hp:14, tier:3},
      {n:'板甲盔·厚', atk:0, def:5, hp:27, tier:3},
      {n:'龙首盔', atk:1, def:8, hp:20, tier:4},
      {n:'龙首盔·锐', atk:2, def:6, hp:12, tier:4},
      {n:'龙首盔·坚', atk:1, def:13, hp:20, tier:4},
      {n:'龙首盔·厚', atk:0, def:7, hp:38, tier:4},
      {n:'秘银冠', atk:2, def:10, hp:28, tier:5},
      {n:'秘银冠·锐', atk:3, def:7, hp:17, tier:5},
      {n:'秘银冠·坚', atk:1, def:16, hp:28, tier:5},
      {n:'秘银冠·厚', atk:1, def:9, hp:53, tier:5},
      {n:'星辰冠', atk:3, def:13, hp:38, tier:6},
      {n:'星辰冠·锐', atk:5, def:9, hp:23, tier:6},
      {n:'星辰冠·坚', atk:2, def:21, hp:38, tier:6},
      {n:'星辰冠·厚', atk:2, def:12, hp:72, tier:6}
    ],
    chest: [
      {n:'布衣', atk:0, def:1, hp:5, tier:0},
      {n:'布衣·锐', atk:0, def:1, hp:3, tier:0},
      {n:'布衣·坚', atk:0, def:2, hp:5, tier:0},
      {n:'布衣·厚', atk:0, def:1, hp:10, tier:0},
      {n:'皮甲', atk:0, def:3, hp:10, tier:1},
      {n:'皮甲·锐', atk:0, def:2, hp:6, tier:1},
      {n:'皮甲·坚', atk:0, def:5, hp:10, tier:1},
      {n:'皮甲·厚', atk:0, def:3, hp:19, tier:1},
      {n:'锁子甲', atk:0, def:5, hp:20, tier:2},
      {n:'锁子甲·锐', atk:0, def:4, hp:12, tier:2},
      {n:'锁子甲·坚', atk:0, def:8, hp:20, tier:2},
      {n:'锁子甲·厚', atk:0, def:4, hp:38, tier:2},
      {n:'板甲', atk:0, def:7, hp:28, tier:3},
      {n:'板甲·锐', atk:0, def:5, hp:17, tier:3},
      {n:'板甲·坚', atk:0, def:11, hp:28, tier:3},
      {n:'板甲·厚', atk:0, def:6, hp:53, tier:3},
      {n:'龙鳞甲', atk:1, def:9, hp:40, tier:4},
      {n:'龙鳞甲·锐', atk:2, def:6, hp:24, tier:4},
      {n:'龙鳞甲·坚', atk:1, def:14, hp:40, tier:4},
      {n:'龙鳞甲·厚', atk:0, def:8, hp:76, tier:4},
      {n:'秘银铠', atk:1, def:12, hp:55, tier:5},
      {n:'秘银铠·锐', atk:2, def:8, hp:33, tier:5},
      {n:'秘银铠·坚', atk:1, def:19, hp:55, tier:5},
      {n:'秘银铠·厚', atk:0, def:11, hp:104, tier:5},
      {n:'星辰铠', atk:2, def:15, hp:70, tier:6},
      {n:'星辰铠·锐', atk:3, def:10, hp:42, tier:6},
      {n:'星辰铠·坚', atk:1, def:24, hp:70, tier:6},
      {n:'星辰铠·厚', atk:1, def:14, hp:133, tier:6}
    ],
    legs: [
      {n:'布裤', atk:0, def:1, hp:4, tier:0},
      {n:'布裤·锐', atk:0, def:1, hp:2, tier:0},
      {n:'布裤·坚', atk:0, def:2, hp:4, tier:0},
      {n:'布裤·厚', atk:0, def:1, hp:8, tier:0},
      {n:'皮裤', atk:0, def:3, hp:8, tier:1},
      {n:'皮裤·锐', atk:0, def:2, hp:5, tier:1},
      {n:'皮裤·坚', atk:0, def:5, hp:8, tier:1},
      {n:'皮裤·厚', atk:0, def:3, hp:15, tier:1},
      {n:'锁甲腿', atk:0, def:5, hp:16, tier:2},
      {n:'锁甲腿·锐', atk:0, def:4, hp:10, tier:2},
      {n:'锁甲腿·坚', atk:0, def:8, hp:16, tier:2},
      {n:'锁甲腿·厚', atk:0, def:4, hp:30, tier:2},
      {n:'板甲腿', atk:0, def:7, hp:22, tier:3},
      {n:'板甲腿·锐', atk:0, def:5, hp:13, tier:3},
      {n:'板甲腿·坚', atk:0, def:11, hp:22, tier:3},
      {n:'板甲腿·厚', atk:0, def:6, hp:42, tier:3},
      {n:'龙鳞腿', atk:1, def:9, hp:32, tier:4},
      {n:'龙鳞腿·锐', atk:2, def:6, hp:19, tier:4},
      {n:'龙鳞腿·坚', atk:1, def:14, hp:32, tier:4},
      {n:'龙鳞腿·厚', atk:0, def:8, hp:61, tier:4},
      {n:'秘银腿甲', atk:1, def:12, hp:44, tier:5},
      {n:'秘银腿甲·锐', atk:2, def:8, hp:26, tier:5},
      {n:'秘银腿甲·坚', atk:1, def:19, hp:44, tier:5},
      {n:'秘银腿甲·厚', atk:0, def:11, hp:84, tier:5},
      {n:'星辰腿甲', atk:2, def:15, hp:56, tier:6},
      {n:'星辰腿甲·锐', atk:3, def:10, hp:34, tier:6},
      {n:'星辰腿甲·坚', atk:1, def:24, hp:56, tier:6},
      {n:'星辰腿甲·厚', atk:1, def:14, hp:106, tier:6}
    ],
    gloves: [
      {n:'布手', atk:0, def:1, hp:0, tier:0},
      {n:'布手·锐', atk:0, def:1, hp:0, tier:0},
      {n:'布手·坚', atk:0, def:2, hp:0, tier:0},
      {n:'布手·厚', atk:0, def:1, hp:0, tier:0},
      {n:'皮手套', atk:1, def:2, hp:2, tier:1},
      {n:'皮手套·锐', atk:2, def:1, hp:1, tier:1},
      {n:'皮手套·坚', atk:1, def:3, hp:2, tier:1},
      {n:'皮手套·厚', atk:0, def:2, hp:4, tier:1},
      {n:'铁护手', atk:2, def:4, hp:6, tier:2},
      {n:'铁护手·锐', atk:3, def:3, hp:4, tier:2},
      {n:'铁护手·坚', atk:1, def:6, hp:6, tier:2},
      {n:'铁护手·厚', atk:1, def:4, hp:11, tier:2},
      {n:'板甲手套', atk:3, def:6, hp:9, tier:3},
      {n:'板甲手套·锐', atk:5, def:4, hp:5, tier:3},
      {n:'板甲手套·坚', atk:2, def:10, hp:9, tier:3},
      {n:'板甲手套·厚', atk:2, def:5, hp:17, tier:3},
      {n:'龙鳞手套', atk:5, def:8, hp:13, tier:4},
      {n:'龙鳞手套·锐', atk:8, def:6, hp:8, tier:4},
      {n:'龙鳞手套·坚', atk:3, def:13, hp:13, tier:4},
      {n:'龙鳞手套·厚', atk:2, def:7, hp:25, tier:4},
      {n:'秘银手套', atk:8, def:10, hp:18, tier:5},
      {n:'秘银手套·锐', atk:14, def:7, hp:11, tier:5},
      {n:'秘银手套·坚', atk:5, def:16, hp:18, tier:5},
      {n:'秘银手套·厚', atk:4, def:9, hp:34, tier:5},
      {n:'星辰手套', atk:12, def:13, hp:24, tier:6},
      {n:'星辰手套·锐', atk:20, def:9, hp:14, tier:6},
      {n:'星辰手套·坚', atk:7, def:21, hp:24, tier:6},
      {n:'星辰手套·厚', atk:6, def:12, hp:46, tier:6}
    ],
    boots: [
      {n:'草鞋', atk:0, def:1, hp:0, tier:0},
      {n:'草鞋·锐', atk:0, def:1, hp:0, tier:0},
      {n:'草鞋·坚', atk:0, def:2, hp:0, tier:0},
      {n:'草鞋·厚', atk:0, def:1, hp:0, tier:0},
      {n:'皮靴', atk:0, def:2, hp:3, tier:1},
      {n:'皮靴·锐', atk:0, def:1, hp:2, tier:1},
      {n:'皮靴·坚', atk:0, def:3, hp:3, tier:1},
      {n:'皮靴·厚', atk:0, def:2, hp:6, tier:1},
      {n:'铁靴', atk:0, def:4, hp:8, tier:2},
      {n:'铁靴·锐', atk:0, def:3, hp:5, tier:2},
      {n:'铁靴·坚', atk:0, def:6, hp:8, tier:2},
      {n:'铁靴·厚', atk:0, def:4, hp:15, tier:2},
      {n:'板甲战靴', atk:1, def:5, hp:10, tier:3},
      {n:'板甲战靴·锐', atk:2, def:4, hp:6, tier:3},
      {n:'板甲战靴·坚', atk:1, def:8, hp:10, tier:3},
      {n:'板甲战靴·厚', atk:0, def:4, hp:19, tier:3},
      {n:'龙鳞靴', atk:0, def:7, hp:18, tier:4},
      {n:'龙鳞靴·锐', atk:0, def:5, hp:11, tier:4},
      {n:'龙鳞靴·坚', atk:0, def:11, hp:18, tier:4},
      {n:'龙鳞靴·厚', atk:0, def:6, hp:34, tier:4},
      {n:'秘银靴', atk:2, def:9, hp:24, tier:5},
      {n:'秘银靴·锐', atk:3, def:6, hp:14, tier:5},
      {n:'秘银靴·坚', atk:1, def:14, hp:24, tier:5},
      {n:'秘银靴·厚', atk:1, def:8, hp:46, tier:5},
      {n:'星辰靴', atk:3, def:11, hp:32, tier:6},
      {n:'星辰靴·锐', atk:5, def:8, hp:19, tier:6},
      {n:'星辰靴·坚', atk:2, def:18, hp:32, tier:6},
      {n:'星辰靴·厚', atk:2, def:10, hp:61, tier:6}
    ],
    weapon: [
      {n:'榆木法杖', atk:4, def:0, hp:0, sp:10, tier:0},
      {n:'白蜡法杖', atk:10, def:0, hp:0, sp:18, tier:1},
      {n:'黑檀法杖', atk:18, def:0, hp:0, sp:28, tier:2},
      {n:'银纹法杖', atk:28, def:0, hp:0, sp:40, tier:3},
      {n:'龙骨法杖', atk:40, def:0, hp:0, sp:55, tier:4},
      {n:'秘银杖', atk:55, def:0, hp:0, sp:72, tier:5},
      {n:'星辰杖', atk:72, def:0, hp:0, sp:95, tier:6},
      {n:'木剑', atk:3, def:0, hp:0, tier:0},
      {n:'木剑·锐', atk:5, def:0, hp:0, tier:0},
      {n:'木剑·坚', atk:2, def:0, hp:0, tier:0},
      {n:'木剑·厚', atk:2, def:0, hp:0, tier:0},
      {n:'铁剑', atk:6, def:0, hp:0, tier:1},
      {n:'铁剑·锐', atk:10, def:0, hp:0, tier:1},
      {n:'铁剑·坚', atk:4, def:0, hp:0, tier:1},
      {n:'铁剑·厚', atk:3, def:0, hp:0, tier:1},
      {n:'钢剑', atk:9, def:1, hp:0, tier:2},
      {n:'钢剑·锐', atk:15, def:1, hp:0, tier:2},
      {n:'钢剑·坚', atk:5, def:2, hp:0, tier:2},
      {n:'钢剑·厚', atk:4, def:1, hp:0, tier:2},
      {n:'火焰大剑', atk:13, def:0, hp:0, tier:3},
      {n:'火焰大剑·锐', atk:22, def:0, hp:0, tier:3},
      {n:'火焰大剑·坚', atk:8, def:0, hp:0, tier:3},
      {n:'火焰大剑·厚', atk:6, def:0, hp:0, tier:3},
      {n:'龙牙剑', atk:17, def:2, hp:5, tier:4},
      {n:'龙牙剑·锐', atk:29, def:1, hp:3, tier:4},
      {n:'龙牙剑·坚', atk:10, def:3, hp:5, tier:4},
      {n:'龙牙剑·厚', atk:8, def:2, hp:10, tier:4},
      {n:'秘银刃', atk:22, def:3, hp:8, tier:5},
      {n:'秘银刃·锐', atk:37, def:2, hp:5, tier:5},
      {n:'秘银刃·坚', atk:13, def:5, hp:8, tier:5},
      {n:'秘银刃·厚', atk:11, def:3, hp:15, tier:5},
      {n:'星辰剑', atk:28, def:4, hp:12, tier:6},
      {n:'星辰剑·锐', atk:48, def:3, hp:7, tier:6},
      {n:'星辰剑·坚', atk:17, def:6, hp:12, tier:6},
      {n:'星辰剑·厚', atk:14, def:4, hp:23, tier:6}
    ],
    offhand: [
      {n:'木盾', atk:0, def:2, hp:0, tier:0},
      {n:'木盾·锐', atk:0, def:1, hp:0, tier:0},
      {n:'木盾·坚', atk:0, def:3, hp:0, tier:0},
      {n:'木盾·厚', atk:0, def:2, hp:0, tier:0},
      {n:'铁盾', atk:0, def:4, hp:5, tier:1},
      {n:'铁盾·锐', atk:0, def:3, hp:3, tier:1},
      {n:'铁盾·坚', atk:0, def:6, hp:5, tier:1},
      {n:'铁盾·厚', atk:0, def:4, hp:10, tier:1},
      {n:'塔盾', atk:0, def:6, hp:10, tier:2},
      {n:'塔盾·锐', atk:0, def:4, hp:6, tier:2},
      {n:'塔盾·坚', atk:0, def:10, hp:10, tier:2},
      {n:'塔盾·厚', atk:0, def:5, hp:19, tier:2},
      {n:'魔法书', atk:3, def:3, hp:8, tier:3},
      {n:'魔法书·锐', atk:5, def:2, hp:5, tier:3},
      {n:'魔法书·坚', atk:2, def:5, hp:8, tier:3},
      {n:'魔法书·厚', atk:2, def:3, hp:15, tier:3},
      {n:'龙鳞盾', atk:0, def:9, hp:16, tier:4},
      {n:'龙鳞盾·锐', atk:0, def:6, hp:10, tier:4},
      {n:'龙鳞盾·坚', atk:0, def:14, hp:16, tier:4},
      {n:'龙鳞盾·厚', atk:0, def:8, hp:30, tier:4},
      {n:'秘银盾', atk:2, def:12, hp:22, tier:5},
      {n:'秘银盾·锐', atk:3, def:8, hp:13, tier:5},
      {n:'秘银盾·坚', atk:1, def:19, hp:22, tier:5},
      {n:'秘银盾·厚', atk:1, def:11, hp:42, tier:5},
      {n:'星辰盾', atk:4, def:15, hp:30, tier:6},
      {n:'星辰盾·锐', atk:7, def:10, hp:18, tier:6},
      {n:'星辰盾·坚', atk:2, def:24, hp:30, tier:6},
      {n:'星辰盾·厚', atk:2, def:14, hp:57, tier:6}
    ],
    neck: [
      {n:'木珠', atk:0, def:0, hp:3, tier:0},
      {n:'木珠·锐', atk:0, def:0, hp:2, tier:0},
      {n:'木珠·坚', atk:0, def:0, hp:3, tier:0},
      {n:'木珠·厚', atk:0, def:0, hp:6, tier:0},
      {n:'银戒', atk:2, def:1, hp:3, tier:1},
      {n:'银戒·锐', atk:3, def:1, hp:2, tier:1},
      {n:'银戒·坚', atk:1, def:2, hp:3, tier:1},
      {n:'银戒·厚', atk:1, def:1, hp:6, tier:1},
      {n:'蓝晶项链', atk:4, def:2, hp:6, tier:2},
      {n:'蓝晶项链·锐', atk:7, def:1, hp:4, tier:2},
      {n:'蓝晶项链·坚', atk:2, def:3, hp:6, tier:2},
      {n:'蓝晶项链·厚', atk:2, def:2, hp:11, tier:2},
      {n:'秘银戒', atk:6, def:4, hp:10, tier:3},
      {n:'秘银戒·锐', atk:10, def:3, hp:6, tier:3},
      {n:'秘银戒·坚', atk:4, def:6, hp:10, tier:3},
      {n:'秘银戒·厚', atk:3, def:4, hp:19, tier:3},
      {n:'龙牙坠', atk:10, def:5, hp:14, tier:4},
      {n:'龙牙坠·锐', atk:17, def:4, hp:8, tier:4},
      {n:'龙牙坠·坚', atk:6, def:8, hp:14, tier:4},
      {n:'龙牙坠·厚', atk:5, def:4, hp:27, tier:4},
      {n:'秘银星坠', atk:15, def:8, hp:20, tier:5},
      {n:'秘银星坠·锐', atk:26, def:6, hp:12, tier:5},
      {n:'秘银星坠·坚', atk:9, def:13, hp:20, tier:5},
      {n:'秘银星坠·厚', atk:8, def:7, hp:38, tier:5},
      {n:'星辰坠', atk:22, def:11, hp:30, tier:6},
      {n:'星辰坠·锐', atk:37, def:8, hp:18, tier:6},
      {n:'星辰坠·坚', atk:13, def:18, hp:30, tier:6},
      {n:'星辰坠·厚', atk:11, def:10, hp:57, tier:6}
    ],
  };
  var TIER_WEIGHTS = [46, 26, 14, 8, 4, 1.6, 0.4];
  // 层数越高，高档装备权重越大
  function tierWeightsFor(floor) {
    var fl = Math.max(1, Number(floor) || 1);
    var boost = Math.min(2.6, 1 + (fl - 1) * 0.06);   // 1 层 1.0 → 25 层 2.44
    return TIER_WEIGHTS.map(function (w, i) {
      return i <= 1 ? w : w * Math.pow(boost, (i - 1) * 0.5);
    });
  }
  function rollTierWeighted(floor) {
    var w = tierWeightsFor(floor);
    var total = w.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total, acc = 0;
    for (var i = 0; i < w.length; i++) {
      acc += w[i];
      if (r < acc) return i;
    }
    return 0;
  }
  var SLOT_WEIGHTS = { helmet: 14, chest: 15, legs: 13, gloves: 11, boots: 12, weapon: 16, offhand: 10, neck: 9 };
  function rollSlotWeighted() {
    var keys = Object.keys(SLOT_WEIGHTS);
    var total = 0;
    keys.forEach(function (k) { total += SLOT_WEIGHTS[k]; });
    var r = Math.random() * total, acc = 0;
    for (var i = 0; i < keys.length; i++) {
      acc += SLOT_WEIGHTS[keys[i]];
      if (r < acc) return keys[i];
    }
    return keys[0];
  }
  function pickItemByTier(pool, tier) {
    if (typeof tier === 'number' && tier >= 0) {
      var fl = pool.filter(function (x) { return (x.tier || 0) === tier; });
      if (fl.length) return fl[Math.floor(Math.random() * fl.length)];
    }
    var _fl = 1;
    try { var _v = VV(); _fl = Number(_v && _v.dgFloor) || 1; } catch (e) {}
    var t = rollTierWeighted(_fl);
    var cands = pool.filter(function (x) { return (x.tier || 0) === t; });
    if (!cands.length) cands = pool;
    return cands[Math.floor(Math.random() * cands.length)];
  }
  function bag() {
    var v = VV(); if (!v) return [];
    if (!Array.isArray(v.mpBag)) v.mpBag = [];
    return v.mpBag;
  }
  window.dolGainExp = function (n) { try { gainExp(n || 0); } catch (e) {} };
  function announceItem(it, rar) {
    try {
      if (!ws || ws.readyState !== 1) return;
      var rank = 0;
      try { rank = RARITY.indexOf(rar); } catch (e) { rank = 0; }
      if (rank < 3) return;
      ws.send(JSON.stringify({ type: 'item_announce', item: (it && it.n) || '', rarity: (rar && rar.n) || '' }));
    } catch (e) {}
  }
  window.dolSetSkillReady = function () {
    try {
      var v = VV(); if (!v) return false;
      var eq = v.mpEquip || {}, cnt = 0;
      for (var k in eq) {
        var it = eq[k]; if (!it) continue;
        if (rarityRank(it.rarity) >= 3) cnt++;
      }
      return cnt >= 5;
    } catch (e) { return false; }
  };
  // 层数越高掉落率越高：45% 起，每层 +1.5%，上限 85%
  window.dolDropChance = function () {
    try {
      var v = VV(); var fl = Number(v && v.dgFloor) || 1;
      var extra = 0;
      try { var _c4 = (typeof classDef === 'function') ? classDef() : null; if (_c4) extra = Number(_c4.loot) || 0; } catch (e) {}
      try { extra += (codexBonus().loot || 0); } catch (e) {}
      return Math.min(65, 25 + Math.floor(fl * 1.0) + extra);
    } catch (e) { return 25; }
  };
  window.dolSpellPower = function () {
    try {
      var v = VV(); if (!v) return 0;
      var sp = 0, eq = v.mpEquip || {};
      ['weapon','offhand','neck','helmet','chest','legs','gloves','boots'].forEach(function (k) {
        var it = eq[k]; if (it) sp += Number(it.sp) || 0;
      });
      try { sp += (affixStatsOf(v).sp || 0); } catch (e) {}
      var sk = v.mpSkill || {};
      sp += (Number(sk.arcane) || 0) * 8;
      try {
        var _c3 = (typeof classDef === 'function') ? classDef() : null;
        if (_c3) sp = sp * (_c3.sp || 1);
      } catch (e) {}
      return Math.max(0, Math.round(sp));
    } catch (e) { return 0; }
  };
  /* ===== 猫猫抽奖 ===== */
  var LOTTERY_COST = 50;
  var LOTTERY_PITY_RARE = 10;    // 10 次内必出稀有以上
  var LOTTERY_PITY_LEGEND = 60;  // 60 次内必出传说以上
  var LOTTERY_TIERS = [
    { w: 34, label: '普通' },
    { w: 26, label: '精良' },
    { w: 20, label: '稀有' },
    { w: 12, label: '史诗' },
    { w: 6,  label: '传说' },
    { w: 2,  label: '神话' }
  ];
  function lotteryRollTier(pull) {
    var total = 0, i;
    for (i = 0; i < LOTTERY_TIERS.length; i++) total += LOTTERY_TIERS[i].w;
    var r = Math.random() * total, acc = 0, t = 0;
    for (i = 0; i < LOTTERY_TIERS.length; i++) {
      acc += LOTTERY_TIERS[i].w;
      if (r < acc) { t = i; break; }
    }
    // 保底
    var v = VV();
    var sinceRare = Number(v && v.mpLotterySinceRare) || 0;
    var sinceLegend = Number(v && v.mpLotterySinceLegend) || 0;
    if (sinceLegend + 1 >= LOTTERY_PITY_LEGEND) t = Math.max(t, 4);
    else if (sinceRare + 1 >= LOTTERY_PITY_RARE) t = Math.max(t, 2);
    return t;
  }
  window.dolLottery = function (mode) {
    try {
      var v = VV(); if (!v) { showToast('读不到存档'); return; }
      var n = String(mode || '1') === '10' ? 10 : 1;
      var cost = LOTTERY_COST * n;
      if ((Number(v.mpCat) || 0) < cost) { showToast('猫猫币不够（需要 ' + cost + '）'); return; }
      if (n === 10 && !window.confirm('消耗 ' + cost + ' 猫猫币抽 10 次？')) return;
      v.mpCat = (Number(v.mpCat) || 0) - cost;
      var got = [];
      for (var k = 0; k < n; k++) {
        var tier = lotteryRollTier(k);
        var slot = rollSlotWeighted();
        var pool = BAG_POOL[slot] || [];
        var it = pickItemByTier(pool, tier) || { n: '碎片', atk: 0, def: 0, hp: 0 };
        var rar = RARITY[tier] || RARITY[0];
        var afx = rollAffixes(tier);
        var dur = rollDurability(tier);
        var obj = {
          slot: slot, n: it.n, atk: it.atk, def: it.def, hp: it.hp, sp: it.sp || 0,
          rarity: rar.k, affixes: afx, dur: dur.dur, maxDur: dur.maxDur, tough: dur.tough,
          set: (typeof rollItemSet === 'function' ? rollItemSet(v, tier) : null)
        };
        if (!Array.isArray(v.mpBag)) v.mpBag = [];
        v.mpBag.push(ensureUid(obj));
        got.push({ n: it.n, rar: rar, tier: tier, slot: slot, afx: afx });
        try { window.dolCodexEquip(it.n); } catch (e) {}
        // 保底计数
        if (tier >= 4) v.mpLotterySinceLegend = 0; else v.mpLotterySinceLegend = (Number(v.mpLotterySinceLegend) || 0) + 1;
        if (tier >= 2) v.mpLotterySinceRare = 0; else v.mpLotterySinceRare = (Number(v.mpLotterySinceRare) || 0) + 1;
        v.mpLotteryTotal = (Number(v.mpLotteryTotal) || 0) + 1;
        if (tier >= 4) {
          try { if (typeof showPillar === 'function') showPillar({ n: it.n }, rar); } catch (e) {}
          try { announceItem(it, rar); } catch (e) {}
        }
        try { window.dolCodexEquip(it.n); } catch (e) {}
      }
      try { renderBag(); renderEquip(); renderCatBalance(); } catch (e) {}
      var box = document.getElementById('dol-lottery-result');
      if (box) {
        box.innerHTML = '<div style="font-size:12px;color:#8a8a8a;margin-bottom:4px">本次抽到（' + n + ' 件）：</div>' +
          got.map(function (g) {
            return '<div style="font-size:12px;margin:2px 0;color:' + g.rar.c + '">[' + g.rar.n + '] ' + esc(g.n) +
              (g.afx && g.afx.length ? ' <span style="font-size:10px;color:#8a8a8a">' + g.afx.map(function (a) { return esc(a.n); }).join(' / ') + '</span>' : '') + '</div>';
          }).join('');
        box.style.display = 'block';
      }
      showToast('抽奖完成，已放入背包');
    } catch (e) {
      showToast('抽奖失败：' + (e && e.message ? e.message : ''));
    }
  };
  function renderLotteryPanel() {
    var box = document.getElementById('dol-lottery-panel');
    if (!box) return;
    var v = VV() || {};
    var cat = Number(v.mpCat) || 0;
    var sinceRare = Number(v.mpLotterySinceRare) || 0;
    var sinceLegend = Number(v.mpLotterySinceLegend) || 0;
    var total = Number(v.mpLotteryTotal) || 0;
    box.innerHTML = '<div style="font-size:12px;color:#8a8a8a;margin-bottom:4px">' +
      '猫猫币 <b style="color:#f0c060">' + cat + '</b>　已抽 <b>' + total + '</b> 次</div>' +
      '<div style="font-size:11px;color:#9ac7ff;margin-bottom:6px">保底：再抽 ' + Math.max(1, LOTTERY_PITY_RARE - sinceRare) +
      ' 次必出稀有以上　再抽 ' + Math.max(1, LOTTERY_PITY_LEGEND - sinceLegend) + ' 次必出传说以上</div>' +
      '<div class="dor" style="flex-wrap:wrap">' +
      '<button data-lottery="1" style="flex:1;min-width:90px">抽 1 次 · 50</button>' +
      '<button data-lottery="10" style="flex:1;min-width:90px">十连 · 500</button>' +
      '</div>' +
      '<div style="font-size:10px;color:#666;margin-top:4px">几率：普通 34% / 精良 26% / 稀有 20% / 史诗 12% / 传说 6% / 神话 2%</div>';
    box.querySelectorAll('[data-lottery]').forEach(function (b) {
      b.onclick = function () { window.dolLottery(b.getAttribute('data-lottery')); renderLotteryPanel(); };
    });
  }
  /* ===== 音效 ===== */
  var SFX = {
    chest: 'data:audio/wav;base64,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',
    crit: 'data:audio/wav;base64,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EgDG/w8A2P/s/zoAzv/M/9//8//C/9b/0//n/zQAyv88AAwA7v86AC8Az/8SAP3/IwDb/wYAOAAuAM//4v8sACIANADW/+n/MgAoAMv/3v8mABwALgDS/+X/EAAiAMf/2f8TABYA0//8/wgAIQAdANr//v8WACcAz//K/woAHAA0ANb/DQAQACEAy/8CAAUAFgAuAPj/CAALABwA7v///xUAEQDS//T/CwAbADMA/v8AABAAKAD0/wMABgAWAOr/+v/9/wwA2f/w/wAAAQDj/+b/9v8LAAcA6f/s/wEAEADf//X/+P8GANb/7P/7//7/LwDi//H/9P/W/9L/6P/3/y4A3P/e/+3/AgDT/+L/5P/5/ykA2f/t/+r/0/8tAOT/8/8nACQA2//q/wYALAAoAOH/DwAjANb/LQDm/xQAJwDb/97/CgAeACwA5v8CABUAIwDe/woABgAaANb/AQD//yIAHgDb/wYAGQAmACMA/v8LAB0A1v/2/wIAFQAiAPn/+/8HABkA8P8CAAAAEQDo//v/BgAYABUA8////xAAHQD1//f/AwAUAO3/7//8/wcA5v/y//T/AADe/+r//P/5/+H/4//0/wAAEADq/+f/+P8IAOP/7//x//3/3P/o/+r/9f/+/+D/7P/u/yEAAQDl//X/8v/c/97/6f/5/x4A5f/i//L/FgDe/+n/6//z/x4A4//k/xUA9/8iAOf/DgAZAPv/4P/r/xIAHQAeAOT/8P8WAOD/IgDl/w8AHgDl/9//7v8XACEAGwDn//L/GgDf/wcA6//2/x0A4/8LAO//FwAeABsADgD3/xcA4f8IABYAEQAbAOn/CwAWABQA4//t/xMAGgAbAOf/8f8TABEABQDr/w0AFwAUAAgAAwAQABoA6//+/woAFADl//j/EAANABoA6f/8/xMAFADj/wAADQALABcA+/8HABAADgD2////CgATAPf/+f8EAA0A8v/z//z/CAAUAPn/9/8NAAsA8//8/wcABQDu//f///8KAPD/8f/6/wUA6//z//X//f8IAO7/7//4/wIA6f/1//P//v8YAPD/+P8CAOn/5//z//v/FwDs/+7/9v8SAOf/7//x//n/FAA=',
    enter: 'data:audio/wav;base64,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2P/c/9//4v/m/+n/7f/x//T/+P/8////AgAFAAkADQAQABQAFwAbAB4AIQAlACgAKwAuADAAMwA2ADgAOwA9AD8AQQBCAEQARgBHAEgASQBKAEoASwBLAEsASwBLAEsASgBKAEkASABHAEUARABCAEEAPwA9ADoAOAA2ADMAMQAuACsAKAAlACIAHwAbABgAFQARAA4ACwAHAAQAAAD+//r/9//z//D/7f/p/+b/4//g/93/2v/X/9T/0v/P/83/yv/I/8b/xP/C/8H/v/++/73/u/+7/7r/uf+5/7n/uP+4/7n/uf+6/7r/u/+8/73/vv/A/8H/w//F/8f/yf/L/83/0P/S/9X/2P/b/93/4P/j/+f/6v/t//D/8//3//r//f8AAAMABgAJAA0AEAATABYAGQAcAB8AIgAlACcAKgAtAC8AMQAzADUANwA5ADsAPAA+AD8AQABBAEIAQwBDAEQARABEAEQARABDAEMAQgBBAEAAPwA+AD0AOwA6ADgANgA0ADIAMAAtACsAKAAmACMAIAAdABsAGAAVABIADwALAAgABQACAAAA/f/6//f/9P/w/+3/6//o/+X/4v/f/93/2v/Y/9X/0//R/8//zf/L/8n/yP/G/8X/xP/D/8L/wf/B/8D/wP/A/8D/wP/A/8D/wf/B/8L/w//E/8X/x//I/8r/y//N/8//0f/T/9b/2P/a/93/3//i/+X/5//q/+3/8P/z//b/+f/8////AQAEAAcACQAMAA8AEgAVABgAGgAdAB8AIgAkACcAKQArAC0ALwAxADIANAA2ADcAOAA5ADoAOwA8ADwAPQA9AD0APQA9AD0APAA8ADsAOwA6ADkANwA2ADUAMwAyADAALgAsACoAKAAmACMAIQAfABwAGgAXABQAEgAPAAwACQAGAAQAAQD///z/+f/3//T/8f/u/+z/6f/n/+T/4v/f/93/2//Z/9f/1f/T/9H/0P/O/83/zP/L/8r/yf/I/8f/x//G/8b/xv/G/8b/xv/H/8f/yP/J/8n/y//M/83/zv/Q/9H/0//V/9f/2P/b/93/3//h/+P/5v/o/+v/7f/w//L/9f/4//r//f8AAAEABAAHAAkADAAPABEAFAAWABkAGwAdAB8AIQAkACUAJwApACsALAAuAC8AMQAyADMANAA1ADUANgA2ADcANwA3ADcANwA3ADYANgA1ADQANAAzADEAMAAvAC4ALAAqACkAJwAlACMAIQAfAB0AGwAYABYAFAARAA8ADAAKAAcABQACAAAA/v/8//n/9//0//L/7//t/+v/6P/m/+T/4v/g/97/3P/a/9n/1//W/9T/0//S/9H/0P/P/87/zf/N/8z/zP/M/w==',
    hurt: 'data:audio/wav;base64,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fwB7AHcAcwBvAGwAaABkAGEAXgBbAFgAVQBTAFAATgBMAEoASABGAEQAQwBCAEEAQAA/AD4APgA+AD4APgA+AD4APwA/AEAAQQBCAEMARQBGAEgAl/6Z/pz+nv6h/qT+p/6r/q7+sf61/rn+vP7A/sT+yP7M/tH+1f7Z/t7+4v7n/uv+8P71/vn+/v4D/wj/Df8S/xb/G/8g/yX/Kv8v/zT/Of8+/0L/R/9M/1H/Vf9a/1//Y/9o/2z/cP90/3n/ff+B/4X/if+M/5D/k/+X/5r/nf+h/6T/pv+p/6z/rv+x/7P/tf+3/7n/u/+9/77/wP/B/8L/w//E/8T/xf/F/8b/xv/G/8b/xf/F/8X/xP/D/8L/wf/A/7//vf+8/7r/uf+3/7X/s/+w/67/rP+p/6f/pP+h/5//nP+Z/5b/kv+P/4z/if+F/4L/fv97/3f/dP9w/2z/af9l/2H/Xf9a/1b/Uv9O/0r/tQCxAK0AqQClAKEAnACYAJQAkQCNAIkAhQCBAH4AegB2AHMAcABsAGkAZgBjAGAAXQBaAFcAVQBSAFAATgBLAEkARwBFAEQAQgBAAD8APgA8ADsAOgA5ADkAOAA3ADcANwA3ADcANwA3ADcAOAA4ADkAOQA6ADsAPAA9AD8AQABCAEMARQBHAEgASgBMAE4AUQBTAFUAWABaAF0AXwBiAGUAaABqAG0AcABzAHYAeQB8AIAAgwCGAIkAjACPAJMAlgCZAJwAoACjAKYAqQCsALAAswC2ALkAvAC/AMIAxQDIAMsAzQDQANMA1QDYANoA3QDfAOEA5ADmAOgA6gDsAO0A7wDxAPIA9AD1APYA9wD5APoAxv/H/8j/yf/K/8r/y//M/8z/zP/N/83/zf/N/83/zf/M/8z/y//L/8r/yf/I/8f/xv/F/8T/w//B/8D/vv+8/7v/uf+3/7X/s/+x/6//rf+r/6j/pv+k/6H/n/+c/5r/l/+U/5L/j/+M/4r/h/+E/4L/f/98/3n/dv90/3H/bv9r/2n/Zv9j/2H/Xv9b/1n/Vv9U/1H/T/9M/0r/SP9F/0P/Qf8//z3/O/85/zf/Nv80/zL/Mf8v/y7/LP8r/yr/Kf8o/yf/Jv8l/yX/JP8j/yP/I/8i/yL/Iv8i/yL/Iv8j/yP/I/8k/yT/Jf8m/yf/KP8p/yr/K/8s/y3/L/8w/zL/M/81/zf/OP86/zz/Pv9A/0L/SQBKAEwATgBQAFIAVABXAFkAWwBdAF8AYgBkAGYAaQBrAG0AcAByAHQAdwB5AHsAfgCAAIMAhQCHAIoAjACOAJAAkwCVAJcAmQCbAJ0AnwChAKMApQCnAKkAqgCsAK4ArwCxALIAtAC1ALYAuAC5ALoAuwC8AL0AvgC+AL8AwADAAMEAwQDBAMIAwgDCAMIAwgDCAMEAwQDBAMAAwAC/AL8AvgC9ALwAuwC7ALkAuAC3ALYAtQCzALIAsACvAK0ArACqAKgApwClAKMAoQCfAJ0AmwCZAJcAlQCTAJAAjgCMAIoAhwCFAIMAgQB+AHwAegB3AHUAcwBwAG4AbABqAGcAZQBjAGEAXgBcAFoAWABWAHj/dv91/3P/cf9w/27/bP9r/2n/aP9n/2X/ZP9j/2L/Yf9g/1//Xv9d/1z/W/9a/1r/Wf9Z/1j/WP9X/1f/V/9X/1f/V/9X/1f/V/9X/1f/WP9Y/1n/Wf9a/1r/W/9c/13/Xv9f/2D/Yf9i/2P/ZP9l/2f/aP9p/2v/bP9u/2//cf9z/3T/dv94/3n/e/99/3//gf+D/4X/h/+I/4r/jP+O/5D/kv+U/5b/mP+a/5z/nv+g/6L/pP+m/6j/qv+s/67/sP+y/7P/tf+3/7n/uv+8/77/v//B/8L/xP/F/8f/yP/K/8v/zP/N/87/0P/R/9L/0//T/9T/1f/W/9f/1//Y/9j/2f/Z/9r/2v/a/9r/2//b/5QAkwCTAJMAkgCSAJEAkQCQAJAAjwCOAI0AjACMAIsAigCJAIgAhgCFAIQAgwCCAIAAfwB+AHwAewB5AHgAdgB1AHMAcgBwAG4AbQBrAGkAaABmAGQAYwBhAF8AXgBcAFoAWABXAFUAUwBSAFAATgBNAEsASQBIAEYARABDAEEAQAA+AD0APAA6ADkANwA2ADUANAAyADEAMAAvAC4ALQAsACsAKgApACkAKAAnACcAJgAlACUAJAAkACQAIwAjACMAIwAiACIAIgAiACIAIgAiACMAIwAjACMAJABRAFEAUABQAFAAUABQAFAAUABQAFAAUABPAE8ATwBPAE8ATwBPAE8ATwBPAE4ATgBOAE4ATgBOALL/sv+y/7L/s/+z/7P/s/+z/7P/s/+z/7P/s/+z/7T/tP+0/7T/tP+0/7T/tP+0/7T/tf+1/7X/tf+1/7X/tf+1/7X/tf+1/7b/tv+2/7b/tv+2/7b/tv+2/7b/tv+3/7f/t/+3/7f/t/+3/7f/t/+3/7f/uP+4/7j/uP+4/7j/uP+4/7j/uP+4/7n/uf+5/7n/uf+5/7n/uf+5/7n/uf+6/7r/uv+6/7r/uv+6/7r/uv+6/7r/uv+7/7v/u/+7/7v/u/+7/7v/u/+7/7v/vP+8/7z/vP+8/7z/vP+8/7z/vP+8/7z/vf+9/73/vf+9/73/vf+9/73/vf+9/73/vv++/77/vv++/77/vv++/77/vv++/0IAQQBBAEEAQQBBAEEAQQBBAEEAQQBBAEEAQQBAAEAAQABAAEAAQABAAEAAQABAAEAAQAA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APQA9AD0APQA9AD0APQA9AD0APQA9AD0APQA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADsAOwA7ADsAOwA7ADsAOwA7ADsAOwA7ADsAOwA6ADoAOgA6ADoAOgA6ADoAOgA6ADoAOgA6ADoAOQA5ADkAOQA5ADkAOQA5ADkAOQA5ADkAOQA5ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA3ADcANwA3AMn/yf/J/8n/yf/J/8n/yf/J/8n/yf/K/8r/yv/K/8r/yv/K/8r/yv/K/8r/yv/K/8r/yv/L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//M/8z/zP/M/8z/zP/M/8z/zP/M/8z/zP/M/8z/zP/N/83/zf/N/83/zf/N/83/zf/N/83/zf/N/83/zf/N/87/zv/O/87/zv/O/87/zv/O/87/zv/O/87/zv/O/87/z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//Q/9D/0P/Q/9D/0P/Q/9D/0P/Q/9D/0P/Q/9D/0P/Q/9D/0f/R/9H/0f/R/9H/0f/R/9H/0f/R/9H/0f/R/9H/0f/R/y4ALgAuAC4ALgAuAC4ALgAuAC4ALgAuAC4ALgAuAC4ALgAtAC0ALQAtAC0ALQAtAC0ALQAtAC0ALQAtAC0ALQAtAC0ALQAsACwALAAsACwALAAsACwALAAsACwALAAsACwALAAsACwALAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAJwAnACcAJwAnACcAJwDZ/9n/2f/Z/9n/2f/Z/9n/2f/Z/9n/2f/Z/9n/2v/a/9r/2v/a/9r/2v/a/9r/2v/a/9r/2v/a/9r/2v/a/9r/2v/a/9r/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/3P/c/9z/3P/c/9z/3P/c/9z/3P/c/9z/3P/c/9z/3P/c/9z/3P/c/9z/3P/d/93/3f/d/93/3f/d/93/3f/d/93/3f/d/93/3f/d/93/3f/d/93/3f/d/93/3v/e/97/3v/e/97/3v/e/97/3v/e/97/3v/e/97/3v/e/97/3v/e/97/3v/e/97/3//f/9//3//f/9//3//f/9//3//f/9//3/8hACEAIQAhACEAIQAhACEAIQAhACEAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB8AHwAfAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHADk/+T/5P/k/+T/5P/l/+X/5f/l/+X/5f/l/+X/5f/l/+X/5f/l/+X/5f/l/+X/5f/l/+X/5f8=',
    lose: 'data:audio/wav;base64,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c/+D/5T/pv+3/8n/2//u/wAAEgAkADYASABZAGoAewCLAJoAqQC3AMQA0ADbAOUA7gD2AP4AAwEIAQwBDgEPAQ8BDgEMAQgBAwH+APcA7wDmANsA0ADEALgAqgCcAI0AfQBtAF0ATAA6ACkAFwAFAPX/4//S/8D/r/+f/4//f/9w/2L/VP9H/zv/MP8m/x3/Ff8O/wj/A////vz++/76/vv+/f4A/wT/Cv8Q/xf/IP8p/zT/P/9L/1j/Zf90/4P/kv+i/7L/w//T/+T/9f8FABYAJwA4AEkAWQBoAHcAhgCUAKEArgC6AMUAzwDYAOAA5wDuAPMA9wD6APsA/AD8APoA+AD0AO8A6QDiANsA0gDIAL4AsgCmAJkAjAB+AG8AYABQAEAAMAAgAA8AAADw/9//z/+//6//oP+R/4P/df9o/1z/UP9G/zz/Mv8q/yP/Hf8Y/xP/EP8O/w3/Df8O/xD/FP8Y/x3/I/8r/zP/PP9G/1H/XP9o/3X/g/+R/5//rv+9/83/3P/s//z/CwAbACoAOgBJAFgAZgB0AIEAjgCaAKYAsAC6AMMAzADTANkA3wDjAOYA6QDqAOoA6gDoAOUA4QDcANcA0ADIAMAAtgCsAKEAlgCKAH0AcABiAFQARQA2ACcAGAAJAPr/6//c/83/vv+w/6L/lP+H/3v/b/9k/1n/T/9G/z7/N/8w/yv/Jv8j/yD/H/8e/x//IP8i/yb/Kv8v/zb/Pf9F/03/V/9h/2z/d/+E/5D/nf+r/7n/x//W/+T/8/8BAA8AHgAsADsASQBWAGQAcAB9AIgAkwCeAKcAsAC4AMAAxgDMANAA1ADXANkA2gDZANgA1gDTANAAywDFAL8AtwCvAKYAnACSAIcAfABwAGMAVgBJADsALQAfABEAAwD2/+j/2v/M/77/sf+k/5j/jP+A/3X/a/9i/1n/Uf9J/0P/Pf85/zX/Mv8w/y7/Lv8v/zH/M/83/zv/QP9G/03/Vf9d/2b/cP96/4X/kf+d/6n/tv/D/9D/3v/r//n/BgATACEALgA7AEgAVQBhAG0AeACCAIwAlgCfAKcArgC0ALoAvwDDAMYAyADKAMoAygDIAMYAwwC/ALsAtQCvAKgAoACXAI4AhAB6AG8AYwBYAEwAPwAyACUAGAALAP//8v/l/9j/y/++/7L/pv+b/5D/hv98/3L/av9i/1v/VP9O/0n/Rf9C/0D/Pv89/z3/Pv9A/0P/Rv9L/1D/Vv9c/2T/bP90/37/h/+S/53/qP+z/7//zP/Y/+X/8f/+/woAFgAjAC8AOwBHAFMAXgBpAHMAfQCGAI4AlgCdAKQAqgCvALMAtgC5ALsAvAC8ALsAugC3ALQAsACrAKYAoACZAJEAiQCBAHcAbQBjAFgATQBCADYAKgAeABIABgD6/+7/4v/W/8r/v/+0/6n/nv+U/4v/gv96/3L/a/9k/17/Wf9V/1H/T/9N/0v/S/9L/03/T/9R/1X/Wf9e/2T/av9x/3n/gf+K/5P/nf+n/7L/vf/I/9T/3//r//f/AgANABkAJQAwADsARgBRAFsAZQBuAHcAfwCHAI4AlACaAJ8ApACnAKoArACuAK4ArgCtAKwAqQCmAKIAngCYAJIAjACEAH0AdABrAGIAWABOAEQAOQAuACMAGAANAAEA9//r/+D/1f/K/8D/tf+r/6L/mf+Q/4j/gP95/3P/bf9o/2T/YP9d/1r/Wf9Y/1j/Wf9a/1z/X/9i/2f/bP9x/3f/fv+F/43/lv+e/6j/sf+7/8b/0P/b/+X/8P/7/wUAEAAbACYAMAA7AEUATgBYAGEAaQBxAHkAgACGAIwAkQCVAJkAnACfAKEAogCiAKIAoQCfAJwAmQCVAJEAiwCGAH8AeABxAGkAYQBYAE8ARQA8ADEAJwAdABIACAD+//T/6f/f/9X/y//B/7f/rv+l/53/lf+O/4f/gf97/3b/cf9t/2r/aP9m/2T/ZP9k/2X/Zv9p/2z/b/9z/3j/ff+D/4r/kf+Y/6D/qf+x/7r/xP/N/9f/4f/r//X///8JABMAHQAnADAAOgBDAEwAVQBdAGQAbABzAHkAfwCEAIgAjACQAJIAlACWAJYAlgCWAJUAkwCQAI0AiQCFAIAAegB0AG0AZgBfAFcATwBGAD0ANAAqACEAFwANAAQA+//x/+f/3v/U/8v/wv+5/7H/qf+h/5r/lP+N/4j/g/9+/3r/d/90/3L/cP9v/2//b/9w/3L/dP93/3v/f/+D/4n/jv+V/5v/ov+q/7L/uv/C/8v/1P/d/+f/8P/6/wIACwAVAB4AJwAwADkAQQBKAFEAWQBgAGYAbQByAHcAfACAAIMAhgCJAIoAiwCMAIwAiwCJAIcAhQCCAH4AegB1AG8AagBjAF0AVQBOAEYA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',
    win: 'data:audio/wav;base64,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',
  };
  var _sfxCtx = null, _sfxCache = {}, _sfxOff = null;
  function _unlockSfx() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { window.__dolSfxLast += '（无 AudioContext）'; return; }
      if (!_sfxCtx) _sfxCtx = new AC();
      window.__dolSfxLast += '（ctx=' + _sfxCtx.state + '）';
      if (_sfxCtx.state === 'suspended') { _sfxCtx.resume(); }
      // 播放一个极短的静音，完成解锁
      var b = _sfxCtx.createBuffer(1, 1, 22050);
      var s0 = _sfxCtx.createBufferSource();
      s0.buffer = b; s0.connect(_sfxCtx.destination); s0.start(0);
    } catch (e) {}
  }
  try {
    ['touchstart','touchend','mousedown','keydown','click'].forEach(function (ev) {
      document.addEventListener(ev, _unlockSfx, { capture: true, once: true, passive: true });
    });
  } catch (e) {}
  window.dolSfxUnlock = _unlockSfx;
  function sfxOn() {
    try {
      if (_sfxOff === null) _sfxOff = (localStorage.getItem('dolSfx') === '0');
      return !_sfxOff;
    } catch (e) { return true; }
  }
  window.dolSfxToggle = function () {
    try {
      _sfxOff = !sfxOn();
      localStorage.setItem('dolSfx', _sfxOff ? '0' : '1');
      showToast(_sfxOff ? '音效已关闭' : '音效已开启');
      try { renderLotteryPanel(); } catch (e) {}
    } catch (e) {}
  };
  window.dolSfxOn = sfxOn;
  window.dolSfx = function (name) {
    try {
      window.__dolSfxLast = name + ' @' + new Date().toLocaleTimeString();
      if (!sfxOn()) { window.__dolSfxLast += '（已关闭）'; return; }
      if (!SFX[name]) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!_sfxCtx) _sfxCtx = new AC();
      if (_sfxCtx.state === 'suspended') { try { _sfxCtx.resume(); } catch (e) {} }
      var buf = _sfxCache[name];
      if (!buf) {
        var b64 = SFX[name].split(',')[1];
        var bin = atob(b64);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        _sfxCtx.decodeAudioData(arr.buffer, function (decoded) {
          _sfxCache[name] = decoded;
          var src = _sfxCtx.createBufferSource();
          src.buffer = decoded;
          var g = _sfxCtx.createGain();
          g.gain.value = 0.35;
          src.connect(g); g.connect(_sfxCtx.destination);
          src.start(0);
        }, function () {});
        return;
      }
      var src2 = _sfxCtx.createBufferSource();
      src2.buffer = buf;
      var g2 = _sfxCtx.createGain();
      g2.gain.value = 0.35;
      src2.connect(g2); g2.connect(_sfxCtx.destination);
      src2.start(0);
    } catch (e) {}
  };
  /* ===== 地下城物品 / 材料 / 药水 / 烹饪 ===== */
  var DG_MATS = {
    fang:  { n: '兽牙',   c: '#d8c8a8' },
    hide:  { n: '粗皮',   c: '#b08a5a' },
    herb:  { n: '苦草',   c: '#7ec98a' },
    ore:   { n: '碎矿',   c: '#9aa8b8' },
    dust:  { n: '骨粉',   c: '#d8d8d8' },
    ember: { n: '余烬',   c: '#f0a030' },
    slime: { n: '黏液',   c: '#8ae0c0' }
  };
  var DG_POTIONS = {
    hp1:   { n: '小血瓶',  d: '回复 30 体力',        hp: 30 },
    hp2:   { n: '中血瓶',  d: '回复 60 体力',        hp: 60 },
    mp1:   { n: '小魔瓶',  d: '回复 40 法力',        mp: 40 },
    mp2:   { n: '中魔瓶',  d: '回复 80 法力',        mp: 80 },
    atk:   { n: '力量药剂', d: '3 回合内攻击 +25%',  buf: 'atk' },
    def:   { n: '坚壁药剂', d: '3 回合内防御 +25%',  buf: 'def' },
    agi:   { n: '迅捷药剂', d: '3 回合内闪避 +15%',  buf: 'agi' }
  };
  var DG_FOODS = {
    soup:  { n: '野菌汤',   mats: { herb: 2, slime: 1 }, hp: 40, mp: 0,  d: '回复 40 体力',           buff: null },
    steak: { n: '烤兽肉',   mats: { fang: 1, hide: 1 }, hp: 25, mp: 0,  d: '回复 25 体力，攻击 +10%（5 回合）', buff: 'atk' },
    stew:  { n: '骨汤',     mats: { dust: 2, herb: 1 }, hp: 15, mp: 40, d: '回复 15 体力、40 法力', buff: null },
    ember_tea: { n: '余烬茶', mats: { ember: 1, herb: 1 }, hp: 0, mp: 60, d: '回复 60 法力，防御 +10%（5 回合）', buff: 'def' }
  };
  function ensureDgInv(v) {
    if (!v) return null;
    if (!v.dgInv || typeof v.dgInv !== 'object') DGAC.write(function () { v.dgInv = {}; });
    return v.dgInv;
  }
  function dgAdd(item, n) {
    try {
      var v = VV(); var inv = ensureDgInv(v); if (!inv) return;
      DGAC.set(inv, item, (Number(inv[item]) || 0) + (Number(n) || 1));
      try { renderBag(); renderCatBalance(); } catch (e) {}
    } catch (e) {}
  }
  window.dolDgAdd = dgAdd;
  function dgDropMats(count) {
    try {
      var v = VV(); if (!v) return [];
      var fl = Number(v.dgFloor) || 1;
      var pool = ['fang','hide','herb','herb','ore','dust','slime'];
      if (fl >= 6) pool.push('ember');
      var got = [];
      for (var i = 0; i < count; i++) {
        var k = pool[Math.floor(Math.random() * pool.length)];
        dgAdd(k, 1);
        got.push(DG_MATS[k].n);
      }
      // 25% 概率带一瓶药
      if (Math.random() < 0.25) {
        var pk = ['hp1','mp1','hp2','atk','def','agi'][Math.floor(Math.random() * 6)];
        dgAdd('pot_' + pk, 1);
        got.push(DG_POTIONS[pk].n);
      }
      return got;
    } catch (e) { return []; }
  }
  window.dolDgDropMats = dgDropMats;

  function dgBuffPush(key, pct, turns) {
    var v = VV(); if (!v) return;
    if (!v.mpBuff || typeof v.mpBuff !== 'object') v.mpBuff = {};
    var cur = v.mpBuff[key] || { v: 0, t: 0 };
    v.mpBuff[key] = { v: Math.max(Number(cur.v) || 0, pct), t: Math.max(Number(cur.t) || 0, turns) };
  }
  window.dolDgBuff = dgBuffPush;
  function dgBuffStats() {
    var v = VV(); if (!v) return { atk: 0, def: 0, agi: 0 };
    var b = v.mpBuff || {};
    var out = { atk: 0, def: 0, agi: 0 };
    ['atk','def','agi'].forEach(function (k) {
      if (b[k] && Number(b[k].t) > 0) out[k] = Number(b[k].v) || 0;
    });
    return out;
  }
  window.dolDgBuffStats = dgBuffStats;
  function dgBuffTick() {
    try {
      var v = VV(); if (!v || !v.mpBuff) return;
      ['atk','def','agi'].forEach(function (k) {
        var b = v.mpBuff[k];
        if (b && Number(b.t) > 0) b.t = Number(b.t) - 1;
        if (b && Number(b.t) <= 0) delete v.mpBuff[k];
      });
    } catch (e) {}
  }
  window.dolDgBuffTick = dgBuffTick;

  window.dolDgUse = function (kind, id) {
    try {
      var v = VV(); if (!v) return;
      var inv = ensureDgInv(v);
      // id 可能是 pot_hp1 / food_soup，也可能只是 hp1 / soup，统一成短键
      var bare = String(id || '').replace(/^(food_|pot_)/, '');
      var isFood = (kind === 'food') || String(id || '').indexOf('food_') === 0;
      var invKey = (isFood ? 'food_' : 'pot_') + bare;
      if (!(Number(inv[invKey]) > 0)) { showToast('没有这个'); return; }
      var def = (isFood ? DG_FOODS : DG_POTIONS)[bare];
      if (!def) { showToast('这件东西用不了'); return; }
      var hpMax = (window.dolStaminaMax ? dolStaminaMax() : 100);
      var msgs = [];
      if (def.hp) { v.dgHp = Math.min(hpMax, (Number(v.dgHp) || 0) + def.hp); msgs.push('体力 +' + def.hp); }
      if (def.mp) { v.dgMana = Math.min((Number(v.dgManaMax) || 100), (Number(v.dgMana) || 0) + def.mp); msgs.push('法力 +' + def.mp); }
      if (def.buf) {
        var table = { atk: [25, 3], def: [25, 3], agi: [15, 3] };
        if (isFood) table = { atk: [10, 5], def: [10, 5], agi: [10, 5] };
        var t = table[def.buf] || [10, 3];
        dgBuffPush(def.buf, t[0], t[1]);
        msgs.push((def.buf === 'atk' ? '攻击' : def.buf === 'def' ? '防御' : '闪避') + ' +' + t[0] + '%（' + t[1] + ' 回合）');
      }
      DGAC.set(inv, invKey, Number(inv[invKey]) - 1);
      showToast((def.n || bare) + '：' + msgs.join('，'));
      try { renderBag(); } catch (e) {}
      // 战斗页：重渲染当前页面，体力/法力立即刷新
      try {
        var SC = window.SugarCube;
        var psg = SC && SC.State && SC.State.passage;
        // 只在稳定页面上重绘；随机事件/探索这类一次性页面不能重放，否则会被“跳过”
        var stable = /DoLOnlineDungeonFight|DoLOnlineDungeonBoss|DoLOnlineDungeonGate|DoLOnlineTownMap|DoLOnlineCatShop|DoLOnlineCampfire|DoLOnlineMerchant|DoLOnlineDungeonEntry/.test(psg || '');
        if (stable) {
          setTimeout(function () { try { SC.Engine.play(psg); } catch (e) {} }, 60);
        }
      } catch (e) {}
    } catch (e) {}
  };
  window.dolDgCook = function (id) {
    try {
      var v = VV(); if (!v) return;
      var inv = ensureDgInv(v);
      var r = DG_FOODS[id];
      if (!r) return;
      var lack = [];
      for (var k in r.mats) { if ((Number(inv[k]) || 0) < r.mats[k]) lack.push(DG_MATS[k].n + '×' + r.mats[k]); }
      if (lack.length) { showToast('材料不够：' + lack.join('、')); return; }
      for (var k2 in r.mats) DGAC.set(inv, k2, Number(inv[k2]) - r.mats[k2]);
      dgAdd('food_' + id, 1);
      showToast('做好了：' + r.n);
    } catch (e) {}
  };
  function renderDgBagExt() {
    try {
      var box = document.getElementById('dol-dg-items');
      if (!box) return;
      var v = VV(); if (!v) { box.innerHTML = ''; return; }
      var inv = ensureDgInv(v);
      var mats = Object.keys(DG_MATS).filter(function (k) { return (Number(inv[k]) || 0) > 0; });
      var potions = Object.keys(DG_POTIONS).filter(function (k) { return (Number(inv['pot_' + k]) || 0) > 0; });
      var foods = Object.keys(DG_FOODS).filter(function (k) { return (Number(inv['food_' + k]) || 0) > 0; });
      var h = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">';
      mats.forEach(function (k) {
        h += '<span style="font-size:11px;padding:1px 6px;border-radius:8px;background:#16181e;color:' + DG_MATS[k].c + '">' + DG_MATS[k].n + ' ×' + inv[k] + '</span>';
      });
      if (!mats.length) h += '<span style="font-size:11px;color:#666">（暂无材料）</span>';
      h += '</div>';
      potions.forEach(function (k) {
        var d = DG_POTIONS[k];
        h += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0;padding:2px 6px;background:#16181e;border-radius:5px">' +
          '<span style="flex:1">' + esc(d.n) + ' ×' + inv['pot_' + k] + '<span style="font-size:10px;color:#8a8a8a"> · ' + esc(d.d) + '</span></span>' +
          '<a href="#" data-dguse="pot_' + k + '" style="color:#7ec98a">使用</a></div>';
      });
      foods.forEach(function (k) {
        var d = DG_FOODS[k];
        h += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0;padding:2px 6px;background:#16181e;border-radius:5px">' +
          '<span style="flex:1">' + esc(d.n) + ' ×' + inv['food_' + k] + '<span style="font-size:10px;color:#8a8a8a"> · ' + esc(d.d) + '</span></span>' +
          '<a href="#" data-dguse="food_' + k + '" style="color:#7ec98a">食用</a></div>';
      });
      box.innerHTML = h;
      box.querySelectorAll('[data-dguse]').forEach(function (a) {
        a.onclick = function (ev) {
          ev.preventDefault();
          var id = a.getAttribute('data-dguse');
          var kind = id.indexOf('food_') === 0 ? 'food' : 'potion';
          var key = id.replace(/^(food_|pot_)/, '');
          window.dolDgUse(kind, key === id ? id : (kind === 'food' ? 'food_' + key : 'pot_' + key));
        };
      });
    } catch (e) {}
  }
  window.dolDgRenderItems = renderDgBagExt;

  function lotteryItem(slot, tier) {
    var pool = BAG_POOL[slot] || [];
    var it = pickItemByTier(pool, tier) || { n: '碎片', atk: 0, def: 0, hp: 0 };
    var rar = RARITY[tier] || RARITY[0];
    var afx = rollAffixes(tier);
    var dur = rollDurability(tier);
    var v = VV();
    return {
      slot: slot, n: it.n, atk: it.atk, def: it.def, hp: it.hp, sp: it.sp || 0,
      rarity: rar.k, affixes: afx, dur: dur.dur, maxDur: dur.maxDur, tough: dur.tough,
      set: (v && typeof rollItemSet === 'function' ? rollItemSet(v, tier) : null)
    };
  }
  window.dolMerchantRoll = function () {
    try {
      var v = VV(); if (!v) return;
      if (v.dgGoodsFloor === (Number(v.dgFloor) || 1) && Array.isArray(v.dgGoods) && v.dgGoods.length) return;
      var stock = window.dolMerchantStock ? window.dolMerchantStock() : [];
      v.dgGoods = stock.map(function (x) { return { n: x.it.n, price: x.price, it: x.it, rarity: x.rarity }; });
      v.dgGoodsFloor = Number(v.dgFloor) || 1;
    } catch (e) {}
  };
  window.dolMerchantBuy = function (idx) {
    try {
      var v = VV(); if (!v) return;
      var s = v.dgGoods;
      var g = Array.isArray(s) ? s[Number(idx)] : null;
      if (!g) { showToast('这件已经卖出去了'); return; }
      if ((Number(v.mpCat) || 0) < g.price) { showToast('猫猫币不够'); return; }
      v.mpCat = (Number(v.mpCat) || 0) - g.price;
      if (!Array.isArray(v.mpBag)) v.mpBag = [];
      v.mpBag.push(ensureUid(g.it));
      v.dgGoods.splice(Number(idx), 1);
      try { renderCatBalance(); renderBag(); } catch (e) {}
      showToast('买到：' + g.it.n);
    } catch (e) {}
  };
  window.dolMerchantStock = function () {
    try {
      var v = VV(); if (!v) return [];
      var fl = Number(v.dgFloor) || 1;
      var base = Math.min(4, Math.max(0, Math.floor(fl / 4)));
      var stock = [];
      var slots = ['weapon','offhand','helmet','chest','legs','gloves','boots','neck'];
      for (var i = 0; i < 3; i++) {
        var tier = Math.max(0, Math.min(5, base + (Math.random() < 0.3 ? 1 : 0)));
        var slot = slots[Math.floor(Math.random() * slots.length)];
        var obj = lotteryItem(slot, tier);
        var price = Math.round((60 + tier * 90) * (0.85 + Math.random() * 0.3)) - Math.round(fl * 2);
        stock.push({ it: obj, price: Math.max(25, price), rarity: tier });
      }
      return stock;
    } catch (e) { return []; }
  };
  window.dolGrantEquip = function (slot, tier) {
    try {
      var v = VV(); if (!v) return;
      slot = slot || 'weapon';
      var pool = (typeof BAG_POOL !== 'undefined' && BAG_POOL[slot]) || [];
      if (!pool.length) { showToast('没有该部位的装备'); return; }
      var it = pickItemByTier(pool, (typeof tier === 'number' && tier >= 0) ? tier : undefined);
      var rar = RARITY[it.tier || 0] || RARITY[0];
      var afx = rollAffixes(it.tier || 0);
      var dur = rollDurability(it.tier || 0);
      if (!Array.isArray(v.mpBag)) v.mpBag = [];
      var _obj = {
        slot: slot, n: it.n, atk: it.atk, def: it.def, hp: it.hp, sp: it.sp || 0,
        rarity: rar.k, affixes: afx, dur: dur.dur, maxDur: dur.maxDur, tough: dur.tough,
        set: (typeof rollItemSet === 'function' ? rollItemSet(v, it.tier || 0) : null)
      };
      tuneGearForClass(_obj, it.tier || 0);
      v.mpBag.push(ensureUid(_obj));
      showToast('获得装备：[' + rar.n + '] ' + it.n + (afx.length ? '（' + afx.map(function (a) { return a.n; }).join('/') + '）' : ''));
      try { if (typeof showPillar === 'function' && it.tier >= 4) showPillar({ n: it.n }, rar); } catch (e) {}
      try { announceItem(it, rar); } catch (e) {}
      try { window.dolCodexEquip(it.n); } catch (e) {}
      try { renderBag(); renderEquip(); } catch (e) {}
    } catch (e) {
      try { showToast('发放失败：' + (e && e.message ? e.message : '未知')); } catch (_) {}
    }
  };
  window.dolDropItem = function () {
    try {
      var v = VV(); if (!v) return null;
      var _sk = v.mpSkill || {};
      var _bonus = (Number(_sk.loot) || 0) * 3;
      if (_bonus > 0 && Math.random() * 100 < _bonus) {
        try { window.dolGrantEquip && dolGrantEquip(); } catch (e) {}
      }
      var slot = rollSlotWeighted();
      var pool = BAG_POOL[slot];
      var it = pickItemByTier(pool, undefined);
      var rar = RARITY[it.tier || 0];
      var durs = rollDurability(it.tier || 0);
      var item = { slot: slot, n: it.n, atk: it.atk, def: it.def, hp: it.hp, sp: it.sp || 0, rarity: rar.k,
                   affixes: rollAffixes(it.tier || 0), dur: durs.dur, maxDur: durs.maxDur, tough: durs.tough,
                   set: (typeof rollItemSet === 'function' ? rollItemSet(v, it.tier || 0) : null) };
      tuneGearForClass(item, it.tier || 0);
      bag().push(item);
      try { window.dolCodexEquip(item.n); } catch (e) {}
      try { if (rarityRank(rar.k) >= 4) showPillar(item, rar); } catch (e) {}
      try { announceItem(item, rar); } catch (e) {}
      try {
        if (rarityRank(rar.k) >= 4) unlockAch('firstLegend');
        if (item.affixes.some(function (a) { return a.k === 'divine'; })) unlockAch('affixDivine');
      } catch (e) {}
      showToast(' 掉落：' + it.n + (item.affixes.length ? '（' + item.affixes.map(function (a) { return a.n; }).join('/') + '）' : ''));
      return item;
    } catch (e) { return null; }
  };
  var RARITY = [
    { k: 'common', n: '普通', c: '#a8a8a8', glow: 'none', anim: '' },
    { k: 'fine',   n: '精良', c: '#5ae06a', glow: '0 0 6px rgba(90,224,106,.7)', anim: '' },
    { k: 'rare',   n: '稀有', c: '#4ac8f0', glow: '0 0 8px rgba(74,200,240,.8)', anim: '' },
    { k: 'epic',   n: '史诗', c: '#c060f0', glow: '0 0 10px rgba(192,96,240,.85)', anim: '' },
    { k: 'legend', n: '传说', c: '#f0a030', glow: '0 0 12px rgba(240,160,48,.9)', anim: 'dolLegendPulse 2.5s ease-in-out infinite' },
    { k: 'myth',   n: '神话', c: '#f04040', glow: '0 0 12px rgba(240,64,64,.95),0 0 22px rgba(240,64,64,.5)', anim: 'dolLegendPulse 1.6s ease-in-out infinite' },
    { k: 'divine', n: '神圣', c: '#ffffff', glow: '0 0 10px rgba(255,255,255,.9)', anim: 'dolDivineShift 3s linear infinite' }
  ];
  var SET_BONUS = {
    common: { name: '布', 3: { atk: 0, def: 1, hp: 12 }, 5: { atk: 1, def: 2, hp: 30 }, 7: { atk: 2, def: 4, hp: 45 } },
    fine: { name: '皮', 3: { atk: 0, def: 4, hp: 6 }, 5: { atk: 0, def: 8, hp: 14 }, 7: { atk: 1, def: 12, hp: 20 } },
    rare: { name: '锁', 3: { atk: 2, def: 2, hp: 10 }, 5: { atk: 4, def: 4, hp: 22 }, 7: { atk: 7, def: 7, hp: 33 } },
    epic: { name: '板', 3: { atk: 0, def: 6, hp: 12 }, 5: { atk: 1, def: 12, hp: 26 }, 7: { atk: 2, def: 18, hp: 40 } },
    legend: { name: '龙', 3: { atk: 9, def: 1, hp: 6 }, 5: { atk: 18, def: 3, hp: 14 }, 7: { atk: 28, def: 5, hp: 22 } },
    myth: { name: '秘银', 3: { atk: 6, def: 6, hp: 18 }, 5: { atk: 12, def: 12, hp: 38 }, 7: { atk: 18, def: 18, hp: 56 } },
    divine: { name: '星辰', 3: { atk: 12, def: 12, hp: 55 }, 5: { atk: 24, def: 24, hp: 110 }, 7: { atk: 36, def: 36, hp: 160 } }
  };
  function setBonusOf(v) {
    try {
      var eq = (v && v.mpEquip) || {};
      var counts = {};
      ['helmet','chest','legs','gloves','boots','weapon','offhand','neck'].forEach(function (k) {
        var it = eq[k];
        if (!it) return;
        var r = it.rarity || rarityByName(it.slot || k, it.n).k;
        counts[r] = (counts[r] || 0) + 1;
      });
      var out = { atk: 0, def: 0, hp: 0, sets: [] };
      Object.keys(counts).forEach(function (k) {
        var n = counts[k];
        var b = SET_BONUS[k]; if (!b) return;
        var tierName = (SET_BONUS[k] && SET_BONUS[k].name) || (RARITY.filter(function (x) { return x.k === k; })[0] || {}).n || k;
        if (n >= 7 && b[7]) { out.atk += b[7].atk; out.def += b[7].def; out.hp += b[7].hp; out.sets.push(tierName + '套装(7件)'); }
        else if (n >= 5) { out.atk += b[5].atk; out.def += b[5].def; out.hp += b[5].hp; out.sets.push(tierName + '套装(5件)'); }
        else if (n >= 3) { out.atk += b[3].atk; out.def += b[3].def; out.hp += b[3].hp; out.sets.push(tierName + '套装(3件)'); }
      });
      return out;
    } catch (e) { return { atk: 0, def: 0, hp: 0, sets: [] }; }
  }
  var AFFIXES = {
    common: [ {n:'微光',atk:1}, {n:'坚壁',def:1}, {n:'丰盈',hp:8} ],
    fine:   [ {n:'锋利',atk:3}, {n:'厚重',def:3}, {n:'强健',hp:20} ],
    rare:   [ {n:'咒印',atk:4,sp:6}, {n:'铁壁',def:6}, {n:'迅捷',dodge:4}, {n:'破甲',pen:6} ],
    epic:   [ {n:'秘能',atk:6,sp:12,crit:4}, {n:'护佑',def:10,block:5}, {n:'血饮',lifesteal:6}, {n:'碎盾',pen:10} ],
    legend: [ {n:'奥术',atk:8,sp:20,crit:6}, {n:'不动',def:16,block:8}, {n:'嗜血',lifesteal:10,atk:4}, {n:'裂甲',pen:14} ],
    myth:   [ {n:'星界',atk:14,sp:32,crit:10}, {n:'圣盾',def:24,block:12}, {n:'血皇',lifesteal:14,hp:60}, {n:'贯甲',pen:18} ],
    divine: [ {n:'虚空',atk:18,sp:48,crit:14,hp:60}, {n:'永恒',def:34,block:16,hp:80}, {n:'轮回',lifesteal:20,atk:10,def:10,hp:100}, {n:'无蔽',pen:24} ]
  };
  function rollDurability(tier) {
    var maxDur = 60 + tier * 15 + randomInt(0, 30);
    var dur = Math.max(5, maxDur - randomInt(0, Math.floor(maxDur * 0.5)));
    var tough = randomInt(1, 3 + Math.floor(tier / 2));
    return { dur: dur, maxDur: maxDur, tough: tough };
  }
  var ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'gloves', 'boots', 'offhand'];
  function wearOne(k) {
    try {
      var v = VV(); if (!v || !v.mpEquip) return;
      var it = v.mpEquip[k]; if (!it) return;
      if (it.dur == null) it.dur = it.maxDur || 100;
      it.dur = Math.max(0, (it.dur || 0) - 1);
      if (it.dur <= 0) {
        v.mpEquip[k] = null;
        showToast(' 装备损坏已卸下：' + it.n);
        try { renderEquip(); renderBag(); } catch (e) {}
      }
    } catch (e) {}
  }
  window.dolWearArmor = function (times) {
    times = times || 1;
    for (var t = 0; t < times; t++) {
      ARMOR_SLOTS.forEach(function (k) { if (Math.random() < 0.6) wearOne(k); });
    }
  };
  window.dolWearWeapon = function () {
    if (Math.random() < 0.5) wearOne('weapon');
  };

  function rollAffixRarity(baseTier) {
    var r = Math.random() * 100, d;
    if (r < 55) d = 0;
    else if (r < 77) d = 1;
    else if (r < 89) d = 2;
    else if (r < 96) d = 3;
    else if (r < 98.8) d = 4;
    else d = 5;
    var t = Math.max(0, Math.min(6, baseTier + d));
    if (Math.random() < 0.04) t = 4 + Math.floor(Math.random() * 3);
    return t;
  }
  function rollAffixes(baseTier) {
    var r = Math.random() * 100;
    if (r < 55) return [];
    var cnt = 1;
    if (r >= 80) cnt = 2;
    if (r >= 95) cnt = 3;
    var out = [], used = {};
    for (var i = 0; i < cnt; i++) {
      var t = rollAffixRarity(baseTier);
      var key = (RARITY[t] || RARITY[0]).k;
      var arr = AFFIXES[key] || AFFIXES.common;
      var pick = arr[Math.floor(Math.random() * arr.length)];
      if (used[key + pick.n]) { i--; if (out.length + 3 < cnt) break; continue; }
      used[key + pick.n] = 1;
      out.push({ k: key, n: pick.n, atk: pick.atk||0, def: pick.def||0, hp: pick.hp||0,
                 crit: pick.crit||0, lifesteal: pick.lifesteal||0, dodge: pick.dodge||0, block: pick.block||0 });
    }
    return out;
  }
  function affixStatsOf(v) {
    var o = { atk: 0, def: 0, hp: 0, crit: 0, lifesteal: 0, dodge: 0, block: 0, sp: 0, pen: 0 };
    try {
      var eq = (v && v.mpEquip) || {};
      ['helmet','chest','legs','gloves','boots','weapon','offhand','neck'].forEach(function (k) {
        var it = eq[k]; if (!it || !Array.isArray(it.affixes)) return;
        it.affixes.forEach(function (a) {
          o.atk += a.atk||0; o.def += a.def||0; o.hp += a.hp||0;
          o.crit += a.crit||0; o.lifesteal += a.lifesteal||0; o.dodge += a.dodge||0; o.block += a.block||0; o.sp += a.sp||0; o.pen += a.pen||0;
        });
      });
    } catch (e) {}
    try {
      var _sb = (typeof setStatOf === 'function') ? setStatOf(v) : null;
      if (_sb) {
        o.crit += _sb.crit || 0; o.dodge += _sb.dodge || 0; o.block += _sb.block || 0;
        o.hp += _sb.hp || 0; o.sp += _sb.sp || 0; o.pen += _sb.pen || 0;
      }
      var _cf = (typeof classDef === 'function') ? classDef() : null;
      if (_cf) { o.crit += _cf.crit || 0; o.dodge += _cf.dodge || 0; }
    } catch (e) {}
    o.block = Math.min(60, o.block);
    o.pen = Math.min(80, o.pen);
    try {
      var sk = (v && v.mpSkill) || {};
      o.crit += (Number(sk.crit) || 0) * 2;
      o.lifesteal += (Number(sk.lifesteal) || 0) * 2;
    } catch (e) {}
    return o;
  }
  function affixHtml(it) {
    if (!it || !Array.isArray(it.affixes) || !it.affixes.length) return '';
    return it.affixes.map(function (a) {
      var r = RARITY.filter(function (x) { return x.k === a.k; })[0] || RARITY[0];
      return '<span style="font-size:10px;' + rarityStyle(r) + '">' + esc(a.n) + '</span>';
    }).join(' ');
  }
  function affixPlain(it) {
    if (!it || !Array.isArray(it.affixes) || !it.affixes.length) return '';
    return it.affixes.map(function (a) { return a.n; }).join('/');
  }
  function rarityStyle(r) {
    if (!r) r = RARITY[0];
    return 'color:' + r.c + ';text-shadow:' + r.glow + ';' + (r.anim ? 'animation:' + r.anim + ';' : '');
  }
  function rarityOf(idx, len) {
    if (len <= 0) return RARITY[0];
    var t = idx / (len - 1 || 1);
    if (t < 0.08) return RARITY[0];
    if (t < 0.25) return RARITY[1];
    if (t < 0.45) return RARITY[2];
    if (t < 0.63) return RARITY[3];
    if (t < 0.79) return RARITY[4];
    if (t < 0.92) return RARITY[5];
    return RARITY[6];
  }
  function rarityByName(slot, name) {
    try {
      var pool = (typeof BAG_POOL !== 'undefined' && BAG_POOL[slot]) || [];
      for (var i = 0; i < pool.length; i++) if (pool[i].n === name) return RARITY[pool[i].tier || 0];
    } catch (e) {}
    return RARITY[0];
  }
  var SLOT_LABEL = { helmet:'头盔', chest:'衣服', boots:'鞋子', weapon:'武器', offhand:'副手' };
  var SLOT_ORDER = { helmet: 0, chest: 1, legs: 2, gloves: 3, boots: 4, weapon: 5, offhand: 6, neck: 7 };
  function tierOfItem(it) {
    try {
      if (it.rarity) return rarityRank(it.rarity);
      var pool = (typeof BAG_POOL !== 'undefined' && BAG_POOL[it.slot]) || [];
      for (var i = 0; i < pool.length; i++) if (pool[i].n === it.n) return pool[i].tier || 0;
    } catch (e) {}
    return 0;
  }
  function sortItems(list) {
    return list.slice().sort(function (a, b) {
      var t = tierOfItem(b) - tierOfItem(a);
      if (t) return t;
      var sa = (SLOT_ORDER[a.slot] != null ? SLOT_ORDER[a.slot] : 99) - (SLOT_ORDER[b.slot] != null ? SLOT_ORDER[b.slot] : 99);
      if (sa) return sa;
      return String(a.n) < String(b.n) ? -1 : (String(a.n) > String(b.n) ? 1 : 0);
    });
  }
  function equipFromBag(idx) {
    try {
      var v = VV(); if (!v) return;
      var all = sortItems(bag());
      var it = all[idx]; if (!it) return;
      if (!v.mpEquip) v.mpEquip = {};
      var arr = bag();
      var real = arr.indexOf(it);
      if (real < 0) return;
      var slot = it.slot;
      var old = v.mpEquip[slot];
      arr.splice(real, 1);
      v.mpEquip[slot] = it;
      if (old) arr.push(old);
      try { renderBag(); renderEquip(); showToast('已装备 ' + it.n); } catch (e) {}
    } catch (e) {}
  }
  var bagSlot = 'all';
  var bagSortMode = 'tier';   // tier | rank | set
  var bagOnlySet = false;
  function renderBag() {
    try { var _ds = document.getElementById('dol-dg-items-sec'); if (_ds) { _ds.style.display = 'block'; } } catch (e) {}
    try { window.dolDgRenderItems && window.dolDgRenderItems(); } catch (e) {}
    var sec = document.getElementById('dol-bag-sec');
    var box = document.getElementById('dol-bag');
    if (!sec || !box) return;
    sec.style.display = 'block';
    var v = VV(); if (!v) return;
    var all0 = bag().slice();
    if (bagOnlySet) all0 = all0.filter(function (x) { return !!x.set; });
    if (bagSortMode === 'set') {
      all0.sort(function (a, b) {
        var sa = (a.set ? 0 : 1) - (b.set ? 0 : 1);
        if (sa) return sa;
        return tierOfItem(b) - tierOfItem(a);
      });
    } else if (bagSortMode === 'rank') {
      all0.sort(function (a, b) {
        var ra = [{common:0,fine:1,rare:2,epic:3,legend:4,myth:5,divine:6}][0][a.rarity] ;
        var rb = [{common:0,fine:1,rare:2,epic:3,legend:4,myth:5,divine:6}][0][b.rarity] ;
        ra = (ra == null ? 0 : ra); rb = (rb == null ? 0 : rb);
        if (rb !== ra) return rb - ra;
        return tierOfItem(b) - tierOfItem(a);
      });
    } else {
      all0 = sortItems(all0);
    }
    var all = all0;
    var slots = ['all','weapon','offhand','helmet','chest','legs','gloves','boots','neck'];
    var tabHtml = '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px">' + slots.map(function (k) {
      var n = k === 'all' ? all.length : all.filter(function (x) { return x.slot === k; }).length;
      var on = (bagSlot === k);
      return '<button data-bagtab="' + k + '" style="padding:3px 7px;font-size:11px;border-radius:6px;' +
        (on ? 'background:rgba(232,201,122,.22);border:1px solid rgba(232,201,122,.6);color:#f0d060'
            : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">' +
        (k === 'all' ? '全部' : (SLOT_LABEL[k] || k)) + ' ' + n + '</button>';
    }).join('') + '</div>';
    var sortBar = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:0 0 5px">' +
      [['tier','默认'],['rank','稀有度'],['set','套装优先']].map(function (t) {
        var on = (bagSortMode === t[0]);
        return '<button data-bagsort="' + t[0] + '" style="padding:2px 8px;font-size:11px;border-radius:6px;' +
          (on ? 'background:rgba(154,199,255,.18);border:1px solid rgba(154,199,255,.5);color:#9ac7ff'
              : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">' + t[1] + '</button>';
      }).join('') +
      '<button data-bagset="1" style="padding:2px 8px;font-size:11px;border-radius:6px;' +
      (bagOnlySet ? 'background:rgba(126,201,138,.18);border:1px solid rgba(126,201,138,.5);color:#7ec98a'
                  : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">只看套装</button>' +
      '<span style="font-size:10px;color:#6a6a72;align-self:center">共 ' + all.length + ' 件</span></div>';
    var list = (bagSlot === 'all') ? all : all.filter(function (x) { return x.slot === bagSlot; });
    if (!all.length) { box.innerHTML = tabHtml + sortBar + '<span style="color:#888">（空）</span>'; return; }
    if (!list.length) { box.innerHTML = tabHtml + sortBar + '<span style="color:#888">（这一页没有装备）</span>'; }
    var html = tabHtml + sortBar;
    list.forEach(function (it) {
      var idx = all.indexOf(it);
      var eq = v.mpEquip && v.mpEquip[it.slot];
      var isOn = eq && eq.n === it.n;
      var rr = it.rarity ? (RARITY.filter(function(r){return r.k===it.rarity;})[0]||RARITY[0]) : rarityByName(it.slot, it.n);
      html += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 6px;background:' +
        (isOn ? '#1a2a1a' : '#16181e') + ';border-radius:5px;font-size:12px">' +
        '<span style="flex:1;' + rarityStyle(rr) + '">' + esc(it.n) +
        (it.set && CLASS_SETS[it.set] ? '<span style="font-size:10px;color:' + CLASS_SETS[it.set].c + '"> ·' + CLASS_SETS[it.set].n + '</span>' : '') +
        '</span>' +
        (affixHtml(it) ? '<span>' + affixHtml(it) + '</span>' : '') +
        '<span style="font-size:10px;color:' + rr.c + '">' + rr.n + '</span>' +
        (it.dur != null ? '<span style="font-size:10px;color:' + (it.dur <= 0 ? '#e25a5a' : '#8a9a8a') + '">耐' + it.dur + '</span>' : '') +
        '<span style="color:#e25a5a">攻+' + it.atk + '</span>' +
        '<span style="color:#5a9ae2">防+' + it.def + '</span>' +
        '<span style="color:#7ec98a">血+' + it.hp + '</span>' +
        (it.sp ? '<span style="color:#c060f0">法+' + it.sp + '</span>' : '') +
        '<a href="#" data-bag="' + idx + '" style="color:' + (isOn ? '#e8c97a' : '#7ec98a') + '">' + (isOn ? '已装备' : '装备') + '</a>' +
        '<a href="#" data-dismantle="' + idx + '" style="color:#e8a33b">拆解</a>' +
        '<a href="#" data-gift="' + idx + '" style="color:#9ac7ff">送出</a></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-bagsort]').forEach(function (b) {
      b.onclick = function () { bagSortMode = b.getAttribute('data-bagsort'); renderBag(); };
    });
    var setBtn = box.querySelector('[data-bagset]');
    if (setBtn) setBtn.onclick = function () { bagOnlySet = !bagOnlySet; renderBag(); };
    box.querySelectorAll('[data-bagtab]').forEach(function (b) {
      b.onclick = function (ev) { ev.preventDefault(); bagSlot = b.getAttribute('data-bagtab'); renderBag(); };
    });
    box.querySelectorAll('[data-bag]').forEach(function (a) {
      a.onclick = function (ev) { ev.preventDefault(); equipFromBag(Number(a.getAttribute('data-bag'))); };
    });
    box.querySelectorAll('[data-dismantle]').forEach(function (a) {
      a.onclick = function (ev) { ev.preventDefault(); dismantleItem(Number(a.getAttribute('data-dismantle'))); };
    });
    box.querySelectorAll('[data-gift]').forEach(function (a) {
      a.onclick = function (ev) {
        ev.preventDefault();
        var gi = Number(a.getAttribute('data-gift'));
        var gitem = all[gi];
        if (!gitem) return;
        var to = prompt('送给谁？输入玩家名');
        if (!to) return;
        try { ws.send(JSON.stringify({ type: 'item_offer', to: to, item: gitem })); showToast('已向 ' + to + ' 发送赠予请求'); } catch (e) {}
      };
    });
  }

  function renderMonster() {
    var sec = document.getElementById('dol-monster-sec');
    var box = document.getElementById('dol-monster');
    if (!sec || !box) return;
    var v = VV(); if (!v) return;
    var name = v.dgEnemyName || '';
    var show = inDungeon() && name;
    sec.style.display = show ? 'block' : 'none';
    if (!show) return;
    if (name === _lastMonster && box.childNodes.length) return;
    _lastMonster = name;
    box.innerHTML = '<span style="color:#8a8a8a">' + esc(name) + '</span>';
    if (window.dolNpcImage) {
      window.dolNpcImage(name, function (src) {
        if (!src) return;
        var b = document.getElementById('dol-monster');
        if (!b) return;
        b.innerHTML = '<img src="' + src + '" style="max-width:100%;max-height:180px;border-radius:8px"><br>' +
          '<span style="color:#8a8a8a;font-size:12px">' + esc(name) + '</span>';
      });
    }
  }

  function renderNpcModelImage(boxId, name) {
    var box = document.getElementById(boxId);
    if (!box) return false;
    var cached = window.dolNpcImageSync ? window.dolNpcImageSync(name) : null;
    if (cached) {
      box.innerHTML = '<div style="text-align:center;padding:6px 0">' +
        '<img src="' + cached + '" style="max-width:100%;max-height:220px;border-radius:8px">' +
        '<div style="font-size:11px;color:#8a8a8a;margin-top:4px">' + esc(name) + '</div></div>';
      return true;
    }
    if (window.dolNpcImage) {
      window.dolNpcImage(name, function (src) {
        if (!src) return;
        var b = document.getElementById(boxId);
        if (!b) return;
        b.innerHTML = '<div style="text-align:center;padding:6px 0">' +
          '<img src="' + src + '" style="max-width:100%;max-height:220px;border-radius:8px">' +
          '<div style="font-size:11px;color:#8a8a8a;margin-top:4px">' + esc(name) + '</div></div>';
      });
    }
    return false;
  }


  /* ===== 成就系统 ===== */
  var ACHS = [
    { id: 'firstOnline', name: '这个游戏还能联机强强', desc: '第一次成功联机', icon: '' },
    { id: 'firstFriend', name: '交到第一个朋友', desc: '添加一个好友', icon: '' },
    { id: 'firstCp', name: '你不是一个人', desc: '结为第一个CP', icon: '' },
    { id: 'firstFight', name: '初次交锋', desc: '第一次和玩家对战', icon: '' },
    { id: 'dungeon5', name: '地下城探险家', desc: '到达地下城第 5 层', icon: '' },
    { id: 'dungeonBoss', name: '地下城之主', desc: '击败地下城 Boss', icon: '' },
    { id: 'lv10', name: '练家子', desc: '达到 Lv.10', icon: '' },
    { id: 'firstLegend', name: '金光闪闪', desc: '获得一件传说及以上装备', icon: '' },
    { id: 'affixDivine', name: '神之词条', desc: '获得一条神圣级附魔', icon: '' },
    { id: 'set5', name: '套装成型', desc: '激活 5 件以上套装效果', icon: '' },
    { id: 'floor10', name: '深渊行者', desc: '到达地下城第 10 层', icon: '' }
  ];
  function unlockedAchs() {
    try { var v = VV(); if (!v) return {}; if (!v.mpAch || typeof v.mpAch !== 'object') v.mpAch = {}; return v.mpAch; } catch (e) { return {}; }
  }
  function unlockAch(id) {
    try {
      var key = 'dolAch_' + id;
      try { if (localStorage.getItem(key)) return false; } catch (e) {}
      var a = unlockedAchs();
      if (a[id]) return false;
      a[id] = Date.now();
      try { localStorage.setItem(key, '1'); } catch (e) {}
      var def = null;
      ACHS.forEach(function (x) { if (x.id === id) def = x; });
      if (def) {
        showToast(' 成就解锁：' + def.name);
      }
      renderAchs();
      return true;
    } catch (e) { return false; }
  }
  function renderAchs() {
    var box = document.getElementById('dol-achs');
    if (!box) return;
    var a = unlockedAchs();
    var got = 0;
    var html = '';
    ACHS.forEach(function (x) {
      var on = !!a[x.id];
      if (on) got++;
      html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #222;font-size:12px">' +
        '<span style="font-size:16px;filter:' + (on ? 'none' : 'grayscale(1);opacity:.4') + '">' + x.icon + '</span>' +
        '<div style="flex:1"><div style="color:' + (on ? '#e8c97a' : '#666') + '">' + x.name + '</div>' +
        '<div style="color:#555;font-size:10px">' + x.desc + '</div></div>' +
        (on ? '<span style="color:#7ec98a"></span>' : '') + '</div>';
    });
    box.innerHTML = html;
    var cnt = document.getElementById('dol-ach-count');
    if (cnt) cnt.textContent = got + '/' + ACHS.length;
  }
  window.dolUnlockAch = unlockAch;


  /* ===== 地下城自由探索（网格地图） ===== */
  var DG_W = 9, DG_H = 9;
  function dgGen(floor) {
    var map = [];
    for (var y = 0; y < DG_H; y++) {
      var row = [];
      for (var x = 0; x < DG_W; x++) {
        if (x === 0 || y === 0 || x === DG_W - 1 || y === DG_H - 1) { row.push('#'); continue; }
        var r = Math.random();
        if (r < 0.18) row.push('#');
        else if (r < 0.40) row.push('M');   // 怪物
        else if (r < 0.50) row.push('C');   // 宝箱
        else if (r < 0.56) row.push('+');   // 篝火
        else if (r < 0.63) row.push('T');   // 陷阱
        else if (r < 0.66) row.push('A');   // 祭坛
        else row.push('.');
      }
      map.push(row);
    }
    map[DG_H - 2][1] = 'S';
    var ex = DG_W - 2, ey = 1;
    map[ey][ex] = ((floor % 5) === 0) ? 'B' : 'L';
    // 起点周围清空
    [[1, DG_H - 2], [2, DG_H - 2], [1, DG_H - 3], [2, DG_H - 3]].forEach(function (c) {
      if (c[0] > 0 && c[1] > 0 && c[0] < DG_W - 1 && c[1] < DG_H - 1) map[c[1]][c[0]] = '.';
    });
    // 保证起点到出口有一条通路（L 形开挖）
    for (var cx = 1; cx <= ex; cx++) if (map[DG_H - 2][cx] === '#') map[DG_H - 2][cx] = '.';
    for (var cy = DG_H - 2; cy >= ey; cy--) if (map[cy][ex] === '#') map[cy][ex] = '.';
    return { map: map, px: 1, py: DG_H - 2, floor: floor, seen: {}, boss: ((floor % 5) === 0) };
  }
  function dgEnsure() {
    var v = VV(); if (!v) return null;
    if (!v.dgMap || !v.dgMap.map) { v.dgMap = dgGen(1); dgReveal(v.dgMap); }
    return v.dgMap;
  }
  function dgCell(m, x, y) { return (m.map[y] && m.map[y][x]) || '#'; }
  function dgReveal(m) {
    try {
      if (!m.seen) m.seen = {};
      for (var dy = -3; dy <= 3; dy++) {
        for (var dx = -3; dx <= 3; dx++) {
          var x = m.px + dx, y = m.py + dy;
          if (x < 0 || y < 0 || x >= DG_W || y >= DG_H) continue;
          if (Math.abs(dx) + Math.abs(dy) > 4) continue;
          m.seen[x + ',' + y] = true;
        }
      }
    } catch (e) {}
  }

  /* ============ 材料 / 拆解 / 采集 / 每日委托 / 铁匠强化 ============ */

  /* ============ 宠物 / 状态 ============ */
  function renderPet() {
    var box = document.getElementById('dol-pet');
    if (!box) return;
    var v = VV(); if (!v) return;
    var p = v.mpPet;
    if (!p) {
      var cost = 200;
      box.innerHTML = '<div style="font-size:12px;color:#8a8a8a">还没有伙伴（200 猫猫币领养一只，属性 +5 攻 / +3 防）</div>' +
        '<button id="dol-pet-buy" style="width:100%;margin-top:4px;padding:5px;font-size:12px">领养 · 200 猫猫币</button>';
      var b = document.getElementById('dol-pet-buy');
      if (b) b.onclick = function () {
        if ((Number(v.mpCat) || 0) < cost) { showToast('猫猫币不够'); return; }
        v.mpCat -= cost;
        v.mpPet = { name: '小灰', lv: 1, exp: 0 };
        showToast('领养了 小灰');
        renderCatBalance(); renderPet();
      };
      return;
    }
    var lv = Number(p.lv) || 1, exp = Number(p.exp) || 0;
    box.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:13px">' +
      '<span style="color:#e8c97a">' + esc(p.name) + ' <span style="font-size:11px;color:#7ec98a">Lv.' + lv + '</span></span>' +
      '<span style="font-size:11px;color:#8a8a8a">攻+' + (5 + lv * 2) + ' 防+' + (3 + lv) + '</span></div>' +
      '<div style="height:4px;background:#1a1a22;border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + Math.min(100, exp) + '%;background:linear-gradient(90deg,#7ec98a,#3a8a4a)"></div></div>' +
      '<button id="dol-pet-feed" style="width:100%;margin-top:5px;padding:5px;font-size:12px">喂 1 条鱼（经验 +20）</button>';
    var f = document.getElementById('dol-pet-feed');
    if (f) f.onclick = function () {
      var m = mats();
      if ((Number(m.fish) || 0) < 1) { showToast('没有鱼，去钓鱼吧'); return; }
      m.fish -= 1; p.exp = (Number(p.exp) || 0) + 20;
      if (p.exp >= 100) { p.exp -= 100; p.lv = lv + 1; showToast(esc(p.name) + ' 升到 Lv.' + p.lv); }
      renderPet();
      var ml = document.getElementById('dol-mat-line'); if (ml) ml.textContent = matLine();
    };
  }
  function petBonus() {
    try {
      var v = VV(); var p = v && v.mpPet; if (!p) return { atk: 0, def: 0 };
      var lv = Number(p.lv) || 1;
      return { atk: 5 + lv * 2, def: 3 + lv };
    } catch (e) { return { atk: 0, def: 0 }; }
  }
  function renderStatusLine() {
    var box = document.getElementById('dol-status-line');
    if (!box) return;
    var v = VV(); if (!v) return;
    var chips = [];
    if ((Number(v.dgBurn) || 0) > 0) chips.push(['灼烧 ' + v.dgBurn, '#ff6a4a']);
    if ((Number(v.dgPoison) || 0) > 0) chips.push(['中毒 ' + v.dgPoison, '#8ae06a']);
    if ((Number(v.dgFrozen) || 0) > 0) chips.push(['冻结 ' + v.dgFrozen, '#8ad0ff']);
    if ((Number(v.dgShield) || 0) > 0) chips.push(['护盾 ' + v.dgShield, '#4ac8f0']);
    if ((Number(v.dgStun) || 0) > 0) chips.push(['麻痹 ' + v.dgStun, '#ffd24a']);
    if (!chips.length) { box.innerHTML = ''; return; }
    box.innerHTML = chips.map(function (c) {
      return '<span style="display:inline-block;padding:1px 6px;margin-right:4px;border-radius:8px;background:rgba(255,255,255,.06);font-size:10px;color:' + c[1] + '">' + c[0] + '</span>';
    }).join('');
  }
  var MAT_NAMES = { ore: '矿石', leather: '皮革', cloth: '布料', herb: '草药', fish: '鱼获' };
  function mats() { var v = VV(); if (!v) return {}; if (!v.mpMat) v.mpMat = {}; return v.mpMat; }
  function addMat(k, n) { var m = mats(); m[k] = (Number(m[k]) || 0) + n; }
  function matLine() {
    var m = mats(), out = [];
    for (var k in m) if (m[k] > 0) out.push((MAT_NAMES[k] || k) + ' ' + m[k]);
    return out.length ? out.join(' · ') : '（暂无材料）';
  }
  function dismantleItem(idx) {
    try {
      var v = VV(); if (!v) return;
      var all = sortItems(bag());
      var it = all[idx]; if (!it) return;
      var arr = bag(); var real = arr.indexOf(it); if (real < 0) return;
      if (!confirm('拆解「' + it.n + '」？会变成材料。')) return;
      arr.splice(real, 1);
      var rank = Math.max(0, (RARITY.filter(function (r) { return r.k === it.rarity; })[0] || RARITY[0]).k === 'divine' ? 6 : rarityRank(it.rarity));
      var cat = 8 + rank * 12;
      v.mpCat = (Number(v.mpCat) || 0) + cat;
      addMat('ore', 1 + rank);
      if (rank >= 3) addMat('leather', 1 + Math.floor(rank / 2));
      if (rank >= 4) addMat('cloth', 1);
      showToast('拆解完成：猫猫币 +' + cat + '，材料 +' + (1 + rank));
      renderBag(); renderCatBalance();
    } catch (e) {}
  }
  function gather(kind) {
    try {
      var v = VV(); if (!v) return;
      var day = Number(v.dgDay) || 1;
      if (!v.mpGather) v.mpGather = {};
      var key = kind + '_' + day;
      if (v.mpGather[key]) { showToast('今天已经' + (kind === 'fish' ? '钓过' : '采过') + '了，明天再来'); return; }
      v.mpGather[key] = true;
      if (kind === 'fish') {
        var n1 = 1 + Math.floor(Math.random() * 3);
        addMat('fish', n1); addMat('cloth', Math.random() < 0.3 ? 1 : 0);
        v.mpCat = (Number(v.mpCat) || 0) + 6;
        showToast('钓到 ' + n1 + ' 条鱼，猫猫币 +6');
      } else {
        var n2 = 1 + Math.floor(Math.random() * 2);
        addMat('herb', n2); addMat('ore', Math.random() < 0.4 ? 1 : 0);
        v.mpCat = (Number(v.mpCat) || 0) + 4;
        showToast('采到 ' + n2 + ' 份草药，猫猫币 +4');
      }
      renderCatBalance();
      var box = document.getElementById('dol-mat-line'); if (box) box.textContent = matLine();
    } catch (e) {}
  }
  var DAILY_POOL = [
    { k: 'kill', n: '击杀 5 只怪物', need: 5, cat: 40 },
    { k: 'floor', n: '地下城推进 2 层', need: 2, cat: 50 },
    { k: 'chest', n: '开启 2 个宝箱', need: 2, cat: 35 },
    { k: 'fish', n: '钓鱼 1 次', need: 1, cat: 30 },
    { k: 'gather', n: '采集 1 次', need: 1, cat: 30 },
    { k: 'equip', n: '拆解 1 件装备', need: 1, cat: 35 }
  ];
  function dailyQuests() {
    var v = VV(); if (!v) return [];
    var day = Number(v.dgDay) || 1;
    if (!v.mpDaily || v.mpDaily.day !== day) {
      var pick = DAILY_POOL.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
      v.mpDaily = { day: day, list: pick.map(function (q) { return { k: q.k, n: q.n, need: q.need, cat: q.cat, got: 0 }; }) };
    }
    return v.mpDaily.list;
  }
  function dailyProgress(k, n) {
    try {
      var list = dailyQuests();
      list.forEach(function (q) { if (q.k === k && q.got < q.need) q.got += n; });
    } catch (e) {}
  }
  function renderDaily() {
    var box = document.getElementById('dol-daily');
    if (!box) return;
    var list = dailyQuests();
    box.innerHTML = list.map(function (q) {
      var done = q.got >= q.need;
      return '<div style="display:flex;justify-content:space-between;font-size:12px;margin:2px 0;color:' + (done ? '#7ec98a' : '#c8c0b4') + '">' +
        '<span>' + esc(q.n) + '　' + Math.min(q.got, q.need) + '/' + q.need + '</span>' +
        '<span>' + (done ? '可领取' : '猫猫币 ' + q.cat) + '</span></div>' +
        (done ? '<button data-daily="' + q.k + '" style="width:100%;margin:2px 0;padding:4px;font-size:12px">领取</button>' : '');
    }).join('') || '（今日已完成）';
    box.querySelectorAll('[data-daily]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-daily');
        var list = dailyQuests();
        var q = list.filter(function (x) { return x.k === k; })[0];
        if (!q || q.got < q.need || q.claimed) return;
        q.claimed = true;
        var v = VV(); if (v) v.mpCat = (Number(v.mpCat) || 0) + q.cat;
        showToast('领取成功：猫猫币 +' + q.cat);
        renderCatBalance(); renderDaily();
      };
    });
  }
  function upgradeEquip(slot) {
    try {
      var v = VV(); if (!v || !v.mpEquip) return;
      var it = v.mpEquip[slot]; if (!it) { showToast('这个部位没有装备'); return; }
      var lv = Number(it.up) || 0;
      if (lv >= 5) { showToast('已经 +5，不能再强化'); return; }
      var costCat = 30 * (lv + 1);
      var costOre = 2 + lv;
      var m = mats();
      if ((Number(m.ore) || 0) < costOre) { showToast('矿石不够（需要 ' + costOre + '）'); return; }
      if ((Number(v.mpCat) || 0) < costCat) { showToast('猫猫币不够（需要 ' + costCat + '）'); return; }
      m.ore -= costOre;
      v.mpCat -= costCat;
      if (Math.random() < 0.15 + lv * 0.05) { showToast('强化失败，材料消耗了'); }
      else { it.up = lv + 1; showToast(it.n + ' 强化到 +' + (lv + 1)); }
      renderEquip(); renderCatBalance();
      var ml = document.getElementById('dol-mat-line'); if (ml) ml.textContent = matLine();
    } catch (e) {}
  }
  window.dolSmithOpen = function () {
    var b = townModal('铁匠铺 · 强化', '');
    if (!b) return;
    function render() {
      var v = VV() || {};
      var slots = ['weapon','helmet','chest','legs','gloves','boots','offhand','neck'];
      var h = '<div style="font-size:12px;color:#8a8a92;margin-bottom:6px">强化 +1~+5，全部装备的强化等级合计，每点给攻防 +1%</div>';
      slots.forEach(function (k) {
        var it = (v.mpEquip || {})[k];
        if (!it) return;
        var lv = Number(it.up) || 0;
        var costCat = 30 * (lv + 1), costOre = 2 + lv;
        h += '<div style="display:flex;align-items:center;gap:6px;font-size:13px;margin:3px 0;padding:3px 6px;background:#16181e;border-radius:6px">' +
          '<span style="flex:1">' + esc(it.n) + ' <span style="color:#7ec98a">+' + lv + '</span>' +
          '<span style="font-size:11px;color:#8a8a8a">　矿' + costOre + ' 猫' + costCat + '</span></span>' +
          (lv < 5 ? '<button data-smithup="' + k + '" style="padding:3px 10px;background:#2c3a2c;color:#b8f0c0;border:1px solid #3a5a3a;border-radius:6px;font-size:12px">强化</button>'
                  : '<span style="color:#666;font-size:11px">满级</span>') + '</div>';
      });
      if (h.indexOf('data-smithup') < 0 && h.indexOf('满级') < 0) h += '<span style="color:#888">（没有装备）</span>';
      b.innerHTML = h;
      b.querySelectorAll('[data-smithup]').forEach(function (btn) {
        btn.onclick = function () { upgradeEquip(btn.getAttribute('data-smithup')); render(); };
      });
    }
    render();
  };
  function renderSmith() {
    var box = document.getElementById('dol-smith');
    if (!box) return;
    var v = VV(); if (!v) return;
    var slots = ['weapon','helmet','chest','legs','gloves','boots','offhand','neck'];
    box.innerHTML = slots.map(function (k) {
      var it = (v.mpEquip || {})[k];
      if (!it) return '';
      var lv = Number(it.up) || 0;
      var costCat = 30 * (lv + 1), costOre = 2 + lv;
      return '<div style="display:flex;align-items:center;gap:5px;font-size:12px;margin:3px 0">' +
        '<span style="flex:1">' + esc(it.n) + ' <span style="color:#7ec98a">+' + lv + '</span></span>' +
        '<span style="font-size:10px;color:#8a8a8a">矿' + costOre + ' 猫' + costCat + '</span>' +
        (lv < 5 ? '<button data-up="' + k + '" style="padding:2px 8px;font-size:11px">强化</button>' : '<span style="color:#666;font-size:10px">满级</span>') +
        '</div>';
    }).join('') || '<span style="color:#888">（没有装备）</span>';
    box.querySelectorAll('[data-up]').forEach(function (b) {
      b.onclick = function () { upgradeEquip(b.getAttribute('data-up')); renderSmith(); };
    });
  }
  var CODEX_MON = ['野狼','黑熊','野猪','野猫','怨灵','史莱姆','触手','腐化的矿工','湿滑的触手','骨堆里的守卫','深渊猎犬','无面祭祀','石壁蠕虫','矿坑看守','骨庙祭司','深渊之影'];
  var CODEX_SPELL = {
    DoLOnlineDungeonFrost: '冰霜', DoLOnlineDungeonFireball: '火球', DoLOnlineDungeonShield: '护盾',
    DoLOnlineSpellHaste: '疾风', DoLOnlineSpellPoison: '毒雾', DoLOnlineSpellDrain: '吸取',
    DoLOnlineSpellThunder: '雷击', DoLOnlineSpellBurst: '爆裂', DoLOnlineSpellDesperate: '背水之炎',
    DoLOnlineSpellChain: '连锁闪电', DoLOnlineSpellBlood: '血祭', DoLOnlineSpellFireWall: '火墙',
    DoLOnlineSpellIceSpike: '冰锥', DoLOnlineSpellShadowBolt: '暗影箭', DoLOnlineSpellThunderStorm: '雷暴',
    DoLOnlineSpellMeteor: '陨石'
  };
  function codex() {
    var v = VV(); if (!v) return null;
    if (!v.mpCodex || typeof v.mpCodex !== 'object') v.mpCodex = { mon: {}, equip: {}, spell: {} };
    if (!v.mpCodex.mon) v.mpCodex.mon = {};
    if (!v.mpCodex.equip) v.mpCodex.equip = {};
    if (!v.mpCodex.spell) v.mpCodex.spell = {};
    return v.mpCodex;
  }
  window.dolCodexMon = function (n) { try { if (!n) return; var c = codex(); c.mon[n] = (c.mon[n] || 0) + 1; } catch (e) {} };
  window.dolCodexEquip = function (n) { try { if (!n) return; var c = codex(); c.equip[n] = (c.equip[n] || 0) + 1; } catch (e) {} };
  window.dolCodexSpell = function (n) { try { if (!n) return; var c = codex(); c.spell[n] = (c.spell[n] || 0) + 1; } catch (e) {} };
  var codexTab = 'mon';
  var _codexCache = { weapon: null, equip: null };
  var CODEX_SLOT_CN = { weapon: '武器', offhand: '副手', helmet: '头盔', chest: '衣服', legs: '裤子', gloves: '手套', boots: '鞋子', neck: '饰品' };
  function codexItemList(kind) {
    if (_codexCache[kind]) return _codexCache[kind];
    var arr = [], seen = {};
    Object.keys(BAG_POOL).forEach(function (slot) {
      if (kind === 'weapon' && slot !== 'weapon') return;
      if (kind === 'equip' && slot === 'weapon') return;
      (BAG_POOL[slot] || []).forEach(function (it) {
        if (!it || !it.n || seen[it.n]) return;
        seen[it.n] = 1;
        arr.push({ n: it.n, slot: slot, tier: Number(it.tier) || 0 });
      });
    });
    arr.sort(function (a, b) { return a.tier - b.tier || a.n.localeCompare(b.n); });
    _codexCache[kind] = arr;
    return arr;
  }
  function codexProgress() {
    var c = codex(); if (!c) return { w: 0, wt: 0, e: 0, et: 0 };
    var w = codexItemList('weapon'), e = codexItemList('equip');
    var got = function (list) {
      var n = 0;
      list.forEach(function (x) { if (c.equip[x.n]) n++; });
      return n;
    };
    return { w: got(w), wt: w.length, e: got(e), et: e.length };
  }
  var codexOnlyGot = false;
  function codexDetail(x, have, times) {
    try {
      var r = RARITY[x.tier] || RARITY[0];
      var body = '<div style="font-size:15px;color:' + r.c + ';font-weight:bold;margin-bottom:4px">' + esc(have ? x.n : '？？？') + '</div>' +
        '<div style="font-size:12px;color:#9a9a9a;margin-bottom:6px">' + (CODEX_SLOT_CN[x.slot] || x.slot) + ' · ' + r.n + '</div>' +
        '<div style="font-size:13px">攻击 +' + (x.atk || 0) + '　防御 +' + (x.def || 0) + '　体力 +' + (x.hp || 0) + (x.sp ? '　法强 +' + x.sp : '') + '</div>' +
        '<div style="font-size:12px;color:#8a8a92;margin-top:6px">' + (have ? ('已收集 ×' + times) : '还没收集到') + '</div>';
      townModal(have ? '装备图鉴' : '未收集', body);
    } catch (e) {}
  }
  function bindCodexLongPress(scope) {
    try {
      scope.querySelectorAll('[data-cxitem]').forEach(function (el) {
        var n = el.getAttribute('data-cxitem');
        var idx = Number(el.getAttribute('data-cxidx'));
        var t = null;
        var start = function () { t = setTimeout(function () { t = null; try { window.dolCodexItem(idx); } catch (e) {} }, 420); };
        var cancel = function () { if (t) { clearTimeout(t); t = null; } };
        el.addEventListener('touchstart', start, { passive: true });
        el.addEventListener('touchend', cancel);
        el.addEventListener('touchmove', cancel);
        el.addEventListener('mousedown', start);
        el.addEventListener('mouseup', cancel);
        el.addEventListener('mouseleave', cancel);
        el.addEventListener('click', function () { cancel(); try { window.dolCodexItem(idx); } catch (e) {} });
      });
    } catch (e) {}
  }
  window.dolCodexItem = function (idx) {
    try {
      var kind = (codexTab === 'weapon') ? 'weapon' : 'equip';
      var list = codexItemList(kind);
      var x = list[idx]; if (!x) return;
      var c = codex(); var times = (c.equip || {})[x.n] || 0;
      codexDetail(x, !!times, times);
    } catch (e) {}
  };
  // 图鉴收集度奖励：25% / 50% / 100% 各给一层永久加成
  function codexBonus() {
    try {
      var p = codexProgress();
      var tot = p.wt + p.et, has = p.w + p.e;
      var pct = tot ? (has / tot * 100) : 0;
      var out = { pct: Math.round(pct), atkPct: 0, defPct: 0, loot: 0, tier: 0 };
      if (pct >= 25) { out.atkPct += 3; out.tier = 1; }
      if (pct >= 50) { out.defPct += 3; out.tier = 2; }
      if (pct >= 100) { out.atkPct += 3; out.loot += 5; out.tier = 3; }
      return out;
    } catch (e) { return { pct: 0, atkPct: 0, defPct: 0, loot: 0, tier: 0 }; }
  }
  function renderCodex() {
    var box = document.getElementById('dol-codex');
    if (!box) return;
    var c = codex(); if (!c) return;
    var tabs = [['mon','怪物'],['weapon','武器'],['equip','装备'],['set','套装'],['spell','法术']];
    var html = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">' + tabs.map(function (t) {
      var n;
      if (t[0] === 'weapon' || t[0] === 'equip') {
        var pr = codexProgress();
        n = (t[0] === 'weapon') ? (pr.w + '/' + pr.wt) : (pr.e + '/' + pr.et);
      } else if (t[0] === 'set') {
        n = SET_ORDER.length;
      } else {
        n = Object.keys(c[t[0]] || {}).length;
      }
      var on = codexTab === t[0];
      return '<button data-cx="' + t[0] + '" style="padding:3px 9px;font-size:11px;border-radius:6px;' +
        (on ? 'background:rgba(232,201,122,.22);border:1px solid rgba(232,201,122,.6);color:#f0d060' : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') +
        '">' + t[1] + ' ' + n + '</button>';
    }).join('') + '</div>';

    /* ===== 套装总览：按职业分 + 基础套单独 ===== */
    if (codexTab === 'set') {
      var v = VV() || {};
      var cnt = setCounts(v);
      var byCls = {};
      SET_ORDER.forEach(function (id) {
        var d = CLASS_SETS[id]; if (!d) return;
        (byCls[d.cls] = byCls[d.cls] || []).push(id);
      });
      var clsName = { warrior: '剑士', mage: '法师', ranger: '游侠', priest: '牧师', shadow: '你打不中我信不信' };
      Object.keys(byCls).forEach(function (cls) {
        html += '<div style="font-size:11px;color:#b4a6a8;margin:7px 0 3px">' + (clsName[cls] || cls) + '</div>';
        byCls[cls].forEach(function (id) {
          var d = CLASS_SETS[id];
          var have = cnt[id] || 0;
          html += '<div style="font-size:11px;margin:2px 0;color:' + d.c + '">' + d.n + ' ' + have + '/6' +
            '<span style="color:#6a6a72">　2:' + JSON.stringify(d.b2) + ' 4:' + JSON.stringify(d.b4) + ' 6:' + JSON.stringify(d.b6) + '</span></div>';
        });
      });
      var rc = {};
      Object.keys((v.mpEquip || {})).forEach(function (k) {
        var it = v.mpEquip[k]; if (!it) return;
        var rr = it.rarity || (rarityByName(it.slot || k, it.n).k);
        rc[rr] = (rc[rr] || 0) + 1;
      });
      html += '<div style="font-size:11px;color:#b4a6a8;margin:10px 0 3px">基础套（按稀有度）</div>';
      Object.keys(SET_BONUS).forEach(function (k) {
        var b = SET_BONUS[k], n2 = rc[k] || 0;
        html += '<div style="font-size:11px;margin:2px 0;color:#c8c2ba">' + b.name + ' ' + n2 + '/7' +
          '<span style="color:#6a6a72">　3件 攻' + b[3].atk + ' 防' + b[3].def + ' 体' + b[3].hp +
          '　5件 攻' + b[5].atk + ' 防' + b[5].def + ' 体' + b[5].hp +
          '　7件 攻' + b[7].atk + ' 防' + b[7].def + ' 体' + b[7].hp + '</span></div>';
      });
      html += '<div style="font-size:10px;color:#5a5a62;margin-top:8px">职业套装：2/4/6 件生效；基础套：3/5/7 件生效</div>';
      box.innerHTML = html;
      box.querySelectorAll('[data-cx]').forEach(function (b) {
        b.onclick = function () { codexTab = b.getAttribute('data-cx'); renderCodex(); };
      });
      return;
    }

    var items = c[codexTab] || {};
    var keys = Object.keys(items);
    if (codexTab === 'weapon' || codexTab === 'equip') {
      var list = codexItemList(codexTab);
      var got = 0;
      list.forEach(function (x) { if (items[x.n]) got++; });
      var pct = list.length ? Math.round(got / list.length * 100) : 0;
      /* 全部 / 已收集 切换 */
      html += '<div style="display:flex;gap:4px;margin:2px 0 6px">' +
        '<button data-cxonly="0" style="padding:2px 9px;font-size:11px;border-radius:6px;' +
        (!codexOnlyGot ? 'background:rgba(154,199,255,.18);border:1px solid rgba(154,199,255,.5);color:#9ac7ff' : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">全部</button>' +
        '<button data-cxonly="1" style="padding:2px 9px;font-size:11px;border-radius:6px;' +
        (codexOnlyGot ? 'background:rgba(154,199,255,.18);border:1px solid rgba(154,199,255,.5);color:#9ac7ff' : 'background:#16181e;border:1px solid #2a2a34;color:#9a9a9a') + '">已收集</button></div>';
      var shown = codexOnlyGot ? list.filter(function (x) { return items[x.n]; }) : list;
      var bySlot = {};
      shown.forEach(function (x) { (bySlot[x.slot] = bySlot[x.slot] || []).push(x); });
      Object.keys(bySlot).forEach(function (slot) {
        html += '<div style="font-size:11px;color:#b4a6a8;margin:6px 0 3px">' + (CODEX_SLOT_CN[slot] || slot) + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
          bySlot[slot].map(function (x) {
            var have = !!items[x.n];
            var r = RARITY[x.tier] || RARITY[0];
            var idx = list.indexOf(x);
            return '<span data-cxitem="' + esc(x.n) + '" data-cxidx="' + idx + '" title="长按看属性" style="padding:3px 7px;border-radius:6px;font-size:11px;' +
              (have ? 'background:#16181e;border:1px solid ' + r.c + '55;color:' + r.c : 'background:#101216;border:1px dashed #2a2a34;color:#4a4a52') + '">' +
              (have ? esc(x.n) : '？？？') + (have && items[x.n] > 1 ? '<span style="color:#666"> ×' + items[x.n] + '</span>' : '') + '</span>';
          }).join('') + '</div>';
      });
      if (!shown.length) html += '<div style="color:#7a7a82;font-size:12px">（这一类还没收集）</div>';
      var cb = codexBonus();
      html += '<div style="font-size:11px;color:#e8c97a;margin-top:8px">已收集 ' + got + ' / ' + list.length + '（' + pct + '%）　点图标看名称与属性</div>' +
        '<div style="font-size:10px;color:#7ec98a;margin-top:3px">图鉴加成：' +
        (cb.tier ? ('攻击 +' + cb.atkPct + '%　防御 +' + cb.defPct + '%' + (cb.loot ? '　掉落 +' + cb.loot + '%' : '')) : '（25% 起有加成）') + '</div>';
      box.innerHTML = html;
      box.querySelectorAll('[data-cx]').forEach(function (b) {
        b.onclick = function () { codexTab = b.getAttribute('data-cx'); renderCodex(); };
      });
      box.querySelectorAll('[data-cxonly]').forEach(function (b) {
        b.onclick = function () { codexOnlyGot = b.getAttribute('data-cxonly') === '1'; renderCodex(); };
      });
      bindCodexLongPress(box);
      return;
    }

    if (!keys.length) { html += '<span style="color:#888">（还没记录，去地下城逛逛）</span>'; }
    else {
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px">' + keys.sort().map(function (k) {
        var n = items[k];
        var col = codexTab === 'mon' ? '#e25a5a' : '#8ad0ff';
        return '<span style="padding:3px 7px;border-radius:6px;background:#16181e;border:1px solid #2a2a34;font-size:11px;color:' + col + '">' +
          esc(k) + '<span style="color:#666"> ×' + n + '</span></span>';
      }).join('') + '</div>';
    }
    if (codexTab === 'mon') {
      html += '<div style="font-size:10px;color:#666;margin-top:5px">已记录 ' + keys.length + ' / ' + CODEX_MON.length + ' 种怪物</div>';
    } else if (codexTab === 'spell') {
      html += '<div style="font-size:10px;color:#666;margin-top:5px">已记录 ' + keys.length + ' / 16 种法术</div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-cx]').forEach(function (b) {
      b.onclick = function () { codexTab = b.getAttribute('data-cx'); renderCodex(); };
    });
  }
  var SKILL_NODES = [
    { k: 'atk',      n: '力量训练',  d: '每级 攻击 +2',      max: 10 },
    { k: 'def',      n: '体能锻炼',  d: '每级 防御 +2',      max: 10 },
    { k: 'hp',       n: '耐力',      d: '每级 体力上限 +10', max: 10 },
    { k: 'crit',     n: '弱点洞察',  d: '每级 暴击 +2%',     max: 10 },
    { k: 'lifesteal',n: '血液掌控',  d: '每级 吸血 +2%',     max: 10 },
      { k: 'loot',     n: '寻宝直觉',  d: '每级 掉落率 +3%',   max: 10 },
    { k: 'arcane',   n: '咒文精通',  d: '每级 法术强度 +8',  max: 3, cost: 2 },
    { k: 'fireWall',   n: '解锁 · 火墙',   d: '第 3 层自动开放，也可在此提前解锁', max: 1, cost: 2, auto: 3 },
    { k: 'iceSpike',   n: '解锁 · 冰锥',   d: '第 5 层自动开放，也可在此提前解锁', max: 1, cost: 2, auto: 5 },
    { k: 'shadowBolt', n: '解锁 · 暗影箭', d: '第 7 层自动开放，也可在此提前解锁', max: 1, cost: 3, auto: 7 },
    { k: 'thunderStorm', n: '解锁 · 雷暴', d: '第 9 层自动开放，也可在此提前解锁', max: 1, cost: 3, auto: 9 },
    { k: 'meteor',     n: '解锁 · 陨石',   d: '第 12 层自动开放，也可在此提前解锁', max: 1, cost: 4, auto: 12 },
    { k: 'uBurst',   n: '解锁 · 爆裂魔法', d: '蓄力 3 回合，400+ 伤害', max: 1, cost: 4 },
    { k: 'uChain',   n: '解锁 · 连锁闪电', d: '耗光法力，1.6 倍返还伤害', max: 1, cost: 4 },
    { k: 'uDesp',    n: '解锁 · 背水之炎', d: '残血爆发', max: 1, cost: 3 },
    { k: 'uBlood',   n: '解锁 · 血祭',      d: '献祭体力换伤害', max: 1, cost: 3 }
  ];
  function skillPts() {
    var v = VV(); if (!v) return 0;
    return Number(v.mpSkillPts) || 0;
  }
  function openSkillTree() {
    try {
      var v = VV(); if (!v) return;
      if (!v.mpSkill) DGAC.write(function () { v.mpSkill = {}; });
      var old = document.getElementById('dol-skill-tree');
      if (old) old.remove();
      var box = document.createElement('div');
      box.id = 'dol-skill-tree';
      box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483660;' +
        'width:min(92vw,340px);max-height:78vh;overflow-y:auto;background:#14161c;color:#ddd;' +
        'border:1px solid #7a6a4a;border-radius:12px;padding:12px;font:13px/1.6 sans-serif';
      function render() {
        var pts = skillPts();
        var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<b style="color:#e8c97a">技能树</b>' +
          '<span style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:12px;color:#9ac7ff">技能点 ' + pts + '</span>' +
          '<button id="dol-sk-reset" style="padding:3px 9px;font-size:12px;background:#2a2028;border:1px solid #5a3a4a;color:#e08aa0;border-radius:6px">洗点</button>' +
          '</span></div>' +
          '<div style="font-size:11px;color:#8a8a8a;margin-bottom:8px">每下一层 20% 概率 +1 点，击败层主固定 +1 点</div>';
        var _dgLv = Number(v.mpDgLv) || 1;
        SKILL_NODES.forEach(function (nd) {
          var lv = Number(v.mpSkill[nd.k]) || 0;
          var autoOn = !!(nd.auto && _dgLv >= nd.auto);
          if (autoOn && lv < 1) { DGAC.set(v.mpSkill, nd.k, 1); lv = 1; }
          var full = lv >= nd.max;
          html += '<div style="display:flex;align-items:center;gap:6px;margin:4px 0;padding:6px 8px;background:#1a1c22;border-radius:8px">' +
            '<div style="flex:1"><div style="color:#e8e0d0">' + nd.n + ' <span style="color:#7ec98a;font-size:11px">' + lv + '/' + nd.max + '</span></div>' +
            '<div style="font-size:11px;color:#8a8a8a">' + nd.d + '</div></div>' +
            (full ? '<span style="color:#7ec98a;font-size:12px">已满</span>'
                  : (autoOn ? '<span style="color:#7ec98a;font-size:12px">已解锁</span>'
                  : '<button data-sk="' + nd.k + '" style="padding:4px 10px">解锁' + ((Number(nd.cost) || 1) > 1 ? '（' + (Number(nd.cost) || 1) + ' 点）' : '') + '</button>')) +
            '</div>';
        });
        html += '<button id="dol-skill-close" style="width:100%;margin-top:8px;padding:8px;background:#3a3a4a;color:#ddd;border:none;border-radius:6px">关闭</button>';
        box.innerHTML = html;
        box.querySelectorAll('[data-sk]').forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-sk'), nd = null;
            SKILL_NODES.forEach(function (x) { if (x.k === k) nd = x; });
            var lv = Number(v.mpSkill[k]) || 0;
            if (lv >= nd.max) return;
            var cost = Number(nd.cost) || 1;
            if (skillPts() < cost) { showToast('技能点不够（需要 ' + cost + '）'); return; }
            DGAC.set(v.mpSkill, k, lv + 1);
            DGAC.set(v, 'mpSkillPts', skillPts() - cost);
            showToast(nd.n + ' 提升到 ' + (lv + 1) + ' 级');
            render();
            try { renderExpBar(); } catch (e) {}
          };
        });
        var rb = box.querySelector('#dol-sk-reset');
        if (rb) rb.onclick = function () {
          var dgLv2 = Number(v.mpDgLv) || 1;
          var refund = 0, cnt = 0;
          SKILL_NODES.forEach(function (nd) {
            var lv = Number(v.mpSkill[nd.k]) || 0;
            if (lv <= 0) return;
            // 等级白送的节点不退点，避免刷点
            if (nd.auto && dgLv2 >= nd.auto) return;
            refund += (Number(nd.cost) || 1) * lv;
            cnt += lv;
          });
          if (!cnt) { showToast('还没点过技能'); return; }
          if (!confirm('洗点：清空已点的 ' + cnt + ' 级技能，退还 ' + refund + ' 技能点。确定？')) return;
          DGAC.write(function () { v.mpSkill = {}; });
          SKILL_NODES.forEach(function (nd) {
            if (nd.auto && dgLv2 >= nd.auto) DGAC.set(v.mpSkill, nd.k, 1);
          });
          DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + refund);
          showToast('已洗点，退还 ' + refund + ' 技能点');
          render();
          try { renderExpBar(); } catch (e) {}
        };
        var cb = box.querySelector('#dol-skill-close');
        if (cb) cb.onclick = function () { box.remove(); };
      }
      render();
      document.body.appendChild(box);
    } catch (e) {}
  }
  window.dolOpenSkillTree = openSkillTree;
  function dgOverlay() {
    var ov = document.getElementById('dol-grid-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'dol-grid-overlay';
      ov.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483000;' +
        'background:#0f1116;border:1px solid rgba(232,201,122,.45);border-radius:12px;padding:10px;' +
        'box-shadow:0 10px 40px rgba(0,0,0,.8);display:none;max-width:94vw';
      ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<b style="color:#e8c97a;font-size:14px">自由探索</b>' +
        '<span id="dol-grid-close" style="color:#aaa;padding:0 8px;font-size:18px">✕</span></div>' +
        '<div id="dol-grid-body" style="font-size:12px"></div>';
      document.body.appendChild(ov);
      var cl = document.getElementById('dol-grid-close');
      if (cl) cl.onclick = function () { ov.style.display = 'none'; try { window.__dolInDungeon = false; } catch (e) {} };
      ov.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-dg]') : null;
        if (b) { try { dgMove(b.getAttribute('data-dg')); } catch (e) {} return; }
        var id = ev.target && ev.target.id;
        if (id === 'dol-dg-fight') { try { dgFight(); } catch (e) {} }
        else if (id === 'dol-dg-open') { try { dgOpen(); } catch (e) {} }
        else if (id === 'dol-dg-rest') { try { dgRest(); } catch (e) {} }
        else if (id === 'dol-dg-next') { try { dgNext(); } catch (e) {} }
      });
    }
    return ov;
  }
  function dgRender() {
    var ov = null;
    try { ov = dgOverlay(); } catch (e) {}
    var box = ov ? document.getElementById('dol-grid-body') : null;
    if (!box) return;
    var inDg = false;
    try { inDg = (window.__dolInDungeon === true); } catch (e) {}
    ov.style.display = inDg ? 'block' : 'none';
    if (!inDg) return;
    var v = VV(); if (!v) return;
    var m = dgEnsure();
    var html = '<div style="font-size:12px;color:#8a8a8a;margin-bottom:4px">第 ' + m.floor + ' 层　体力 ' + (v.dgHp||100) + '　法力 ' + (v.dgMana||100) + '</div>';
    html += '<div style="display:inline-block;font:12px/1.1 monospace;background:#0c0e12;padding:5px;border-radius:6px;letter-spacing:2px">';
    for (var y = 0; y < DG_H; y++) {
      for (var x = 0; x < DG_W; x++) {
        var c = dgCell(m, x, y);
        if (x === m.px && y === m.py) { html += '<span style="color:#e8c97a">@</span>'; continue; }
        var known = !!(m.seen && m.seen[x + ',' + y]);
        if (!known && c !== '#') { html += '<span style="color:#2a2e36">·</span>'; continue; }
        var col = '#333', ch = c;
        if (c === '#') { col = '#555'; ch = '█'; }
        else if (c === 'M') { col = '#e25a5a'; ch = 'M'; }
        else if (c === 'C') { col = '#e8c97a'; ch = 'C'; }
        else if (c === '+') { col = '#7ec98a'; ch = '+'; }
        else if (c === 'L') { col = '#4ac8f0'; ch = 'L'; }
        else { col = '#3a3a4a'; ch = '·'; }
        html += '<span style="color:' + col + '">' + ch + '</span>';
      }
      html += '<br>';
    }
    html += '</div>';
    html += '<div style="font-size:11px;color:#666;margin-top:2px">@你 M怪 C宝箱 +篝火 L楼梯（走到怪/宝箱/篝火上自动触发）</div>';
    var cur = dgCell(m, m.px, m.py);
    html += '<div style="margin-top:6px;font-size:13px">当前：' + ({'.':'空地','M':' 怪物','C':' 宝箱','+':' 篝火','L':' 楼梯','S':'入口'}[cur] || cur) + '</div>';
    html += '<div style="display:flex;gap:6px;margin-top:6px;justify-content:center">' +
      '<button data-dg="u" style="width:44px">↑</button>' +
      '<button data-dg="l" style="width:44px">←</button>' +
      '<button data-dg="d" style="width:44px">↓</button>' +
      '<button data-dg="r" style="width:44px">→</button></div>';
    if (cur === 'L' || cur === 'S') html += '<div class="dor" style="margin-top:6px"><button id="dol-dg-next" style="width:100%">⬇ 下一层</button></div>';
    if (cur === 'M') html += '<div class="dor" style="margin-top:6px"><button id="dol-dg-fight" style="width:100%"> 战斗</button></div>';
    if (cur === 'C') html += '<div class="dor" style="margin-top:6px"><button id="dol-dg-open" style="width:100%"> 开宝箱</button></div>';
    if (cur === '+') html += '<div class="dor" style="margin-top:6px"><button id="dol-dg-rest" style="width:100%"> 休息</button></div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-dg]').forEach(function (b) {
      b.onclick = function () { dgMove(b.getAttribute('data-dg')); };
    });
    var f1 = document.getElementById('dol-dg-fight');
    if (f1) f1.onclick = function () { dgFight(); };
    var f2 = document.getElementById('dol-dg-open');
    if (f2) f2.onclick = function () { dgOpen(); };
    var f3 = document.getElementById('dol-dg-rest');
    if (f3) f3.onclick = function () { dgRest(); };
    var f4 = document.getElementById('dol-dg-next');
    if (f4) f4.onclick = function () { dgNext(); };
  }
  function dgMove(dir) {
    var v = VV(); if (!v) return;
    var m = dgEnsure();
    var dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0;
    var dy = dir === 'u' ? -1 : dir === 'd' ? 1 : 0;
    var nx = m.px + dx, ny = m.py + dy;
    if (nx < 0 || ny < 0 || nx >= DG_W || ny >= DG_H) return;
    if (dgCell(m, nx, ny) === '#') { showToast('走不通'); return; }
    m.px = nx; m.py = ny;
    var cell = dgCell(m, nx, ny);
    dgReveal(m);
    v.dgMap = m;
    // 碰到标记直接触发互动（楼梯 L 除外）
    if (cell === 'M') { dgFight(); return; }
    if (cell === 'C') { dgOpen(); return; }
    if (cell === '+') {
      if ((Number(v.dgHp) || 0) >= 100 && (Number(v.dgMana) || 0) >= 100) {
        showToast('状态已满，篝火留在原地');
        dgRender();
        return;
      }
      m.map[ny][nx] = '.';
      dgRest();
      return;
    }
    if (cell === 'T') {
      var trapDmg = 8 + Math.floor(Math.random() * 12);
      v.dgHp = Math.max(0, (Number(v.dgHp) || 100) - trapDmg);
      m.map[ny][nx] = '.';
      showFloat('-' + trapDmg, '#ff6a4a', 0);
      showToast('踩到陷阱，受到 ' + trapDmg + ' 伤害');
    } else if (cell === 'A') {
      if (confirm('祭坛：献祭 20 点体力，永久 +5 体力上限？')) {
        v.dgHp = Math.max(1, (Number(v.dgHp) || 100) - 20);
        v.mpBonusHp = (Number(v.mpBonusHp) || 0) + 5;
        m.map[ny][nx] = '.';
        showToast('祭坛回应了你（体力上限 +5）');
      }
    } else if (cell === 'B') {
      m.map[ny][nx] = '.';
      v.dgForceBoss = true;
      showToast('更深处的东西醒了！');
      try { dgFight(); } catch (e) {}
    } else if (cell === 'L') {
      showToast('这里有向下的路');
    }
    dgReveal(m);
    v.dgMap = m;
    dgRender();
  }
  function floatLayer() {
    var l = document.getElementById('dol-float-layer');
    if (!l) { l = document.createElement('div'); l.id = 'dol-float-layer'; document.body.appendChild(l); }
    return l;
  }
  function showFloat(text, color, delay) {
    setTimeout(function () {
      try {
        var layer = floatLayer();
        var d = document.createElement('div');
        d.className = 'dol-float';
        d.textContent = text;
        d.style.color = color || '#ff8a8a';
        var w = window.innerWidth, h = window.innerHeight;
        d.style.left = Math.round(w * 0.5 + (Math.random() * 90 - 45)) + 'px';
        d.style.top = Math.round(h * 0.16 + (Math.random() * 30 - 15)) + 'px';
        layer.appendChild(d);
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1000);
      } catch (e) {}
    }, delay || 0);
  }
  function playCombatFloats(log) {
    var i = 0, m;
    (log || []).forEach(function (line) {
      if ((m = /反击 (\d+) 伤害/.exec(line))) { showFloat('-' + m[1], '#ff5a5a', i * 110); i++; }
      else if ((m = /造成 (\d+) 伤害/.exec(line))) { showFloat('-' + m[1], '#ff9a6a', i * 110); i++; }
      else if (line.indexOf('暴击') >= 0) { showFloat('暴击！', '#ffd24a', i * 110); i++; }
    });
  }
  function barHtml(label, cur, max, color) {
    var p = Math.max(0, Math.min(100, Math.round(cur / (max || 1) * 100)));
    return '<div style="margin:3px 0">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:#bbb">' +
      '<span>' + esc(label) + '</span><span>' + Math.max(0, Math.round(cur)) + ' / ' + Math.round(max) + '</span></div>' +
      '<div style="height:8px;background:#14161c;border-radius:4px;overflow:hidden;border:1px solid #2a2a30;margin-top:2px">' +
      '<div style="height:100%;width:' + p + '%;background:' + color + ';transition:width .35s ease"></div></div></div>';
  }
  function renderBars(hp, hpMax, ehp, ehpMax, monName) {
    var box = document.getElementById('dol-bars');
    if (!box) return;
    box.innerHTML = barHtml('我', hp, hpMax, 'linear-gradient(90deg,#4ae06a,#2aa04a)') +
      barHtml(monName || '怪物', Math.max(0, ehp), ehpMax, 'linear-gradient(90deg,#e05a5a,#a02a2a)');
  }
  function rarityRank(k) {
    for (var i = 0; i < RARITY.length; i++) if (RARITY[i].k === k) return i;
    return 0;
  }
  function showPillar(item, rar) {
    try {
      var el = document.getElementById('dol-pillar');
      if (!el) {
        el = document.createElement('div');
        el.id = 'dol-pillar';
        document.body.appendChild(el);
      }
      var r = rar || RARITY[0];
      el.innerHTML = '<div class="dol-pillar-beam" style="background:linear-gradient(180deg,transparent,' + r.c + '55,transparent)"></div>' +
        '<div class="dol-pillar-text" style="color:' + r.c + ';text-shadow:0 0 16px ' + r.c + '">' +
        (item && item.n ? esc(item.n) : '') + '</div>';
      el.style.display = 'flex';
      el.style.animation = 'dolPillarIn 1.8s ease-out forwards';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 1800);
    } catch (e) {}
  }
  function checkFloorAch(v) {
    try { if (v && Number(v.dgFloor) >= 10) unlockAch('floor10'); } catch (e) {}
  }
  var HUI_PIC = 'data:image/jpeg;base64,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';
  function injectHuiPortrait(passageName) {
    try {
      if (!passageName || passageName.indexOf('DoLOnlineNpc') !== 0) return;
      var nodes = document.querySelectorAll('.dol-hui-pic');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute('data-done')) continue;
        nodes[i].setAttribute('data-done', '1');
        nodes[i].innerHTML = '<img src="' + HUI_PIC + '" style="width:200px;border-radius:14px;border:1px solid #4a4030;box-shadow:0 6px 20px rgba(0,0,0,.55)">';
      }
    } catch (e) {}
  }
  var _lastDgEhp = null, _lastDgHp = null;
  function animBar(el, toPct, ms, flash) {
    if (!el) return;
    try {
      var to = Math.max(0, Math.min(100, toPct));
      var from = (el._pct == null) ? to : el._pct;
      el._pct = to;
      el.style.transition = 'none';
      if (Math.abs(to - from) < 0.3) { el.style.width = to + '%'; return; }
      var start = null;
      function step(t) {
        if (start === null) start = t;
        var k = Math.min(1, (t - start) / ms);
        var ease = 1 - Math.pow(1 - k, 3);
        el.style.width = (from + (to - from) * ease) + '%';
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      if (flash) {
        el.style.filter = 'brightness(1.9)';
        setTimeout(function () { try { el.style.filter = ''; } catch (e) {} }, 260);
      }
    } catch (e) {}
  }
  function injectDungeonCss() {
    try {
      if (document.getElementById('dol-dg-css')) return;
      var st = document.createElement('style');
      st.id = 'dol-dg-css';
      st.textContent =
        'body.dol-dg-mode #passages{font-family:system-ui,sans-serif;font-size:15px;line-height:1.75;color:#d8d0c8;padding:10px 12px 30px}' +
        'body.dol-dg-mode #passages h3{font-size:17px;color:#e8c97a;margin:14px 0 10px;padding-left:9px;border-left:3px solid #e8c97a;letter-spacing:.5px;font-weight:600}' +
        'body.dol-dg-mode #passages table{width:100%;border-collapse:separate;border-spacing:0;background:rgba(255,255,255,.035);border:1px solid rgba(232,201,122,.18);border-radius:10px;overflow:hidden;margin:10px 0}' +
        'body.dol-dg-mode #passages td{padding:7px 12px;border:none;border-bottom:1px solid rgba(255,255,255,.06);font-size:14px}' +
        'body.dol-dg-mode #passages tr:last-child td{border-bottom:none}' +
        'body.dol-dg-mode #passages td:first-child{color:#9a9a9a;width:34%}' +
        '#passages #dol-spellgrid a,#dol-spellgrid a{display:inline-flex!important;width:calc(50% - 4px)!important;box-sizing:border-box;margin:2px;padding:8px 6px;background:rgba(232,201,122,.07);border:1px solid rgba(232,201,122,.28);border-radius:8px;color:#f0d060;text-decoration:none;font-size:13px;text-align:center;line-height:1.25;justify-content:center;align-items:center}' +
        '#dol-spellgrid br{display:none!important}' +
        'body.dol-dg-mode #passages a{display:inline-flex;align-items:center;justify-content:center;vertical-align:top;' +
        'width:calc(50% - 6px);box-sizing:border-box;margin:3px;padding:8px 8px;background:rgba(232,201,122,.07);' +
        'border:1px solid rgba(232,201,122,.28);border-radius:8px;color:#f0d060;text-decoration:none;font-size:14px;text-align:center;line-height:1.3}' +
        'body.dol-dg-mode #passages a + br{display:none}' +
        'body.dol-dg-mode #passages a:active{background:rgba(232,201,122,.2)}' +
        'body.dol-dg-mode #passages hr{border:none;border-top:1px solid rgba(255,255,255,.08);margin:14px 0}' +
        'body.dol-dg-mode #passages b{color:#f0e0c0}' +
        'body.dol-dg-mode #passages br+br{display:block}';
      document.head.appendChild(st);
    } catch (e) {}
  }
  window.dolCastFromSelect = function () {
    try {
      var s = document.getElementById('dol-spell-sel');
      if (!s || !s.value) { showToast('先选择一个法术'); return; }
      var v = s.value;
      var box = document.getElementById('dol-spell-links');
      var a = box ? box.querySelector('a[data-passage="' + v + '"]') : null;
      if (a) { a.click(); return; }
      var SC = window.SugarCube;
      if (SC && SC.Engine && SC.Engine.play) { SC.Engine.play(v); return; }
      showToast('无法施放（找不到链接）');
    } catch (e) { showToast('施放出错：' + (e && e.message ? e.message : '')); }
  };
  function dgHud() {
    var el2 = document.getElementById('dol-dg-hud');
    if (!el2) {
      el2 = document.createElement('div');
      el2.id = 'dol-dg-hud';
      el2.style.cssText = 'position:fixed;left:50%;top:calc(4px + env(safe-area-inset-top,0px));transform:translateX(-50%);' +
        'z-index:2147482900;width:min(56vw,200px);padding:3px 7px;background:rgba(10,10,14,.72);' +
        'border:1px solid rgba(232,201,122,.25);border-radius:8px;pointer-events:none;display:none;' +
        'font:10px/1.15 sans-serif;color:#c8c8c8';
      el2.innerHTML =
        '<div style="display:flex;justify-content:space-between"><span>我</span><span id="dol-dg-t1"></span></div>' +
        '<div style="position:relative;height:4px;background:#1a1a22;border-radius:2px;overflow:hidden;margin-top:1px">' +
        '<div id="dol-dg-f1" style="height:100%;width:100%;background:linear-gradient(90deg,#4ae06a,#2aa04a)"></div>' +
        '<div id="dol-dg-sh" style="position:absolute;top:0;bottom:0;left:100%;width:0;background:linear-gradient(90deg,#4ac8f0,#2a6ac0);transition:left .4s ease,width .4s ease"></div></div>' +
        '<div id="dol-dg-r2"><div style="display:flex;justify-content:space-between;margin-top:3px"><span id="dol-dg-n2">怪物</span><span id="dol-dg-t2"></span></div>' +
        '<div style="height:4px;background:#1a1a22;border-radius:2px;overflow:hidden;margin-top:1px">' +
        '<div id="dol-dg-f2" style="height:100%;width:100%;background:linear-gradient(90deg,#e05a5a,#a02a2a);transition:width .4s ease"></div></div></div>';
      document.body.appendChild(el2);
    }
    return el2;
  }
  // 兼容：游戏的 overlayReplace 需要 T.buttons（临时变量）。
  // 正常由 StoryCaption 里的 <<run T.buttons = new Tab(...)>> 建立，
  // 若该步骤没跑（被其它模组干扰/异常中断），这里补一个安全的空对象。
  function ensureOverlayTab() {
    try {
      var SC = window.SugarCube;
      var T = SC && SC.State && SC.State.temporary;
      if (!T) return;
      if (T.buttons) return;
      if (typeof window.Tab === 'function') {
        try { T.buttons = new window.Tab('overlayButtons', 'macro-button-selected'); return; } catch (e) {}
      }
      T.buttons = {
        activeTab: -1,
        toggle: function () {}, reset: function () { this.activeTab = -1; },
        setActive: function (i) { this.activeTab = i; }, setupTabs: function () {}
      };
    } catch (e) {}
  }
  // 在「开始渲染新 passage」之前就补齐 T.buttons，避免 overlayReplace 报错
  (function hookOverlayTabEarly() {
    try {
      var $ = window.jQuery;
      if (!$) return;
      $(document).on(':passageinit', function () { try { ensureOverlayTab(); } catch (e) {} });
      $(document).on(':passagestart', function () { try { ensureOverlayTab(); } catch (e) {} });
      $(document).on(':passagerender', function () { try { ensureOverlayTab(); } catch (e) {} });
    } catch (e) {}
  })();
  function dungeonPassageEnhance(passageName) {
    try {
      var hud = dgHud();
      try { ensureOverlayTab(); } catch (e) {}
      try {
        var v0 = VV();
        if (v0 && v0.dgEnemyName) window.dolCodexMon(v0.dgEnemyName);
        if (passageName && CODEX_SPELL[passageName]) window.dolCodexSpell(CODEX_SPELL[passageName]);
      } catch (e) {}
      try {
        if (passageName === 'DoLOnlineDungeonEntry' || passageName === 'DoLOnlineDungeonPartySync' || passageName === 'DoLOnlineDungeonExplore' || passageName === 'DoLOnlineDungeonFight') {
          var sb = document.getElementById('dol-party-share');
          if (sb) {
            var r = partyRun;
            if (r && r.active && r.mon) {
              var order = r.order || r.members || [];
              sb.innerHTML = '<div style="font-size:12px;color:#e8c97a">👥 共享中：' + order.map(esc).join('、') + '</div>' +
                '<div style="font-size:12px;color:#ddd">' + esc(r.mon.name) + ' ' + r.mon.hp + '/' + r.mon.hpMax + '</div>' +
                (r.teamHpMax ? '<div style="font-size:12px;color:#9ac7ff">队伍体力 ' + (r.teamHp || 0) + '/' + r.teamHpMax + '</div>' : '') +
                '<div style="font-size:11px;color:#8a9ae2">出手请到面板「队伍 → 共享怪物」点「攻击」，那里能看到队伍血条和每个人的伤害</div>';
              sb.style.display = 'block';
            } else { sb.style.display = 'none'; sb.innerHTML = ''; }
          }
        }
      } catch (e) {}
      if (passageName === 'DoLOnlineDungeonEntry' || passageName === 'DoLOnlineDungeonExplore' || passageName === 'DoLOnlineDungeonFight') {
        try {
          if (partyMembers && partyMembers.length > 1 && USERNAME === (partyMembers[0] || '')) {
            var _v = VV();
            var _fl = _v ? (Number(_v.dgFloor) || 1) : 1;
            if (window.__lastPartyFloor !== _fl) {
              window.__lastPartyFloor = _fl;
              ws.send(JSON.stringify({ type: 'party_enter' }));
            }
          }
        } catch (e) {}
      }
      if (passageName === 'DoLOnlinePartyRun') {
        try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'party_run_state' })); } catch (e) {}
        setTimeout(function () { try { renderPartyRun(); } catch (e) {} }, 300);
      }
      // 严格判定：必须是 mod 自己的页面才显示地下城 HUD
      var title = '';
      try {
        var SC = window.SugarCube;
        if (SC && SC.State && SC.State.passage) title = SC.State.passage;
      } catch (e) {}
      var cur = (typeof passageName === 'string' && passageName) ? passageName : title;
      var isDg = !!(cur && cur.indexOf('DoLOnline') === 0);
      if (!isDg) window.__dolDg = false;
      try { document.body.classList.toggle('dol-dg-mode', !!isDg); } catch (e) {}
      if (!isDg) {
        hud.style.display = 'none';
        try {
          if (!partyEvent || !partyEvent.active) {
            var ph = document.getElementById('dol-party-hud');
            if (ph) ph.style.display = 'none';
          }
        } catch (e) {}
        _lastDgEhp = null; _lastDgHp = null;
        return;
      }
      var v = VV(); if (!v) return;
      var monName = v.dgEnemyName || '';
      var inFight = /DungeonFight|DungeonBoss|Spell|SkillHeavy|SkillGuard|SkillHeal|ClassSkill/.test(cur || '');
      var ehp = inFight ? (Number(v.dgEHp) || 0) : 0;
      var ehpMax = inFight ? (Number(v.dgEHpMax) || 0) : 0;
      var hpMax = (window.dolStaminaMax ? dolStaminaMax() : 100);
      var hp = Number(v.dgHp);
      if (!isFinite(hp)) hp = hpMax;
      if (hp > hpMax) { hp = hpMax; try { v.dgHp = hpMax; } catch (e) {} }
      if (hp < 0) hp = 0;

      var html = barHtml('我', Math.max(0, hp), hpMax, 'linear-gradient(90deg,#4ae06a,#2aa04a)');
      if (ehpMax > 0) html += barHtml(monName || '怪物', Math.max(0, ehp), ehpMax, 'linear-gradient(90deg,#e05a5a,#a02a2a)');
      hud.style.display = 'block';
      try { injectDungeonCss(); } catch (e) {}
      var t1 = document.getElementById('dol-dg-t1'), f1 = document.getElementById('dol-dg-f1');
      var t2 = document.getElementById('dol-dg-t2'), f2 = document.getElementById('dol-dg-f2');
      var n2 = document.getElementById('dol-dg-n2');
      if (t1) t1.textContent = Math.round(hp) + '/' + Math.round(hpMax);
      animBar(f1, hp / hpMax * 100, 950, true);
      try {
        var shEl = document.getElementById('dol-dg-sh');
        var shRounds = Number(v.dgShield) || 0;
        if (shEl) {
          if (shRounds > 0) {
            shEl.style.left = '0%';
            shEl.style.width = Math.min(100, Math.round(shRounds / 3 * 100)) + '%';
            shEl.style.opacity = '0.35';
          } else {
            shEl.style.width = '0%';
          }
        }
      } catch (e) {}
      var r2 = document.getElementById('dol-dg-r2');
      if (ehpMax > 0 && ehp > 0) {
        if (r2) r2.style.display = 'block';
        if (t2) t2.textContent = Math.round(ehp) + '/' + Math.round(ehpMax);
        animBar(f2, ehp / ehpMax * 100, 850, true);
        if (n2) n2.textContent = monName || '怪物';
      } else {
        if (r2) r2.style.display = 'none';
        if (f2) f2.style.width = '0%';
      }
      try {
        var pbox = document.getElementById('dol-bars');
        if (pbox) pbox.innerHTML = html;
      } catch (e) {}

      if (_lastDgEhp !== null && ehp < _lastDgEhp) showFloat('-' + (_lastDgEhp - ehp), '#ff8a6a', 0);
      if (_lastDgHp !== null && hp < _lastDgHp) showFloat('-' + Math.round(_lastDgHp - hp), '#ff5a5a', 140);
      if (_lastDgEhp !== null && ehp <= 0 && _lastDgEhp > 0) {
        showFloat('击败！', '#ffd24a', 280);
        try {
          if (partyEvent && partyEvent.kind === 'dungeon' && partyEvent.active && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'party_dungeon_action', action: 'attack', role: getRole(), value: Math.floor((playerCombatStats().atk || 10) * 3) }));
          }
        } catch (e) {}
      }
      _lastDgEhp = ehp; _lastDgHp = hp;

      try {
        var txt = (document.getElementById('passages') || document.body).innerText || '';
        // 暴击飘字已改为按战斗结算触发，避免轮询重复
      } catch (e) {}
    } catch (e) {}
  }
  var globalPresence = {};
  function renderWorldPresence() {
    try {
      var box = el.worldPresence;
      if (!box) return;
      var names = Object.keys(globalPresence).filter(function (n) { return n !== USERNAME; });
      var me = '';
      try {
        var v = VV();
        if (v && v.map && v.map.location) me = v.map.location;
      } catch (e) {}
      var byLoc = {};
      var myLoc = me || '';
      names.forEach(function (n) {
        var it = globalPresence[n] || {};
        var loc = it.mapLocation || it.passage || '未知';
        (byLoc[loc] = byLoc[loc] || []).push(n);
      });
      if (!names.length) { box.textContent = '—'; return; }
      var keys = Object.keys(byLoc).sort();
      var html = '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      keys.forEach(function (loc) {
        var label = (typeof MAP_LOCATION_NAMES !== 'undefined' && MAP_LOCATION_NAMES[loc]) || loc;
        var isMine = (loc === myLoc);
        var ppl = byLoc[loc].map(function (n) { return esc(n); }).join('、');
        html += '<div style="flex:1 1 46%;min-width:110px;padding:4px 6px;border-radius:6px;background:' +
          (isMine ? 'rgba(232,201,122,.14)' : '#16181e') + ';border:1px solid ' +
          (isMine ? 'rgba(232,201,122,.45)' : 'rgba(255,255,255,.08)') + '">' +
          '<div style="font-size:11px;color:' + (isMine ? '#f0d060' : '#9a9a9a') + '">' + esc(String(label).slice(0, 18)) + '</div>' +
          '<div style="font-size:12px;color:#d8d0c8">' + ppl + '</div></div>';
      });
      html += '</div>';
      box.innerHTML = html;
    } catch (e) {}
  }

  function getPresence() {
    var passage = '', day = null, money = null, mapLocation = '', timeStamp = null;
    try {
      var st = window.SugarCube && window.SugarCube.State;
      if (st && st.active) passage = st.active.title;
      var v = st && st.variables;
      if (v && typeof v.day === 'number') day = v.day;
      if (v && typeof v.money === 'number') money = v.money;
      if (v && v.map && v.map.location) mapLocation = v.map.location;
      if (v && typeof v.timeStamp === 'number') timeStamp = v.timeStamp;
    } catch (e) {}
    return { passage: passage, day: day, money: money, mapLocation: mapLocation, timeStamp: timeStamp };
  }
  function sendPresenceNow() {
    if (!TOKEN || !ws || ws.readyState !== 1) return;
    var p = getPresence();
    try {
      var _v = VV();
      var _d = _v ? Math.min(99, Math.max(1, Number(_v.mpDLv) || 1)) : 1;
      var _g = _v ? Math.min(99, Math.max(0, Number(_v.mpDgLv) || 1)) : 0;
      var _lv = _v ? (_d * 100 + _g) : null;
    ws.send(JSON.stringify({ type: 'presence', worldId: worldId, passage: p.passage, day: p.day, money: p.money, lv: _lv, mapLocation: p.mapLocation, timeStamp: p.timeStamp })); } catch (e) {}
  }
  function startPresence() {
    stopPresence();
    startTimeSync();
    sendPresenceNow();
    presenceTimer = setInterval(sendPresenceNow, 8000);
  }
  function onFrameworkFrame() {
    try { renderCoLocated(); } catch (e) {}
    try { enforceCheatGate(); } catch (e) {}
    try { checkFightReturn(); } catch (e) {}
    try { captureScreen(); } catch (e) {}
    try { sendPresenceNow(); } catch (e) {}
    try { renderMapMarkers(); } catch (e) {}
  }
  function tryHookFramework() {
    if (frameworkHooked) return;
    var mb = window.maplebirch;
    if (mb && typeof mb.on === 'function') {
      try {
        mb.on(':passagedisplay', onFrameworkFrame);
        try { mb.on(':storyready', onFrameworkFrame); } catch (e) {}
        frameworkHooked = true;
        if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
        if (screenTimer) { clearInterval(screenTimer); screenTimer = null; }
        return;
      } catch (e) {}
    }
    frameworkTries++;
    if (frameworkTries < 30) setTimeout(tryHookFramework, 500);
  }
  function stopPresence() {
    stopTimeSync();
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
    worldPresences = {};
    renderWorldPresence();
    worldActions = [];
    if (el.actionLog) el.actionLog.innerHTML = '';
    stopScreenSync();
  }
  function resubscribeWorld() {
    if (ws && ws.readyState === 1 && worldId) {
      try { ws.send(JSON.stringify({ type: 'watch_world', worldId: worldId })); } catch (e) {}
    }
  }
  function joinWorld() {
    if (!TOKEN) { setStatus('请先登录', 'err'); return; }
    var id = el.worldId.value.trim();
    if (!id) { setWorldStatus('请输入世界ID/房间号', 'err'); return; }
    if (!confirm('加入共享世界会载入该世界的存档，并覆盖你当前的进度。\n（会先备份你的个人进度）\n\n确定加入「' + id + '」吗？')) return;
    try { uploadSave(); } catch (e) {}
    setWorldStatus('加入中…');
    try { localStorage.setItem('dolon_world', id); } catch (e) {}
    api('POST', '/api/world/join', { worldId: id, name: USERNAME + ' 的世界' }).then(function (r) {
      if (r && r.ok) {
        worldId = id;
        worldVersion = r.world.version;
        worldLatestVersion = r.world.version;
        worldHost = r.world.host || '';
        cheatAllow = Array.isArray(r.world.cheatAllow) ? r.world.cheatAllow : [];
        renderCheatList();
        resubscribeWorld();
        startPresence();
        startScreenSync();
        var tail = r.created ? '（已创建，还没有存档）' : '（最近编辑：' + (r.world.lastEditor || '无') + '）';
        setWorldStatus((r.created ? '已创建' : '已加入') + '世界「' + id + '」v' + worldVersion + tail, 'ok');
        // 自动载入已关闭：请手动点「载入世界存档」
      } else {
        setWorldStatus((r && r.error) || '加入失败', 'err');
      }
    });
  }
  var autoSaveTimer = null, autoSaveDirty = false, autoSaveBusy = false;
  var AUTO_SAVE_WORLD = false;   // 世界存档改为手动上传
  function scheduleAutoSave() {
    if (!AUTO_SAVE_WORLD) return;   // 自动保存已关闭
    if (!TOKEN || !worldId) return;
    if (foreignWorld) return;   // 别人的世界只读，不写回
    autoSaveDirty = true;
    if (autoSaveTimer) return;
    autoSaveTimer = setTimeout(function () { autoSaveTimer = null; doAutoSave(); }, 60000);
  }
  function doAutoSave() {
    if (!autoSaveDirty || autoSaveBusy) return;
    if (worldId === 'main') { try { uploadSave(); } catch (e) {} autoSaveDirty = false; return; }
    if (!TOKEN || !worldId) return;
    autoSaveBusy = true;
    var save = null;
    try { save = serializeGame(); } catch (e) { save = null; }
    if (!save) { autoSaveBusy = false; return; }
    api('POST', '/api/world/save', { worldId: worldId, save: save, baseVersion: worldVersion, meta: getMeta() }).then(function (r) {
      autoSaveBusy = false;
      if (r && r.ok) {
        autoSaveDirty = false;
        worldVersion = r.version; worldLatestVersion = r.version;
        setWorldStatus('已自动保存 v' + worldVersion, 'ok');
      } else if (r && r.conflict) {
        autoSaveDirty = false;
        if (r.version) { worldVersion = r.version; worldLatestVersion = r.version; }
        setWorldStatus('别人更新过世界（v' + (r.version || '?') + '），本次保存已跳过；需要同步请点「载入世界存档」', 'err');
      }
    });
  }
  function restoreMyBackup() {
    try {
      var bak = localStorage.getItem('dolon_mybackup');
      if (!bak) { showToast('没有可恢复的备份'); return; }
      if (!confirm('恢复你进入别人世界之前的进度？当前进度将被覆盖。')) return;
      if (deserializeGame(bak)) {
        foreignWorld = false;
        showToast('已恢复你的进度');
        try { renderEquip(); renderBag(); renderQuests(); renderExpBar(); } catch (e) {}
      }
    } catch (e) {}
  }
  window.dolRestoreBackup = restoreMyBackup;
  function stripForeignProgress() {
    try {
      var v = VV(); if (!v) return;
      v.mpEquip = {};
      v.mpBag = [];
      v.mpCat = 0;
      v.mpSP = 0; v.mpDSP = 0; v.mpDgSP = 0;
      DGAC.set(v, 'mpDLv', 1); DGAC.set(v, 'mpDgLv', 1);
      v.mpQ = {};
      DGAC.set(v, 'dgFloor', 1); v.dgHp = null; v.dgEHp = 0; v.dgEHpMax = 0;
      v.dgMana = (v.dgManaMax || 100); DGAC.set(v, 'dgGold', 0);
      v.mpBossHp = undefined; v.dgCharge = 0; v.dgShield = 0; v.dgShieldHp = 0;
      v.dgPoison = 0; v.dgHaste = 0; v.dgStun = 0;
      try { renderEquip(); renderBag(); renderQuests(); renderExpBar(); } catch (e) {}
      showToast('这是别人的世界存档，地下城进度与装备已重置为你的');
    } catch (e) {}
  }
  function autoLoadWorld(silent) {
    if (!TOKEN || !worldId) return;
    if (worldId === 'main') {
      // 常驻服：共享世界，但每个人用自己的存档
      api('GET', '/api/save').then(function (r2) {
        if (r2 && r2.ok && r2.save) {
          try {
            if (deserializeGame(r2.save)) { setWorldStatus('常驻服：已载入你的个人存档', 'ok'); }
          } catch (e) {}
        } else {
          setWorldStatus('常驻服：新档开始时使用当前进度', 'ok');
        }
      });
      return;
    }
    api('GET', '/api/world?worldId=' + encodeURIComponent(worldId)).then(function (r) {
      if (!(r && r.ok && r.world)) return;
      worldHost = r.world.host || worldHost;
      cheatAllow = Array.isArray(r.world.cheatAllow) ? r.world.cheatAllow : cheatAllow;
      try { refreshAdminUI(); } catch (e) {}
      if (!r.world.save) {
        if (!silent) setWorldStatus('世界还是空的，你的进度会自动存进去');
        autoSaveDirty = true;
        doAutoSave();
        return;
      }
      if (r.world.version === worldVersion && !silent) {
        setWorldStatus('已跟随世界进度 v' + worldVersion, 'ok');
        return;
      }
      try {
        var foreign = !!(r.world.owner && r.world.owner !== USERNAME);
        if (foreign) {
          try { var bak = serializeGame(); if (bak) localStorage.setItem('dolon_mybackup', bak); } catch (e) {}
        }
        foreignWorld = foreign;
        if (deserializeGame(r.world.save)) {
          if (foreign) stripForeignProgress();
          worldVersion = r.world.version;
          worldLatestVersion = r.world.version;
          setWorldStatus('已载入世界存档 v' + worldVersion + '（' + (r.world.lastEditor || '?') + '）', 'ok');
          if (!silent) showToast('已同步到世界最新进度');
        }
      } catch (e) {}
    });
  }
  function loadWorld() {
    if (!TOKEN) { setStatus('请先登录', 'err'); return; }
    if (!worldId) { setWorldStatus('请先加入世界', 'err'); return; }
    if (!confirm('载入世界存档会覆盖当前进度（会先自动备份你的个人进度），确定继续吗？')) return;
    try { uploadSave(); } catch (e) {}
    setWorldStatus('载入中…（已自动备份个人进度）');
    api('GET', '/api/world?worldId=' + encodeURIComponent(worldId)).then(function (r) {
      if (r && r.ok && r.world && r.world.save) {
        var ok = false;
        try { ok = deserializeGame(r.world.save); } catch (e) { ok = false; }
        if (ok) {
          worldVersion = r.world.version;
          worldLatestVersion = r.world.version;
          worldHost = r.world.host || worldHost;
          cheatAllow = Array.isArray(r.world.cheatAllow) ? r.world.cheatAllow : cheatAllow;
      try { refreshAdminUI(); } catch (e) {}
          renderCheatList();
          setWorldStatus('已载入世界存档 v' + worldVersion + '（' + (r.world.lastEditor || '无') + ' 的进度）', 'ok');
        } else {
          setWorldStatus('载入失败：无法载入存档', 'err');
        }
      } else if (r && r.ok && r.world && !r.world.save) {
        setWorldStatus('世界还是空的，先点「保存到世界」上传你的初始进度', 'err');
      } else {
        setWorldStatus((r && r.error) || '载入失败', 'err');
      }
    });
  }
  function enforceCheatGate() {
    try {
      var ok = canCheat();
      var hidden = document.querySelectorAll('[data-dol-cheat-hidden="1"]');
      for (var i = 0; i < hidden.length; i++) {
        hidden[i].style.display = ok ? '' : 'none';
      }
      var sec = document.getElementById('dol-cheat-sec');
      if (sec) sec.style.display = ok ? 'block' : 'none';
      var deny = document.getElementById('dol-cheat-deny');
      if (deny) deny.style.display = ok ? 'none' : 'block';
    } catch (e) {}
  }
  function checkFightReturn() {
    if (!fightReturn) return;
    try {
      var st = window.SugarCube && window.SugarCube.State;
      var cur = st && st.active ? st.active.title : '';
      if (!cur) return;
      if (cur === fightReturn) { fightReturn = ''; return; }
      if (FIGHT_PASSAGES.indexOf(cur) >= 0) return;
      var ret = fightReturn;
      fightReturn = '';
      var Engine = window.SugarCube && window.SugarCube.Engine;
      if (Engine && typeof Engine.play === 'function') Engine.play(ret);
    } catch (e) {}
  }
  function renderCombat(c) {
    var box = document.getElementById('dol-combat');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dol-combat';
      box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483662;' +
        'width:min(92vw,360px);max-height:86vh;overflow-y:auto;background:#14161c;color:#ddd;border:1px solid #5a4a2a;border-radius:10px;' +
        'padding:12px;font:14px/1.5 sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.7);display:none';
      document.body.appendChild(box);
    }
    if (!c) { box.style.display = 'none'; return; }
    if (!c.active) {
      var last = (c.log && c.log.length) ? c.log[c.log.length - 1] : '战斗结束';
      box.innerHTML = '<div style="font-weight:bold;color:#e8c97a;margin-bottom:8px"> 战斗结束</div>' +
        '<div style="color:#7ec98a;margin-bottom:8px">' + esc(last) + '</div>' +
        '<button id="dol-combat-close" style="width:100%;padding:8px;background:#3a3a4a;color:#ddd;border:none;border-radius:6px">关闭</button>';
      var cb = box.querySelector('#dol-combat-close');
      if (cb) cb.onclick = function () { box.style.display = 'none'; };
      box.style.display = 'block';
      return;
    }
    var html = '<div style="font-weight:bold;color:#e8c97a;margin-bottom:6px"> 联机战斗</div>';
    html += '<div id="dol-combat-model" style="height:150px;display:flex;align-items:center;justify-content:center;background:#0c0e12;border:1px solid #2a2a30;border-radius:6px;overflow:hidden;margin-bottom:8px"></div>';
    var bpct = Math.max(0, Math.round(c.baileyHp / c.baileyMax * 100));
    html += '<div style="margin-bottom:6px">贝利 <span style="color:#e25a5a">' + c.baileyHp + '/' + c.baileyMax + '</span>' +
      '<div style="height:9px;background:#222;border-radius:5px;overflow:hidden"><div style="height:100%;width:' + bpct + '%;background:linear-gradient(90deg,#e25a5a,#f0a040)"></div></div></div>';
    for (var i = 0; i < c.players.length; i++) {
      var pl = c.players[i];
      var ppct = Math.max(0, Math.round(pl.hp / pl.max * 100));
      var isTurn = (i === c.turn);
      html += '<div style="margin-bottom:5px' + (isTurn ? ';color:#e8c97a;font-weight:bold' : '') + '">' +
        esc(pl.name) + (pl.name === USERNAME ? '（你）' : '') + (isTurn ? ' ◀ 回合' : '') +
        ' <span style="color:#7ec98a">' + pl.hp + '/' + pl.max + '</span>' +
        '<div style="height:7px;background:#222;border-radius:4px;overflow:hidden"><div style="height:100%;width:' + ppct + '%;background:#7ec98a"></div></div></div>';
    }
    html += '<div id="dol-combat-log" style="font-size:12px;color:#9a9a9a;max-height:96px;overflow-y:auto;margin:8px 0;background:#0c0e12;padding:6px;border-radius:4px"></div>';
    html += '<div style="display:flex;gap:6px">' +
      '<button id="dol-combat-attack" style="flex:2;padding:10px;background:#e8a33b;color:#111;border:none;border-radius:6px;font-weight:bold;font-size:15px">攻击</button>' +
      '<button id="dol-combat-rest" style="flex:1;padding:10px;background:#3a5a3a;color:#b8f0c0;border:none;border-radius:6px">休息</button>' +
      '<button id="dol-combat-swap" style="flex:1;padding:10px;background:#3a3a5a;color:#bbb;border:none;border-radius:6px">换位</button>' +
      '</div>';
    box.innerHTML = html;
    if (c.log) box.querySelector('#dol-combat-log').innerHTML = c.log.slice(-10).map(esc).join('<br>');
    try {
      var mbox = box.querySelector('#dol-combat-model');
      if (mbox) renderCombatModel(mbox);
    } catch (e) {}
    var myIdx = -1;
    for (var k2 = 0; k2 < c.players.length; k2++) if (c.players[k2].name === USERNAME) myIdx = k2;
    var isMyTurn = (myIdx >= 0 && myIdx === c.turn);
    function bindAct(id, act) {
      var b = box.querySelector('#' + id);
      if (!b) return;
      b.disabled = !isMyTurn;
      b.style.opacity = isMyTurn ? '1' : '0.4';
      b.onclick = function () {
        if (!isMyTurn) return;
        try { ws.send(JSON.stringify({ type: 'combat_action', action: act })); } catch (e) {}
      };
    }
    bindAct('dol-combat-attack', 'attack');
    bindAct('dol-combat-rest', 'rest');
    bindAct('dol-combat-swap', 'swap');
    box.style.display = 'block';
  }
  function renderCombatModel(box) {
    if (!box) return;
    if (!peerCombatSnapshot || !peerCombatSnapshot.player || !window.MultiCanvasModel || !window.CanvasModel) {
      box.innerHTML = '<span style="color:#555;font-size:13px">（队友模型未就绪）</span>';
      return;
    }
    try {
      var v = VV();
      var keys = ['player','worn','transformationParts','hairtype','fringetype','hairlengthstage','fringelengthstage',
        'haircolour','hairfringecolour','hairColourStyle','hairFringeColourStyle','hairColourGradient','hairFringeColourGradient',
        'naturalhaircolour','leftEyeColour','rightEyeColour','skinColour','makeup','arousal','pain','trauma','tiredness','position',
        'combat','enemyhealth','enemyhealthmax','enemyarousal','enemyarousalmax','enemyanger','enemytrust','npcSub','consensual'];
      var backup = {};
      keys.forEach(function (k) { backup[k] = v[k]; });
      var snap = peerCombatSnapshot;
      try {
        v.combat = 1;
        v.enemyhealth = 100; v.enemyhealthmax = 100;
        v.enemyarousal = 0; v.enemyarousalmax = 500;
        v.enemyanger = 20;
        v.enemytrust = 0;
        v.npcSub = 1; v.consensual = 0;
        keys.forEach(function (k) {
          if (k === 'position') { v.position = 'missionary'; }
          else if (k === 'combat' || k === 'enemyhealth' || k === 'enemyhealthmax' || k === 'enemyarousal' || k === 'enemyarousalmax' || k === 'enemyanger' || k === 'enemytrust' || k === 'npcSub' || k === 'consensual') { /* 保留临时值 */ }
          else if (k === 'transformationParts') { v.transformationParts = normalizeTransformParts(snap.transformationParts, backup.transformationParts); }
          else if (k === 'player' && snap.player) { v.player = Object.assign(dclone(backup.player || {}), dclone(snap.player));
              if (!(Number(v.player.perceived_breastsize) >= 3)) v.player.perceived_breastsize = 3;
              if (!(Number(v.player.breastsize) >= 1)) v.player.breastsize = 1; }
          else if (k === 'worn' && snap.worn) { v.worn = dclone(snap.worn || {}); } else if (snap[k] !== undefined) { v[k] = dclone(snap[k]); }
        });
        if (window.Skin && typeof window.Skin.recache === 'function') window.Skin.recache();
        var mc = window.MultiCanvasModel.create('dolCombatPeer', 'combatMainPc', 'dolCombatPeerPc');
        mc.redraw();
        box.innerHTML = '';
        box.appendChild(mc.canvas.canvas);
        return;
      } finally {
        keys.forEach(function (k) { v[k] = backup[k]; });
        if (window.Skin && typeof window.Skin.recache === 'function') window.Skin.recache();
      }
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      box.innerHTML = '<span style="color:#c66;font-size:12px">（模型渲染失败：' + msg.slice(0, 120) + '）</span>';
    }
  }
  function showToast(text) {
    try {
      // 事件效果只写在正文里，禁止任何浮层弹出（兜底，防止旧代码路径）
      if (typeof text === 'string' && /(疼痛|压力|创伤|自控|性奋|疲劳|觉察|猫猫币|矿石)\s*[+-]{1,3}/.test(text)) return;
      if (text && text.nodeType) {
        window.__dolToastErr = '传入了 DOM 节点\n' + (new Error().stack || '');
        text = '（内部错误：传入了 DOM 节点）';
      } else if (typeof text === 'object' && text !== null && !text.message && !text.msg) {
        window.__dolToastErr = '传入了对象 ' + Object.prototype.toString.call(text) + '\n' + (new Error().stack || '');
      }
      if (typeof text === 'string' && text.indexOf('[object ') === 0) {
        window.__dolToastErr = '字符串里含节点：' + text + '\n' + (new Error().stack || '');
        text = '（内部错误：文本被节点污染）';
      }
      if (text && typeof text === 'object') text = (text.message || text.msg || String(text));
    } catch (e) {}
    var t = document.getElementById('dol-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'dol-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:26%;transform:translateX(-50%);z-index:2147483670;' +
        'background:#2a2418;color:#e8c97a;border:1px solid #7a6a4a;border-radius:8px;padding:10px 16px;' +
        'font-size:15px;max-width:82vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.6);display:none';
      document.body.appendChild(t);
    }
    t.textContent = (typeof text === 'string') ? text : String(text && text.message ? text.message : text);
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.style.display = 'none'; }, 2800);
  }
  function renderCoLocated() {
    var old = document.getElementById('dol-colocated');
    if (old) old.remove();
    if (!worldId) return;
    var myPassage = '';
    try { myPassage = (window.SugarCube && window.SugarCube.State && window.SugarCube.State.active) ? window.SugarCube.State.active.title : ''; } catch (e) {}
    if (!myPassage) return;
    var others = [];
    for (var u in worldPresences) {
      if (u === USERNAME) continue;
      var p = worldPresences[u];
      if (p && p.passage && p.passage === myPassage) others.push(u);
    }
    if (!others.length) return;
    var passages = document.getElementById('passages');
    if (!passages) return;
    var box = document.createElement('div');
    box.id = 'dol-colocated';
    box.className = 'dol-colocated';
    var title = document.createElement('div');
    title.className = 'dol-colocated-title';
    title.textContent = '同处一地的玩家（点击互动）';
    box.appendChild(title);
    for (var i = 0; i < others.length; i++) {
      var uname = others[i];
      var a = document.createElement('a');
      a.className = 'dol-colocated-btn';
      a.textContent = ' 与 ' + uname + ' 互动';
      a.onclick = (function (name) { return function (ev) { if (ev) ev.preventDefault(); interactWithPlayer(name); }; })(uname);
      box.appendChild(a);
      var t = document.createElement('a');
      t.className = 'dol-colocated-btn';
      t.textContent = ' 与 ' + uname + ' 交易';
      t.onclick = (function (name) { return function (ev) { if (ev) ev.preventDefault(); tradeWithPlayer(name); }; })(uname);
      box.appendChild(t);
      if (isAdminUser()) {
        var ge = document.createElement('a');
        ge.className = 'dol-colocated-btn';
        ge.textContent = ' 给 ' + uname + ' 经验';
        ge.onclick = (function (name) { return function (ev) {
          if (ev) ev.preventDefault();
          var n = window.prompt('给 ' + name + ' 增加多少经验？', '50');
          if (n === null) return;
          var amt = Math.floor(Number(n));
          if (!amt || amt <= 0) { showToast(' 数值无效'); return; }
          try { ws.send(JSON.stringify({ type: 'grant_exp', to: name, amount: amt })); } catch (e) {}
        }; })(uname);
        box.appendChild(ge);
      }
      var pa = document.createElement('a');
      pa.className = 'dol-colocated-btn';
      if (partyMembers && partyMembers.indexOf(uname) >= 0) {
        var already = document.createElement('a');
        already.className = 'dol-colocated-btn';
        already.textContent = ' 已在队伍中';
        already.style.opacity = '0.7';
        already.style.cursor = 'default';
        box.appendChild(already);
      } else {
        pa.textContent = ' 邀请 ' + uname + ' 组队';
        pa.onclick = (function (name) { return function (ev) { if (ev) ev.preventDefault(); try { ws.send(JSON.stringify({ type: 'party_invite', to: name })); } catch (e) {} showToast('已邀请 ' + name + ' 组队'); }; })(uname);
        box.appendChild(pa);
      }
    }
    var coop = document.createElement('a');
    coop.className = 'dol-colocated-btn';
    coop.style.cssText = 'border-color:#c94;color:#f0a040';
    coop.textContent = ' 组队打贝利';
    coop.onclick = function (ev) { if (ev) ev.preventDefault(); startCoopCombat(); };
    box.appendChild(coop);
    passages.appendChild(box);
  }

  function tradeWithPlayer(name) {
    var amt = window.prompt('给 ' + name + ' 多少钱？（£）', '100');
    if (amt === null) return;
    var n = Math.floor(Number(amt));
    if (!n || n <= 0) { showToast(' 金额无效'); return; }
    try { ws.send(JSON.stringify({ type: 'trade_offer', to: name, amount: n })); } catch (e) {}
    showToast(' 已向 ' + name + ' 发起交易：£' + n);
  }
  window.startDungeonPartyFight = function (npcName) {
    try {
      if (!partyMembers || !partyMembers.length) { showToast('没有队友'); return; }
      ws.send(JSON.stringify({ type: 'party_event_start', npc: npcName || '地下城怪物' }));
      showToast(' 组队战斗开始：' + (npcName || '地下城怪物'));
    } catch (e) {}
  };
  function startCoopCombat() {
    try { ws.send(JSON.stringify({ type: 'combat_start_coop' })); } catch (e) {}
    showToast(' 已发起组队战斗');
  }

  function interactWithPlayer(name) {
    setStatus('正在与 ' + name + ' 互动…', 'ok');
    showToast('与 ' + name + ' 互动中…');
    var ok = false;
    try {
      var SC = window.SugarCube;
      var v = SC && SC.State && SC.State.variables;
      if (v && v.NPCList) {
        try {
          var tmp = document.createElement('div');
          document.body.appendChild(tmp);
          var W = window.Wikifier || (SC && SC.Wikifier);
          if (typeof W === 'function') { new W(tmp, '<<generateNPC 1 a m m>>'); }
          else if (W && typeof W.wiki === 'function') { W.wiki('<<generateNPC 1 a m m>>', tmp); }
          if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
        } catch (e) {}
        var npc0 = v.NPCList[0];
        if (npc0 && npc0.type) {
          npc0.name = name || '对手';
          try {
            var _pp = (peerCombatSnapshot && peerCombatSnapshot.player) || {};
            var _fem = (_pp.sex === 'f' || _pp.gender_appearance === 'f' || _pp.gender === 'f');
            npc0.pronoun = _fem ? 'f' : 'm';
            npc0.gender = _fem ? 'f' : 'm';
          } catch (e) { npc0.pronoun = 'f'; npc0.gender = 'f'; }
          try {
            var S = window.setup;
            if (window.npcEquipSet && S && S.npcClothesSets) {
              var g = npc0.pronoun || 'm';
              var opts = S.npcClothesSets.filter(function (x) { return x.gender === g; });
              if (!opts.length) opts = S.npcClothesSets;
              var pick = opts[Math.floor(Math.random() * opts.length)];
              if (pick) window.npcEquipSet(npc0, pick);
            }
          } catch (e) {}
          ok = true;
        }
        if (!ok) {
          var npc1 = v.NPCList[0];
          if (npc1 && npc1.type) { npc1.name = name || '对手'; ok = true; }
        }
      }
    } catch (e) {}
    try { appendChat(USERNAME, '（与 ' + name + ' 互动）', Date.now(), true); } catch (e) {}
    try { ws.send(JSON.stringify({ type: 'action', worldId: worldId, action: '与 ' + name + ' 互动' })); } catch (e) {}
    try { sendCombatSnapshot(); } catch (e) {}
    if (ok) {
      try {
        var _v2 = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables;
        var _npc = _v2 && _v2.NPCList && _v2.NPCList[0];
        if (_v2 && _npc) {
          if (!_npc.pronoun) _npc.pronoun = 'm';
          if (!_npc.gender) _npc.gender = 'm';
          _v2.pronoun = _npc.pronoun;
          _v2.gender = _npc.gender;
          try { setupNativeCombat(_v2, _npc); } catch (e) {}
          _v2.fightstart = 1;
        }
      } catch (e) {}
      try { ws.send(JSON.stringify({ type: 'combat_start', to: name })); } catch (e) {}
      try { VV().mpPlayerFight = 1; } catch (e) {}
      try { sendCombatSnapshot(); } catch (e) {}
      try { ws.send(JSON.stringify({ type: 'pvp_challenge', to: name })); } catch (e) {}
      showToast('已向 ' + name + ' 发起决斗');
      return;
    } else {
      showToast(' 当前场景无可用 NPC');
      setStatus('互动失败：无可用 NPC', 'err');
    }
  }

  function canCheat() {
    // 工具区（商店快捷入口 / 发放道具 / 发放装备 / 作弊 / MapleBirch 接口）唯一门槛：
    // 线上：服务器授权（管理名单，或被管理员在「作弊权限」里勾选）；
    // 线下：沿用本机记住的授权（该账号在这一台设备上被授权过才算），否则照样隐藏。
    try {
      var granted = !!serverIsAdmin || !!(USERNAME && cheatAllow && cheatAllow.indexOf(USERNAME) >= 0);
      if (granted) {
        try { if (USERNAME) localStorage.setItem('dolon_cheat_ok', USERNAME); } catch (e) {}
        return true;
      }
      var online = !!(TOKEN && ws && ws.readyState === 1);
      if (online) return false;                        // 在线已确认没权限
      try {
        var remembered = localStorage.getItem('dolon_cheat_ok');
        if (remembered && (!USERNAME || remembered === USERNAME)) return true;
      } catch (e) {}
      return false;
    } catch (e) { return false; }
  }
  function renderCheatList() {
    if (!el.cheatList) return;
    if (!worldHost) { el.cheatList.textContent = '—'; return; }
    var isAdmin = !!serverIsAdmin;   // 与服务端 grant_cheat 校验保持一致
    var names = Object.keys(worldPresences);
    var members = [];
    for (var i = 0; i < names.length; i++) { if (names[i] !== USERNAME) members.push(names[i]); }
    if (!members.length) { el.cheatList.textContent = '（暂无其他在线成员）'; return; }
    var html = '';
    for (var k = 0; k < members.length; k++) {
      var u = members[k];
      var on = cheatAllow.indexOf(u) >= 0;
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:' + (isAdmin ? '#ddd' : '#888') + ';padding:2px 0">' +
        '<input type="checkbox" data-cheat="' + esc(u) + '"' + (on ? ' checked' : '') + (isAdmin ? '' : ' disabled') + ' style="width:18px;height:18px">' + esc(u) + ' 有作弊权限</label>';
    }
    if (!isAdmin) html += '<div style="color:#e25a5a;font-size:11px;margin-top:3px"> 只有管理员「你好」可以修改</div>';
    el.cheatList.innerHTML = html;
    if (!isAdmin) return;
    var boxes = el.cheatList.querySelectorAll('input[data-cheat]');
    for (var j = 0; j < boxes.length; j++) {
      boxes[j].onchange = function () {
        var to = this.getAttribute('data-cheat');
        try { ws.send(JSON.stringify({ type: 'grant_cheat', to: to, allow: this.checked })); } catch (e) {}
      };
    }
  }
  function updateTimeBadge() {
    var b = document.getElementById('dol-time-badge');
    if (!b) return;
    var v = null;
    try { v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables; } catch (e) {}
    if (!v) { b.style.display = 'none'; return; }
    var myTs = typeof v.timeStamp === 'number' ? v.timeStamp : 0;
    var w = worldMaxTime();
    if (!w.ts || w.ts <= myTs + 60000) { b.style.display = 'none'; return; }
    var delta = w.ts - myTs;
    var mins = Math.floor(delta / 60000);
    var days = Math.floor(mins / (24 * 60));
    var hours = Math.floor((mins % (24 * 60)) / 60);
    var rem = mins % 60;
    var label = days > 0 ? (days + '天' + (hours > 0 ? hours + '时' : '')) : (hours > 0 ? (hours + '时') : (rem + '分'));
    b.textContent = '⏩' + label;
    b.style.display = 'block';
    b.onclick = function (ev) { if (ev) ev.stopPropagation(); syncToWorldTime(); };
  }
  function syncToWorldTime() {
    try {
      var v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables;
      if (!v) return;
      var w = worldMaxTime();
      if (!w.ts || w.ts <= (v.timeStamp || 0)) { setStatus('已经是最新时间', 'ok'); updateTimeBadge(); return; }
      v.timeStamp = w.ts;
      if (w.day != null) v.day = w.day;
      try { window.Time && window.Time.set(); } catch (e) {}
      try { if (window.SugarCube && window.SugarCube.Engine && window.SugarCube.State && window.SugarCube.State.passage) window.SugarCube.Engine.show(window.SugarCube.State.passage); } catch (e) {}
      setStatus(' 已同步到世界时间', 'ok');
      updateTimeBadge();
    } catch (e) {}
  }
  function setTimeSync(on) {
    timeSyncOn = !!on;
    try { localStorage.setItem('dolon_time_sync', on ? '1' : '0'); } catch (e) {}
    if (on) applyTimeSync();
    setWorldStatus(on ? '时间同步已开启' : '时间同步已关闭', 'ok');
  }
  function worldMaxTime() {
    var maxTs = 0, maxDay = null;
    try {
      var v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables;
      if (v && typeof v.timeStamp === 'number') maxTs = v.timeStamp;
      if (v && typeof v.day === 'number') maxDay = v.day;
    } catch (e) {}
    for (var u in worldPresences) {
      var p = worldPresences[u];
      if (p && typeof p.timeStamp === 'number' && p.timeStamp > maxTs) maxTs = p.timeStamp;
      if (p && typeof p.day === 'number' && (maxDay == null || p.day > maxDay)) maxDay = p.day;
    }
    return { ts: maxTs, day: maxDay };
  }
  function applyTimeSync() {
    if (!timeSyncOn) return;
    try {
      var v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables;
      if (!v) return;
      var w = worldMaxTime();
      var changed = false;
      if (w.ts && w.ts > (v.timeStamp || 0)) { v.timeStamp = w.ts; changed = true; }
      if (w.day != null && w.day > (typeof v.day === 'number' ? v.day : -1)) { v.day = w.day; changed = true; }
      if (changed) {
        try { window.Time && window.Time.set(); } catch (e) {}
        try { if (window.SugarCube && window.SugarCube.Engine && window.SugarCube.State && window.SugarCube.State.passage) window.SugarCube.Engine.show(window.SugarCube.State.passage); } catch (e) {}
      }
    } catch (e) {}
  }
  function startTimeSync() {
    stopTimeSync();
    timeSyncTimer = setInterval(function () { applyTimeSync(); updateTimeBadge(); }, 5000);
  }
  function stopTimeSync() {
    if (timeSyncTimer) { clearInterval(timeSyncTimer); timeSyncTimer = null; }
  }
  function syncWorldDay() {
    if (!TOKEN) { setWorldStatus('请先登录', 'err'); return; }
    if (!worldId) { setWorldStatus('请先加入世界', 'err'); return; }
    setWorldStatus('读取世界天数…');
    api('GET', '/api/world?worldId=' + encodeURIComponent(worldId)).then(function (r) {
      if (r && r.ok && r.world && r.world.meta && r.world.meta.day != null) {
        var day = Number(r.world.meta.day);
        if (!confirm('把游戏天数同步到世界的第 ' + day + ' 天？\n（只改天数，不覆盖你的角色）')) { setWorldStatus('已取消', 'err'); return; }
        try {
          var v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables;
          if (!v) { setWorldStatus('读不到游戏变量', 'err'); return; }
          v.day = day;
          setWorldStatus(' 已同步到第 ' + day + ' 天', 'ok');
          setTimeout(function () { try { if (window.SugarCube && window.SugarCube.Engine && window.SugarCube.State && window.SugarCube.State.passage) window.SugarCube.Engine.show(window.SugarCube.State.passage); } catch (e) {} }, 100);
        } catch (e) { setWorldStatus('同步失败：' + e.message, 'err'); }
      } else {
        setWorldStatus('世界还没有天数（先点「保存到世界」一次）', 'err');
      }
    });
  }
  function copyCharacter() {
    if (!TOKEN) { setStatus('请先登录', 'err'); return; }
    if (!worldId) { setWorldStatus('请先加入世界', 'err'); return; }
    if (!confirm('将把「主角色」复制到你的游戏（覆盖当前进度），复制后是你自己的独立副本。确定吗？')) return;
    setWorldStatus('复制中…');
    api('GET', '/api/world?worldId=' + encodeURIComponent(worldId)).then(function (r) {
      if (r && r.ok && r.world && r.world.save) {
        var ok = false;
        try { ok = deserializeGame(r.world.save); } catch (e) { ok = false; }
        if (ok) {
          worldVersion = r.world.version;
          worldLatestVersion = r.world.version;
          var day = (r.world.meta && r.world.meta.day != null) ? r.world.meta.day : '?';
          setWorldStatus(' 已复制主角色（第' + day + '天）。这是你的独立副本：想保存就点「上传当前存档」到自己的云存档。', 'ok');
        } else {
          setWorldStatus('复制失败：无法载入角色', 'err');
        }
      } else if (r && r.ok && r.world && !r.world.save) {
        setWorldStatus('世界还没有主角色，先让房主点「保存到世界」上传', 'err');
      } else {
        setWorldStatus((r && r.error) || '复制失败', 'err');
      }
    });
  }
  function saveWorld() {
    if (!TOKEN) { setStatus('请先登录', 'err'); return; }
    if (!worldId) { setWorldStatus('请先加入世界', 'err'); return; }
    if (worldHost && USERNAME !== worldHost) {
      setWorldStatus('只有世界主机「' + worldHost + '」能保存这个世界；你的进度已存在个人存档里', 'err');
      return;
    }
    var save;
    try { save = serializeGame(); } catch (e) { save = null; }
    if (!save) { setWorldStatus('无法读取当前存档', 'err'); return; }
    setWorldStatus('保存中…');
    api('POST', '/api/world/save', { worldId: worldId, save: save, baseVersion: worldVersion, meta: getMeta() }).then(function (r) {
      if (r && r.ok) {
        worldVersion = r.version;
        worldLatestVersion = r.version;
        setWorldStatus('已保存到世界 v' + worldVersion, 'ok');
      } else if (r && r.conflict) {
        setWorldStatus('冲突：' + r.error, 'err');
      } else {
        setWorldStatus((r && r.error) || '保存失败', 'err');
      }
    });
  }

  function start() {
    if (!document.body || !window.SugarCube || !window.SugarCube.State) {
      setTimeout(start, 200);
      return;
    }
    buildUI();
    hookActionClicks();
    tryHookFramework();
    try { hookMultiCanvas(); } catch (e) {}
    document.addEventListener('click', function (ev) {
      try {
        var t = ev.target;
        var a = (t && t.closest) ? t.closest('#next a') : null;
        if (a) sendCombatTurn();
      } catch (e) {}
    }, true);
    setInterval(function () {
      try {
        var _vf = VV();
        if (_vf && Number(_vf.mpPlayerFight) === 1) {
          var _psg = (window.SugarCube && window.SugarCube.State && window.SugarCube.State.passage) || '';
          if (_psg !== 'DoLOnlineCombat') _vf.mpPlayerFight = 0;
        }
        if (_vf && _vf.combat === 1 && Number(_vf.mpPlayerFight) === 1 && Number(_vf.enemyanger) > 40) _vf.enemyanger = 40;
      } catch (e) {}
      try {
        var _vbg = VV();
        var _nowCombat = (_vbg && _vbg.combat === 1) ? 1 : 0;
        if (dolLastCombat === 1 && _nowCombat === 0 && combatPeerName) {
          try {
            var _win = Number(_vbg.enemyhealth) <= 0;
            var _line = _win ? (' 你击败了 ' + combatPeerName + '！') : (' 你被 ' + combatPeerName + ' 击败了…');
            showToast(_line);
            setStatus(_line, 'ok');
            try { ws.send(JSON.stringify({ type: 'combat_end', to: combatPeerName, win: _win })); } catch (e) {}
          } catch (e) {}
          combatPeerName = '';
        }
        dolLastCombat = _nowCombat;
      } catch (e) {}
      try { hookMultiCanvas(); } catch (e) {}
      try {
        if (VV().combat === 1) {
          sendCombatSnapshot();
          enhanceNativeCombat();
          try { var _vc = VV(); if (Number(_vc.enemyanger) > 40) _vc.enemyanger = 40; } catch (e) {}
        }
      } catch (e) {}
    }, 500);
    setTimeout(function () { try { loadServerIcon(); } catch (e) {} }, 1500);
    setTimeout(function () { try { loadLatestVersion(); } catch (e) {} }, 2000);
    setTimeout(function () { try { renderExpBar(); } catch (e) {} }, 1200);
    setInterval(function () { try { if (TOKEN && ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'cp_list' })); } catch (e) {} }, 10000);
    setTimeout(function () { try { fixPanelZoom(); } catch (e) {} }, 800);
    setInterval(function () { try { fixPanelZoom(); } catch (e) {} }, 2000);
    setInterval(function () { try { if (panelOpen()) renderEquip(); } catch (e) {} }, 1000);
    setInterval(function () { try { if (panelOpen()) renderBag(); } catch (e) {} }, 1000);
    setInterval(function () { try { if (panelOpen()) renderAchs(); } catch (e) {} }, 3000);
    setInterval(function () { try { dgRender(); } catch (e) {} }, 1000);
    window.dolDungeonEnter = dgEnter;
    setInterval(function () { try { if (panelOpen()) renderMonster(); } catch (e) {} }, 1000);
    setInterval(function () { try { applyPainReduce(); } catch (e) {} }, 500);
    setInterval(function () { try { if (TOKEN && ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'friend_list' })); } catch (e) {} }, 8000);
    setInterval(function () {
      try {
        if (!TOKEN || !ws || ws.readyState !== 1) return;
        api('GET', '/api/me').then(function (r) {
          if (r && typeof r.admin === 'boolean' && r.admin !== serverIsAdmin) {
            serverIsAdmin = r.admin;
            try { refreshAdminUI(); } catch (e) {}
          }
        });
      } catch (e) {}
    }, 30000);
    setInterval(function () { try { if (panelOpen()) renderExpBar(); } catch (e) {} }, 500);
    setInterval(function () { try { if (panelOpen()) renderCatBalance(); } catch (e) {} }, 1500);
    setInterval(function () { try { if (panelOpen()) renderQuests(); } catch (e) {} }, 2500);
    setInterval(function () { try { if (panelOpen()) renderParty(); } catch (e) {} }, 3000);
    setInterval(function () { try { syncNativeCombat(); } catch (e) {} }, 2000);
    setInterval(function () { try { renderSelfCombatHud(); } catch (e) {} }, 1200);
    setInterval(function () { try { if (panelOpen()) renderCodex(); } catch (e) {} }, 3000);
    setInterval(function () { try { checkNativeFeats(); } catch (e) {} }, 8000);
    setInterval(function () { try { trackMaxFloor(); } catch (e) {} }, 3000);
    try { bindMapHotspots(); } catch (e) {}
    setInterval(function () { try { installTownMapInPlace(); } catch (e) {} }, 900);
    // 丰收街入口兜底：页面事件没触发时也保证插上
    setInterval(function () {
      try {
        var st = window.SugarCube && window.SugarCube.State;
        if (st && st.passage === 'Harvest Street') ensureDgEntry(true);
      } catch (e) {}
    }, 2500);
    setTimeout(function () { try { window.dolEnsureFeats(); checkNativeFeats(); } catch (e) {} }, 2500);
    setInterval(function () {
      try {
        var ml = document.getElementById('dol-mat-line'); if (ml) ml.textContent = matLine();
        if (panelOpen()) { renderDaily(); renderSmith(); renderPet(); renderStatusLine(); renderClass(); renderNpc(); renderMbInfo(); renderDungeonLock(); }
      } catch (e) {}
    }, 3000);
    setInterval(function () {
      try {
        var box = document.getElementById('dol-dg-grid-box');
        var src = document.getElementById('dol-dg');
        if (box && src && src.innerHTML) box.innerHTML = src.innerHTML;
      } catch (e) {}
    }, 2000);
    setInterval(function () { try { if (ws && ws.readyState === 1 && TOKEN) ws.send(JSON.stringify({ type: 'party_state_query' })); } catch (e) {} }, 5000);
    setInterval(function () {
      try { if (ws && ws.readyState === 1 && TOKEN) ws.send(JSON.stringify({ type: 'world_boss_state' })); } catch (e) {}
    }, 20000);
    setTimeout(function () { try { loadServerStats(); } catch (e) {} }, 2500);
  }
  start();
})();
