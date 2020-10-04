import { spawnSync } from 'child_process'
import { genRandomHex, getObjByPath } from './utils'
import { options as OPT } from './main'
import { exit } from 'process'
import * as fs from 'fs'
import * as path from 'path'

const TEMP_PATH = 'temp'

const AST_SCRIPT_PATH = path.join(
    path.dirname(__dirname),
    'scripts',
    'ast_nodes.py'
)

if (fs.existsSync(TEMP_PATH)) {
    if (!fs.lstatSync(TEMP_PATH).isDirectory) {
        exit(1)
    }
} else {
    fs.mkdirSync(TEMP_PATH)
}

type ASTRes = {
    ast_count: number
    ast_json: ASTNode
}

type ASTNode = {
    node: string
    lineno?: number
    end_lineno?: number
}

export const getAST = (
    code: string
): {
    err: boolean
    ast_count: number
    ast_object: ASTNode
} => {
    const res = {
        err: false,
        ast_count: 0,
        ast_object: {} as ASTNode,
    }
    const filename = `temp/${genRandomHex(6)}.py`
    fs.writeFileSync(filename, code)

    let astProc = spawnSync(OPT.pythonBIN, [AST_SCRIPT_PATH, filename], {
        encoding: 'utf-8',
    })
    fs.unlinkSync(filename)
    if (astProc.status != 0) {
        return { ...res, err: true }
    } else {
        const astRes = JSON.parse(astProc.stdout) as ASTRes
        return {
            ...res,
            ast_count: astRes['ast_count'],
            ast_object: astRes['ast_json'],
        }
    }
}

export const getASTNodeByPath = (
    node: ASTNode,
    path: string | string[]
): ASTNode => {
    for (const p of Array.isArray(path) ? path : path.split('/')) {
        try {
            node = node[p]
        } catch (e) {
            if (e instanceof TypeError) {
                return undefined
            } else {
                throw e
            }
        }
    }
    return node
}

export const getASTNodeCnt = (obj: ASTNode | [ASTNode]): number => {
    let nodeCnt = 0
    if (obj['node']) {
        nodeCnt++
    }
    for (const val of Object.values(obj)) {
        if (typeof val == 'object' && val != null) {
            if (Array.isArray(val)) {
                for (const item of val) {
                    nodeCnt += getASTNodeCnt(item)
                }
            } else {
                nodeCnt += getASTNodeCnt(val)
            }
        }
    }
    return nodeCnt
}

type ASTModifyType = 'node_added' | 'node_deleted' | 'node_modified' | 'attr_added' | 'attr_deleted' | 'attr_modified'

export type ASTDiffRes = {
    path: string
    type: ASTModifyType
    delta: number
}

export const ASTDiff = (
    rootOld: ASTNode,
    rootNew: ASTNode,
    keyIgnore: string[] = [
        'lineno',
        'end_lineno',
        'col_offset',
        'end_col_offset',
    ],
    path: string[] = []
): ASTDiffRes[] => {
    const res: ASTDiffRes[] = []
    const diff = (path: string[]) => {
        const _old = getASTNodeByPath(rootOld, path)
        const _new = getASTNodeByPath(rootNew, path)
        const delta =
            (_new ? getASTNodeCnt(_new) : 0) - (_old ? getASTNodeCnt(_old) : 0)
        let type: ASTModifyType
        if (_old && _new) {
            if (path[path.length - 1] == 'node') {
                path.pop()
                type = 'node_modified'
            }else{
                type = 'attr_modified'
            }
        } else if (!_new && !_old) {
            return 
        } else if (!_new) {
            type = delta ? 'node_deleted' : 'attr_deleted'
        } else if (!_old) {
            type = delta ? 'node_added' : 'attr_added'
        }
        res.push({
            path: path.join('/'),
            type,
            delta,
        })
    }
    const localOld = getASTNodeByPath(rootOld, path)
    const localNew = getASTNodeByPath(rootNew, path)
    const keys = [...Object.keys(localNew), ...Object.keys(localOld)]
    for (let i = 0; keys[i]; i++) {
        for (let j = i + 1; keys[j]; ) {
            if (keys[i] == keys[j]) {
                keys.splice(j, 1)
            } else {
                j++
            }
        }
    }
    for (const key of keys) {
        if (keyIgnore.indexOf(key) != -1) continue
        const valOld = localOld[key]
        const valNew = localNew[key]
        if (
            typeof valOld == 'object' &&
            typeof valNew == 'object' &&
            valOld !== null &&
            valNew !== null
        ) {
            if (Array.isArray(valOld) || Array.isArray(valNew)) {
                let child = 0
                while (true) {
                    if (
                        typeof valOld[child] == 'undefined' &&
                        typeof valNew[child] == 'undefined'
                    ) {
                        break
                    } else if (
                        typeof valOld[child] == 'object' &&
                        typeof valNew[child] == 'object'
                    ) {
                        ASTDiff(rootOld, rootNew, keyIgnore, [
                            ...path,
                            key,
                            child.toString(),
                        ]).forEach((d) => {
                            res.push(d)
                        })
                    }

                    child += 1
                }
            } else {
                ASTDiff(rootOld, rootNew, keyIgnore, [...path, key]).forEach(
                    (d) => {
                        res.push(d)
                    }
                )
            }
        } else {
            if (valOld != valNew) {
                diff([...path, key])
            }
        }
    }
    return res
}
