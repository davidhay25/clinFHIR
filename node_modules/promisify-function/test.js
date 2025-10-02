/* global describe it */
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import promisify from './src'

chai.use(chaiAsPromised)
chai.use(sinonChai)

const expect = chai.expect

describe('promisify', () => {
  it('calls wrapped function with arguments', function () {
    const fn = sinon.stub().yields()
    const promisified = promisify(fn)
    return expect(promisified('some', 'arguments'))
      .to.be.eventually.fulfilled.then(function () {
        expect(fn).to.have.been.calledWith('some', 'arguments')
      })
  })

  it('rejects when wrapped function returns error', () => {
    const fn = sinon.stub().yields('some error')
    const promisified = promisify(fn)
    return expect(promisified('some', 'arguments'))
      .to.be.eventually.rejectedWith('some error')
  })

  it('resolves when wrapped function returns no error', () => {
    const fn = sinon.stub().yields(null, 'a', 'result')
    const promisified = promisify(fn)
    return expect(promisified('some', 'arguments'))
      .to.eventually.be.fulfilled
  })

  it('resolves single value as such', () => {
    const fn = sinon.stub().yields(null, 42)
    const promisified = promisify(fn)
    return expect(promisified('some', 'arguments'))
      .to.eventually.deep.equal(42)
  })

  it('resolves multiple value as an array', () => {
    const fn = sinon.stub().yields(null, 'a', 'result')
    const promisified = promisify(fn)
    return expect(promisified('some', 'arguments'))
      .to.eventually.deep.equal(['a', 'result'])
  })

  it('throws when no function is passed', () => {
    expect(promisify).to.throw(Error, 'fn parameter must be a function')
  })
})
