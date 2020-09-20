import * as fs from 'fs'

type BasicLine = {
    modified: boolean
    space: number
    code: string
}

type CodeLine = {
    lineNr: number
    modified: boolean
    indent: number
    code: string
    type?: 'class' | 'def'
    name?: string
}

type CodeLineExt = {
    modified: boolean
    indent: number
    code: string
    lineIndex: number
}

type Modify = {
    line: string
    lineNumber: number
    added: boolean
}

export type Changes = {
    '+': { lineNr: number }[]
    '-': { lineNr: number; content: string }[]
}

export class PyCode {
    private _linesOld: CodeLine[]
    private _linesNew: CodeLine[]
    private _localMinIndent: number = 8
    constructor(code: string, changes: Changes) {
        this._linesNew = []
        this._linesOld = []

        const linesNew = code.split('\n').map((_code) => {
            return { content: _code, modified: false }
        })
        const linesOld = code.split('\n').map((_code) => {
            return { content: _code, modified: false }
        })
        for (let c of changes['+']) {
            linesOld.splice(c.lineNr - 2, 1)[0]
            linesNew[c.lineNr - 2].modified = true
        }
        for (let c of changes['-']) {
            linesOld.splice(c.lineNr - 2, 0, {
                content: c.content,
                modified: true,
            })
        }

        this.applyCodeLines('new', linesNew)
        this.applyCodeLines('old', linesOld)
    }
    // #[DEBUG]
    get linesNew(): CodeLine[] {
        return this._linesNew
    }
    get linesOld(): CodeLine[] {
        return this._linesOld
    }
    slice = (tN: boolean, beginIndex: number, endIndex: number): CodeLine[] => {
        const lines: CodeLine[] = []
        for (let i = beginIndex; i <= endIndex; i++) {
            lines.push(this.getCL(tN)[i])
        }
        return lines
    }
    private getCL(tN: boolean): CodeLine[] {
        return tN ? this.linesNew : this.linesOld
    }
    applyCodeLines = (
        target: 'new' | 'old',
        lines: {
            content: string
            modified: boolean
        }[]
    ) => {
        let multiLineComment = false
        const basicLines = [] as BasicLine[]
        for (let l of lines) {
            const line = { modified: l.modified, space: 0 } as BasicLine
            line.code = l.content.replace(
                /^([\ ]{1,})/,
                (a: string, s: string) => {
                    line.space = s.length
                    return ''
                }
            )

            if (line.code.length == 0) continue // skip empty line
            if (line.code.slice(0, 1) == '#') continue // skip line
            if (
                line.code.slice(0, 3) == '"""' &&
                line.code.length > 3 &&
                line.code.slice(-3) == '"""'
            ) {
                continue
            }
            if (
                line.code.slice(0, 3) == '"""' &&
                line.code.length > 3 &&
                line.code.slice(-3) != '"""'
            ) {
                multiLineComment = true
                continue
            }
            if (
                multiLineComment &&
                line.code.slice(0, 3) != '"""' &&
                line.code.length >= 3 &&
                line.code.slice(-3) == '"""'
            ) {
                multiLineComment = false
                continue
            }
            if (line.code.slice(0, 3) == '"""' && line.code.length == 3) {
                multiLineComment = !multiLineComment
                continue
            }

            if (multiLineComment) continue

            if (line.code.indexOf('"""') != -1) {
                // console.log(line.code)
            }

            if (line.space <= this._localMinIndent && line.space != 0) {
                this._localMinIndent = line.space
            }
            basicLines.push(line)
        }
        for (const i in basicLines) {
            const bLine = basicLines[i]
            const codeline: CodeLine = {
                modified: bLine.modified,
                indent: Math.round(bLine.space / this._localMinIndent),
                code: bLine.code,
                lineNr: parseInt(i),
            }
            if (target == 'new') {
                this._linesNew.push(codeline)
            } else {
                this._linesOld.push(codeline)
            }
        }
    }
    public _printLines = (
        beginIndex: number = 0,
        endIndex: number = Infinity
    ): void => {
        const lines = this.linesNew.slice(beginIndex, endIndex)
        for (const i in lines) {
            const line = lines[i]
            const len = 30
            console.log(
                `[${i}]\tP:${line.indent} M:${
                    line.modified ? 'T' : 'F'
                } C:${line.code.slice(0, len)}${
                    line.code.length > len ? '...' : ''
                }`
            )
        }
    }
    print = (tN: boolean, filename: string) => {
        const lines = [] as string[]
        let i = 0
        const codelines: CodeLine[] = tN ? this._linesNew : this._linesOld
        while (codelines[i]) {
            const line = codelines[i]
            lines.push(`${' '.repeat(4 * line.indent)}${line.code}`)
            i++
        }
        fs.writeFileSync(filename, lines.join('\n'))
    }
    findScopeCL = (
        tN: boolean,
        startLineIndex: number,
        direction: 'top' | 'bot',
        fix: number,
        DEBUG?: boolean
    ): CodeLine => {
        const startLine = this.getCL(tN)[startLineIndex]
        const targetScope = startLine.indent + fix

        if (DEBUG) {
            console.log('---------------------------------------')
            console.log('|             findScopeCL             |')
            console.log('---------------------------------------')
            console.log(`> [INF] start  lineNr: ${startLine.lineNr}`)
            console.log(`> [INF] start  indent: ${startLine.indent}`)
            console.log(`> [INF] target indent: ${targetScope}`)
            console.log(`> [INF] start    code:\n>\t${startLine.code}`)
        }

        if (targetScope < 0) throw new Error('findScope: -1')
        const lineFix = direction == 'top' ? -1 : 1
        let i = startLineIndex + lineFix
        while (this.getCL(tN)[i]) {
            const _line = this.getCL(tN)[i]
            if (_line.indent == targetScope) {
                // TODO: wrap???
                if (
                    _line.code.slice(0, 2) == '):' ||
                    _line.code.slice(0, 2) == ']:'
                ) {
                    //
                } else {
                    if (DEBUG) {
                        console.log('--------------loop break---------------')
                        console.log(`> [INF] end lineNr: ${_line.lineNr}`)
                        console.log(`> [INF] end indent: ${_line.indent}`)
                        console.log(`> [INF] end code:\n>\t${_line.code}`)
                    }
                    break
                }
            }
            i += lineFix
        }
        const line = this.getCL(tN)[i]
        if (typeof line == 'undefined') {
            return undefined
        }
        const re = new RegExp(/(class|def)\s([^\(]{1,})/g)
        const res = re.exec(line.code)
        if (res) {
            line.type = res[1] as 'class' | 'def'
            line.name = res[2]
        }
        return line
    }
    findLocalFnCL = (tN: boolean, startLineIndex: number): CodeLine => {
        let i = startLineIndex
        let cl: CodeLine = this.getCL(tN)[i]
        while (this.getCL(tN)[i]) {
            if (cl.code.slice(0, 3) == 'def') {
                break
            }
            try {
                cl = this.findScopeCL(tN, i, 'top', -1)
                i = cl.lineNr
            } catch (e) {
                return undefined
            }
        }
        return cl
    }
    search = (tN: boolean, str: string): CodeLine[] => {
        const lines = [] as CodeLine[]
        for (const i in this.getCL(tN)) {
            const line = this.getCL(tN)[i]
            if (line.code.indexOf(str) != -1) {
                lines.push(line)
            }
        }
        return lines
    }
    getScopeEndCLByLI = (tN: boolean, fnLineIndex: number) => {
        let cl = this.findScopeCL(tN, fnLineIndex, 'bot', 0)
        // TODO:
        // remove next scope's head
        if (typeof cl == 'undefined') {
            cl = this.getCL(tN)[this.getCL(tN).length - 1]
        } else {
            cl = this.getCL(tN)[cl.lineNr - 1]
        }

        return cl
    }
    gethScopeRangeByName = (
        tN: boolean,
        type: 'def' | 'class',
        name: string,
        verifyParents: CodeLine[]
    ): {
        start: number
        end: number
    } => {
        const clArr = this.search(tN, `${type} ${name}(`)
        if (clArr.length > 0) {
            for (const cl of clArr) {
                const thisParents = this.getScopeLIParentCLs(
                    true,
                    cl.lineNr
                ).filter((_cl) => {
                    return typeof _cl.type != 'undefined'
                })
                verifyParents = verifyParents.filter((_cl) => {
                    return typeof _cl.type != 'undefined'
                })
                if (thisParents.length != verifyParents.length) continue
                let b = false
                for (const pi in thisParents) {
                    if (b) continue
                    if (
                        thisParents[pi].type != verifyParents[pi].type ||
                        thisParents[pi].name != verifyParents[pi].name
                    ) {
                        b = true
                    }
                }
                if (b) continue
                const endCL = this.getScopeEndCLByLI(tN, cl.lineNr)
                return {
                    start: cl.lineNr,
                    end: endCL.lineNr,
                }
            }
        }
        return undefined
    }
    genCodeSnip = (
        tN: boolean,
        beginIndex: number,
        endIndex: number,
        maxLine: number = Infinity
    ): string => {
        const codelines = this.slice(tN, beginIndex, endIndex)
        const code: string[] = []
        let localMinFix: number = Infinity

        codelines.map((line) => {
            localMinFix = localMinFix >= line.indent ? line.indent : localMinFix
        })

        if (codelines[0].indent > localMinFix)
            throw new Error(
                'pythonParse.genCodeSnip: snip top at local min scope'
            )
        codelines.map((line) => {
            code.push(' '.repeat((line.indent - localMinFix) * 4) + line.code)
        })
        if (code.length > maxLine)
            throw new Error(
                'pythonParse.genCodeSnip: snip larger then max lines allowed'
            )
        return code.join('\n')
    }
    getScopeLIParentCLs = (tN: boolean, lineIndex: number): CodeLine[] => {
        const parents = []
        let i = lineIndex
        while (true) {
            try {
                const cl = this.findScopeCL(tN, i, 'top', -1)
                if (cl.lineNr == i) break
                parents.push(cl)
                i = cl.lineNr
            } catch {
                break
            }
        }
        return parents
    }
    getChanges = (tN: boolean) => {
        return this.getCL(tN).filter((line) => {
            return line.modified == true
        })
    }
}
