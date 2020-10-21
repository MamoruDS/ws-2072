import { deepStrictEqual } from 'assert'
import { genRandomHex } from './utils'

import { ASTNode } from './ast'

class LiteAST {}

type NodeType =
    | 'argument'
    | 'assign'
    | 'called'
    | 'class'
    | 'condition'
    | 'constant'
    | 'document'
    | 'expression'
    | 'function'
    | 'index'
    | 'keyword'
    | 'loop'
    | 'operator'
    | 'path'
    | 'reserved'
    | 'subscript'
    | 'tuple'
    | 'variable'
type ASTField = 'body' | 'orelse' | 'args'

type Tag =
    | 'child'
    | 'lhs'
    | 'rhs'
    | 'op'
    | 'arg'
    | 'body'
    | 'base'
    | 'dim'
    | 'lower'
    | 'upper'
    | 'step'
    | 'target'

type TagChild = {
    tag: Tag
    node: LiteNode
}

class LiteNode {
    private readonly _type: NodeType
    private readonly _value: any
    private _parent: LiteNode
    private _children: TagChild[]
    private _tempID: string
    _debug: boolean

    constructor(type: NodeType, value?: any) {
        this._type = type
        this._value = value
        this._children = []
        this._tempID = genRandomHex(6)
        this._debug = false
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
    getNodeByType = (type: NodeType): LiteNode[] => {
        return this._walk(this).filter((node) => {
            return node._type == type
        })
    }
    getRootNode = (): LiteNode => {
        let node: LiteNode = this
        while (true) {
            if (node._parent) {
                node = node._parent
            } else {
                break
            }
        }
        return node
    }
    removeChild = (child: LiteNode): void => {
        for (const i in this._children) {
            if (this._children[i].node.id == child.id) {
                this._children.splice(parseInt(i), 1)
                break
            }
        }
    }
    toJSON(): string {
        return JSON.stringify({
            type: this._type,
            value: this._value,
        })
    }
}

const tagGen = (field: ASTField): Tag => {
    // if (field == 'body') {
    //     return 'child'
    // }
    return 'child'
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
    } = {}
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
            BitOr: 'or',
            BitAnd: 'and',
            Div: 'division',
            Eq: 'eq',
            Gt: 'gt',
            Gte: 'geq',
            Lt: 'lt',
            LtE: 'leq',
            Mod: 'mod',
            Mult: 'multiple',
            Not: 'boolNot',
            NotEq: 'neq',
            Or: 'boolOr',
            Sub: 'minus',
            // TODO:
            // USub:
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
            tag: 'lhs',
        })
    } else if (_t == 'Attribute') {
        prop.type = 'path'
        prop.hasChild = false
        prop.node = getExprPath(node)
        if (father) father.appendChild('child', prop.node, inf.appendAtBegin)
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
        if (father) father.appendChild('child', prop.node, inf.appendAtBegin)
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
    } else if (_t == 'Div') {
        GSOperator()
    } else if (_t == 'Eq') {
        GSOperator()
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
        // TODO:
    } else if (_t == 'ImportFrom') {
        // TODO:
    } else if (_t == 'In') {
        // TODO:
    } else if (_t == 'Index') {
        prop.type = 'index'
        prop.value = 'index'
        prop.hasChild = false
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
    } else if (_t == 'JoinedStr') {
        // TODO:
    } else if (_t == 'List') {
        // TODO:
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
    } else if (_t == 'Not') {
        GSOperator()
    } else if (_t == 'NotEq') {
        GSOperator()
    } else if (_t == 'Or') {
        GSOperator()
    } else if (_t == 'Pass') {
        prop.type = 'reserved'
        prop.value = 'pass'
        prop.hasChild = false
    } else if (_t == 'Return') {
        prop.type = 'reserved'
        prop.hasChild = false
        _loadFromAST(node['value'] as ASTNode, prop.this, {
            tag: 'body',
        })
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
    } else if (_t == 'Store') {
        // ignored
    } else if (_t == 'Sub') {
        GSOperator()
    } else if (_t == 'Subscript') {
        prop.type = 'path'
        prop.hasChild = false
        prop.node = getExprPath(node)
        if (father) father.appendChild('child', prop.node, inf.appendAtBegin)
    } else if (_t == 'Tuple') {
        prop.type = 'tuple'
        for (const _item of node['elts']) {
            _loadFromAST(_item, prop.this, {
                tag: 'child',
            })
        }
    } else if (_t == 'USub') {
        GSOperator()
    } else if (_t == 'UnaryOp') {
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
        } else {
            throw new Error(
                `cannot handle unknown UnaryOP with operator: "${node['op']['node']}"`
            )
        }
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
    }
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
    if (prop.hasChild) {
        for (const field of ['body', 'orelse', 'args'] as ASTField[]) {
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
    return prop.node
}

const loadFromAST = (node: ASTNode): LiteNode => {
    return _loadFromAST(node)
}

const a = []

export { LiteAST, loadFromAST }
