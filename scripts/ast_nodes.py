import sys
import os
import json

import ast
from _ast import AST


def ast2json(node):
    global ast_count
    ast_count = 0
    if not isinstance(node, AST):
        raise TypeError('expected AST, got %r' % node.__class__.__name__)

    def _format(node):
        if isinstance(node, AST):
            fields = [('node', _format(node.__class__.__name__))]
            _attrs = ['lineno', 'col_offset']
            try:
                fields += [('lineno', node.lineno)]
                fields += [('end_lineno', node.end_lineno)]
                fields += [('col_offset', node.col_offset)]
                fields += [('end_col_offset', node.end_col_offset)]
            except:
                pass
            try:
                fields += [('lineno', node.body[0].lineno)]
                fields += [('end_lineno', node.body[0].end_lineno)]
                fields += [('col_offset', node.body[0].col_offset)]
                fields += [('end_col_offset', node.body[0].end_col_offset)]
            except:
                pass
            fields += [(a, _format(b)) for a, b in iter_fields(node)]
            global ast_count
            ast_count = ast_count + 1
            return '{ %s }' % ', '.join(
                ('"%s": %s' % field for field in fields))
        if isinstance(node, list):
            return '[ %s ]' % ', '.join([_format(x) for x in node])
        node = str(node)
        return json.dumps(node)

    return _format(node)


def iter_fields(node):
    for field in node._fields:
        try:
            yield field, getattr(node, field)
        except AttributeError:
            pass


def astParse():
    if sys.version_info.major != 3:
        sys.stderr.write(json.dumps({'errType': 'PY_VER'}) + '\n')
        sys.exit(1)
    inputfile = sys.argv[1]
    f = open(inputfile, 'r')
    src = f.read()
    try:
        parsed = ast.parse(src)
        ast_json = ast2json(parsed)
        global ast_count
        sys.stdout.write('{{ "ast_count": {}, "ast_json": {} }}\n'.format(ast_count, ast_json))
    except:
        sys.stderr.write(json.dumps({'errType': 'AST_PARSE'}) + '\n')
        sys.exit(1)
    sys.exit(0)


astParse()
