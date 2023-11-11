import { CodePoint } from "./code-point";

type Position = {
  offset: number;
  line: number;
  column: number;
};

export class CodePointIterator {
  public readonly text: string;

  private lastCodePoint: number = CodePoint.NULL;

  public start: Position = {
    offset: -1,
    line: 1,
    column: -1,
  };

  public end: Position = {
    offset: 0,
    line: 1,
    column: 0,
  };

  /**
   * Initialize this char iterator.
   */
  public constructor(text: string) {
    this.text = text;
  }

  public next(): number {
    if (this.lastCodePoint === CodePoint.EOF) {
      return CodePoint.EOF;
    }

    return (this.lastCodePoint = this.moveAt(this.end));
  }

  public eat(cp: number): boolean {
    if (this.text.codePointAt(this.end.offset) === cp) {
      this.next();
      return true;
    }
    return false;
  }

  public moveAt(pos: Position): number {
    this.start.offset = this.end.offset = pos.offset;
    this.start.line = this.end.line = pos.line;
    this.start.column = this.end.column = pos.column;

    const cp = this.text.codePointAt(this.start.offset) ?? CodePoint.EOF;
    if (cp === CodePoint.EOF) {
      this.end = this.start;
      return cp;
    }
    const shift = cp >= 0x10000 ? 2 : 1;
    this.end.offset += shift;
    if (cp === CodePoint.LINE_FEED) {
      this.end.line += 1;
      this.end.column = 0;
    } else if (cp === CodePoint.CARRIAGE_RETURN) {
      if (this.text.codePointAt(this.end.offset) === CodePoint.LINE_FEED) {
        this.end.offset++;
        this.end.line += 1;
        this.end.column = 0;
      }
      return CodePoint.LINE_FEED;
    } else {
      this.end.column += shift;
    }

    return cp;
  }
}
