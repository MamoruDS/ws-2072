import { deepStrictEqual } from 'assert'
import { genRandomHex } from './utils'

class LiteAST {}

type NodeType =
    | 'class'
    | 'function'
    | 'condition'
    | 'expression'
    | 'constant'
    | 'operator'
    | 'reserved'

type Tag = 'body' | 'left'

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

    constructor(type: NodeType) {
        this._type = type
        this._children = []
        this._tempID = genRandomHex(6)
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
            // children: this._children,
        }
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
    appendChild(tag: Tag, node: LiteNode): void {
        if (node.parentNode) {
            const parent = node.parentNode
            parent.removeChild(node)
        }
        node.parentNode = this
        this._children.push({
            tag,
            node,
        })
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

export { LiteAST }
