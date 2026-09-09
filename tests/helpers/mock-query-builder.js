function createQueryBuilder(resolved = { data: null, error: null, count: null }) {
  const builder = {
    resolved,
    inserts: [],
    updates: [],
    eqs: [],
    ins: [],
    gtes: [],
    ltes: [],
    ilikes: [],
    rangeArgs: null,
    selectArgs: null,
    orderArgs: null,
    deleteCalled: false,
    select: jest.fn((...args) => {
      builder.selectArgs = args
      return builder
    }),
    insert: jest.fn((payload) => {
      builder.inserts.push(payload)
      return builder
    }),
    update: jest.fn((payload) => {
      builder.updates.push(payload)
      return builder
    }),
    delete: jest.fn(() => {
      builder.deleteCalled = true
      return builder
    }),
    eq: jest.fn((column, value) => {
      builder.eqs.push([column, value])
      return builder
    }),
    in: jest.fn((column, values) => {
      builder.ins.push([column, values])
      return builder
    }),
    gte: jest.fn((column, value) => {
      builder.gtes.push([column, value])
      return builder
    }),
    lte: jest.fn((column, value) => {
      builder.ltes.push([column, value])
      return builder
    }),
    ilike: jest.fn((column, value) => {
      builder.ilikes.push([column, value])
      return builder
    }),
    or: jest.fn((value) => {
      builder.ors = builder.ors || []
      builder.ors.push(value)
      return builder
    }),
    is: jest.fn((column, value) => {
      builder.ises = builder.ises || []
      builder.ises.push([column, value])
      return builder
    }),
    range: jest.fn((from, to) => {
      builder.rangeArgs = [from, to]
      return builder
    }),
    order: jest.fn((column, options) => {
      builder.orderArgs = [column, options]
      return builder
    }),
    maybeSingle: jest.fn(() => Promise.resolve(builder.resolved)),
    then(onFulfilled, onRejected) {
      return Promise.resolve(builder.resolved).then(onFulfilled, onRejected)
    },
  }

  return builder
}

module.exports = {
  createQueryBuilder,
}
