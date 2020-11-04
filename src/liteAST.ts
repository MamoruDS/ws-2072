import { deepStrictEqual } from 'assert'
import { genRandomHex, getChanges } from './utils'

import { ASTNode, getAST, KEY_IGNORE, rmKeys } from './ast'

import { NodeType, ASTField, Tag } from './liteAST.constant'
import { isTypeInGroup } from './liteAST.constant'

class LiteAST {}

type TagChild = {
    tag: Tag
    node: LiteNode
}

type ExtPYType = 'Bool' | 'Str' | 'Number' | 'Null'

const getExtPYType = (code: string): ExtPYType => {
    if (code == 'True' || code == 'False') return 'Bool'
    if (code == 'Null') return 'Null'
    if (!isNaN(parseInt(code))) return 'Number'
    return 'Str'
}

const deepEq = (lhs: any, rhs: any): boolean => {
    try {
        deepStrictEqual(lhs, rhs)
    } catch {
        return false
    }
    return true
}

export class LiteNode {
    private readonly _type: NodeType
    private readonly _value: any
    private _parent: LiteNode
    private _children: TagChild[]
    private _document: string
    private _tempID: string
    private _coopID: string
    private _offset: [number | null, number | null]
    private _line: [number | null, number | null]
    _debug: boolean

    constructor(type: NodeType, value?: any) {
        this._type = type
        this._value = value
        this._children = []
        this._tempID = genRandomHex(6)
        this._offset = [null, null]
        this._line = [null, null]
        this._debug = false
    }

    get type(): NodeType {
        return this._type
    }
    get value(): any {
        return this._value
    }
    get childNodes(): TagChild[] {
        return this._children
    }
    get childNodeCount(): number {
        return this._children.length
    }
    get parentNode(): LiteNode {
        return this._parent
    }
    set parentNode(node: LiteNode) {
        this._parent = node
    }
    get id(): string {
        return this._tempID
    }
    get coID(): string {
        return this._coopID
    }
    set coID(coopID: string) {
        this._coopID = coopID
    }
    get tag(): string {
        return this._parent
            ? this._parent.childNodes.filter((child) => {
                  return child.node.id == this._tempID
              })[0].tag
            : undefined
    }
    get document(): string | undefined {
        if (this.type == 'document') return this._document
        const _doc = this._document || this.getRootNode().document
        const _line = this.line
        const _offset = this.offset
        if (isTypeInGroup(this.type, 'nullPos')) {
            return this._value // TBD
        }
        if (_doc && _line[0] != null) {
            const _local = _doc.split('\n').slice(_line[0] - 1, _line[1])
            const _1 = _local.length - 1
            if (_1 == 0) {
                _local[0] = _local[0].substring(_offset[0], _offset[1])
            } else {
                _local[0] = _local[0].substr(_offset[0])
                _local[_1] = _local[_1].substring(0, _offset[1])
            }
            return _local.join('\n')
        }
        // undefined document causing failed in _indentFix
        return undefined // TBD
    }
    get code(): string {
        let code: string
        const _getChildrenByTag = (tags: Tag[]): TagChild[] => {
            return this.childNodes.filter((child) => {
                let _eq = false
                tags.forEach((tag) => {
                    if (tag == child.tag) _eq = true
                })
                return _eq
            })
        }
        const _parse = (value: string): string => {
            let _res: string = value
            if (isNaN(parseInt(value))) {
                if (value != 'False' && value != 'True' && value != 'Null') {
                    _res = `"${value}"`
                }
            }
            return _res
        }
        switch (this._type) {
            case 'assign':
                code = [
                    _getChildrenByTag(['lhs'])[0].node.code,
                    '=',
                    _getChildrenByTag(['rhs'])[0].node.code,
                ].join(' ')
                break
            case 'condition':
                code = `if ${_getChildrenByTag(['body'])[0].node.code}:`
                break
            case 'constant':
                code = _parse(this._value)
                break
            case 'document':
                code = '[LiteAST.document]'
                break
            case 'expression':
                code = [
                    _getChildrenByTag(['lhs'])[0].node.code,
                    _getChildrenByTag(['op'])[0].node.code,
                    _getChildrenByTag(['rhs'])[0].node.code,
                ].join(' ')
                break
            case 'operator':
                switch (this._value) {
                    case 'add':
                        code = '+'
                        break
                    case 'boolAnd':
                        code = 'and'
                        break
                    case 'or':
                        code = '|'
                        break
                    case 'and':
                        code = '&'
                        break
                    case 'division':
                        code = '/'
                        break
                    case 'eq':
                        code = '=='
                        break
                    case 'gt':
                        code = '>'
                        break
                    case 'geq':
                        code = '>='
                        break
                    case 'lt':
                        code = '<'
                        break
                    case 'leq':
                        code = '<='
                        break
                    case 'mod':
                        code = '%'
                        break
                    case 'multiple':
                        code = '*'
                        break
                    case 'boolNot':
                        code = 'not'
                        break
                    case 'neq':
                        code = '!='
                        break
                    case 'boolOr':
                        code = 'or'
                        break
                    case 'minus':
                        code = '-'
                        break
                    default:
                        code = this._value
                }
                break
            case 'path':
                code = _getChildrenByTag(['child'])
                    .map((child) => {
                        const _head = child.node._value
                        const _body = child.node.childNodeCount
                            ? child.node.childNodes
                                  .filter((_arg) => {
                                      return _arg.tag == 'arg'
                                  })
                                  .map((_arg) => {
                                      return _arg.node.code
                                  })
                                  .join(',')
                            : undefined
                        return `${_head}${_body ? `(${_body})` : ''}`
                    })
                    .join('.')
                break
            case 'variable':
                code = this._value
                break
            case 'vector':
                code = this.childNodes
                    .filter((child) => {
                        return child.tag == 'child'
                    })
                    .map((child) => {
                        return child.node.code
                    })
                    .join(', ')
                code = `[${code}]`
                break
        }
        return code
    }
    get line(): [number | null, number | null] {
        let line = this._line
        while (typeof line == 'undefined') {
            try {
                line = this.parentNode.line
            } catch (e) {
                if (e instanceof ReferenceError) {
                    line = [null, null]
                    break
                }
                throw e
            }
        }
        if (this._type == 'function' || this._type == 'function.async') {
            // getting lines of whole document
            const lines = this.getRootNode().document.split('\n')
            // finding head of function
            while (lines[line[0] - 1].match(/^\s{0,}(async\s)?def\s/) == null) {
                line[0] -= 1
                if (line[0] == 0) {
                    line = [null, null]
                    break
                }
            }
            // finding tail line number by child
            for (const _child of this._children) {
                // switch to node.line when child.line independent with parent's
                if (_child.node._line[1] > line[1]) {
                    line[1] = _child.node._line[1]
                }
            }
        }
        return line
    }
    get offset(): [number | null, number | null] {
        let offset = this._offset
        if (['function', 'function.async', 'module']) {
            offset = [0, Infinity]
        } else {
            while (typeof offset == 'undefined') {
                try {
                    offset = this.parentNode.offset
                } catch (e) {
                    if (e instanceof ReferenceError) {
                        offset = [null, null]
                        break
                    }
                    throw e
                }
            }
        }
        return offset
    }
    _setPosition(
        line_top: number,
        line_bot: number,
        offset_left: number,
        offset_right: number
    ) {
        this._line = [
            typeof line_top == 'number' ? line_top : null,
            typeof line_bot == 'number' ? line_bot : null,
        ]
        this._offset = [
            typeof offset_left == 'number' ? offset_left : null,
            typeof offset_right == 'number' ? offset_right : null,
        ]
    }
    setDocument(doc: string) {
        this._document = doc
        // TODO: doc checking
    }
    // getPosition(
    //     options: {
    //         minScopeType: 'node' | 'line' | 'scope' | 'function'
    //     } = {
    //         minScopeType: 'node',
    //     }
    // ) {
    // }
    getDocument(
        options: {
            indentFix: boolean
            minScopeType: 'node' | 'line' | 'scope' | 'function'
        } = {
            indentFix: true,
            minScopeType: 'node',
        }
    ): string {
        const _indentFix = (lines: string): string => {
            try {
                lines.split('\n')
            } catch (e) {
                if (e instanceof TypeError) {
                    return this.getDocument({
                        indentFix: options.indentFix,
                        minScopeType: 'scope',
                    })
                } else {
                    throw e
                }
            }
            const _lines = lines.split('\n')
            let _minIndent = Infinity
            _lines.forEach((_line) => {
                try {
                    const _l = _line.match(/^\s{0,}/)[0].length
                    _minIndent = _l < _minIndent ? _l : _minIndent
                } catch {}
            })
            return _lines
                .map((_line) => {
                    return _line.substr(_minIndent)
                })
                .join('\n')
        }
        if (options.minScopeType == 'node') {
            return _indentFix(this.document)
        }
        const _line = this.line
        if (options.minScopeType == 'line') {
            let node: LiteNode = this
            while (true) {
                if (typeof node.parentNode == 'undefined') break
                if (!isTypeInGroup(node.parentNode.type, 'bigScope')) {
                    node = node.parentNode
                } else {
                    break
                }
            }
            return _indentFix(node.document)
        }
        if (options.minScopeType == 'scope') {
            // TODO:
            return this.getDocument({
                indentFix: options.indentFix,
                minScopeType: 'function',
            })
        }
        if (options.minScopeType == 'function') {
            let node: LiteNode = this
            while (true) {
                if (typeof node.parentNode == 'undefined') break
                if (!isTypeInGroup(node.type, 'pyFn')) {
                    node = node.parentNode
                } else {
                    break
                }
            }
            return _indentFix(node.document)
        }
    }

    _sum(): object {
        return {
            type: this._type,
            value: this._value,
            children: JSON.stringify(this._children),
        }
    }
    _DEBUG(
        options: {
            ignoreTag?: boolean
        } = {}
    ): object {
        const out = {
            type: this._type,
            value: this._value,
            children: this._children.map((child) => {
                if (options.ignoreTag) {
                    return child.node._DEBUG(options)
                } else {
                    return {
                        tag: child.tag,
                        node: child.node._DEBUG(options),
                    }
                }
            }),
        }
        if (out.children.length == 0) delete out.children
        return out
    }
    private _walk = (node: LiteNode, list: LiteNode[] = []): LiteNode[] => {
        list.push(node)
        for (const child of node.childNodes) {
            this._walk(child.node, list)
        }
        return list
    }
    sameWith(node: LiteNode): boolean {
        try {
            deepStrictEqual(this._sum(), node._sum())
            return true
        } catch {}
        return false
    }
    appendChild(tag: Tag, node: LiteNode, appendAtBegin?: boolean): void {
        if (this._debug)
            console.log(`appending '${node.id}' to ${this._tempID}`)

        if (node.parentNode) {
            const parent = node.parentNode
            if (this._debug)
                console.log(
                    `\tremoving '${node.id}' from previous parent '${parent.id}'`
                )
            parent.removeChild(node)
        }
        node.parentNode = this
        if (appendAtBegin) {
            this._children.unshift({
                tag,
                node,
            })
        } else {
            this._children.push({
                tag,
                node,
            })
        }
    }
    getNodeById = (id: string): LiteNode => {
        return this._walk(this).filter((node) => {
            return node.id == id
        })[0]
    }
    getNodesByType = (type: NodeType): LiteNode[] => {
        return this._walk(this).filter((node) => {
            return node._type == type
        })
    }
    getNodesByTypes = (types: NodeType[]): LiteNode[] => {
        return this._walk(this).filter((node) => {
            return types.indexOf(node._type) != -1
        })
    }
    getAllSubNodes = (): LiteNode[] => {
        // this method will return `this`
        return this._walk(this).filter((node) => {
            return true
        })
    }
    getRootNode = (): LiteNode => {
        return this.getPathToRoot()[0]
    }
    getPathToRoot = (): LiteNode[] => {
        let path: LiteNode[] = [this]
        while (true) {
            if (path[0]._parent) {
                path.unshift(path[0]._parent)
            } else {
                break
            }
        }
        return path
    }
    removeChild = (child: LiteNode): void => {
        for (const i in this._children) {
            if (this._children[i].node.id == child.id) {
                this._children.splice(parseInt(i), 1)
                break
            }
        }
    }
    distanceTo = (id: string, _oneway?: boolean): number => {
        const _root = this.getRootNode()
        if (_root.getNodeById(id)) {
            let node: LiteNode = this
            let distance = 0
            while (node.id != id) {
                if (this.getNodeById(id)) {
                    // to bot
                    for (const _child of node.childNodes) {
                        if (_child.node.id == id) {
                            node = _child.node
                            break
                        }
                    }
                } else {
                    // to top
                    node = node.parentNode
                }
                distance += 1
            }
            return distance
        } else {
            return -1
        }
    }
    toJSON(): string {
        return JSON.stringify({
            type: this._type,
            value: this._value,
        })
    }
}

type LiteASTDiffRes = {
    id: [string, string]
    type: 'node_added' | 'node_deleted' | 'value_modified'
}

const diffLiteNode = (
    lhs: LiteNode,
    rhs: LiteNode,
    options: {
        debugSolve?: boolean
        debugChangeAPI?: boolean
        debugFrom?: boolean
        debugIDS?: boolean
        debugChecking?: boolean
        debugPending?: boolean
        debugDiff?: boolean
    } = {
        // debugSolve: true,
        // debugChangeAPI: true,
        // debugFrom: true,
        // debugIDS: true,
        // debugChecking: true,
        // debugPending: true,
        // debugDiff: true,
    }
): LiteASTDiffRes[] => {
    const _OPT = options
    const pending: { id: string; lhs: TagChild; rhs: TagChild }[] = []
    const res: LiteASTDiffRes[] = []
    const isSimilar = (lhs: TagChild, rhs: TagChild): boolean => {
        let res = false
        if (lhs.node.type == rhs.node.type) {
            if (false) {
            } else if (lhs.node.type == 'assign') {
                res = deepEq(
                    lhs.node.childNodes
                        .filter((_child) => {
                            return _child.tag == 'lhs'
                        })[0]
                        .node._DEBUG(),
                    rhs.node.childNodes
                        .filter((_child) => {
                            return _child.tag == 'lhs'
                        })[0]
                        .node._DEBUG()
                )
            } else if (lhs.node.type == 'constant') {
                res =
                    getExtPYType(lhs.node.value) == getExtPYType(rhs.node.value)
            } else if (lhs.node.type == 'document') {
                res = false
            } else if (isTypeInGroup(lhs.node.type, 'pyFn')) {
                res = lhs.node.value == rhs.node.value
            } else {
                res = true
            }
        }
        return res
    }
    const isEqual = (lhs: TagChild, rhs: TagChild): boolean => {
        let res = false
        if (lhs.node.type == rhs.node.type) {
            try {
                deepStrictEqual(lhs.node._DEBUG(), rhs.node._DEBUG())
                res = true
            } catch (e) {
                // console.log(e)
            }
        }
        return res
    }
    const _verticalHistSearch = (
        cur: TagChild,
        searchFrom: string[],
        options: {
            ignoreParentCheck?: boolean
        } = {}
    ) => {
        const res = {
            _found: false,
        }
        const _getNodeById = (_id: string): LiteNode => {
            return rhs.getNodeById(_id) || lhs.getNodeById(_id)
        }
        const _from = searchFrom.filter((_id) => {
            const _child = _getNodeById(_id)
            const _curPID = cur.node.parentNode
                ? cur.node.parentNode.id
                : undefined
            const _curPCoID = cur.node.parentNode
                ? cur.node.parentNode.coID
                : undefined
            const _childPID = _child.parentNode
                ? _child.parentNode.id
                : undefined
            const _childPCoID = _child.parentNode
                ? _child.parentNode.coID
                : undefined
            const _comp = options.ignoreParentCheck || _childPID == _curPCoID
            if (_OPT.debugIDS)
                console.log({
                    msg: '---- IDS ----',
                    from: _id,
                    curCL: cur.node.code,
                    fromCL: _child.code,
                    curPID: _curPID,
                    curPCoID: _curPCoID,
                    fromPID: _childPID,
                    fromPCoID: _childPCoID,
                    // same: Boolean(_childPID == _curPID),
                    res: Boolean(_comp),
                })
            return _comp
        })
        if (_OPT.debugFrom)
            console.log({
                msg: '---- FROM ----',
                from: _from,
            })
        _from.forEach((_id) => {
            const _target = _getNodeById(_id)
            // TODO: grant more tag from different type of LiteAST
            // const _children = _target.getNodesByType(cur.node.type)
            const _children = _target.getAllSubNodes().sort((a, b) => {
                return a.getPathToRoot.length - b.getPathToRoot.length
            })
            // console.log({
            //     target: _target.code,
            //     subNodes: _children.map((child) => {
            //         return child.code
            //     }),
            //     subPath: _children.map((child) => {
            //         return child
            //             .getPathToRoot()
            //             .map((node) => {
            //                 return node.type
            //             })
            //             .join('/')
            //     }),
            // })
            if (_OPT.debugChecking)
                console.log({
                    msg: '---- CHECKING ----',
                    cur: cur.node.code,
                    target: _target.code,
                })
            let found = false
            for (const _child of _children) {
                try {
                    if (_OPT.debugDiff)
                        console.table({
                            msg: '--- DIFF ---',
                            lhs: _child._DEBUG(),
                            rhs: cur.node._DEBUG(),
                        })
                    deepStrictEqual(_child._DEBUG(), cur.node._DEBUG())
                    found = true
                    let _min: LiteNode = _child
                    while (!_min.coID && _min) {
                        _min = _min.parentNode
                    }
                    const distance = cur.node.distanceTo(_min.coID)
                    console.log({
                        distance,
                    })
                    break
                } catch {}
            }
            if (!found) {
                // for (const _child of _children) {
                //     found = _verticalHistSearch(
                //         { tag: 'body', node: _child },
                //         [cur.node.id],
                //         options
                //     )._found
                //     if (found) break
                // }
            } else {
                res._found = true
            }
        })
        return res
    }
    pending.push({
        id: genRandomHex(4),
        lhs: {
            tag: 'child',
            node: lhs,
        },
        rhs: {
            tag: 'child',
            node: rhs,
        },
    })
    while (pending.length) {
        const check = pending.shift()
        const _lhsChildren = check.lhs.node.childNodes
        const _rhsChildren = check.rhs.node.childNodes
        if (
            (_lhsChildren.length > 0 && _rhsChildren.length > 0) ||
            check.rhs.node.type == 'document'
        ) {
            const _diff = getChanges<TagChild>(
                _lhsChildren,
                _rhsChildren,
                isEqual,
                isSimilar
            )
            if (_OPT.debugChangeAPI)
                console.log({
                    msg: '---- GetChanges ----',
                    diff: _diff,
                })
            // set coopID first
            _diff.forEach((_co) => {
                // if (_co['oi'] != null && _co['ni'] != null && !_co['mod']) {
                if (_co['oi'] != null && _co['ni'] != null) {
                    const _lhsNode = _lhsChildren[_co['oi']]
                    const _rhsNode = _rhsChildren[_co['ni']]
                    _lhsNode.node.coID = _rhsNode.node.id
                    _rhsNode.node.coID = _lhsNode.node.id
                    // console.log({
                    //     _co,
                    //     lID: _lhsNode.node.id,
                    //     lCoID: _lhsNode.node.coID,
                    //     rID: _rhsNode.node.id,
                    //     rCoID: _rhsNode.node.coID,
                    // })
                }
            })
            // ^ set coopID done.
            _diff.forEach((_co) => {
                if (_co['oi'] == null) {
                    // node added
                    _verticalHistSearch(
                        _rhsChildren[_co['ni']],
                        res
                            .filter((_r) => {
                                return (
                                    typeof _r.id[0] != 'undefined' &&
                                    typeof _r.id[1] == 'undefined'
                                )
                            })
                            .map((_r) => {
                                return _r.id[0]
                            })
                    )
                    res.push({
                        id: [undefined, _rhsChildren[_co['ni']].node.id],
                        type: 'node_added',
                    })
                    if (_OPT.debugSolve)
                        console.log({
                            msg: `---- SOLVE [${check.id}] ----`,
                            lhs: undefined,
                            rhs: {
                                type: _rhsChildren[_co['ni']].node.type,
                                code: _rhsChildren[_co['ni']].node.code,
                            },
                        })
                }
                if (_co['ni'] == null) {
                    // node deleted
                    _verticalHistSearch(
                        _lhsChildren[_co['oi']],
                        res
                            .filter((_r) => {
                                return (
                                    typeof _r.id[0] == 'undefined' &&
                                    typeof _r.id[1] != 'undefined'
                                )
                            })
                            .map((_r) => {
                                return _r.id[1]
                            })
                    )
                    res.push({
                        id: [_lhsChildren[_co['oi']].node.id, undefined],
                        type: 'node_deleted',
                    })
                    if (_OPT.debugSolve)
                        console.log({
                            msg: `---- SOLVE [${check.id}] ----`,
                            lhs: {
                                type: _lhsChildren[_co['oi']].node.type,
                                code: _lhsChildren[_co['oi']].node.code,
                            },
                            rhs: undefined,
                        })
                }
                if (_co['mod']) {
                    const _lhsChild = _lhsChildren[_co['oi']]
                    const _rhsChild = _rhsChildren[_co['ni']]
                    const _pendingId = genRandomHex(4)
                    pending.push({
                        id: _pendingId,
                        lhs: _lhsChild,
                        rhs: _rhsChild,
                    })
                    if (_OPT.debugPending) {
                        console.log({
                            msg: '---- PENDING ----',
                            id: _pendingId,
                            // lta: _lhsChild.tag,
                            // lty: _lhsChild.node.type,
                            lc: _lhsChild.node.code,
                            // rta: _rhsChild.tag,
                            // rty: _lhsChild.node.type,
                            rc: _rhsChild.node.code,
                        })
                    }
                }
            })
        } else {
            const _lhsNode = check.lhs.node
            const _rhsNode = check.rhs.node
            res.push({
                id: [_lhsNode.id, _rhsNode.id],
                type: 'value_modified',
            })
            if (_OPT.debugSolve)
                console.log({
                    msg: `---- SOLVE [${check.id}] ----`,
                    lhs: {
                        type: _lhsNode.type,
                        value: _lhsNode['_value'],
                    },
                    rhs: {
                        type: _rhsNode.type,
                        value: _rhsNode['_value'],
                    },
                })
        }
    }
    return res
}

const getExprPath = (node: ASTNode): LiteNode => {
    const path = new LiteNode('path')
    let _i = 0
    while (_i < 1000) {
        const called = node['called']
        const keywords = node['keywords']
        const args = node['args']
        let _cur: LiteNode = undefined
        if (node['node'] == 'Call') {
            node = {
                ...node['func'],
                called: true,
                args: node['args'],
                keywords: node['keywords'],
            }
        } else if (node['node'] == 'Attribute') {
            _cur = createLiteNode(
                node['called'] ? 'called' : 'variable',
                node['attr'],
                path,
                {
                    // TODO: change tag
                    tag: 'child',
                    appendAtBegin: true,
                }
            )
            node = node['value'] as ASTNode
        } else if (node['node'] == 'Subscript') {
            const _type = node['slice'] ? 'slice' : undefined
            const _subscript = createLiteNode('subscript', _type, path, {
                tag: 'child',
                appendAtBegin: true,
            })
            if (_type == 'slice') {
                _loadFromAST(node['slice'], _subscript, {
                    tag: 'body',
                })
            }
            node = { ...(node['value'] as ASTNode) }
        } else if (node['node'] == 'Name') {
            _cur = createLiteNode('variable', node['id'], path, {
                // TODO: change tag
                tag: 'child',
                appendAtBegin: true,
            })
            _i += 9999
        }
        if (called && Array.isArray(args)) {
            for (const _arg of args) {
                _loadFromAST(_arg, _cur, {
                    tag: 'arg',
                })
            }
        }
        if (called && Array.isArray(keywords)) {
            for (const _arg of keywords) {
                _loadFromAST(_arg, _cur, {
                    tag: 'arg',
                })
            }
        }
        _i += 1
    }
    return path
}

const createLiteNode = (
    type: NodeType,
    value?: any,
    father?: LiteNode,
    options: {
        tag?: Tag
        appendAtBegin?: boolean
    } = {}
): LiteNode => {
    const node = new LiteNode(type, value)
    if (father) father.appendChild(options.tag, node, options.appendAtBegin)
    return node
}

const _loadFromAST = (
    node: ASTNode,
    father?: LiteNode,
    inf: {
        tag?: Tag
        appendAtBegin?: boolean
    } = {},
    options: {
        plainExceptHandlerType?: boolean
        parseDict?: boolean
        panicUnknownUnaryOp?: boolean
        lessTypeSetAsTuple?: boolean
    } = {
        plainExceptHandlerType: false,
        // parseDict: true,
        panicUnknownUnaryOp: false,
        lessTypeSetAsTuple: false,
    }
): LiteNode => {
    const prop = {
        value: null,
        tag: inf.tag,
        hasChild: true,
        this: createLiteNode('reserved'),
    } as {
        node: LiteNode
        type: NodeType
        value: any
        hasChild: boolean
        tag: Tag
        this: LiteNode
    }
    if (typeof node == 'string') return
    const _t = node['node']
    const GSOperator = () => {
        const list = {
            Add: 'add',
            And: 'boolAnd',
            BitAnd: 'and',
            BitOr: 'or',
            BitXor: 'xor',
            Div: 'division',
            Eq: 'eq',
            FloorDiv: 'divisionFloor',
            Is: 'is',
            IsNot: 'isnot',
            Gt: 'gt',
            Gte: 'geq',
            LShift: 'lShift',
            Lt: 'lt',
            LtE: 'leq',
            Mod: 'mod',
            Mult: 'multiple',
            Not: 'boolNot',
            NotEq: 'neq',
            NotIn: 'notIn',
            Or: 'boolOr',
            Pow: 'power',
            RShift: 'rShift',
            Sub: 'minus',
            UAdd: 'negative',
            USub: 'positive',
        }
        prop.type = 'operator'
        prop.value = list[node['node']]
        prop.hasChild = false
    }
    if (false) {
    } else if (_t == 'Add') {
        GSOperator()
    } else if (_t == 'And') {
        GSOperator()
    } else if (_t == 'AnnAssign') {
        // ignored
    } else if (_t == 'Assert') {
        prop.type = 'reserved'
        prop.value = 'assert'
        prop.hasChild = false
        _loadFromAST(node['test'], prop.this, {
            tag: 'body',
        })
    } else if (_t == 'Assign') {
        prop.type = 'assign'
        prop.hasChild = false
        _loadFromAST(node['targets'][0], prop.this, {
            tag: 'lhs',
        })
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'rhs',
        })
    } else if (_t == 'AsyncFunctionDef') {
        prop.type = 'function.async'
        prop.value = node['name']
        prop.hasChild = true
        if (!Array.isArray(node['args'])) {
            const _arguments = node['args']
            if (Array.isArray(_arguments['args'])) {
                for (const _i in _arguments['args']) {
                    const _arg = createLiteNode(
                        'argument',
                        _arguments['args'].slice().reverse()[_i]['arg'],
                        prop.this,
                        {
                            tag: 'arg',
                            appendAtBegin: true,
                        }
                    )
                    // TODO: alternative tag: default
                    const _default = _arguments['defaults'] //
                        .slice()
                        .reverse()[_i]
                    if (_default) {
                        _loadFromAST(_default, _arg, {
                            tag: 'body',
                        })
                    }
                }
            }
        }
    } else if (_t == 'Attribute') {
        prop.type = 'path'
        prop.hasChild = false
        prop.node = getExprPath(node)
        if (father) {
            father.appendChild(inf.tag || 'child', prop.node, inf.appendAtBegin)
        }
    } else if (_t == 'AugAssign') {
        prop.type = 'assign'
        prop.hasChild = false
        _loadFromAST(node['target'], prop.this, {
            tag: 'lhs',
        })
        _loadFromAST(
            {
                node: 'BinOp',
                left: node['target'],
                op: node['op'],
                right: node['value'] as ASTNode,
            },
            prop.this,
            {
                tag: 'rhs',
            }
        )
    } else if (_t == 'Await') {
        prop.type = 'reserved'
        prop.value = 'await'
        prop.hasChild = false
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == 'BinOp') {
        prop.type = 'expression'
        prop.hasChild = false
        _loadFromAST(node['left'], prop.this, {
            tag: 'lhs',
        })
        _loadFromAST(node['op'], prop.this, {
            tag: 'op',
        })
        _loadFromAST(node['right'], prop.this, {
            tag: 'rhs',
        })
    } else if (_t == 'BitAnd') {
        GSOperator()
    } else if (_t == 'BitOr') {
        GSOperator()
    } else if (_t == 'BitXor') {
        GSOperator()
    } else if (_t == 'BoolOp') {
        prop.type = 'expression'
        prop.hasChild = false
        _loadFromAST(node['values'][0], prop.this, {
            tag: 'lhs',
        })
        _loadFromAST(node['op'], prop.this, {
            tag: 'op',
        })
        _loadFromAST(node['values'][1], prop.this, {
            tag: 'rhs',
        })
    } else if (_t == 'Break') {
        prop.type = 'reserved'
        prop.hasChild = false
    } else if (_t == 'Call') {
        prop.type = 'path'
        prop.hasChild = false
        prop.node = getExprPath(node)
        if (father) {
            father.appendChild(inf.tag || 'child', prop.node, inf.appendAtBegin)
        }
    } else if (_t == 'ClassDef') {
        prop.type = 'class'
        prop.value = node['name']
        prop.hasChild = true
        // TODO: extends keywords?
        for (const _b of node['bases']) {
            _loadFromAST(_b, prop.this, {
                tag: 'base',
            })
        }
    } else if (_t == 'Compare') {
        prop.type = 'expression'
        prop.hasChild = false
        _loadFromAST(node['left'], prop.this, {
            tag: 'lhs',
        })
        // TODO:
        _loadFromAST(node['ops'][0], prop.this, {
            tag: 'op',
        })
        _loadFromAST(node['comparators'][0], prop.this, {
            tag: 'rhs',
        })
    } else if (_t == 'Constant') {
        prop.type = 'constant'
        prop.value = node['value']
        prop.hasChild = false
    } else if (_t == 'Continue') {
        prop.type = 'reserved'
        prop.value = 'continue'
        prop.hasChild = false
    } else if (_t == 'Del') {
        // ignored
    } else if (_t == 'Delete') {
        prop.type = 'reserved'
        prop.value = 'del'
        prop.hasChild = false
        for (const _target of node['targets']) {
            _loadFromAST(_target, prop.this, {
                tag: 'body',
            })
        }
    } else if (_t == 'Dict') {
        if (options.parseDict) {
            prop.type = 'object'
            prop.hasChild = false
            for (const key of node['keys']) {
                _loadFromAST(key, prop.this, {
                    tag: 'key',
                })
            }
            for (const key of node['values']) {
                _loadFromAST(key, prop.this, {
                    tag: 'val',
                })
            }
        } else {
            prop.type = 'constant'
            prop.value = JSON.stringify(rmKeys(node, KEY_IGNORE))
            prop.hasChild = false
        }
    } else if (_t == 'Div') {
        GSOperator()
    } else if (_t == 'Eq') {
        GSOperator()
    } else if (_t == 'ExceptHandler') {
        prop.type = 'except'
        if (options.plainExceptHandlerType) {
            try {
                prop.value =
                    node['type']['node'] == 'Name'
                        ? node['type']['id']
                        : undefined
            } catch {
                prop.value = undefined
            }
        } else {
            if (node['type']) {
                _loadFromAST(node['type'], prop.this, {
                    tag: 'body',
                    appendAtBegin: true,
                })
            }
        }
        prop.hasChild = true
    } else if (_t == 'Expr') {
        prop.node = _loadFromAST(node['value'] as ASTNode, father, inf)
    } else if (_t == 'ExtSlice') {
        prop.type = 'index'
        prop.value = 'extSlice'
        prop.hasChild = false
        for (const _d of node['dims']) {
            _loadFromAST(_d, prop.this, {
                tag: 'dim',
            })
        }
    } else if (_t == 'FloorDiv') {
        GSOperator()
    } else if (_t == 'For') {
        prop.type = 'loop'
        prop.hasChild = true
        // TODO: better option
        _loadFromAST(node['target'], prop.this, {
            tag: 'target',
        })
        _loadFromAST(node['iter'], prop.this, {
            tag: 'body',
        })
    } else if (_t == 'FormattedValue') {
        // TODO:
    } else if (_t == 'FunctionDef') {
        prop.type = 'function'
        prop.value = node['name']
        prop.hasChild = true
        if (!Array.isArray(node['args'])) {
            const _arguments = node['args']
            if (Array.isArray(_arguments['args'])) {
                for (const _i in _arguments['args']) {
                    const _arg = createLiteNode(
                        'argument',
                        _arguments['args'].slice().reverse()[_i]['arg'],
                        prop.this,
                        {
                            tag: 'arg',
                            appendAtBegin: true,
                        }
                    )
                    // TODO: alternative tag: default
                    const _default = _arguments['defaults'] //
                        .slice()
                        .reverse()[_i]
                    if (_default) {
                        _loadFromAST(_default, _arg, {
                            tag: 'body',
                        })
                    }
                }
            }
        }
    } else if (_t == 'GeneratorExp') {
        // TODO:
    } else if (_t == 'Global') {
        prop.type = 'reserved'
        prop.value = 'global'
        prop.hasChild = false
        for (const v of node['names'] as string[]) {
            _loadFromAST(
                {
                    node: 'Name',
                    id: v,
                },
                prop.this,
                {
                    tag: 'body',
                }
            )
        }
    } else if (_t == 'Gt') {
        GSOperator()
    } else if (_t == 'GtE') {
        GSOperator()
    } else if (_t == 'If') {
        prop.type = 'condition'
        prop.hasChild = true
        _loadFromAST(node['test'], prop.this, {
            tag: 'body',
        })
    } else if (_t == 'IfExp') {
        // TODO:
    } else if (_t == 'Import') {
        prop.type = 'assign'
        prop.node = prop.this // panic
        prop.hasChild = false
        for (const _mod of node['names']) {
            _loadFromAST(
                {
                    node: 'Assign',
                    targets: [
                        {
                            node: 'Name',
                            id:
                                _mod['asname'] != 'None'
                                    ? _mod['asname']
                                    : _mod['name'],
                        },
                    ],
                    value: {
                        node: '_LiteAST.Module',
                        name: _mod['name'],
                    },
                },
                father,
                inf
            )
        }
    } else if (_t == 'ImportFrom') {
        prop.type = 'assign'
        prop.node = prop.this // panic
        prop.hasChild = false
        for (const _mod of node['names']) {
            _loadFromAST(
                {
                    node: 'Assign',
                    targets: [
                        {
                            node: 'Name',
                            id:
                                _mod['asname'] != 'None'
                                    ? _mod['asname']
                                    : _mod['name'],
                        },
                    ],
                    value: {
                        node: '_LiteAST.Module',
                        name: [node['module'], _mod['name']].join('.'),
                    },
                },
                father,
                inf
            )
        }
    } else if (_t == 'In') {
        // TODO:
    } else if (_t == 'Index') {
        prop.type = 'index'
        prop.value = 'index'
        prop.hasChild = false
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == 'Invert') {
        // implemented in UnaryOp
    } else if (_t == 'Is') {
        GSOperator()
    } else if (_t == 'IsNot') {
        GSOperator()
    } else if (_t == 'JoinedStr') {
        // TODO:
    } else if (_t == 'LShift') {
        GSOperator()
    } else if (_t == 'Lambda') {
        prop.type = 'lambda'
        prop.hasChild = false
        if (!Array.isArray(node['args'])) {
            const _arguments = node['args']
            if (Array.isArray(_arguments['args'])) {
                for (const _i in _arguments['args']) {
                    const _arg = createLiteNode(
                        'argument',
                        _arguments['args'].slice().reverse()[_i]['arg'],
                        prop.this,
                        {
                            tag: 'arg',
                            appendAtBegin: true,
                        }
                    )
                    const _default = _arguments['defaults'] //
                        .slice()
                        .reverse()[_i]
                    if (_default) {
                        _loadFromAST(_default, _arg, {
                            tag: 'body',
                        })
                    }
                }
            }
        }
        _loadFromAST(node['body'] as ASTNode, prop.this, {
            tag: 'child',
        })
    } else if (_t == 'List') {
        prop.type = 'vector'
        prop.hasChild = false
        for (const _element of node['elts']) {
            _loadFromAST(_element, prop.this, {
                tag: 'child',
            })
        }
    } else if (_t == 'ListComp') {
        // TODO:
    } else if (_t == 'Load') {
        // ignored
    } else if (_t == 'Lt') {
        GSOperator()
    } else if (_t == 'LtE') {
        GSOperator()
    } else if (_t == 'Mod') {
        GSOperator()
    } else if (_t == 'Module') {
        prop.type = 'document'
        prop.hasChild = true
    } else if (_t == 'Mult') {
        GSOperator()
    } else if (_t == 'Name') {
        prop.type = 'variable'
        prop.value = node['id']
        prop.hasChild = false
    } else if (_t == 'Nonlocal') {
        prop.type = 'reserved'
        prop.value = 'nonlocal'
        prop.hasChild = false
        for (const v of node['names'] as string[]) {
            _loadFromAST(
                {
                    node: 'Name',
                    id: v,
                },
                prop.this,
                {
                    tag: 'body',
                }
            )
        }
    } else if (_t == 'Not') {
        GSOperator()
    } else if (_t == 'NotEq') {
        GSOperator()
    } else if (_t == 'NotIn') {
        GSOperator()
    } else if (_t == 'Or') {
        GSOperator()
    } else if (_t == 'Pass') {
        prop.type = 'reserved'
        prop.value = 'pass'
        prop.hasChild = false
    } else if (_t == 'Pow') {
        GSOperator()
    } else if (_t == 'RShift') {
        GSOperator()
    } else if (_t == 'Raise') {
        prop.type = 'reserved'
        prop.value = 'raise'
        prop.hasChild = false
        if (node['exc']) {
            _loadFromAST(node['exc'], prop.this, {
                tag: 'body',
            })
        }
    } else if (_t == 'Return') {
        prop.type = 'reserved'
        prop.value = 'return'
        prop.hasChild = false
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == 'Set') {
        if (options.lessTypeSetAsTuple) {
            prop.type = 'tuple'
        } else {
            prop.type = 'set'
        }
        prop.hasChild = false
        for (const _item of node['elts']) {
            _loadFromAST(_item, prop.this, {
                tag: 'child',
            })
        }
    } else if (_t == 'Slice') {
        prop.type = 'index'
        prop.value = 'slice'
        prop.hasChild = false
        for (const _t of ['lower', 'upper', 'step'] as Tag[]) {
            if (typeof node[_t] != 'string') {
                _loadFromAST(node[_t], prop.this, {
                    tag: _t,
                })
            }
        }
    } else if (_t == 'Starred') {
        prop.type = 'reserved'
        prop.value = 'starred'
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == 'Store') {
        // ignored
    } else if (_t == 'Sub') {
        GSOperator()
    } else if (_t == 'Subscript') {
        prop.type = 'path'
        prop.hasChild = false
        prop.node = getExprPath(node)
        if (father) {
            father.appendChild(inf.tag || 'child', prop.node, inf.appendAtBegin)
        }
    } else if (_t == 'Try') {
        prop.type = 'try'
        prop.hasChild = true
    } else if (_t == 'Tuple') {
        prop.type = 'tuple'
        for (const _item of node['elts']) {
            _loadFromAST(_item, prop.this, {
                tag: 'child',
            })
        }
    } else if (_t == 'UAdd') {
        GSOperator()
    } else if (_t == 'USub') {
        GSOperator()
    } else if (_t == 'UnaryOp') {
        // TODO: useful UnaryOp in vary cases
        if (node['op']['node'] == 'Not') {
            prop.type = 'expression'
            prop.hasChild = false
            _loadFromAST(
                {
                    node: 'Constant',
                    value: 'False',
                    kind: 'None',
                },
                prop.this,
                {
                    tag: 'lhs',
                }
            )
            _loadFromAST(
                {
                    node: 'BitAnd',
                },
                prop.this,
                {
                    tag: 'op',
                }
            )
            _loadFromAST(node['operand'], prop.this, {
                tag: 'rhs',
            })
        } else if (node['op']['node'] == 'Invert') {
            prop.type = 'reserved'
            prop.value = 'invert'
            prop.hasChild = false
            _loadFromAST(node['operand'], prop.this, {
                tag: 'body',
            })
        } else if (['USub', 'UAdd'].indexOf(node['op']['node']) != -1) {
            prop.type = 'expression'
            prop.hasChild = false
            _loadFromAST(
                {
                    node: 'Constant',
                    value: '0',
                    kind: 'None',
                },
                prop.this,
                {
                    tag: 'lhs',
                }
            )
            _loadFromAST(
                {
                    node:
                        node['op']['node'] == 'USub'
                            ? 'Sub'
                            : node['op']['node'] == 'UAdd'
                            ? 'Add'
                            : undefined,
                },
                prop.this,
                {
                    tag: 'op',
                }
            )
            _loadFromAST(node['operand'], prop.this, {
                tag: 'rhs',
            })
        } else {
            if (options.panicUnknownUnaryOp) {
                throw new Error(
                    `cannot handle unknown UnaryOP with operator: "${node['op']['node']}"`
                )
            }
        }
    } else if (_t == 'While') {
        prop.type = 'loop'
        prop.hasChild = true
        _loadFromAST(node['test'], prop.this, {
            tag: 'body',
        })
    } else if (_t == 'With') {
        // needs more details
        if (
            node['items']['node'] == 'withitem' &&
            node['items']['node']['context_expr']
        ) {
            prop.type = 'with'
            prop.hasChild = true
            _loadFromAST(node['items']['node']['context_expr'], prop.this, {
                tag: 'body',
            })
        }
    } else if (_t == 'Yield') {
        prop.type = 'reserved'
        prop.value = 'yield'
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == 'alias') {
        // ignored
    } else if (_t == 'arg') {
        // ignored
    } else if (_t == 'arguments') {
        // ignored
    } else if (_t == 'comprehension') {
        // TODO:
    } else if (_t == 'keyword') {
        prop.type = 'keyword'
        prop.value = node['arg']
        prop.hasChild = false
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == '_LiteAST.Module') {
        prop.type = 'module'
        prop.value = node['name']
        prop.hasChild = false
    }
    if (!prop.type) return
    prop.node = prop.node
        ? prop.node
        : createLiteNode(prop.type, prop.value, father, {
              tag: inf.tag,
              appendAtBegin: inf.appendAtBegin,
          })
    while (prop.this.childNodeCount) {
        const _c = prop.this.childNodes[0]
        prop.node.appendChild(_c.tag, _c.node)
    }
    const tagGen = (field: ASTField): Tag => {
        const _f = {
            body: 'child', // TODO: using body instead
            finalbody: 'finally',
            handlers: 'catch',
            orelse: 'else',
        } as { [key in ASTField]: Tag }
        return _f[field] || 'child'
    }
    if (prop.hasChild) {
        for (const field of [
            'args',
            'body',
            'finalbody',
            'handlers',
            'orelse',
        ] as ASTField[]) {
            if (Array.isArray(node[field])) {
                const _f = node[field]
                if (Array.isArray(_f)) {
                    for (const _node of _f) {
                        _loadFromAST(_node, prop.node, {
                            tag: tagGen(field),
                        })
                    }
                }
            }
        }
    }
    prop.node._setPosition(
        node['lineno'],
        node['end_lineno'],
        node['col_offset'],
        node['end_col_offset']
    )
    return prop.node
}

const loadFromAST = (node: ASTNode): LiteNode => {
    return _loadFromAST(node)
}

const loadFromCode = (code: string): LiteNode => {
    const { ast_object } = getAST(code)
    return loadFromAST(ast_object)
}

export { LiteAST, diffLiteNode, loadFromAST, loadFromCode }
