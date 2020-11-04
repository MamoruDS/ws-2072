import { PyCode, Changes } from './pythonParse'
import { fetchCommit, PatchFile } from './fetch'
import { getAST, ASTDiffAlt, ASTDiffRes, ASTNode } from './ast'
import { diffLiteNode, LiteNode, loadFromAST } from './liteAST'

const options = {
    githubToken: undefined,
    pythonBIN: 'python',
    strictIfConditionCheck: true,
    // disableLiteAST: false,
} as {
    githubToken: string
    pythonBIN: string
    strictIfConditionCheck: boolean
    // disableLiteAST: boolean
}

type LiteASTDiffRes = {
    line: [string, string]
    snippet: [string, string]
    type: string
    nodeCnt: [number | null, number | null]
    nodeDelta: number
    topLineNr?: [number | null, number | null]
    botLineNr?: [number | null, number | null]
    path: [string, string]
    node: [object, object]
}

type CodeDiff<T> = {
    url: string
    filename: string
    failed?: boolean
    code_old: string
    code_new: string
    diff: T[]
}

const LiteASTDiff = (
    lhsCode: string,
    rhsCode: string,
    options?: {
        indentFix?: boolean
        minScopeType?: 'function'
    }
): LiteASTDiffRes[] => {
    const getNodeFrom = (root: LiteNode, id: string): LiteNode | undefined => {
        return id ? root.getNodeById(id) : undefined
    }
    const getSnippet = (
        node: LiteNode,
        scope: 'node' | 'line' | 'function'
    ): string => {
        if (node) {
            return node.getDocument({
                indentFix: true,
                minScopeType: scope,
            })
        }
        return undefined
    }
    const lhsAST = getAST(lhsCode)
    const rhsAST = getAST(rhsCode)
    if (lhsAST.err || rhsAST.err) {
        return undefined
    }
    const _lhs = loadFromAST(lhsAST['ast_object'])
    const _rhs = loadFromAST(rhsAST['ast_object'])
    _lhs.setDocument(lhsCode)
    _rhs.setDocument(rhsCode)
    const res = diffLiteNode(_lhs, _rhs)
    return res.map((_diff) => {
        const lNode = getNodeFrom(_lhs, _diff.id[0])
        const rNode = getNodeFrom(_rhs, _diff.id[1])
        const nodeCnt: [number, number] = [
            lNode ? lNode.getAllSubNodes().length : null,
            rNode ? rNode.getAllSubNodes().length : null,
        ]
        return {
            line: [getSnippet(lNode, 'line'), getSnippet(rNode, 'line')],
            snippet: [
                getSnippet(lNode, 'function'),
                getSnippet(rNode, 'function'),
            ],
            type: _diff.type,
            nodeCnt,
            nodeDelta: nodeCnt[1] - nodeCnt[0],
            topLineNr: [
                lNode ? lNode.line[0] : null,
                rNode ? rNode.line[0] : null,
            ],
            botLineNr: [
                lNode ? lNode.line[1] : null,
                rNode ? rNode.line[1] : null,
            ],
            path: [
                lNode
                    ? lNode
                          .getPathToRoot()
                          .map((_lite) => {
                              return _lite.type
                          })
                          .join('/')
                    : undefined,
                rNode
                    ? rNode
                          .getPathToRoot()
                          .map((_lite) => {
                              return _lite.type
                          })
                          .join('/')
                    : undefined,
            ],
            node: [
                lNode
                    ? lNode._DEBUG({
                          ignoreTag: true,
                      })
                    : undefined,
                rNode
                    ? rNode._DEBUG({
                          ignoreTag: true,
                      })
                    : undefined,
            ],
        }
    })
}

function loadFromSnip(
    snipOld: string,
    snipNew: string,
    useLiteAST: false
): CodeDiff<ASTDiffRes>
function loadFromSnip(
    snipOld: string,
    snipNew: string,
    useLiteAST: true
): CodeDiff<LiteASTDiffRes>
function loadFromSnip(
    snipOld: string,
    snipNew: string,
    useLiteAST: boolean = true
): CodeDiff<object> {
    const diff = []
    if (!useLiteAST) {
        const astOld = getAST(snipOld)
        const astNew = getAST(snipNew)
        ASTDiffAlt(astOld['ast_object'], astNew['ast_object']).forEach(
            (_diff) => {
                diff.push(_diff)
            }
        )
    } else {
        const liteDiff = LiteASTDiff(snipOld, snipNew)
        if (typeof liteDiff == 'undefined') {
            return {
                url: undefined,
                filename: undefined,
                failed: true,
                code_old: snipOld,
                code_new: snipNew,
                diff,
            }
        } else {
            liteDiff.forEach((_diff) => {
                diff.push(_diff)
            })
        }
    }
    return {
        url: undefined,
        filename: undefined,
        code_old: snipOld,
        code_new: snipNew,
        diff,
    }
}

function loadPatchFile(
    file: PatchFile,
    commitURL: string,
    useLiteAST: false
): CodeDiff<ASTDiffRes>
function loadPatchFile(
    file: PatchFile,
    commitURL: string,
    useLiteAST: true
): CodeDiff<LiteASTDiffRes>
function loadPatchFile(
    file: PatchFile,
    commitURL: string,
    useLiteAST: boolean = true
): CodeDiff<ASTDiffRes | LiteASTDiffRes> {
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
    const codeOld = pyCode.genCode(false)
    const codeNew = pyCode.genCode(true)
    const diff = []
    if (!useLiteAST) {
        ASTDiffAlt(
            getAST(codeOld)['ast_object'],
            getAST(codeNew)['ast_object'],
            {
                strictIfConditionCheck: options.strictIfConditionCheck,
            }
        ).forEach((_diff) => {
            diff.push(_diff)
        })
    } else {
        const liteDiff = LiteASTDiff(codeOld, codeNew)
        if (typeof liteDiff == 'undefined') {
            return {
                url: commitURL,
                filename: file.filename,
                failed: true,
                code_old: codeOld,
                code_new: codeNew,
                diff,
            }
        } else {
            liteDiff.forEach((_diff) => {
                diff.push(_diff)
            })
        }
    }
    return {
        url: commitURL,
        filename: file.filename,
        code_old: codeOld,
        code_new: codeNew,
        diff: diff,
    }
}

async function loadCommitURL(
    commit: string,
    useLiteAST: false
): Promise<CodeDiff<ASTDiffRes>[]>
async function loadCommitURL(
    commit: string,
    useLiteAST: true
): Promise<CodeDiff<LiteASTDiffRes>[]>
async function loadCommitURL(
    commit: string,
    useLiteAST: boolean = true
): Promise<CodeDiff<object>[]> {
    const diffs = []
    const files = await fetchCommit(commit)
    for (const file of files) {
        try {
            if (useLiteAST) {
                diffs.push(loadPatchFile(file, commit, true))
            } else {
                diffs.push(loadPatchFile(file, commit, false))
            }
        } catch (e) {
            console.error(e)
            continue
        }
    }
    return diffs
}

type _DIFFRES = CodeDiff<ASTDiffRes | LiteASTDiffRes>

type Summary = {
    url: string
    file: string
    failed: boolean
    changes: number
    summary: {
        added: number
        deleted: number
        modified: number
    }
    deltas: number[]
}

function summary(result: _DIFFRES | _DIFFRES[]): Summary[] {
    const sum = []
    if (Array.isArray(result)) {
        for (const _result of result) {
            sum.push(_summary(_result))
        }
        return sum
    } else {
        return summary([result])
    }
}

const _summary = (result: _DIFFRES): Summary => {
    const res = {
        url: result.url,
        file: result.filename,
        failed: false,
        changes: 0,
        summary: {
            added: 0,
            deleted: 0,
            modified: 0,
        },
        deltas: [],
    }
    if (result.failed) {
        res.failed = true
        return res
    }
    for (const _d of result.diff) {
        if (_d.type == 'node_added') {
            res.summary.added += 1
        } else if (_d.type == 'node_added') {
            res.summary.deleted += 1
        } else {
            res.summary.modified += 1
        }
        res.deltas.push(_d.nodeDelta)
    }
    return res
}

export { CodeDiff as CodeInfo, options as OPT }

export {
    loadFromSnip,
    loadCommitURL,
    loadPatchFile,
    LiteASTDiff as _LiteASTDiff,
    summary,
}
