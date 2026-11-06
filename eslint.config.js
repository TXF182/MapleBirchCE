/* MapleBirchCE ESLint 配置（flat config，eslint 10.x）
 *
 * 定位：只做「确定性错误」检查，不做风格检查。
 * 源码共 41 个分片、1,412 处 var、跨文件全局共享（浏览器 IIFE 拼接后同一作用域），
 * 因此不启用 no-undef 等跨文件依赖规则，也不启用任何格式类规则；
 * 规则集只覆盖「拼错/写重/写不到」这三类 vacuous 正确性错误。
 *
 * 八条规则（2026-11-06 定案 + 同日扩展）：
 *   1. no-dupe-keys    —— 对象字面量重复键：后者静默覆盖前者，CE 面板数据表最容易踩
 *   2. no-unreachable  —— return/throw 之后的死代码：通常是分支写错或漏删旧实现
 *   3. no-func-assign  —— 函数声明被重新赋值：声明提升期赋值，实际调用可能失效
 *   4. eqeqeq          —— 松散相等：已实测 11 处中 9 处是 `== null` 惯用法（合法），
 *                        故用 { null: "ignore" } 放行 null 比较，只拦其余松散比较
 *   5. no-self-assign  —— 自赋值 `x = x`：通常改错了目标变量，静默无效果
 *   6. no-constant-condition —— 恒定条件分支；checkLoops:false 放行 while(true)
 *   7. no-unsafe-negation —— `!a instanceof b` 优先级误用，语义与作者意图相反
 *   8. no-fallthrough  —— switch 漏写 break，会让后一个 case 的写入也执行
 *
 * 生效性验证（防「配置 files 不匹配导致零规则静默通过」）：
 *   'var a = 1; a = a;' | eslint --stdin --stdin-filename javascript/maplebirchce.js
 *   → 实测报 no-self-assign + no-fallthrough，exit 1，证明规则真的在跑。
 *
 * 跑法：npm run lint（即 npx eslint javascript/maplebirchce.js）
 *
 * 检查对象是 build 产物而非 src 分片：src 是 41 段「不完整片段」（00-preamble.js 的开括号
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
      "eqeqeq": ["error", "always", { "null": "ignore" }],
      /* 2026-11-06 扩展（同为「确定性错误」类，不含风格规则）：
         5. no-self-assign       —— 自赋值 `x = x`：通常是改错了目标变量，静默无效果
         6. no-constant-condition —— 恒定条件分支；放行循环（while(true) 是项目里的合法写法）
         7. no-unsafe-negation   —— `!a instanceof b` 这类优先级误用，语义与作者意图相反
         8. no-fallthrough       —— switch 贯穿：漏写 break 会让后一个 case 的写入也执行 */
      "no-self-assign": "error",
      "no-constant-condition": ["error", { "checkLoops": false }],
      "no-unsafe-negation": "error",
      "no-fallthrough": "error"
    }
  }
];
