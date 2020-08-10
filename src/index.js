// @flow

import Sequelize, { Model, type QueryOptions } from 'sequelize'

type QueryGenerator = $Call<<T>({ QueryGenerator: T }) => T, Class<Model<any>>>

const Literal = Object.getPrototypeOf(Sequelize.literal('foo')).constructor
const sqlOutput = Symbol('sqlOutput')
const queryGeneratorSymbol = Symbol('queryGenerator')

class ValuesRow {
  value: string
  constructor(value: string) {
    this.value = value
  }
}

function isValuesArray(expression: any): boolean {
  if (!Array.isArray(expression)) return false
  for (let i = 0; i < expression.length; i++) {
    if (!(expression[i] instanceof ValuesRow)) return false
  }
  return true
}

function sql(
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): [string, QueryOptions] {
  const parts: Array<string> = []
  const bind: Array<any> = []
  let queryGenerator
  for (let i = 0, length = expressions.length; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]
    if (expression instanceof Literal) {
      parts.push(expression.val)
    } else if (isValuesArray(expression)) {
      parts.push((expression: any).map(row => row.value).join(', '))
    } else if (Array.isArray(expression) && (expression: any)[sqlOutput]) {
      const [query, options] = ((expression: any): [string, QueryOptions])
      parts.push(
        query.replace(
          /(\$+)(\d+)/g,
          (match: string, dollars: string, index: string) =>
            dollars.length % 2 === 0
              ? match
              : `${dollars}${parseInt(index) + bind.length}`
        )
      )
      bind.push(...options.bind)
    } else if (expression && expression.prototype instanceof Model) {
      const { QueryGenerator, tableName } = (expression: any)
      queryGenerator = QueryGenerator
      parts.push(QueryGenerator.quoteTable(tableName))
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      const {
        field,
        Model: { QueryGenerator },
      } = (expression: any)
      queryGenerator = QueryGenerator
      parts.push(QueryGenerator.quoteIdentifier(field))
    } else {
      bind.push(expression)
      parts.push(`$${bind.length}`)
    }
  }
  parts.push(strings[expressions.length])
  const result = [
    parts
      .join('')
      .trim()
      .replace(/\s+/g, ' '),
    { bind },
  ]
  ;(result: any)[sqlOutput] = true
  if (queryGenerator) (result: any)[queryGeneratorSymbol] = queryGenerator
  return result
}

function findQueryGenerator(
  expressions: $ReadOnlyArray<mixed>
): QueryGenerator {
  for (let i = 0, { length } = expressions; i < length; i++) {
    const expression = expressions[i]
    if (
      expression instanceof Object &&
      (expression: any)[queryGeneratorSymbol]
    ) {
      return (expression: any)[queryGeneratorSymbol]
    } else if (expression && expression.prototype instanceof Model) {
      return (expression: any).QueryGenerator
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      return (expression: any).Model.QueryGenerator
    } else if (expression instanceof Sequelize) {
      return expression.getQueryInterface().QueryGenerator
    }
  }
  throw new Error(
    `at least one of the expressions must be a sequelize Model, attribute, or Sequelize instance`
  )
}

const once = <F: Function>(fn: F): F => {
  let called = false
  let result: any
  return ((): any => {
    if (called) return result
    called = true
    return (result = fn())
  }: any)
}

const escapeSql = (queryGenerator: () => QueryGenerator) => (
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): string => {
  const parts: Array<string> = []
  for (let i = 0, { length } = expressions; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]
    if (expression instanceof Literal) {
      parts.push(expression.val)
    } else if (isValuesArray(expression)) {
      parts.push((expression: any).map(row => row.value).join(', '))
    } else if (Array.isArray(expression) && (expression: any)[sqlOutput]) {
      const [query, options] = ((expression: any): [string, QueryOptions])
      parts.push(
        query.replace(
          /(\$+)(\d+)/g,
          (match: string, dollars: string, index: string) =>
            dollars.length % 2 === 0
              ? match
              : queryGenerator().escape(options.bind[parseInt(index) - 1])
        )
      )
    } else if (expression && expression.prototype instanceof Model) {
      const { tableName } = (expression: any)
      parts.push(queryGenerator().quoteTable(tableName))
    } else if (expression && expression.type instanceof Sequelize.ABSTRACT) {
      const { field } = (expression: any)
      parts.push(queryGenerator().quoteIdentifier(field))
    } else {
      parts.push(queryGenerator().escape(expression))
    }
  }
  parts.push(strings[expressions.length])
  return parts.join('').trim()
}

sql.escape = (
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): string =>
  escapeSql(once(() => findQueryGenerator(expressions)))(
    strings,
    ...expressions
  )

sql.literal = (
  strings: $ReadOnlyArray<string>,
  ...expressions: $ReadOnlyArray<mixed>
): Literal =>
  Sequelize.literal(
    escapeSql(once(() => findQueryGenerator(expressions)))(
      strings,
      ...expressions
    )
  )

sql.with = (sequelize: Sequelize) => ({
  escape: (
    strings: $ReadOnlyArray<string>,
    ...expressions: $ReadOnlyArray<mixed>
  ): string =>
    escapeSql(() => sequelize.getQueryInterface().QueryGenerator)(
      strings,
      ...expressions
    ),
  values: (
    strings: $ReadOnlyArray<string>,
    ...expressions: $ReadOnlyArray<mixed>
  ): ValuesRow =>
    new ValuesRow(
      escapeSql(() => sequelize.getQueryInterface().QueryGenerator)(
        strings,
        ...expressions
      )
    ),
  literal: (
    strings: $ReadOnlyArray<string>,
    ...expressions: $ReadOnlyArray<mixed>
  ): Literal =>
    Sequelize.literal(
      escapeSql(() => sequelize.getQueryInterface().QueryGenerator)(
        strings,
        ...expressions
      )
    ),
  query: (
    strings: $ReadOnlyArray<string>,
    ...expressions: $ReadOnlyArray<mixed>
  ) => (options: QueryOptions = {}): Promise<any> => {
    const [query, baseOptions] = sql(strings, ...expressions)
    return sequelize.query(query, { ...baseOptions, ...options })
  },
})

module.exports = sql
