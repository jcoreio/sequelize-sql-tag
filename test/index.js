// @flow

import Sequelize from 'sequelize'
import { describe, it } from 'mocha'
import { expect } from 'chai'

import sql from '../src'

describe(`sql`, function () {
  const sequelize = new Sequelize('test', 'test', 'test', {
    dialect: 'postgres',
  })

  const User = sequelize.define('User', {
    name: { type: Sequelize.STRING },
    birthday: { type: Sequelize.DATE },
  })

  it(`works`, function () {
    expect(sql`
SELECT ${User.rawAttributes.name} ${Sequelize.literal('FROM')} ${User}
WHERE ${User.rawAttributes.birthday} = ${new Date('2346-7-11')} AND
  ${sql`${User.rawAttributes.name} LIKE ${'a%'} AND`}${sql``}
  ${User.rawAttributes.id} = ${1}
    `).to.deep.equal([
      `SELECT "name" FROM "Users" WHERE "birthday" = $1 AND "name" LIKE $2 AND "id" = $3`,
      {
        bind: [new Date('2346-7-11'), 'a%', 1],
      },
    ])
  })
  it(`handles escaped $ in nested templates properly`, function () {
    expect(sql`SELECT ${sql`'$$1'`}`).to.deep.equal([
      `SELECT '$$1'`,
      { bind: [] },
    ])
  })
  it(`works with nested sql.literal`, function () {
    expect(
      sql`SELECT ${sql.with(sequelize).literal`${'foo'}`} FROM ${User}`
    ).to.deep.equal([`SELECT 'foo' FROM "Users"`, { bind: [] }])
  })
  it(`works with nested .values`, function () {
    const { values } = sql.with(sequelize)
    const users = [
      { name: 'Jim', birthday: 'Jan 1 2020' },
      { name: 'Bob', birthday: 'Jan 2 1986' },
    ]
    expect(sql`
    INSERT INTO ${User}
      ${User.rawAttributes.name}, ${User.rawAttributes.birthday}
      VALUES ${users.map(
        ({ name, birthday }) => values`(${name}, ${birthday})`
      )}
    `).to.deep.equal([
      `INSERT INTO "Users" "name", "birthday" VALUES ('Jim', 'Jan 1 2020'), ('Bob', 'Jan 2 1986')`,
      { bind: [] },
    ])
  })
})

describe(`sql.escape`, function () {
  it(`works`, function () {
    const sequelize = new Sequelize('test', 'test', 'test', {
      dialect: 'postgres',
    })

    const User = sequelize.define('User', {
      name: { type: Sequelize.STRING },
      birthday: { type: Sequelize.DATE },
    })

    expect(sql.escape`
SELECT ${User.rawAttributes.id} ${Sequelize.literal('FROM')} ${User}
WHERE ${User.rawAttributes.name} LIKE ${'and%'} AND
  ${sql`${User.rawAttributes.name} LIKE ${'a%'} AND`}${sql``}
  ${User.rawAttributes.id} = ${1}
    `).to.deep.equal(`SELECT "id" FROM "Users"
WHERE "name" LIKE 'and%' AND
  "name" LIKE 'a%' AND
  "id" = 1`)
  })
  it(`throws if it can't get a QueryGenerator`, function () {
    expect(() => sql.escape`SELECT ${1} + ${2};`).to.throw(
      Error,
      'at least one of the expressions must be a sequelize Model, attribute, or Sequelize instance'
    )
  })
  it(`can get QueryGenerator from Sequelize Model class`, function () {
    const sequelize = new Sequelize('test', 'test', 'test', {
      dialect: 'postgres',
    })

    const User = sequelize.define('User', {
      name: { type: Sequelize.STRING },
      birthday: { type: Sequelize.DATE },
    })

    expect(sql.escape`SELECT ${'foo'} FROM ${User}`).to.deep.equal(
      `SELECT 'foo' FROM "Users"`
    )
  })
  it(`handles escaped $ in nested templates properly`, function () {
    expect(sql.escape`SELECT ${sql`'$$1'`}`).to.deep.equal(`SELECT '$$1'`)
  })
  it(`can get QueryGenerator from nested sql template`, async function (): Promise<void> {
    const sequelize = new Sequelize('test', 'test', 'test', {
      dialect: 'postgres',
    })

    const User = sequelize.define('User', {
      name: { type: Sequelize.STRING },
      birthday: { type: Sequelize.DATE },
    })

    expect(sql.escape`SELECT ${'foo'} FROM ${sql`${User}`}`).to.deep.equal(
      `SELECT 'foo' FROM "Users"`
    )
  })
  describe(`.with`, function () {
    const sequelize = new Sequelize('test', 'test', 'test', {
      dialect: 'postgres',
    })

    describe(`.escape`, function () {
      it(`works`, function () {
        expect(
          sql.with(sequelize).escape`SELECT LOWER(${'foo'});`
        ).to.deep.equal(`SELECT LOWER('foo');`)
      })
      it(`works in conjunction with .values`, function () {
        const items = [
          { foo: 1, bar: { hello: 'world' } },
          { foo: 3, bar: 'baz' },
        ]
        const { escape, values } = sql.with(sequelize)
        expect(
          escape`SELECT VALUES ${items.map(
            ({ foo, bar }) => values`(${foo}, ${JSON.stringify(bar)}::jsonb)`
          )}`
        ).to.equal(
          `SELECT VALUES (1, '{"hello":"world"}'::jsonb), (3, '"baz"'::jsonb)`
        )
      })
    })
    describe(`.query`, function () {
      it(`works`, function () {
        const calls = []
        const _sequelize: any = {
          query: (...args: any): any => {
            calls.push(args)
            return Promise.resolve()
          },
          getQueryInterface(): any {
            return sequelize.getQueryInterface()
          },
        }
        expect(
          sql.with(_sequelize).query`SELECT LOWER(${'foo'});`({ test: 'bar' })
        ).to.be.an.instanceOf(Promise)
        expect(calls).to.deep.equal([
          ['SELECT LOWER($1);', { bind: ['foo'], test: 'bar' }],
        ])
      })
    })
  })
})
