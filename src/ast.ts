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
        node = node[p]
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

export type ASTDiffRes = {
    path: string
    type: 'added' | 'deleted' | 'modified_value' | 'modified_node'
    node: number
}

export const ASTDiff = (
    rootOld: ASTNode,
    rootNew: ASTNode,
    path: string[] = [],
    keyIgnore: string[] = [
        'lineno',
        'end_lineno',
        'col_offset',
        'end_col_offset',
    ]
): ASTDiffRes[] => {
    const res: ASTDiffRes[] = []
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
        const valueOld = localOld[key]
        const valueNew = localNew[key]
        if (typeof valueOld == 'undefined') {
            res.push({
                path: [...path, key].join('/'),
                type: 'added',
                node: getASTNodeCnt(valueNew),
            })
        } else if (typeof valueNew == 'undefined') {
            res.push({
                path: [...path, key].join('/'),
                type: 'deleted',
                node: 0 - getASTNodeCnt(valueOld),
            })
        } else {
            if (
                typeof valueNew == 'object' &&
                typeof valueOld == 'object' &&
                valueNew !== null &&
                valueOld !== null
            ) {
                if (Array.isArray(valueNew) && Array.isArray(valueOld)) {
                    let i = 0
                    while (true) {
                        const nodeOld = valueOld[i]
                        const nodeNew = valueNew[i]

                        if (
                            typeof nodeOld == 'undefined' &&
                            typeof nodeNew == 'undefined'
                        ) {
                            break
                        } else if (typeof nodeOld == 'undefined') {
                            res.push({
                                path: [...path, key, i].join('/'),
                                type: 'added',
                                node: getASTNodeCnt(nodeNew),
                            })
                        } else if (typeof nodeNew == 'undefined') {
                            res.push({
                                path: [...path, key, i].join('/'),
                                type: 'deleted',
                                node: 0 - getASTNodeCnt(nodeOld),
                            })
                        } else {
                            if (nodeOld['node'] != nodeNew['node']) {
                                res.push({
                                    path: [...path, key, i].join('/'),
                                    type: 'modified_node',
                                    node:
                                        getASTNodeCnt(nodeNew) -
                                        getASTNodeCnt(nodeOld),
                                })
                            } else {
                                ASTDiff(rootOld, rootNew, [
                                    ...path,
                                    key,
                                    i.toString(),
                                ]).forEach((d) => {
                                    res.push(d)
                                })
                            }
                        }
                        i++
                    }
                } else {
                    ASTDiff(rootOld, rootNew, [...path, key]).forEach((d) => {
                        res.push(d)
                    })
                }
            } else {
                if (valueNew !== valueOld && keyIgnore.indexOf(key) == -1) {
                    res.push({
                        path: [...path, key].join('/'),
                        type: 'modified_value',
                        node: 0,
                    })
                }
            }
        }
    }
    return res
}
