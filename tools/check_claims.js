/* check_claims.js —— 声明结构自洽性核查（自动判定，低噪声）
   查 5 类能直接判定的缺陷：
     D1 跨适配器 varPath 重复        两个模组写同一状态键 → 双写互相覆盖
     D2 同适配器 varPath 重复        面板出现两项、写入同一路径
     D3 同适配器 key 重复            React/DOM 列表键冲突、留痕记录互相覆盖
     D4 levels/labels 数量不一致     阶段选择渲染错位（选到 A 标签写 B 值）
     D5 min/max 反向或非数字        写入被钳到错误区间
   用法：node tools/check_claims.js [--json]
   退出码：有 D1~D5 命中则 1
*/
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "javascript", "src");

function blockOf(text, pos) {
	let depth = 0;
	let start = -1;
	for (let i = pos; i >= 0; i--) {
		const c = text[i];
		if (c === "}") depth++;
		else if (c === "{") {
			if (depth === 0) { start = i; break; }
			depth--;
		}
		if (pos - i > 900) break;
	}
	if (start < 0) return null;
	let d = 0;
	for (let j = start; j < text.length && j - start < 1600; j++) {
		const c = text[j];
		if (c === "{") d++;
		else if (c === "}") {
			d--;
			if (d === 0) return text.slice(start, j + 1);
		}
	}
	return null;
}

function parseItems() {
	const items = [];
	for (const f of fs.readdirSync(SRC_DIR)) {
		if (!/^04a-.*\.js$/.test(f)) continue;
		const text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
		const re = /varPath\s*:\s*"([^"]+)"/g;
		let m;
		while ((m = re.exec(text))) {
			const block = blockOf(text, m.index);
			if (!block) continue;
			const head = text.slice(0, m.index);
			const all = [...head.matchAll(/CHEAT_ADAPTERS\[\s*"([^"]+)"\s*\]/g)];
			const adapter = all.length ? all[all.length - 1][1] : null;
			const lineNo = text.slice(0, m.index).split("\n").length;
			const keyM = block.match(/key\s*:\s*"([^"]+)"/);
			const levM = block.match(/levels\s*:\s*\[([\s\S]*?)\]/);
			const labM = block.match(/labels\s*:\s*\[([\s\S]*?)\]/);
			const minM = block.match(/min\s*:\s*(-?\d+(?:\.\d+)?)/);
			const maxM = block.match(/max\s*:\s*(-?\d+(?:\.\d+)?)/);
			const countTop = (s) => {
				let n = 0, depth = 0, inStr = false, q = "";
				for (let i = 0; i < s.length; i++) {
					const c = s[i];
					if (inStr) { if (c === q && s[i - 1] !== "\\") inStr = false; continue; }
					if (c === '"' || c === "'") { inStr = true; q = c; continue; }
					if (c === "[" || c === "(" || c === "{") depth++;
					else if (c === "]" || c === ")" || c === "}") depth--;
					else if (c === "," && depth === 0) n++;
				}
				return s.trim() ? n + 1 : 0;
			};
			items.push({
				file: f, line: lineNo, adapter,
				key: keyM ? keyM[1] : null,
				varPath: m[1],
				levels: levM ? countTop(levM[1]) : null,
				labels: labM ? countTop(labM[1]) : null,
				levelsRaw: levM ? levM[1].trim().slice(0, 60) : null,
				min: minM ? Number(minM[1]) : null,
				max: maxM ? Number(maxM[1]) : null,
			});
		}
	}
	return items;
}

function main() {
	const asJson = process.argv.includes("--json");
	const items = parseItems();
	const hits = { D1: [], D2: [], D3: [], D4: [], D5: [] };

	/* 已取证的白名单共享键：多个适配器按「单项增删」操作同一数组（cheatWriteListValue，
	   05-modcheat-ui.js:444 逐项 checkbox），不整体覆盖；留痕键形如 cheat:<modId>:<key> 各自独立，
	   互不覆盖。新增条目必须先取证写入语义，不能因为「不报了」就加。 */
	const SHARED_OK = new Set(["loveInterestList"]);

	const byVp = new Map();
	const byKey = new Map();
	for (const it of items) {
		if (!it.adapter) continue;
		const vk = it.varPath;
		if (!byVp.has(vk)) byVp.set(vk, []);
		byVp.get(vk).push(it);
		const kk = it.adapter + "|" + it.key;
		if (!byKey.has(kk)) byKey.set(kk, []);
		byKey.get(kk).push(it);
		if (it.levels != null && it.labels != null && it.levels !== it.labels) {
			hits.D4.push(it.adapter + " | " + it.varPath + "  levels=" + it.levels + " labels=" + it.labels + "  " + it.file + ":" + it.line);
		}
		if (it.min != null && it.max != null && it.min > it.max) {
			hits.D5.push(it.adapter + " | " + it.varPath + "  min=" + it.min + " max=" + it.max + "  " + it.file + ":" + it.line);
		}
	}
	for (const [vp, list] of byVp) {
		if (SHARED_OK.has(vp)) continue;
		const adapters = [...new Set(list.map((x) => x.adapter))];
		if (adapters.length > 1) {
			hits.D1.push(vp + "  ← " + adapters.join(" / ") + "   " + list.map((x) => x.file + ":" + x.line).join(", "));
		} else if (list.length > 1) {
			hits.D2.push(adapters[0] + " | " + vp + "  声明 " + list.length + " 次   " + list.map((x) => x.file + ":" + x.line).join(", "));
		}
	}
	for (const [kk, list] of byKey) {
		if (list.length > 1) hits.D3.push(kk + "  声明 " + list.length + " 次   " + list.map((x) => x.file + ":" + x.line).join(", "));
	}

	const total = hits.D1.length + hits.D2.length + hits.D3.length + hits.D4.length + hits.D5.length;
	if (asJson) {
		console.log(JSON.stringify({ total, items: items.length, hits }, null, 1));
	} else {
		console.log("声明结构自洽性：检查 " + items.length + " 条，命中 " + total + " 项");
		for (const k of ["D1", "D2", "D3", "D4", "D5"]) {
			/* 只剩 key 不带 key 字段的项（无 key 的 varPath）集中在 D2，属正常结构，不单独报 */
			if (!hits[k].length) continue;
			const titles = { D1: "D1 跨适配器同一 varPath", D2: "D2 同适配器同一 varPath 重复", D3: "D3 同适配器 key 重复", D4: "D4 levels/labels 数量不一致", D5: "D5 min>max" };
			console.log("\n[" + titles[k] + "] " + hits[k].length);
			for (const h of hits[k].slice(0, 20)) console.log("  " + h);
		}
	}
	process.exit(total ? 1 : 0);
}

main();
