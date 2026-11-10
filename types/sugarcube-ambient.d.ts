/* 职责：为拼接产物在 SugarCube / DoL 运行时才注入的全局提供类型声明。
 * 本文件不参与打包（build_js.js 只读 javascript/src），仅供 tsc --noEmit 使用。
 * 依据：产物内对 T / C 的引用都包在 typeof 守卫里（maplebirchce.js:536 / :11708），
 *       属于引擎侧可选全局，因此声明为 any，而不是删除引用。 */
declare const V: any;
declare const State: any;
declare const setup: any;
declare const Story: any;
declare const Engine: any;
declare const Time: any;
declare const DateTime: any; /* SugarCube 的日期构造器：Time.timeTravel(new DateTime(y, m, d, h, min)) 的入参类型（v2.0.15 节日时间通道） */
declare const SugarCube: any;
declare const Wikifier: any;
declare const T: any;
declare const C: any;
declare const $: any;
declare function clone<T = any>(value: T): T;
declare function passage(name?: string): any;
declare function variables(): Record<string, any>;
declare function gwylanStatusCheck(...args: any[]): any;
declare function npcIsPregnant(...args: any[]): any;
declare function playerIsPregnant(...args: any[]): any;

/* SugarCube 给 Math 打了 clamp 补丁（引擎在 story 前置脚本里注入）：
   v2.0.17 $gwylan.lureDistance 兜底照抄原版 Widgets Forest 的 Math.clamp($forest, 15, 100)。
   源码侧仍包 typeof 守卫（沙箱/纯 node 测试里没有该补丁），此处只做类型补声明。 */
interface Math {
  clamp(value: number, min: number, max: number): number;
}

interface Window {
  maplebirch?: any;
  SugarCube?: any;
  modDataValueZipList?: any;
  modDataZipList?: any;
  [key: string]: any;
}
