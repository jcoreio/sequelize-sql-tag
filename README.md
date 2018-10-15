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

## Examples

```js
const Sequelize = require('sequelize')
const sql = require('@jcoreio/sequelize-sql-tag')
const sequelize = new Sequelize('test', 'test', 'test', { dialect: 'postgres', logging: false })

const User = sequelize.define('User', {
  name: {type: Sequelize.STRING},
  birthday: {type: Sequelize.STRING},
  active: {type: Sequelize.BOOLEAN},
})

const lock = true

sequelize.query(...sql`SELECT ${User.attributes.name} FROM ${User}
WHERE ${User.attributes.birthday} = ${new Date('2346-7-11')} AND
  ${User.attributes.active} = ${true}
  ${Sequelize.literal(lock ? 'FOR UPDATE' : '')}`).then(console.log);
// => [ [ { name: 'Jimbob' } ], Statement { sql: 'SELECT "name" FROM "Users" WHERE "birthday" = $1 AND "active" = $2 FOR UPDATE' } ]
```

Sometimes custom subqueries within a Sequelize `where` clause can be useful.
In this case, there is no way to use query parameters.  You can use
`sql.escape` in this context to inline the escaped values rather than using
query parameters:

```js
const {Op} = Sequelize

const User = sequelize.define('User', {
  name: {type: Sequelize.STRING},
})
const Organization = sequelize.define('Organization', {
  name: {type: Sequelize.STRING},
})
const OrganizationMember = sequelize.define('OrganizationMember', {
  userId: {type: Sequelize.INTEGER},
  organizationId: {type: Sequelize.INTEGER},
})
User.belongsToMany(Organization, {through: OrganizationMember})
Organization.belongsToMany(User, {through: OrganizationMember})

async function getUsersInOrganization(organizationId, where = {}) {
  return await User.findAll({
    where: {
      ...where,
      // Using a sequelize include clause to do this kind of sucks tbh
      id: {[Op.in]: Sequelize.literal(sql.escape`
        SELECT ${OrganizationMember.attributes.userId}
        FROM ${OrganizationMember}
        WHERE ${OrganizationMember.attributes.organizationId} = ${organizationId}
      `)}
      // SELECT "userId" FROM "OrganizationMembers" WHERE "organizationId" = 2
    },
  })
}
```

## API

### `` sql`query` ``

Creates arguments for `sequelize.query`.

#### Returns (`[string, {bind: Array<string>}]`)

The `sql, options` arguments to pass to `sequelize.query`.

### `` sql.escape`query` ``

Creates a raw SQL string with all expressions in the template escaped.

#### Returns (`string`)

The raw SQL.
