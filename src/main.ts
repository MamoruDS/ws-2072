import { PyCode, Changes } from './pythonParse'
import { fetchCommit, PatchFile } from './fetch'
import { getAST, ASTDiffAlt, ASTDiffRes } from './ast'

const options = {
    githubToken: undefined,
    pythonBIN: 'python',
} as {
    githubToken: string
    pythonBIN: string
}

const loadFromSnip = (snipOld: string, snipNew: string): CodeDiff => {
    const astOld = getAST(snipOld)
    const astNew = getAST(snipNew)
    return {
        url: undefined,
        code_old: snipOld,
        code_new: snipNew,
        diff: ASTDiffAlt(astOld['ast_object'], astNew['ast_object']),
    }
}

type CodeDiff = {
    url: string
    code_old: string
    code_new: string
    diff: ASTDiffRes[]
}

const loadPatchFile = (file: PatchFile, commitURL?: string): CodeDiff => {
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
    const diff = ASTDiffAlt(
        getAST(codeOld)['ast_object'],
        getAST(codeNew)['ast_object']
    )
    return {
        url: commitURL,
        code_old: codeOld,
        code_new: codeNew,
        diff: diff,
    }
}

const loadCommitURL = async (commit: string): Promise<CodeDiff[]> => {
    const diffs: CodeDiff[] = []
    const files = await fetchCommit(commit)
    for (const file of files) {
        try {
            diffs.push(loadPatchFile(file, commit))
        } catch (e) {
            console.error(e)
            continue
        }
    }
    return diffs
}

export { CodeDiff as CodeInfo, options as OPT }

export { loadFromSnip, loadCommitURL, loadPatchFile }
