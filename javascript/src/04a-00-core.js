/* ============ v1.9.13 拆分：Mod 作弊适配器声明（CHEAT_ADAPTERS 注册表容器） ============
   原 04a-modcheat-adapters.js（80KB）按模组拆分为本文件（注册表声明）+ 04a-01..11-*.js（各模组块）。
   构建 tools/build_js.js 按文件名 sort() 拼接：04a-00-core.js 排最前，先执行 var CHEAT_ADAPTERS = {}，
   各块文件随后按各自模组 id 执行 CHEAT_ADAPTERS 注册赋值（统一为 变量 + 方括号字符串键 + 等号 + 花括号 的形态）。
   注意：本注释内不得出现该形态的任何字面示例——tools/gen_key_registry.js 的正则不区分代码与注释，
   会把示例当成一个真实适配器块并产出空条目（历史 bug：曾多出 "modId": [] 假键）。
   工具脚本（check_mod_updates / audit_adapters / resolve_missing）已改读目录下全部 04a-*.js 拼接解析。 */
/** @type {Record<string, any>} 注册表容器：modId -> { detect, entry }；各 04a-XX-*.js 块随后赋值 */
var CHEAT_ADAPTERS = {};
