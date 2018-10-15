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
  ${User.attributes.id} = ${1}
    `).to.deep.equal([`SELECT "name" FROM "Users" WHERE "birthday" = $1 AND "id" = $2`, {bind: [new Date('2346-7-11'), 1]}])
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
  ${User.attributes.id} = ${1}
    `).to.deep.equal(`SELECT "id" FROM "Users" WHERE "name" LIKE 'and%' AND "id" = 1`)
  })
  it(`throws if it can't get a QueryGenerator`, function () {
    expect(() => sql.escape`SELECT ${1} + ${2};`).to.throw(Error, 'at least one of the expressions must be a sequelize Model or attribute')
  })
})
