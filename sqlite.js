// Shared hosting uses Node's SQLite to avoid native addon compilation on FreeBSD.
require('dotenv').config();
if (process.env.NAV_SQLITE_DRIVER !== 'builtin' && process.platform !== 'freebsd') {
  module.exports = require('sqlite3');
} else {
  const { DatabaseSync } = require('node:sqlite');
  class Database {
    constructor(filename) { this.handle = new DatabaseSync(filename); this.queue = []; this.pending = false; }
    enqueue(task) {
      this.queue.push(task);
      if (!this.pending) {
        this.pending = true;
        setImmediate(() => this.drain());
      }
      return this;
    }
    drain() {
      const task = this.queue.shift();
      if (!task) { this.pending = false; return; }
      try { task(); } finally { setImmediate(() => this.drain()); }
    }
    serialize(callback) { callback(); return this; }
    query(method, sql, args) {
      const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
      const params = (Array.isArray(args[0]) ? args[0] : args).map(v => v === undefined ? null : v);
      return this.enqueue(() => {
        let result, error;
        try { result = this.handle.prepare(sql)[method](...params); }
        catch (err) {
          error = err;
          if ((err.errcode & 255) === 19) error.code = 'SQLITE_CONSTRAINT';
        }
        if (callback) {
          const context = method === 'run' && result ? { lastID: Number(result.lastInsertRowid), changes: Number(result.changes) } : this;
          callback.call(context, error || null, method === 'run' ? undefined : result);
        } else if (error) { console.error('SQLite operation failed:', error.message); }
      });
    }
    run(sql, ...args) { return this.query('run', sql, args); }
    get(sql, ...args) { return this.query('get', sql, args); }
    all(sql, ...args) { return this.query('all', sql, args); }
    prepare(sql) {
      const db = this;
      return {
        run(...args) { db.run(sql, ...args); return this; },
        finalize(callback) { db.enqueue(() => { if (callback) callback(null); }); }
      };
    }
    close(callback) { return this.enqueue(() => { this.handle.close(); if (callback) callback(null); }); }
  }
  module.exports = { Database, verbose() { return this; } };
}
