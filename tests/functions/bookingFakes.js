// tests/functions/bookingFakes.js
// An in-memory stand-in for the supabase-js client the booking functions
// use: from(table) with select / insert / update, the filters eq / gte /
// lte / in / is, order, single / maybeSingle, the count+head query the rate
// limiter runs, and auth.getUser. Filters really filter (gte/lte compare
// ISO strings), so slot and overlap queries see only the rows they ask for.
//
// Every query is recorded in `state.queries` ({ table, op, columns,
// filters, row/patch }) so tests can check what was asked for, e.g. which
// profile columns a gate selected.

export function fakeDb(tables = {}, { users = {}, failUpdatesOn = null } = {}) {
  const state = {
    sites: [], profiles: [], bookings: [], request_log: [],
    ...structuredClone(tables),
    queries: [],
    inserts: [],
    updates: [],
  };
  let nextId = 1;

  function matches(row, filters) {
    return filters.every(([op, col, val]) => {
      const v = row[col];
      if (op === 'eq') return v === val;
      if (op === 'gte') return v != null && String(v) >= String(val);
      if (op === 'lte') return v != null && String(v) <= String(val);
      if (op === 'in') return val.includes(v);
      if (op === 'is') return v === val;
      return true;
    });
  }

  function run(q) {
    const rows = state[q.table] || (state[q.table] = []);
    const filters = q.ops.filter((o) => ['eq', 'gte', 'lte', 'in', 'is'].includes(o[0]));
    const single = q.ops.some((o) => o[0] === 'single' || o[0] === 'maybeSingle');
    const strict = q.ops.some((o) => o[0] === 'single');
    const insert = q.ops.find((o) => o[0] === 'insert');
    const update = q.ops.find((o) => o[0] === 'update');
    const select = q.ops.find((o) => o[0] === 'select');
    state.queries.push({
      table: q.table,
      op: insert ? 'insert' : update ? 'update' : 'select',
      columns: select ? select[1] : undefined,
      filters,
      row: insert ? insert[1] : undefined,
      patch: update ? update[1] : undefined,
    });

    if (insert) {
      const row = { id: `${q.table}-${nextId++}`, created_at: new Date().toISOString(), ...insert[1] };
      if (q.table === 'request_log') row.ts = new Date().toISOString();
      rows.push(row);
      state.inserts.push({ table: q.table, row: insert[1] });
      return { data: structuredClone(row), error: null };
    }
    if (update) {
      if (failUpdatesOn && failUpdatesOn(q.table, update[1])) {
        return { data: null, error: { message: 'update failed (fake)' } };
      }
      const hit = rows.filter((r) => matches(r, filters));
      hit.forEach((r) => Object.assign(r, structuredClone(update[1])));
      state.updates.push({ table: q.table, patch: update[1], filters, matched: hit.length });
      if (single) {
        if (strict && hit.length !== 1) return { data: null, error: { message: 'not one row' } };
        return { data: hit[0] ? structuredClone(hit[0]) : null, error: null };
      }
      return { data: structuredClone(hit), error: null };
    }
    const found = rows.filter((r) => matches(r, filters));
    if (select && select[2] && select[2].head) return { count: found.length, data: null, error: null };
    if (single) {
      if (strict && found.length !== 1) return { data: null, error: { message: 'not one row' } };
      return { data: found[0] ? structuredClone(found[0]) : null, error: null };
    }
    return { data: structuredClone(found), error: null };
  }

  function from(table) {
    const q = { table, ops: [] };
    const b = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'is', 'order', 'insert', 'update', 'single', 'maybeSingle']) {
      b[m] = (...args) => { q.ops.push([m, ...args]); return b; };
    }
    b.then = (resolve, reject) => Promise.resolve().then(() => run(q)).then(resolve, reject);
    return b;
  }

  return {
    state,
    from,
    auth: {
      getUser: async (token) => (users[token]
        ? { data: { user: { id: users[token] } }, error: null }
        : { data: { user: null }, error: { message: 'bad token' } }),
    },
  };
}

// The profile columns a query selected (for gate checks).
export function profileSelects(db) {
  return db.state.queries.filter((q) => q.table === 'profiles' && q.op === 'select').map((q) => q.columns);
}
