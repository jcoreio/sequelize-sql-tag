// @flow

import Sequelize, {Model} from 'sequelize'

const Literal = Object.getPrototypeOf(Sequelize.literal('foo')).constructor

function sql(
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): [string, {bind: Array<any>}] {
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
  return [parts.join('').trim().replace(/\s+/g, ' '), {bind}]
}

sql.escape = function escapeSql(
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): string {
  const parts: Array<string> = []
  let queryGenerator
  for (let i = 0, length = expressions.length; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]
    if (expression instanceof Literal) {
      parts.push(expression.val)
    } else if (expression && expression.prototype instanceof Model) {
      const {QueryGenerator, tableName} = (expression: any)
      queryGenerator = QueryGenerator
      parts.push(QueryGenerator.quoteTable(tableName))
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      const {field, Model: {QueryGenerator}} = (expression: any)
      queryGenerator = QueryGenerator
      parts.push(QueryGenerator.quoteIdentifier(field))
    } else {
      if (!queryGenerator) throw new Error(`at least one of the expressions must be a sequelize Model or attribute`)
      parts.push(queryGenerator.escape(expression))
    }
  }
  parts.push(strings[expressions.length])
  return parts.join('').trim().replace(/\s+/g, ' ')
}

module.exports = sql
