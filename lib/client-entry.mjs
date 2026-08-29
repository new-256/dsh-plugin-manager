/**
 * @file client-entry.mjs
 * @description 组合树里 name: dsh-plugin-manager 裸名行的宿主半边入口 —— 空操作占位。
 * 真正的宿主逻辑在 cordis.patch.yml 的 file:// 行。
 *
 * 为什么必须存在：
 * 宿主侧 client-modules 只扫描「裸包名」行（require.resolve(name/package.json) 必须命中）
 * 才能发现 package.json 的 dsh.client 声明，把 client.js 纳入浏览器花名册。
 * package.json 的 main/exports["."] 指向本占位而非 lib/index.mjs，防止同插件被
 * 两个行名加载两份实例。
 */
export const name = 'dsh-plugin-manager-client';

export function apply() {}
