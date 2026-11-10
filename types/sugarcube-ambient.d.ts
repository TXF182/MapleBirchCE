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

interface Window {
  maplebirch?: any;
  SugarCube?: any;
  modDataValueZipList?: any;
  modDataZipList?: any;
  [key: string]: any;
}
