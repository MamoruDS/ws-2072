const list = [
    'Add',
    'Assert',
    'Assign',
    'Attribute',
    'BinOp',
    'BitAnd',
    'Break',
    'Call',
    'ClassDef',
    'Compare',
    'Constant',
    'Div',
    'Eq',
    'Expr',
    'ExtSlice',
    'For',
    'FormattedValue',
    'FunctionDef',
    'Gt',
    'GtE',
    'If',
    'IfExp',
    'Import',
    'ImportFrom',
    'In',
    'Index',
    'JoinedStr',
    'List',
    'ListComp',
    'Load',
    'Lt',
    'LtE',
    'Module',
    'Mult',
    'Name',
    'NotEq',
    'Pass',
    'Return',
    'Slice',
    'Store',
    'Sub',
    'Subscript',
    'Tuple',
    'USub',
    'UnaryOp',
    'alias',
    'arg',
    'arguments',
    'comprehension',
    'keyword',
    'And',
    'BoolOp',
    'Or',
    'Mod',
    'Continue',
    'Not',
    'BitOr',
    '_LiteAST.Module',
    'AsyncFunctionDef',
    'Await',
    'Delete',
    'Del',
    'AugAssign',
    'Lambda',
]

let res

res = list
    .sort()
    .map((i) => `'${i}'`)
    .join('\n    | ')
console.log(`export type ASTType = \n    | ${res}`)

console.log('\n')

res = list
    .sort()
    .map((i) => `'${i}'`)
    .join(',\n    ')
console.log(`export const ASTTypeList: ASTType[] = [\n    ${res}\n]`)
