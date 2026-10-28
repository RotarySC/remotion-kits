/**
 * **缓动** —— 机位与分镜共用一份，别各写一套（同一段运动在两处的曲线必须一致）。
 *
 * 抽出来是因为 `shots.ts` 要用 `cameras.ts` 的缓动，而 `cameras.ts` 又要用 `shots.ts`
 * 的解析 —— 两个文件互相 import 就成了环。缓动本身与机位、与分镜都无关，单独放最干净。
 */

export type Ease = 'linear' | 'in' | 'out' | 'inout';

export function ease(name: Ease | undefined): (x: number) => number {
  switch (name) {
    case 'linear':
      return (x) => x;
    case 'in':
      return (x) => x * x;
    case 'out':
      return (x) => 1 - (1 - x) * (1 - x);
    case 'inout':
    default:
      return (x) => x * x * (3 - 2 * x); // smoothstep
  }
}
