/* ============ v1.9.13 拆分：Mod 作弊适配器声明（CHEAT_ADAPTERS 注册表容器） ============
   原 04a-modcheat-adapters.js（80KB）按模组拆分为本文件（注册表声明）+ 04a-01..09-*.js（各模组块）。
   构建 tools/build_js.js 按文件名 sort() 拼接：04a-00-core.js 排最前，先执行 var CHEAT_ADAPTERS = {}，
   各块文件随后执行 CHEAT_ADAPTERS["modId"] = {...} 赋值。
   工具脚本（check_mod_updates / audit_adapters / resolve_missing）已改读目录下全部 04a-*.js 拼接解析。 */
var CHEAT_ADAPTERS = {};
