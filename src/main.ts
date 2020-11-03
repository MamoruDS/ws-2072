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
    path: [string, string]
    node: [object, object]
}

type CodeDiff<T> = {
    url: string
    filename: string
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
    const lhsAST = getAST(lhsCode)['ast_object']
    const rhsAST = getAST(rhsCode)['ast_object']
    const _lhs = loadFromAST(lhsAST)
    const _rhs = loadFromAST(rhsAST)
    _lhs.setDocument(lhsCode)
    _rhs.setDocument(rhsCode)
    const res = diffLiteNode(_lhs, _rhs)
    return res.map((_diff) => {
        const lNode = getNodeFrom(_lhs, _diff.id[0])
        const rNode = getNodeFrom(_rhs, _diff.id[1])
        return {
            line: [getSnippet(lNode, 'line'), getSnippet(rNode, 'line')],
            snippet: [
                getSnippet(lNode, 'function'),
                getSnippet(rNode, 'function'),
            ],
            type: _diff.type,
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
        LiteASTDiff(snipOld, snipNew).forEach((_diff) => {
            diff.push(_diff)
        })
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
        LiteASTDiff(codeOld, codeNew).forEach((_diff) => {
            diff.push(_diff)
        })
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

export { CodeDiff as CodeInfo, options as OPT }

export {
    loadFromSnip,
    loadCommitURL,
    loadPatchFile,
    LiteASTDiff as _LiteASTDiff,
}
