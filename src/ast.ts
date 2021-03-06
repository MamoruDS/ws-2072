import { spawnSync } from 'child_process'
import * as utils from './utils'
import { OPT } from './main'
import { exit } from 'process'
import * as fs from 'fs'
import * as path from 'path'

import { deepStrictEqual } from 'assert'

const TEMP_PATH = 'temp'

export const KEY_IGNORE: string[] = [
    'lineno',
    'end_lineno',
    'col_offset',
    'end_col_offset',
]

export const rmKeys = <T extends object>(input: T, keys: string[]): T => {
    const re = new RegExp(
        `(,?\[\\s\]{0,}(${KEY_IGNORE.map((key) => {
            return `("${key}")`
        }).join('|')}):\\s{0,}\\d+)`,
        'gm'
    )
    return JSON.parse(JSON.stringify(input).replace(re, ''))
}

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

import * as _TEMP from './_gen'

export type ASTNode = {
    node: _TEMP.ASTType
    lineno?: number
    end_lineno?: number
    test?: ASTNode
    body?: ASTNode | ASTNode[]
    orelse?: ASTNode[]
    value?: string | ASTNode
    keys?: ASTNode[]
    values?: ASTNode[]
    targets?: ASTNode[]
    elts?: ASTNode[]
    id?: string
    left?: ASTNode
    right?: ASTNode
    op?: ASTNode
    args?: ASTNode | ASTNode[]
    arg?: string
    ops?: ASTNode[]
    comparators?: ASTNode[]
    slice?: ASTNode
    name?: string
    bases?: ASTNode[]
    dims?: ASTNode[]
    lower?: 'None' | ASTNode
    upper?: 'None' | ASTNode
    step?: 'None' | ASTNode
    target?: ASTNode
    iter?: ASTNode
    defaults?: ASTNode[]
    kind?: 'None' | string
    operand?: ASTNode
    names?: ASTNode[] | string[]
    asname?: string
    module?: string
    type?: ASTNode
    exc?: ASTNode
}

type NodeCount = number | null

type NodeInfo = {
    nodeCnt: NodeCount
    topLineNr: number
    botLineNr: number
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
    const filename = `temp/${utils.genRandomHex(6)}.py`
    fs.writeFileSync(filename, code)

    let astProc = spawnSync(OPT.pythonBIN, [AST_SCRIPT_PATH, filename], {
        encoding: 'utf-8',
    })
    fs.unlinkSync(filename)
    if (astProc.status != 0) {
        return { ...res, err: true }
    } else {
        const astRes = JSON.parse(astProc.stdout) as ASTRes
        getASTNodeInfo(astRes['ast_json'])
        return {
            ...res,
            ast_count: astRes['ast_count'],
            ast_object: astRes['ast_json'],
        }
    }
}

export const getMinASTNodeByPath = (
    root: ASTNode,
    path: string | string[]
): ASTNode => {
    let node: ASTNode = undefined
    const _path: string[] = Array.isArray(path)
        ? [...path]
        : path.split(utils.SAPERATOR)
    while (true) {
        const _n = utils.get(root, _path)
        if (typeof _n == 'object' && _n['node']) {
            node = _n
            break
        }
        if (typeof _path.pop() == 'undefined') break
    }
    return node
}

const isScopeNodePath = (path: string | string[]): boolean => {
    const _path: string[] = Array.isArray(path)
        ? [...path]
        : path.split(utils.SAPERATOR)
    if (
        _path[_path.length - 2] == 'body' &&
        !Number.isNaN(parseInt(_path[_path.length - 1]))
    )
        return true
    return false
}

export const getMinScopePath = (
    root: ASTNode,
    path: string | string[]
    // fix: number = 0
): string[] => {
    const _path: string[] = Array.isArray(path)
        ? [...path]
        : path.split(utils.SAPERATOR)
    while (_path.length) {
        if (
            isScopeNodePath(_path) &&
            typeof utils.get(root, _path) != 'undefined'
        ) {
            break
        }
        _path.pop()
    }
    return _path
}

const T: _TEMP.ASTType[] = _TEMP.ASTTypeList

export const getASTNodeInfo = (node: ASTNode): NodeInfo => {
    const info: NodeInfo = {
        nodeCnt: node['node'] ? 1 : 0,
        topLineNr: node['lineno'],
        botLineNr: node['end_lineno'],
    }
    let n = node['node']
    if (T.indexOf(n) == -1 && typeof n == 'string') {
        T.push(n)
        console.log(
            `[ASTWALK] never seen before: '${n}' at [${info.topLineNr},${info.botLineNr}]`
        )
    }

    const _mergeInfo = (_inf: NodeInfo) => {
        info.nodeCnt += _inf.nodeCnt
        if (info.topLineNr > _inf.topLineNr) {
            info.topLineNr = _inf.topLineNr
        }
        if (info.botLineNr < _inf.botLineNr) {
            info.botLineNr = _inf.botLineNr
        }
    }
    for (const key of Object.keys(node)) {
        const val = node[key]
        if (typeof val == 'object' && val != null) {
            if (Array.isArray(val)) {
                for (const item of val) {
                    _mergeInfo(getASTNodeInfo(item))
                }
            } else {
                _mergeInfo(getASTNodeInfo(val))
            }
        }
    }
    return info
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
                    if (typeof item == 'object') {
                        nodeCnt += getASTNodeCnt(item)
                    }
                }
            } else {
                nodeCnt += getASTNodeCnt(val)
            }
        }
    }
    return nodeCnt
}

type ASTModifyType =
    | 'node_added'
    | 'node_deleted'
    | 'node_modified'
    | 'attr_added'
    | 'attr_deleted'
    | 'attr_modified'

export type ASTDiffRes = {
    path: [string, string]
    type: ASTModifyType
    nodeCnt?: [NodeCount, NodeCount]
    nodeDelta?: number
    topLineNr?: [number, number]
    botLineNr?: [number, number]
}

export const ASTDiff = (
    rootOld: ASTNode,
    rootNew: ASTNode,
    keyIgnore: string[] = KEY_IGNORE,
    path: string[] = []
): ASTDiffRes[] => {
    const res: ASTDiffRes[] = []
    const diff = (path: string[]) => {
        const _old = utils.get(rootOld, path)
        const _new = utils.get(rootNew, path)
        let delta =
            (_new ? getASTNodeCnt(_new) : 0) - (_old ? getASTNodeCnt(_old) : 0)
        let type: ASTModifyType
        if (_old && _new) {
            if (path[path.length - 1] == 'node') {
                delta =
                    getASTNodeCnt(getMinASTNodeByPath(rootNew, path)) -
                    getASTNodeCnt(getMinASTNodeByPath(rootOld, path))
                path.pop()
                type = 'node_modified'
            } else {
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
            path: [path.join(utils.SAPERATOR), path.join(utils.SAPERATOR)],
            type,
            nodeDelta: delta,
        })
    }
    const localOld = getMinASTNodeByPath(rootOld, path)
    const localNew = getMinASTNodeByPath(rootNew, path)
    if (!localOld && !localNew) return res
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
                    } else {
                        diff([...path, key, child.toString()])
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
export const getMinASTDiff = (
    rootOld: ASTNode,
    rootNew: ASTNode,
    ASTDiff: ASTDiffRes[]
) => {
    const checked: {
        [path: string]: { added: number; deleted: number }
    } = {}
    for (const diff of ASTDiff) {
        if (diff.type.substr(0, 4) == 'attr') {
            continue
        }
        if (!isScopeNodePath(diff.path)) {
            continue
        }
        // TODO: path[0]
        const body: string = diff.path[0]
            .split(utils.SAPERATOR)
            .slice(0, -1)
            .join(utils.SAPERATOR)
        if (!checked[body]) {
            checked[body] = {
                added: 0,
                deleted: 0,
            }
        }
        switch (diff.type) {
            case 'node_modified': {
                checked[body]['added'] += 1
                checked[body]['deleted'] += 1
                break
            }
            case 'node_added': {
                checked[body]['added'] += 1
                break
            }
            case 'node_deleted': {
                checked[body]['deleted'] += 1
                break
            }
        }
    }
    return checked
}

export const ASTDiffAlt = (
    rootOld: ASTNode,
    rootNew: ASTNode,
    options: {
        strictIfConditionCheck?: boolean
    } = {}
    // ASTDiff: ASTDiffRes[]
) => {
    // const checked: string[] = []
    const pending: { old: string[]; new: string[] }[] = []
    const diffRes: ASTDiffRes[] = []
    const astSimilar = (lhs: ASTNode, rhs: ASTNode) => {
        if (lhs.node == rhs.node) {
            if (lhs.node == 'Expr') {
                try {
                    if (
                        lhs['value']['func']['id'] == rhs['value']['func']['id']
                    ) {
                        return true
                    } else {
                        return false
                    }
                } catch {
                    return false
                }
            }
            if (lhs.node == 'Assign') {
                try {
                    deepStrictEqual(
                        lhs['targets'].map((n) => {
                            return {
                                id: n['id'],
                            }
                        }),
                        rhs['targets'].map((n) => {
                            return {
                                id: n['id'],
                            }
                        })
                    )
                    return true
                } catch (e) {
                    return false
                }
            }
            if (lhs.node == 'If' && options.strictIfConditionCheck) {
                try {
                    deepStrictEqual(
                        rmKeys(lhs['test'], KEY_IGNORE),
                        rmKeys(rhs['test'], KEY_IGNORE)
                    )
                    return true
                } catch (e) {
                    return false
                }
            }
            return true
        }
        return false
    }
    const astEqual = (lhs: ASTNode, rhs: ASTNode) => {
        let res = false
        if (lhs.node == rhs.node) {
            const re = new RegExp(
                `((${KEY_IGNORE.map((key) => {
                    return `("${key}")`
                }).join('|')}):\\s{0,}\\d+,{0,})`,
                'gm'
            )
            const _lhs = rmKeys(lhs, KEY_IGNORE)
            const _rhs = rmKeys(rhs, KEY_IGNORE)
            try {
                deepStrictEqual(_lhs, _rhs)
                res = true
            } catch {}
        }
        return res
    }
    // TODO: ASTDiff filter
    pending.push({
        old: ['body'],
        new: ['body'],
    })
    while (pending.length) {
        const body = pending.shift()
        const _oldBody = utils.get(rootOld, body['old']) as ASTNode[]
        const _newBody = utils.get(rootNew, body['new']) as ASTNode[]
        if (typeof _oldBody != 'undefined' && typeof _newBody != 'undefined') {
            const diff = utils.getChanges<ASTNode>(
                _oldBody,
                _newBody,
                astEqual,
                astSimilar
            )
            diff.forEach((_j) => {
                if (_j['oi'] == null) {
                    diffRes.push({
                        path: [
                            undefined,
                            [...body['new'], _j['ni']].join(utils.SAPERATOR),
                        ],
                        type: 'node_added',
                    })
                } else if (_j['ni'] == null) {
                    diffRes.push({
                        path: [
                            [...body['old'], _j['oi']].join(utils.SAPERATOR),
                            undefined,
                        ],
                        type: 'node_deleted',
                    })
                } else if (_j['mod']) {
                    const _oldChild = _oldBody[_j['oi']]
                    const _newChild = _newBody[_j['ni']]
                    if (
                        Array.isArray(_oldChild['body']) &&
                        Array.isArray(_newChild['body'])
                    ) {
                        pending.push({
                            old: [...body['old'], _j['oi'].toString(), 'body'],
                            new: [...body['new'], _j['ni'].toString(), 'body'],
                        })
                    }
                    if (
                        Array.isArray(_oldChild['orelse']) &&
                        Array.isArray(_newChild['orelse'])
                    ) {
                        pending.push({
                            old: [
                                ...body['old'],
                                _j['oi'].toString(),
                                'orelse',
                            ],
                            new: [
                                ...body['new'],
                                _j['ni'].toString(),
                                'orelse',
                            ],
                        })
                    } else {
                        diffRes.push({
                            path: [
                                [...body['old'], _j['oi']].join(
                                    utils.SAPERATOR
                                ),
                                [...body['new'], _j['ni']].join(
                                    utils.SAPERATOR
                                ),
                            ],
                            type: 'node_modified',
                        })
                    }
                }
            })
        }
    }
    diffRes.forEach((res) => {
        const _default: NodeInfo = {
            nodeCnt: null,
            topLineNr: undefined,
            botLineNr: undefined,
        }
        const infOld = res.path[0]
            ? getASTNodeInfo(utils.get(rootOld, res.path[0]))
            : { ..._default }
        const infNew = res.path[1]
            ? getASTNodeInfo(utils.get(rootNew, res.path[1]))
            : { ..._default }
        res.nodeCnt = [infOld.nodeCnt, infNew.nodeCnt]
        res.nodeDelta = infNew.nodeCnt - infOld.nodeCnt
        res.topLineNr = [infOld.topLineNr, infNew.topLineNr]
        res.botLineNr = [infOld.botLineNr, infNew.botLineNr]
        if (res.type == 'node_modified') {
            let _type: ASTModifyType
            const _old = utils.get(rootOld, res.path[0])
            const _new = utils.get(rootNew, res.path[1])
            for (const key of Object.keys(_old)) {
                if (typeof _new[key] != 'undefined') {
                    try {
                        deepStrictEqual(_old[key], _new[key])
                    } catch (e) {
                        _type = 'attr_modified'
                    }
                } else {
                    _type = _type == 'attr_modified' ? 'attr_deleted' : _type
                }
            }
            for (const key of Object.keys(_new)) {
                if (typeof _old[key] != 'undefined') {
                    try {
                        deepStrictEqual(_old[key], _new[key])
                    } catch (e) {
                        _type = 'attr_modified'
                    }
                } else {
                    _type = _type == 'attr_modified' ? 'attr_added' : _type
                }
            }
            res.type = _type
        }
    })
    return diffRes
}
