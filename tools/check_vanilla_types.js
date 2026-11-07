/* check_vanilla_types.js —— 数字档位声明 vs 原版实际存储形态
   背景（v2.0.3）：`prison.protection` 在面板里被声明成数字 0-10 档位，但原版 0.5.12.13 里它是
   枚举字符串（`<<set $prison.protection to "scarred">>` + `<<if $prison.protection is "scarred">>`）。
   SugarCube 的 `is` 等价 `===`，面板写数字 → 两个 is 判定全部落空、`!$prison.protection` 又因数字为真值而不成立，
   表现为「面板显示写入成功、游戏侧静默半失效」。这类错配 audit / resolve_missing / check_key_types 都抓不到：
   前两个只查键在不在，第三个只扫模组源码里的 0/1 布尔形态。
   本工具补这一维：把「场景 → 地点」页 PLACE_GROUPS 的数字档位声明，逐条拿到原版 HTML 里比对赋值形态。

   判据（只认显式证据，宁缺勿滥）：
     · 锚定字符串赋值：`<<set $<path> to "…">>`（含 += 之外的直写）
     · 锚定数字赋值：  `<<set $<path> to <数字>`
     · 锚定严格判定：  `<<if $<path> is "…">>`
     CONFLICT = 有字符串赋值（或 is "…" 判定）且**零数字赋值** → 声明数字档位必然半失效

   用法：
     node tools/check_vanilla_types.js            默认读消费端 game 目录
     node tools/check_vanilla_types.js <html>     指定原版 HTML
     node tools/check_vanilla_types.js --list      只打印已解析的声明
   环境变量：MCE_DOL_HTML（原版 HTML 全路径，优先） / MCE_DOL_PROJECT（消费端目录）
   退出码：0 无冲突（含 HTML 缺失 SKIP）；1 有 CONFLICT
*/
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "javascript", "src", "07d-places.js");
const DEFAULT_PROJECT = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project";

function resolveHtml(argv) {
	const direct = argv.find((a) => /\.html?$/i.test(a));
	if (direct) return direct;
	if (process.env.MCE_DOL_HTML) return process.env.MCE_DOL_HTML;
	const proj = process.env.MCE_DOL_PROJECT || DEFAULT_PROJECT;
	return path.join(proj, "game", "Degrees of Lewdity.html");
}

function parseDecls() {
	const text = fs.readFileSync(SRC, "utf8");
	const out = [];
	const re = /\{\s*key:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*path:\s*"([^"]+)",\s*max:\s*([\d.]+)/g;
	let m;
	while ((m = re.exec(text))) {
		out.push({ key: m[1], name: m[2], path: m[3], max: Number(m[4]) });
	}
	return out;
}

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
	const argv = process.argv.slice(2);
	let decls = parseDecls();
	if (argv.includes("--list")) {
		console.log("已解析数字档位声明 " + decls.length + " 条：");
		for (const d of decls) console.log("  " + d.key + "  $" + d.path + "  max=" + d.max + "  （" + d.name + "）");
		return 0;
	}
	/* --probe <path>：把任意键按同一规则单独核对（排障与负向验证用，例如
	   `--probe prison.protection` 应报 CONFLICT —— 证明规则确实能抓出「声明数字、实为字符串」） */
	const pi = argv.indexOf("--probe");
	const probeMode = pi !== -1 && argv[pi + 1] ? String(argv[pi + 1]) : null;
	if (probeMode) {
		decls = [{ key: "probe", name: "probe 单键核对", path: probeMode.replace(/^\$/, ""), max: NaN }];
	}
	const html = resolveHtml(argv);
	if (!fs.existsSync(html)) {
		console.log("SKIP 原版 HTML 不存在：" + html);
		console.log("（设置 MCE_DOL_HTML 或传参后重跑；缺失时本检查不参与判定）");
		return 0;
	}
	const raw = fs.readFileSync(html, "utf8");
	const lines = raw.split("\n");
	console.log("原版：" + html + "（" + lines.length + " 行）");
	console.log("声明：" + decls.length + " 条数字档位（07d-places.js PLACE_GROUPS）\n");

	const conflicts = [];
	const noEvidence = [];
	for (const d of decls) {
		const pre = "\\$" + escapeRe(d.path);
		/* 引号在 tw-passagedata 里可能是原生 " 或 HTML 实体 &quot;，两种都认 */
		const q = "(\"|&quot;)";
		const reStrSet = new RegExp(pre + "\\s+to\\s+" + q);
		const reNumSet = new RegExp(pre + "\\s+to\\s+-?\\d");
		const reIsStr = new RegExp(pre + "\\s+is\\s+" + q);
		let strSet = 0, numSet = 0, isStr = 0;
		const evStr = [], evNum = [];
		for (let i = 0; i < lines.length; i++) {
			const l = lines[i];
			if (l.indexOf("$" + d.path) === -1) continue;
			if (reStrSet.test(l)) { strSet++; if (evStr.length < 3) evStr.push(i + 1); }
			if (reNumSet.test(l)) { numSet++; if (evNum.length < 3) evNum.push(i + 1); }
			if (reIsStr.test(l)) { isStr++; if (evStr.length < 3 && evStr.indexOf(i + 1) === -1) evStr.push(i + 1); }
		}
		if (probeMode) {
			console.log("[probe] $" + d.path + "  字符串赋值=" + strSet + "  数字赋值=" + numSet + "  is字符串判定=" + isStr);
			console.log("        字符串/is 证据行：" + (evStr.length ? evStr.join(", ") : "（无）"));
			console.log("        数字赋值证据行：" + (evNum.length ? evNum.join(", ") : "（无）"));
		}
		/* 判据：出现 `is "…"` 严格字符串判定 → 写数字必然不匹配（SugarCube 的 is 等价 ===），必冲突；
		   否则「有字符串赋值且零数字赋值」→ 原版纯字符串语义，声明数字档位同样必然落空。 */
		if ((isStr > 0 && strSet > 0) || (strSet > 0 && numSet === 0)) {
			conflicts.push({ d, strSet, isStr, numSet, ev: evStr.slice(0, 3), evNum: evNum.slice(0, 3) });
		} else if (strSet === 0 && isStr === 0 && numSet === 0) {
			noEvidence.push(d);
		}
	}

	if (conflicts.length) {
		console.log("[CONFLICT 声明数字档位，但原版只有字符串形态 —— 面板写入会静默半失效]");
		for (const c of conflicts) {
			console.log("  " + c.d.key + "  $" + c.d.path + "  max=" + c.d.max);
			console.log("      字符串 / is 判定命中行：" + c.ev.map((n) => String(n)).join(", ") + "（字符串赋值 " + c.strSet + " / is 判定 " + c.isStr + " / 数字赋值 " + c.numSet + (c.evNum.length ? "，数字行 " + c.evNum.map((n) => String(n)).join(",") : "") + "）");
			console.log("      → 应改为枚举控件直写字符串，或从该页移除（参见 07i-yanling.js 监狱庇护组的处理）");
		}
		console.log("");
	}
	console.log("汇总：" + decls.length + " 条声明，CONFLICT " + conflicts.length + " / NO_EVIDENCE " + noEvidence.length);
	if (noEvidence.length) {
		console.log("NO_EVIDENCE（原版无该键的显式赋值，无法判定；保守放行）：");
		console.log("  " + noEvidence.map((d) => d.key + "($" + d.path + ")").join(", "));
	}
	return conflicts.length ? 1 : 0;
}

process.exit(main());
