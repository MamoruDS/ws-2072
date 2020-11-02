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
    | 'function.async'
    | 'index'
    | 'keyword'
    | 'lambda'
    | 'loop'
    | 'module'
    | 'operator'
    | 'path'
    | 'reserved'
    | 'subscript'
    | 'tuple'
    | 'variable'
    | 'vector'

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
    | 'else'

export { NodeType, ASTField, Tag }

type LiteASTGroup<T extends string> = {
    bigScope: T[]
    pyFn: T[]
    nullPos: T[]
}

const GROUP: LiteASTGroup<NodeType> = {
    bigScope: ['document', 'function', 'function.async'],
    pyFn: ['function'],
    nullPos: ['argument'],
}

const isTypeInGroup = (
    type: NodeType,
    group: keyof LiteASTGroup<NodeType>
): boolean => {
    return GROUP[group].indexOf(type) != -1
}

export { isTypeInGroup }
