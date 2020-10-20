import { deepStrictEqual } from 'assert'
import { genRandomHex } from './utils'

import { ASTNode } from './ast'

class LiteAST {}

type NodeType =
    | 'assign'
    | 'called'
    | 'class'
    | 'constant'
    | 'document'
    | 'expression'
    | 'flow'
    | 'function'
    | 'index'
    | 'keyword'
    | 'operator'
    | 'path'
    | 'reserved'
    | 'subscript'
    | 'tuple'
    | 'variable'
type ASTField = 'body' | 'orelse' | 'args'

type Tag = 'child' | 'lhs' | 'rhs' | 'op' | 'args' | 'body'

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
            node = node['value']
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
            node = { ...node['value'] }
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
                    tag: 'args',
                })
            }
        }
        if (called && Array.isArray(keywords)) {
            for (const _arg of keywords) {
                _loadFromAST(_arg, _cur, {
                    tag: 'args',
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
    const _fields: ASTField[] = ['body', 'orelse', 'args']
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
    const _t = node['node']

    if (false) {
    } else if (_t == 'Add') {
        prop.type = 'operator'
        prop.value = 'add'
        prop.hasChild = false
    } else if (_t == 'Assert') {
        prop.type = 'reserved'
        prop.value = 'assert'
        _loadFromAST(node['test'], prop.this, {
            tag: 'body',
        })
        prop.hasChild = false
    } else if (_t == 'Assign') {
        prop.type = 'assign'
        prop.value = null
        prop.hasChild = false
        _loadFromAST(node['targets'][0], prop.this, {
            tag: 'lhs',
        })
        _loadFromAST(node['value'], prop.this, {
            tag: 'lhs',
        })
    } else if (_t == 'Attribute') {
        prop.type = 'path'
        prop.node = getExprPath(node)
        if (father) father.appendChild('child', prop.node, inf.appendAtBegin)
        prop.hasChild = false
    } else if (_t == 'BinOp') {
        prop.type = 'expression'
        _loadFromAST(node['left'], prop.this, {
            tag: 'lhs',
        })
        _loadFromAST(node['op'], prop.this, {
            tag: 'op',
        })
        _loadFromAST(node['right'], prop.this, {
            tag: 'rhs',
        })
        prop.hasChild = false
    } else if (_t == 'Call') {
        prop.type = 'path'
        prop.node = getExprPath(node)
        if (father) father.appendChild('child', prop.node, inf.appendAtBegin)
        prop.hasChild = false
    } else if (_t == 'Compare') {
        prop.type = 'expression'
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
        prop.hasChild = false
    } else if (_t == 'Constant') {
        prop.type = 'constant'
        prop.value = node['value']
        prop.hasChild = false
    } else if (_t == 'Div') {
        prop.type = 'operator'
        prop.value = 'division'
        prop.hasChild = false
    } else if (_t == 'Eq') {
        prop.type = 'operator'
        prop.value = 'equal'
        prop.hasChild = false
    } else if (_t == 'Expr') {
        prop.node = _loadFromAST(node['value'], father, inf)
    } else if (_t == 'For') {
        prop.type = 'flow'
    } else if (_t == 'FunctionDef') {
        prop.type = 'function'
    } else if (_t == 'If') {
        prop.type = 'flow'
    } else if (_t == 'Index') {
        prop.type = 'index'
        _loadFromAST(node['value'], prop.this, {
            tag: 'body',
        })
        prop.hasChild = false
    } else if (_t == 'Module') {
        prop.type = 'document'
    } else if (_t == 'Name') {
        prop.type = 'variable'
        prop.value = node['id']
    } else if (_t == 'Return') {
        prop.type = 'reserved'
    } else if (_t == 'Tuple') {
        prop.type = 'tuple'
        prop.value = null
        for (const _item of node['elts']) {
            _loadFromAST(_item, prop.this, {
                tag: 'child',
            })
        }
    } else if (_t == 'keyword') {
        prop.type = 'keyword'
        prop.value = node['arg']
        _loadFromAST(node['value'], prop.this, {
            tag: 'body',
        })
        prop.hasChild = false
    }
    if (!prop.node) {
        prop.node = createLiteNode(prop.type, prop.value, father, {
            tag: inf.tag,
            appendAtBegin: inf.appendAtBegin,
        })
    }

    // prop.node._debug = true

    while (prop.this.childNodeCount) {
        const _c = prop.this.childNodes[0]
        prop.node.appendChild(_c.tag, _c.node)
    }

    if (prop.hasChild) {
        for (const field of _fields) {
            if (Array.isArray(node[field])) {
                for (const _node of node[field]) {
                    _loadFromAST(_node, prop.node, {
                        tag: tagGen(field),
                    })
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
