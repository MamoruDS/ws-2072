import { PyCode, Changes } from './pythonParse'
import * as fetch from './fetch'
import { getAST, ASTDiff, ASTDiffRes } from './ast'
import { RangeChecker } from './range'
import { writer, DataType } from './record'

export { writer as CSVWriter, getAST }

export const options = {
    githubToken: undefined,
    maxASTNodeCnt: 500,
    maxPYLineCnt: 100,
    pythonBIN: 'python',
} as {
    githubToken: string
    maxASTNodeCnt: number
    maxPYLineCnt: number
    pythonBIN: string
}

export const loadFromSnip = (snipOld: string, snipNew: string): OutputData => {
    const astOld = getAST(snipOld)
    const astNew = getAST(snipNew)
    return {
        old: snipOld,
        new: snipNew,
        url: undefined,
        ast: {
            old: astOld['ast_count'],
            new: astNew['ast_count'],
            diff: ASTDiff(astOld['ast_object'], astNew['ast_object']),
        },
    }
}

type OutputData = {
    old: string
    new: string
    url: string
    ast: {
        old: number
        new: number
        diff: ASTDiffRes[]
    }
}

export { OutputData as CodeInfo }

export const loadPatchFile = (
    file: fetch.PatchFile,
    commitURL?: string
): OutputData[] => {
    const data: OutputData[] = []
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
                let code: string, codeRev: string
                try {
                    code = pyCode.genCodeSnip(
                        tN,
                        r[0],
                        r[1],
                        options.maxPYLineCnt
                    )
                    codeRev = pyCode.genCodeSnip(
                        !tN,
                        rRev[0],
                        rRev[1],
                        options.maxPYLineCnt
                    )
                } catch (e) {
                    continue
                }

                const ast = getAST(code)
                const astRev = getAST(codeRev)
                const astDiff = ASTDiff(
                    (tN ? astRev : ast)['ast_object'],
                    (tN ? ast : astRev)['ast_object']
                )
                if (ast.err || astRev.err) continue
                if (
                    ast.ast_count >= options.maxASTNodeCnt ||
                    astRev.ast_count >= options.maxASTNodeCnt
                )
                    continue
                data.push({
                    old: tN ? codeRev : code,
                    new: tN ? code : codeRev,
                    url: commitURL,
                    ast: {
                        old: (tN ? astRev : ast)['ast_count'],
                        new: (tN ? ast : astRev)['ast_count'],
                        diff: astDiff,
                    },
                })
            } catch (e) {
                throw new Error(
                    `[\x1b[31mERR\x1b[0m] some error occurred when loadPatchFile [${file.filename}], error: ${e}`
                )
            }
        }
    }
    return data
}

export const loadCommitURL = async (commit: string): Promise<OutputData[]> => {
    const data: OutputData[] = []
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
