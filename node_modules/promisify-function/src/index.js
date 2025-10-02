export default function promisify (fn) {
  if (typeof fn !== 'function') {
    throw new Error('fn parameter must be a function')
  }
  return function (...args) {
    return new Promise(function (resolve, reject) {
      function callback (err, ...args) {
        if (err) {
          reject(err)
        } else {
          const data = args.length <= 1
            ? args[0]
            : args
          resolve(data)
        }
      }
      fn(...[...args, callback])
    })
  }
}
