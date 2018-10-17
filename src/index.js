// @flow

import Sequelize, {Model} from 'sequelize'

type QueryGenerator = $Call<<T>({QueryGenerator: T}) => T, Class<Model<any>>>

const Literal = Object.getPrototypeOf(Sequelize.literal('foo')).constructor
const sqlOutput = Symbol('sqlOutput')
const queryGeneratorSymbol = Symbol('queryGenerator')

function sql(
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): [string, {bind: Array<any>}] {
  const parts: Array<string> = []
  const bind: Array<any> = []
  let queryGenerator
  for (let i = 0, length = expressions.length; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]
    if (expression instanceof Literal) {
      parts.push(expression.val)
    } else if (expression instanceof Object && expression[sqlOutput]) {
      const [query, options] = expression
      parts.push(query.replace(/(\$+)(\d+)/g, (match: string, dollars: string, index: string) =>
        dollars.length % 2 === 0
          ? match
          : `${dollars}${parseInt(index) + bind.length}`
      ))
      bind.push(...options.bind)
    } else if (expression && expression.prototype instanceof Model) {
      const {QueryGenerator, tableName} = (expression: any)
      queryGenerator = QueryGenerator
      parts.push(QueryGenerator.quoteTable(tableName))
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      const {field, Model: {QueryGenerator}} = (expression: any)
      queryGenerator = QueryGenerator
      parts.push(QueryGenerator.quoteIdentifier(field))
    } else {
      bind.push(expression)
      parts.push(`$${bind.length}`)
    }
  }
  parts.push(strings[expressions.length])
  const result = [parts.join('').trim().replace(/\s+/g, ' '), {bind}];
  (result: any)[sqlOutput] = true
  if (queryGenerator) (result: any)[queryGeneratorSymbol] = queryGenerator
  return result
}

function findQueryGenerator(expressions: $ReadOnlyArray<mixed>): QueryGenerator {
  for (let i = 0, {length} = expressions; i < length; i++) {
    const expression = expressions[i]
    if (expression instanceof Object && expression[queryGeneratorSymbol]) {
      return expression[queryGeneratorSymbol]
    } else if (expression && expression.prototype instanceof Model) {
      return (expression: any).QueryGenerator
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      return (expression: any).Model.QueryGenerator
    }
  }
  throw new Error(`at least one of the expressions must be a sequelize Model or attribute`)
}

sql.escape = function escapeSql(
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): string {
  const parts: Array<string> = []
  let queryGenerator: ?QueryGenerator
  function getQueryGenerator(): QueryGenerator {
    return queryGenerator || (queryGenerator = findQueryGenerator(expressions))
  }

  for (let i = 0, {length} = expressions; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]
    if (expression instanceof Literal) {
      parts.push(expression.val)
    } else if (expression instanceof Object && expression[sqlOutput]) {
      const [query, options] = expression
      parts.push(query.replace(/(\$+)(\d+)/g, (match: string, dollars: string, index: string) =>
        dollars.length % 2 === 0
          ? match
          : getQueryGenerator().escape(options.bind[parseInt(index) - 1])
      ))
    } else if (expression && expression.prototype instanceof Model) {
      const {tableName} = (expression: any)
      parts.push(getQueryGenerator().quoteTable(tableName))
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      const {field} = (expression: any)
      parts.push(getQueryGenerator().quoteIdentifier(field))
    } else {
      parts.push(getQueryGenerator().escape(expression))
    }
  }
  parts.push(strings[expressions.length])
  return parts.join('').trim().replace(/\s+/g, ' ')
}

module.exports = sql
