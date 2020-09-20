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
            fields += [(a, _format(b)) for a, b in iter_fields(node)]
            global ast_count
            ast_count = ast_count + 1
            return '{ %s }' % ', '.join(
                ('"%s": %s' % field for field in fields))
        if isinstance(node, list):
            return '[ %s ]' % ', '.join([_format(x) for x in node])
        return json.dumps(node)

    return _format(node)


def iter_fields(node):
    for field in node._fields:
        try:
            yield field, getattr(node, field)
        except AttributeError:
            pass


def astParse():
    inputfile = sys.argv[1]
    f = open(inputfile, 'r')
    src = f.read()
    try:
        parsed = ast.parse(src)
        ast_json = ast2json(parsed)
        global ast_count
        sys.stdout.write('{{ "ast_count": {}, "ast_json": {} }}'.format(ast_count, ast_json))
    except:
        sys.stderr.write('[ERR] parse error')
        sys.exit(1)
    sys.exit(0)


astParse()
