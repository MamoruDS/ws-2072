type NodeType =
    | 'argument'
    | 'assign'
    | 'called'
    | 'class'
    | 'condition'
    | 'constant'
    | 'object'
    | 'document'
    | 'expression'
    | 'except'
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
    | 'set'
    | 'subscript'
    | 'try'
    | 'tuple'
    | 'variable'
    | 'vector'
    | 'with'

type ASTField = 'args' | 'body' | 'finalbody' | 'handlers' | 'orelse'

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
    | 'finally'
    | 'catch'
    | 'key'
    | 'val'

export { NodeType, ASTField, Tag }

type LiteASTGroup<T extends string> = {
    bigScope: T[]
    pyFn: T[]
    nullPos: T[]
    lineExpression: T[]
}

const GROUP: LiteASTGroup<NodeType> = {
    bigScope: ['document', 'function', 'function.async'],
    pyFn: ['function'],
    nullPos: ['argument', 'operator'],
    lineExpression: ['assign'],
}

const isTypeInGroup = (
    type: NodeType,
    group: keyof LiteASTGroup<NodeType>
): boolean => {
    return GROUP[group].indexOf(type) != -1
}

export { isTypeInGroup }
