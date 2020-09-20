import { PyCode, Changes } from './pythonParse'
import * as fetch from './fetch'
import { getAST } from './ast'
import { RangeChecker } from './range'
import { writer, DataType } from './record'

export { writer as CSVWriter }

export const loadPatchFile = (
    file: fetch.PatchFile,
    commitURL?: string
): DataType[] => {
    const data: DataType[] = []
    const changes = { '+': [], '-': [] } as Changes
    for (const c of file.modified_lines) {
        if (c.added) {
            changes['+'].unshift({ lineNr: c.lineNumber })
        } else {
            changes['-'].push({ lineNr: c.lineNumber, content: c.line })
        }
    }
    let pyCode: PyCode
    try {
        pyCode = new PyCode(file.raw, changes)
    } catch {
        throw new Error(
            `[\x1b[31mERR\x1b[0m] failed to generate PyCode with [${file.filename}]`
        )
    }

    const rangeOld = new RangeChecker()
    const rangeNew = new RangeChecker()

    for (const tN of [false, true]) {
        const changes = pyCode.getChanges(tN)
        for (const cl of changes) {
            try {
                const localFnCL = pyCode.findLocalFnCL(tN, cl.lineNr)
                if (!localFnCL) continue
                const end = pyCode.getScopeEndCLByLI(tN, localFnCL.lineNr)
                const parents = pyCode.getScopeLIParentCLs(tN, localFnCL.lineNr)
                const rangeChecker = tN ? rangeNew : rangeOld
                const rangeCheckerRev = tN ? rangeOld : rangeNew
                const r: [number, number] = [localFnCL.lineNr, end.lineNr]
                if (rangeChecker.collisionWith(r)) continue
                rangeChecker.add(r)
                const localFnCLRev = pyCode.gethScopeRangeByName(
                    !tN,
                    localFnCL.type,
                    localFnCL.name,
                    parents
                )
                if (!localFnCLRev) continue
                const rRev: [number, number] = [
                    localFnCLRev.start,
                    localFnCLRev.end,
                ]
                if (rangeCheckerRev.collisionWith(rRev)) continue
                rangeChecker.add(rRev)
                const code = pyCode.genCodeSnip(tN, r[0], r[1], 100)
                const codeRev = pyCode.genCodeSnip(!tN, rRev[0], rRev[1], 100)
                const ast = getAST(code)
                const astRev = getAST(codeRev)
                if (ast.err || astRev.err) continue
                if (ast.ast_count == astRev.ast_count) continue
                if (ast.ast_count >= 500 || astRev.ast_count >= 500) continue
                data.push({
                    old: tN ? codeRev : code,
                    new: tN ? code : codeRev,
                    url: commitURL,
                    change: tN
                        ? ast.ast_count > astRev.ast_count
                            ? 'add'
                            : 'delete'
                        : ast.ast_count > astRev.ast_count
                        ? 'delete'
                        : 'add',
                })
            } catch (e) {
                throw new Error(
                    `[\x1b[31mERR\x1b[0m] some error occurred when loadPatchFile [${file.filename}]`
                )
            }
        }
    }
    return data
}

export const loadCommitURL = async (commit: string): Promise<DataType[]> => {
    const data: DataType[] = []
    const files = await fetch.fetchCommit(commit)
    for (const file of files) {
        try {
            loadPatchFile(file, commit).forEach((d) => {
                data.push(d)
            })
        } catch (e) {
            console.error(e)
            continue
        }
    }
    return data
}
