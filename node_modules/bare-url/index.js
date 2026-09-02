const path = require('bare-path')
const binding = require('./binding')
const errors = require('./lib/errors')
const URLSearchParams = require('./lib/url-search-params')

const kind = Symbol.for('bare.url.kind')

const isWindows = Bare.platform === 'win32'

// Scratch buffer that the binding writes the parsed component offsets into. A
// single shared buffer is reused across every parse.
//
// The offsets are copied out into fields on the URL immediately after a
// successful parse, so nothing observes the buffer across calls.
const components = new Uint32Array(8)

// The value used for a component that is not present in the URL.
const unset = 0xffffffff

// The characters that pathToFileURL() has to percent-encode itself. A backslash
// is a path separator on Windows and so is left alone there.
const reserved = isWindows ? /[%#?\n\r\t]/ : /[%#?\n\r\t\\]/

class URL {
  static get [kind]() {
    return 0 // Compatibility version
  }

  constructor(input, base, opts = {}) {
    if (arguments.length === 0) throw errors.INVALID_URL()

    input = String(input)

    if (base !== undefined) base = String(base)

    this._href = undefined
    this._schemeEnd = 0
    this._usernameEnd = 0
    this._hostStart = 0
    this._hostEnd = 0
    this._pathStart = 0
    this._queryStart = 0
    this._fragmentStart = 0
    this._params = null

    this._parse(input, base, opts.throw !== false)
  }

  get [kind]() {
    return URL[kind]
  }

  // https://url.spec.whatwg.org/#dom-url-href

  get href() {
    return this._href
  }

  set href(value) {
    this._update(value)

    if (this._params) this._params._parse(this.search)
  }

  // https://url.spec.whatwg.org/#dom-url-protocol

  get protocol() {
    return this._slice(0, this._schemeEnd) + ':'
  }

  set protocol(value) {
    this._update(this._replace(value.replace(/:+$/, ''), 0, this._schemeEnd))
  }

  // https://url.spec.whatwg.org/#dom-url-username

  get username() {
    return this._slice(this._schemeEnd + 3 /* :// */, this._usernameEnd)
  }

  set username(value) {
    if (cannotHaveCredentialsOrPort(this)) {
      return
    }

    if (this.username === '') value += '@'

    this._update(this._replace(value, this._schemeEnd + 3 /* :// */, this._usernameEnd))
  }

  // https://url.spec.whatwg.org/#dom-url-password

  get password() {
    return this._href.slice(this._usernameEnd + 1 /* : */, this._hostStart - 1 /* @ */)
  }

  set password(value) {
    if (cannotHaveCredentialsOrPort(this)) {
      return
    }

    let start = this._usernameEnd + 1 /* : */
    let end = this._hostStart - 1 /* @ */

    if (this.password === '') {
      value = ':' + value
      start--
    }

    if (this.username === '') {
      value += '@'
      end++
    }

    this._update(this._replace(value, start, end))
  }

  // https://url.spec.whatwg.org/#dom-url-host

  get host() {
    return this._slice(this._hostStart, this._pathStart)
  }

  set host(value) {
    if (hasOpaquePath(this)) {
      return
    }

    this._update(
      this._replace(value, this._hostStart, value.includes(':') ? this._pathStart : this._hostEnd)
    )
  }

  // https://url.spec.whatwg.org/#dom-url-hostname

  get hostname() {
    return this._slice(this._hostStart, this._hostEnd)
  }

  set hostname(value) {
    if (hasOpaquePath(this)) {
      return
    }

    this._update(this._replace(value, this._hostStart, this._hostEnd))
  }

  // https://url.spec.whatwg.org/#dom-url-port

  get port() {
    return this._slice(this._hostEnd + 1 /* : */, this._pathStart)
  }

  set port(value) {
    if (cannotHaveCredentialsOrPort(this)) {
      return
    }

    let start = this._hostEnd + 1 /* : */

    if (this.port === '') {
      value = ':' + value
      start--
    }

    this._update(this._replace(value, start, this._pathStart))
  }

  // https://url.spec.whatwg.org/#dom-url-pathname

  get pathname() {
    return this._slice(this._pathStart, this._queryStart - 1 /* ? */)
  }

  set pathname(value) {
    if (hasOpaquePath(this)) {
      return
    }

    if (value[0] !== '/' && value[0] !== '\\') {
      value = '/' + value
    }

    this._update(this._replace(value, this._pathStart, this._queryStart - 1 /* ? */))
  }

  // https://url.spec.whatwg.org/#dom-url-search

  get search() {
    return this._slice(this._queryStart - 1 /* ? */, this._fragmentStart - 1 /* # */)
  }

  set search(value) {
    if (value && value[0] !== '?') value = '?' + value

    this._update(
      this._replace(value, this._queryStart - 1 /* ? */, this._fragmentStart - 1 /* # */)
    )

    if (this._params) this._params._parse(this.search)
  }

  // https://url.spec.whatwg.org/#dom-url-searchparams

  get searchParams() {
    if (this._params === null) {
      this._params = new URLSearchParams(this.search, this)
    }

    return this._params
  }

  // https://url.spec.whatwg.org/#dom-url-hash

  get hash() {
    return this._slice(this._fragmentStart - 1 /* # */)
  }

  set hash(value) {
    if (value && value[0] !== '#') value = '#' + value

    this._update(this._replace(value, this._fragmentStart - 1 /* # */))
  }

  toString() {
    return this._href
  }

  toJSON() {
    return this._href
  }

  [Symbol.for('bare.inspect')]() {
    return {
      __proto__: { constructor: URL },

      href: this.href,
      protocol: this.protocol,
      username: this.username,
      password: this.password,
      host: this.host,
      hostname: this.hostname,
      port: this.port,
      pathname: this.pathname,
      search: this.search,
      searchParams: this.searchParams,
      hash: this.hash
    }
  }

  _slice(start, end = this._href.length) {
    return this._href.slice(start, end)
  }

  _replace(replacement, start, end = this._href.length) {
    return this._slice(0, start) + replacement + this._slice(end)
  }

  _parse(input, base, shouldThrow) {
    let href

    try {
      href = binding.parse(input, base || null, components, shouldThrow)
    } catch (err) {
      if (err instanceof TypeError) throw err

      throw errors.INVALID_URL(`Invalid URL '${input}'`, input)
    }

    if (href === undefined) return

    this._href = href
    this._schemeEnd = components[0]
    this._usernameEnd = components[1]
    this._hostStart = components[2]
    this._hostEnd = components[3]
    this._pathStart = components[5]

    const queryStart = components[6]
    const fragmentStart = components[7]

    const end = href.length + 1

    this._queryStart = queryStart === unset ? end : queryStart
    this._fragmentStart = fragmentStart === unset ? end : fragmentStart
  }

  _update(input) {
    try {
      this._parse(input, null, true)
    } catch (err) {
      if (err instanceof TypeError) throw err
    }
  }
}

module.exports = exports = URL

// https://url.spec.whatwg.org/#url-opaque-path
function hasOpaquePath(url) {
  return url.pathname[0] !== '/'
}

// https://url.spec.whatwg.org/#cannot-have-a-username-password-port
function cannotHaveCredentialsOrPort(url) {
  return url.hostname === '' || url.protocol === 'file:'
}

exports.URL = URL
exports.URLSearchParams = URLSearchParams

exports.errors = errors

exports.isURL = function isURL(value) {
  if (value instanceof URL) return true

  return typeof value === 'object' && value !== null && value[kind] === URL[kind]
}

exports.isURLSearchParams = URLSearchParams.isURLSearchParams

// https://url.spec.whatwg.org/#dom-url-parse
exports.parse = function parse(input, base) {
  const url = new URL(input, base, { throw: false })
  return url._href ? url : null
}

// https://url.spec.whatwg.org/#dom-url-canparse
exports.canParse = function canParse(input, base) {
  return binding.canParse(String(input), base ? String(base) : null)
}

exports.fileURLToPath = function fileURLToPath(url) {
  if (typeof url === 'string') {
    url = new URL(url)
  }

  if (url.protocol !== 'file:') {
    throw errors.INVALID_URL_SCHEME('The URL must use the file: protocol')
  }

  if (!isWindows && url.hostname) {
    throw errors.INVALID_FILE_URL_HOST("The file: URL host must be 'localhost' or empty")
  }

  const encoded = url.pathname

  // Every check below looks for a percent encoded sequence, as does the decoding
  // that follows, so a path without any can skip all of them.
  const hasEncoded = encoded.includes('%')

  if (hasEncoded) {
    if (isWindows) {
      if (/%2f|%5c/i.test(encoded)) {
        throw errors.INVALID_FILE_URL_PATH(
          'The file: URL path must not include encoded \\ or / characters'
        )
      }
    } else if (/%2f/i.test(encoded)) {
      throw errors.INVALID_FILE_URL_PATH('The file: URL path must not include encoded / characters')
    }

    if (/%00/i.test(encoded)) {
      throw errors.INVALID_FILE_URL_PATH(
        'The file: URL path must not include encoded NUL characters'
      )
    }
  }

  const pathname = path.normalize(hasEncoded ? decodeURIComponent(encoded) : encoded)

  if (isWindows) {
    if (url.hostname) return '\\\\' + url.hostname + pathname

    const letter = pathname.charCodeAt(1) | 0x20

    if (letter < 0x61 /* a */ || letter > 0x7a /* z */ || pathname.charCodeAt(2) !== 0x3a /* : */) {
      throw errors.INVALID_FILE_URL_PATH('The file: URL path must be absolute')
    }

    return pathname.slice(1)
  }

  return pathname
}

exports.pathToFileURL = function pathToFileURL(pathname) {
  let resolved = path.resolve(pathname)

  if (pathname[pathname.length - 1] === '/') {
    resolved += '/'
  } else if (isWindows && pathname[pathname.length - 1] === '\\') {
    resolved += '\\'
  }

  // Paths hardly ever contain any of these, so one pass to rule them out is
  // cheaper than the six or seven replacements it stands in for.
  if (reserved.test(resolved)) {
    resolved = resolved
      .replaceAll('%', '%25') // Must be first
      .replaceAll('#', '%23')
      .replaceAll('?', '%3f')
      .replaceAll('\n', '%0a')
      .replaceAll('\r', '%0d')
      .replaceAll('\t', '%09')

    if (!isWindows) {
      resolved = resolved.replaceAll('\\', '%5c')
    }
  }

  return new URL('file:' + resolved)
}

exports.format = function format(parts) {
  const { protocol, auth, host, hostname, port, pathname, search, query, hash, slashes } = parts

  let result = ''

  if (typeof protocol === 'string') {
    result += protocol

    if (protocol[protocol.length - 1] !== ':') {
      result += ':'
    }

    if (slashes === true || /https?|ftp|gopher|file/.test(protocol)) {
      result += '//'
    }
  }

  if (typeof auth === 'string') {
    if (host || hostname) result += auth + '@'
  }

  if (typeof host === 'string') result += host
  else {
    result += hostname

    if (port) result += ':' + port
  }

  if (typeof pathname === 'string' && pathname !== '') {
    if (pathname[0] !== '/') result += '/'
    result += pathname
  }

  if (typeof search === 'string') {
    if (search[0] !== '?') result += '?'
    result += search
  } else if (typeof query === 'object' && query !== null) {
    result += '?' + new URLSearchParams(query)
  }

  if (typeof hash === 'string') {
    if (hash[0] !== '#') result += '#'
    result += hash
  }

  return result
}
