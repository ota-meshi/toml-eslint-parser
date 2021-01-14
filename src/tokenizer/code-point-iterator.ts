import { NULL, EOF, LINE_FEED, CARRIAGE_RETURN } from "./code-point"

type Position = {
    offset: number
    line: number
    column: number
}

export class CodePointIterator {
    public readonly text: string

    private lastCodePoint: number = NULL

    public start: Position = {
        offset: -1,
        line: 1,
        column: -1,
    }

    public end: Position = {
        offset: 0,
        line: 1,
        column: 0,
    }

    /**
     * Initialize this char iterator.
     */
    public constructor(text: string) {
        this.text = text
    }

    public next(): number {
        if (this.lastCodePoint === EOF) {
            return EOF
        }

        this.start.offset = this.end.offset
        this.start.line = this.end.line
        this.start.column = this.end.column

        const cp = this.text.codePointAt(this.start.offset) ?? EOF
        if (cp === EOF) {
            this.end = this.start
            return (this.lastCodePoint = cp)
        }
        const shift = cp >= 0x10000 ? 2 : 1
        this.end.offset = this.start.offset + shift
        if (cp === LINE_FEED) {
            this.end.line = this.start.line + 1
            this.end.column = 0
        } else if (cp === CARRIAGE_RETURN) {
            if (this.text.codePointAt(this.end.offset) === LINE_FEED) {
                this.end.offset++
                this.end.line = this.start.line + 1
                this.end.column = 0
            }
            return (this.lastCodePoint = LINE_FEED)
        } else {
            this.end.column = this.start.column + shift
        }

        return (this.lastCodePoint = cp)
    }

    public *iterateSubCodePoints(): IterableIterator<number> {
        let index = this.end.offset
        while (true) {
            const cp = this.text.codePointAt(index) ?? EOF
            if (cp === EOF) {
                return
            }
            yield cp
            index += cp >= 0x10000 ? 2 : 1
        }
    }

    public subCodePoints(): {
        next(): number
        count: number
    } {
        const sub = this.iterateSubCodePoints()
        let end = false
        let count = 0
        return {
            next() {
                if (end) {
                    return EOF
                }
                const r = sub.next()
                if (r.done) {
                    end = true
                    return EOF
                }
                count++
                return r.value
            },
            get count() {
                return count
            },
        }
    }
}
