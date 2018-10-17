// @flow

import Sequelize from 'sequelize'
import {describe, it} from 'mocha'
import {expect} from 'chai'

import sql from '../src'

describe(`sql`, function () {
  it(`works`, function () {
    const sequelize = new Sequelize('test', 'test', 'test', {dialect: 'postgres'})

    const User = sequelize.define('User', {
      name: {type: Sequelize.STRING},
      birthday: {type: Sequelize.DATE},
    })

    expect(sql`
SELECT ${User.attributes.name} ${Sequelize.literal('FROM')} ${User}
WHERE ${User.attributes.birthday} = ${new Date('2346-7-11')} AND
  ${sql`${User.attributes.name} LIKE ${'a%'} AND`}${sql``}
  ${User.attributes.id} = ${1}
    `).to.deep.equal([`SELECT "name" FROM "Users" WHERE "birthday" = $1 AND "name" LIKE $2 AND "id" = $3`, {
      bind: [new Date('2346-7-11'), 'a%', 1]
    }])
  })
  it(`handles escaped $ in nested templates properly`, function () {
    expect(sql`SELECT ${sql`'$$1'`}`).to.deep.equal([`SELECT '$$1'`, {bind: []}])
  })
})

describe(`sql.escape`, function () {
  it(`works`, function () {
    const sequelize = new Sequelize('test', 'test', 'test', {dialect: 'postgres'})

    const User = sequelize.define('User', {
      name: {type: Sequelize.STRING},
      birthday: {type: Sequelize.DATE},
    })

    expect(sql.escape`
SELECT ${User.attributes.id} ${Sequelize.literal('FROM')} ${User}
WHERE ${User.attributes.name} LIKE ${'and%'} AND
  ${sql`${User.attributes.name} LIKE ${'a%'} AND`}${sql``}
  ${User.attributes.id} = ${1}
    `).to.deep.equal(`SELECT "id" FROM "Users" WHERE "name" LIKE 'and%' AND "name" LIKE 'a%' AND "id" = 1`)
  })
  it(`throws if it can't get a QueryGenerator`, function () {
    expect(() => sql.escape`SELECT ${1} + ${2};`).to.throw(Error, 'at least one of the expressions must be a sequelize Model or attribute')
  })
  it(`can get QueryGenerator from Sequelize Model class`, function () {
    const sequelize = new Sequelize('test', 'test', 'test', {dialect: 'postgres'})

    const User = sequelize.define('User', {
      name: {type: Sequelize.STRING},
      birthday: {type: Sequelize.DATE},
    })

    expect(sql.escape`SELECT ${'foo'} FROM ${User}`).to.deep.equal(`SELECT 'foo' FROM "Users"`)
  })
  it(`handles escaped $ in nested templates properly`, function () {
    expect(sql.escape`SELECT ${sql`'$$1'`}`).to.deep.equal(`SELECT '$$1'`)
  })
  it(`can get QueryGenerator from nested sql template`, async function (): Promise<void> {
    const sequelize = new Sequelize('test', 'test', 'test', {dialect: 'postgres'})

    const User = sequelize.define('User', {
      name: {type: Sequelize.STRING},
      birthday: {type: Sequelize.DATE},
    })

    expect(sql.escape`SELECT ${'foo'} FROM ${sql`${User}`}`).to.deep.equal(`SELECT 'foo' FROM "Users"`)
  })
})
