import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export interface DrawContext {
  globalAlpha: number;
  strokeStyle: string | object;
  fillStyle: string | object;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  beginPath(): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void;
  closePath(): void;
  fill(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  lineTo(x: number, y: number): void;
  moveTo(x: number, y: number): void;
  stroke(): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
}

export interface Statement {
  key: unknown;
  priority: number;
  fn: (ctx: DrawContext) => void;
}

export class Drawable implements ISerializable {
  @wireType('i32')
  zIndex = 0;
  _statements: Statement[] = [];
  _sortedFns: ((ctx: DrawContext) => void)[] | undefined = undefined;

  serialize(): Record<string, unknown> {
    return { zIndex: this.zIndex };
  }

  addStatement(
    key: unknown,
    priority: number,
    fn: (ctx: DrawContext) => void,
  ): void {
    this._statements = this._statements.filter((s) => s.key !== key);
    this._statements.push({ key, priority, fn });
    this._sortedFns = undefined;
  }

  removeStatement(key: unknown): void {
    const before = this._statements.length;
    this._statements = this._statements.filter((s) => s.key !== key);
    if (this._statements.length !== before) this._sortedFns = undefined;
  }

  draw(ctx: DrawContext): void {
    if (!this._sortedFns) {
      this._sortedFns = [...this._statements]
        .sort((a, b) => b.priority - a.priority)
        .map((s) => s.fn);
    }
    for (const fn of this._sortedFns) {
      fn(ctx);
    }
  }
}
