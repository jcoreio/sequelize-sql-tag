// @flow

import Sequelize, {Model} from 'sequelize'

const Literal = Object.getPrototypeOf(Sequelize.literal('foo')).constructor

function sql(
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): {bind: Array<any>, query: string} {
  const parts: Array<string> = []
  const bind: Array<any> = []
  for (let i = 0, length = expressions.length; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]
    if (expression instanceof Literal) {
      parts.push(expression.val)
    } else if (expression && expression.prototype instanceof Model) {
      const {QueryGenerator, tableName} = (expression: any)
      parts.push(QueryGenerator.quoteTable(tableName))
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      const {field, Model: {QueryGenerator}} = (expression: any)
      parts.push(QueryGenerator.quoteIdentifier(field))
    } else {
      bind.push(expression)
      parts.push(`$${bind.length}`)
    }
  }
  parts.push(strings[expressions.length])
  return {bind, query: parts.join('').trim().replace(/\s+/g, ' ')}
}

module.exports = sql
