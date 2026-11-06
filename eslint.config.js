/* MapleBirchCE ESLint 配置（flat config，eslint 10.x）
 *
 * 定位：只做「确定性错误」检查，不做风格检查。
 * 源码共 34 个分片、1,412 处 var、跨文件全局共享（浏览器 IIFE 拼接后同一作用域），
 * 因此不启用 no-undef 等跨文件依赖规则，也不启用任何格式类规则；
 * 规则集只覆盖「拼错/写重/写不到」这三类 vacuous 正确性错误。
 *
 * 四条规则（2026-11-06 定案）：
 *   1. no-dupe-keys    —— 对象字面量重复键：后者静默覆盖前者，CE 面板数据表最容易踩
 *   2. no-unreachable  —— return/throw 之后的死代码：通常是分支写错或漏删旧实现
 *   3. no-func-assign  —— 函数声明被重新赋值：声明提升期赋值，实际调用可能失效
 *   4. eqeqeq          —— 松散相等：已实测 11 处中 9 处是 `== null` 惯用法（合法），
 *                        故用 { null: "ignore" } 放行 null 比较，只拦其余松散比较
 *
 * 跑法：npm run lint（即 npx eslint javascript/maplebirchce.js）
 *
 * 检查对象是 build 产物而非 src 分片：src 是 34 段「不完整片段」（00-preamble.js 的开括号
 * 与 09-exports.js 的闭括号分处两个文件），单文件解析必然 Parsing error，无法逐片 lint。
 * 产物是拼接后的完整脚本，与运行时真正执行的代码一致；命中行号可直接按段注释定位回 src。
 * 该检查已并入 tools/run_all.ps1 的第 2.5 步（与 node --check 同层，放在 build 之后）。
 */
module.exports = [
  {
    files: ["javascript/maplebirchce.js"],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "script"
    },
    rules: {
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-func-assign": "error",
      "eqeqeq": ["error", "always", { "null": "ignore" }]
    }
  }
];
