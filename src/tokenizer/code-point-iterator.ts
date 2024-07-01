import { CodePoint } from "./code-point";
import { Locations } from "./locs";

export class CodePointIterator {
  public readonly text: string;

  private readonly locs = new Locations();

  private lastCodePoint: number = CodePoint.NULL;

  public start = -1;

  public end = 0;

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

  public getLocFromIndex(index: number): { line: number; column: number } {
    return this.locs.getLocFromIndex(index);
  }

  public eat(cp: number): boolean {
    if (this.text.codePointAt(this.end) === cp) {
      this.next();
      return true;
    }
    return false;
  }

  public moveAt(offset: number): number {
    this.start = this.end = offset;

    const cp = this.text.codePointAt(this.start) ?? CodePoint.EOF;
    if (cp === CodePoint.EOF) {
      this.end = this.start;
      return cp;
    }
    const shift = cp >= 0x10000 ? 2 : 1;
    this.end += shift;
    if (cp === CodePoint.LINE_FEED) {
      this.locs.addOffset(this.end);
    } else if (cp === CodePoint.CARRIAGE_RETURN) {
      if (this.text.codePointAt(this.end) === CodePoint.LINE_FEED) {
        this.end++;
        this.locs.addOffset(this.end);
      }
      return CodePoint.LINE_FEED;
    }

    return cp;
  }
}
