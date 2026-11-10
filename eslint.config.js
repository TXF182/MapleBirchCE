/* MapleBirchCE ESLint 配置（flat config，eslint 10.x）
 *
 * 定位：只做「确定性错误」检查，不做风格检查。
 * 源码共 73 个分片、跨文件全局共享（浏览器 IIFE 拼接后同一作用域），
 * 因此宿主导出的标识符（SugarCube / DoL / jQuery）必须以 globals 显式声明，
 * 否则 no-undef 会把「宿主提供的全局」误报成未定义（实测 363 条全部属此类）。
 *
 * 十条规则（2026-11-06 定案 → 同日扩展到八条 → 2026-11-09 加 no-redeclare / no-undef）：
 *   1. no-dupe-keys    —— 对象字面量重复键：后者静默覆盖前者，CE 面板数据表最容易踩
 *   2. no-unreachable  —— return/throw 之后的死代码：通常是分支写错或漏删旧实现
 *   3. no-func-assign  —— 函数声明被重新赋值：声明提升期赋值，实际调用可能失效
 *   4. eqeqeq          —— 松散相等：已实测 11 处中 9 处是 `== null` 惯用法（合法），
 *                        故用 { null: "ignore" } 放行 null 比较，只拦其余松散比较
 *   5. no-self-assign  —— 自赋值 `x = x`：通常改错了目标变量，静默无效果
 *   6. no-constant-condition —— 恒定条件分支；checkLoops:false 放行 while(true)
 *   7. no-unsafe-negation —— `!a instanceof b` 优先级误用，语义与作者意图相反
 *   8. no-fallthrough  —— switch 漏写 break，会让后一个 case 的写入也执行
 *   9. no-redeclare    —— 同作用域重复 var/func 声明：var 无块作用域，分支内再 var 会复用
 *                        外层变量，改动一处影响另一处（实测存量 2 处，已修）
 *  10. no-undef        —— 未声明标识符：拼错变量名 / 漏声明，运行期才 TypeError。
 *                        宿主导出必须先声明在 globals 里，否则规则不可用（见下）
 *
 * globals 的来源与依据（2026-11-09 实测逐条核对）：
 *   - window / document / localStorage / navigator / setInterval / clearInterval /
 *     setTimeout / clearTimeout / CSS —— 浏览器标准宿主
 *   - State / V / setup / Story / SugarCube / Engine / Wikifier / passage / Time / clone /
 *     T —— SugarCube 2 与 DoL 的引擎全局（State.passage / State.variables / setup 注册池）
 *   - $ —— SugarCube 内置 jQuery 别名（panel 里 `$("#id")` 用得最多）
 *   - C —— DoL 颜色常量表（`C.red` 之类）
 *   - Engine —— SugarCube.Engine（`Engine.play`）
 *   - gwylanStatusCheck / npcIsPregnant / playerIsPregnant —— DoL 原版剧情脚本导出的全局函数
 *
 * 生效性验证（防「配置 files 不匹配导致零规则静默通过」）：
 *   'var a = 1; a = a;' | eslint --stdin --stdin-filename javascript/maplebirchce.js
 *   → 实测报 no-self-assign + no-fallthrough，exit 1，证明规则真的在跑。
 *
 * 跑法：npm run lint（即 npx eslint javascript/maplebirchce.js）
 *
 * 检查对象是 build 产物而非 src 分片：src 是 73 段「不完整片段」（00-preamble.js 的开括号
 * 与 09-exports.js 的闭括号分处两个文件），单文件解析必然 Parsing error，无法逐片 lint。
 * 产物是拼接后的完整脚本，与运行时真正执行的代码一致；命中行号可直接按段注释定位回 src。
 * 该检查已并入 tools/run_all.ps1 的第 2.5 步（与 node --check 同层，放在 build 之后）。
 */
module.exports = [
  {
    files: ["javascript/maplebirchce.js"],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "script",
      globals: {
        /* 浏览器宿主 */
        "window": "readonly",
        "document": "readonly",
        "localStorage": "readonly",
        "navigator": "readonly",
        "setInterval": "readonly",
        "clearInterval": "readonly",
        "setTimeout": "readonly",
        "clearTimeout": "readonly",
        "CSS": "readonly",
        /* SugarCube / DoL 引擎全局 */
        "State": "readonly",
        "V": "readonly",
        "setup": "readonly",
        "Story": "readonly",
        "SugarCube": "readonly",
        "Engine": "readonly",
        "Wikifier": "readonly",
        "passage": "readonly",
        "Time": "readonly",
        "DateTime": "readonly", /* SugarCube 日期构造器（Time.timeTravel 的入参类型，v2.0.15 节日时间通道用到） */
        "clone": "readonly",
        "T": "readonly",
        "$": "readonly",
        "C": "readonly",
        /* DoL 原版剧情脚本导出的全局函数 */
        "gwylanStatusCheck": "readonly",
        "npcIsPregnant": "readonly",
        "playerIsPregnant": "readonly"
      }
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
      "no-fallthrough": "error",
      /* 2026-11-09 扩展（关掉「同一作用域写重 / 写了个不存在的名字」这两类静默错误）：
         9. no-redeclare —— 重复声明；实测存量 2 处已在本次改动中修掉，之后应为 0
        10. no-undef    —— 未声明标识符；宿主导出全部在上方 globals 里声明，之后应为 0 */
      "no-redeclare": "error",
      "no-undef": "error"
    }
  }
];
