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
WHERE ${User.attributes.birthday} = ${new Date('1986-12-11')} AND
  ${User.attributes.id} = ${1}
    `).to.deep.equal({query: `
SELECT "name" FROM "Users"
WHERE "birthday" = $1 AND
  "id" = $2
    `, bind: [new Date('1986-12-11'), 1]
    })
  })
})
