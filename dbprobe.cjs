const { Client } = require('C:/Users/ohrz1/OneDrive/Desktop/ANAAREF/node_modules/pg');

const urls = {
  port15432_teams_ssl: 'postgresql://dbadmin:g8.WQ0v%5DOyToX32c%5B%7CWy7*6Y0Gt.@127.0.0.1:15432/teams?sslmode=require',
  port15432_postgres_ssl: 'postgresql://dbadmin:g8.WQ0v%5DOyToX32c%5B%7CWy7*6Y0Gt.@127.0.0.1:15432/postgres?sslmode=require',
  port5432_teams_ssl: 'postgresql://dbadmin:g8.WQ0v%5DOyToX32c%5B%7CWy7*6Y0Gt.@127.0.0.1:5432/teams?sslmode=require',
};

(async () => {
  for (const [name, rawUrl] of Object.entries(urls)) {
    const ssl = rawUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined;
    const connectionString = rawUrl.replace('?sslmode=require', '');
    const c = new Client({ connectionString, ssl, connectionTimeoutMillis: 5000 });
    try {
      await c.connect();
      const tables = await c.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1"
      );
      console.log(name, 'CONNECTED tables=' + JSON.stringify(tables.rows.map((r) => r.table_name)));
      try {
        const sims = await c.query('SELECT count(*)::int AS n FROM simulations');
        console.log(name, 'simulations=' + sims.rows[0].n);
      } catch (e) {
        console.log(name, 'simulations query failed: ' + e.message);
      }
      try {
        const tpl = await c.query('SELECT count(*)::int AS n FROM report_templates');
        console.log(name, 'report_templates=' + tpl.rows[0].n);
      } catch (e) {
        console.log(name, 'report_templates query failed: ' + e.message);
      }
      await c.end();
    } catch (e) {
      console.log(name, 'FAILED code=' + e.code + ' msg=' + e.message);
    }
  }
})();
