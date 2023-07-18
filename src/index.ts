import Sequelize, { Model, QueryOptions } from 'sequelize'
type QueryGenerator = ReturnType<<T>(arg1: { QueryGenerator: T }) => T>
type LiteralInstance = ReturnType<typeof Sequelize.literal>
const Literal = Object.getPrototypeOf(Sequelize.literal('foo')).constructor
const sqlOutput = Symbol('sqlOutput')
const queryGeneratorSymbol = Symbol('queryGenerator')

class ValuesRow {
  value: string

  constructor(value: string) {
    this.value = value
  }
}

function getQueryGeneratorCompat(value: any): QueryGenerator {
  const { queryGenerator, QueryGenerator } = value
  if (queryGenerator) return queryGenerator
  if (QueryGenerator) return QueryGenerator
  throw new Error(`failed to get queryGenerator on ${value}`)
}

function isValuesArray(expression: any): boolean {
  if (!Array.isArray(expression)) return false
  for (let i = 0; i < expression.length; i++) {
    if (!(expression[i] instanceof ValuesRow)) return false
  }
  return true
}

function sql(
  strings: ReadonlyArray<string>,
  ...expressions: ReadonlyArray<unknown>
): [string, QueryOptions] {
  const parts: Array<string> = []
  const bind: Array<any> = []
  let queryGenerator

  for (let i = 0, length = expressions.length; i < length; i++) {
    parts.push(strings[i])
    const expression = expressions[i]

    if (expression instanceof Literal) {
      parts.push((expression as any).val)
    } else if (isValuesArray(expression)) {
      parts.push((expression as any).map((row: any) => row.value).join(', '))
    } else if (Array.isArray(expression) && (expression as any)[sqlOutput]) {
      const [query, options] = expression as [string, QueryOptions]
      parts.push(
        query.replace(
          /(\$+)(\d+)/g,
          (match: string, dollars: string, index: string) =>
            dollars.length % 2 === 0
              ? match
              : `${dollars}${parseInt(index) + bind.length}`
        )
      )
      if (Array.isArray(options.bind)) bind.push(...options.bind)
    } else if (expression && (expression as any).prototype instanceof Model) {
      const { tableName } = expression as any
      queryGenerator = getQueryGeneratorCompat(expression)
      parts.push((queryGenerator as any).quoteTable(tableName))
    } else if (
      expression &&
      (expression as any).type instanceof Sequelize.ABSTRACT
    ) {
      const { field, Model } = expression as any
      queryGenerator = getQueryGeneratorCompat(Model)
      parts.push((queryGenerator as any).quoteIdentifier(field))
    } else {
      bind.push(expression)
      parts.push(`$${bind.length}`)
    }
  }

  parts.push(strings[expressions.length])
  const result = [parts.join('').trim().replace(/\s+/g, ' '), { bind }]
  ;(result as any)[sqlOutput] = true
  if (queryGenerator) (result as any)[queryGeneratorSymbol] = queryGenerator
  return result as [string, QueryOptions]
}

function findQueryGenerator(
  expressions: ReadonlyArray<unknown>
): QueryGenerator {
  for (let i = 0, { length } = expressions; i < length; i++) {
    const expression = expressions[i]

    if (
      expression instanceof Object &&
      (expression as any)[queryGeneratorSymbol]
    ) {
      return (expression as any)[queryGeneratorSymbol]
    } else if (expression && (expression as any).prototype instanceof Model) {
      return getQueryGeneratorCompat(expression)
    } else if (
      expression &&
      (expression as any).type instanceof Sequelize.ABSTRACT
    ) {
      return getQueryGeneratorCompat((expression as any).Model)
    } else if (expression instanceof Sequelize.Sequelize) {
      return getQueryGeneratorCompat(expression.getQueryInterface())
    }
  }

  throw new Error(
    `at least one of the expressions must be a sequelize Model, attribute, or Sequelize instance`
  )
}

const once = <F extends () => any>(fn: F): F => {
  let called = false
  let result: any
  return ((): any => {
    if (called) return result
    called = true
    return (result = fn())
  }) as any
}

const escapeSql =
  (queryGenerator: () => QueryGenerator) =>
  (
    strings: ReadonlyArray<string>,
    ...expressions: ReadonlyArray<unknown>
  ): string => {
    const parts: Array<string> = []

    for (let i = 0, { length } = expressions; i < length; i++) {
      parts.push(strings[i])
      const expression = expressions[i]

      if (expression instanceof Literal) {
        parts.push((expression as any).val)
      } else if (isValuesArray(expression)) {
        parts.push((expression as any).map((row: any) => row.value).join(', '))
      } else if (Array.isArray(expression) && (expression as any)[sqlOutput]) {
        const [query, options] = expression as [string, QueryOptions]
        const { bind } = options

        if (!Array.isArray(bind)) {
          throw new Error('expected options.bind to be an array')
        }

        parts.push(
          query.replace(
            /(\$+)(\d+)/g,
            (match: string, dollars: string, index: string) =>
              dollars.length % 2 === 0
                ? match
                : (queryGenerator as any)().escape(bind[parseInt(index) - 1])
          )
        )
      } else if (expression && (expression as any).prototype instanceof Model) {
        const { tableName } = expression as any
        parts.push((queryGenerator as any)().quoteTable(tableName))
      } else if (
        expression &&
        (expression as any).type instanceof Sequelize.ABSTRACT
      ) {
        const { field } = expression as any
        parts.push((queryGenerator as any)().quoteIdentifier(field))
      } else {
        parts.push((queryGenerator as any)().escape(expression))
      }
    }

    parts.push(strings[expressions.length])
    return parts.join('').trim()
  }

sql.escape = (
  strings: ReadonlyArray<string>,
  ...expressions: ReadonlyArray<unknown>
): string =>
  escapeSql(once(() => findQueryGenerator(expressions)))(
    strings,
    ...expressions
  )

sql.literal = (
  strings: ReadonlyArray<string>,
  ...expressions: ReadonlyArray<unknown>
): typeof Literal =>
  Sequelize.literal(
    escapeSql(once(() => findQueryGenerator(expressions)))(
      strings,
      ...expressions
    )
  )

sql.with = (sequelize: Sequelize.Sequelize) => ({
  escape: (
    strings: ReadonlyArray<string>,
    ...expressions: ReadonlyArray<unknown>
  ): string =>
    escapeSql(() => getQueryGeneratorCompat(sequelize.getQueryInterface()))(
      strings,
      ...expressions
    ),
  values: (
    strings: ReadonlyArray<string>,
    ...expressions: ReadonlyArray<unknown>
  ): ValuesRow =>
    new ValuesRow(
      escapeSql(() => getQueryGeneratorCompat(sequelize.getQueryInterface()))(
        strings,
        ...expressions
      )
    ),
  literal: (
    strings: ReadonlyArray<string>,
    ...expressions: ReadonlyArray<unknown>
  ): typeof Literal =>
    Sequelize.literal(
      escapeSql(() => getQueryGeneratorCompat(sequelize.getQueryInterface()))(
        strings,
        ...expressions
      )
    ),
  query:
    (strings: ReadonlyArray<string>, ...expressions: ReadonlyArray<unknown>) =>
    (options: QueryOptions = {}): Promise<any> => {
      const [query, baseOptions] = sql(strings, ...expressions)
      return sequelize.query(query, { ...baseOptions, ...options })
    },
})

declare type SqlFunction = {
  (strings: ReadonlyArray<string>, ...expressions: ReadonlyArray<any>): [
    string,
    QueryOptions
  ]
  escape(
    strings: ReadonlyArray<string>,
    ...expressions: ReadonlyArray<any>
  ): string
  literal(
    strings: ReadonlyArray<string>,
    ...expressions: ReadonlyArray<any>
  ): LiteralInstance
  with(sequelize: Sequelize.Sequelize): {
    escape(
      strings: ReadonlyArray<string>,
      ...expressions: ReadonlyArray<any>
    ): string
    values(
      strings: ReadonlyArray<string>,
      ...expressions: ReadonlyArray<any>
    ): ValuesRow
    literal(
      strings: ReadonlyArray<string>,
      ...expressions: ReadonlyArray<any>
    ): LiteralInstance
    query(
      strings: ReadonlyArray<string>,
      ...expressions: ReadonlyArray<any>
    ): (options?: QueryOptions) => Promise<any>
  }
}

export default sql as SqlFunction
