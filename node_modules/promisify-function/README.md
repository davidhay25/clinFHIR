# promisify-function

[![npm](https://img.shields.io/npm/v/promisify-function.svg)](https://www.npmjs.com/package/promisify-function)
[![Build Status](https://travis-ci.org/jcollado/promisify-function.svg?branch=master)](https://travis-ci.org/jcollado/promisify-function)
[![Coverage Status](https://coveralls.io/repos/jcollado/promisify-function/badge.svg?branch=master&service=github)](https://coveralls.io/github/jcollado/promisify-function?branch=master)
[![Dependency Status](https://david-dm.org/jcollado/promisify-function.svg)](https://david-dm.org/jcollado/promisify-function)
[![devDependency Status](https://david-dm.org/jcollado/promisify-function/dev-status.svg)](https://david-dm.org/jcollado/promisify-function#info=devDependencies)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Turn a callback style function into a function that returns a promise.

## Installation

The recommended way to install `promisify-function` is as a dependency of a project:

```bash
npm install --save promisify-function
```

## Usage

Pass a callback style function and get a function the returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) as result:

```node
const fs = require('fs')
const promisify = require('promisify-function')
const mkdir = promisify(fs.mkdir)
```

## Contributing

Any contribution is more than welcome. In particular, if:

- there's something that doesn't work as expected or you have an idea for a nice to have feature, then please submit an issue [here](https://github.com/jcollado/promisify-function/issues/new)
- you know how to fix a problem or improve the code, then please submit a pull request [here](https://github.com/jcollado/promisify-function/compare)
