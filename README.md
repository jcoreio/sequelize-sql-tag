# @jcoreio/sequelize-sql-tag

[![Build Status](https://travis-ci.org/jcoreio/sequelize-sql-tag.svg?branch=master)](https://travis-ci.org/jcoreio/sequelize-sql-tag)
[![Coverage Status](https://codecov.io/gh/jcoreio/sequelize-sql-tag/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/sequelize-sql-tag)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

a template tag for [Sequelize](docs.sequelizejs.com) that quotes `Model`s' table
names, attribute names, and puts other expressions into bind parameters

Using the table and attribute names from your Sequelize `Model`s is much more
refactor-proof in raw queries than embedding raw identifiers.

## Installation

```sh
npm install --save @jcoreio/sequelize-sql-tag
```

## Compatibility

Requires `sequelize@^4.0.0`.  Once v5 is released I'll check if it's still
compatible.  Not making any effort to support versions < 4, but you're welcome
to make a PR.

## Example

```js
const Sequelize = require('sequelize')
const sql = require('./dist/src/index.js')
const sequelize = new Sequelize('test', 'test', 'test', { dialect: 'postgres', logging: false })

const User = sequelize.define('User', {
  name: {type: Sequelize.STRING},
  birthday: {type: Sequelize.STRING},
  active: {type: Sequelize.BOOLEAN},
})

const lock = true

sequelize.query(sql`SELECT ${User.attributes.name} FROM ${User}
WHERE ${User.attributes.birthday} = ${new Date('2346-7-11')} AND
  ${User.attributes.active} = ${true}
  ${Sequelize.literal(lock ? 'FOR UPDATE' : '')}`).then(console.log);
// => [ [ { name: 'Jimbob' } ], Statement { sql: 'SELECT "name" FROM "Users" WHERE "birthday" = $1 AND "active" = $2 FOR UPDATE' } ]
```
