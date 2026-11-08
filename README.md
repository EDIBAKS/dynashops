# Dyna App (dyna-shop)

A Quasar Project

## Daily sales reports

The receipt range accepts numeric receipt suffixes; the selected DPC prefix is shown
automatically. Leave both fields empty to include all receipts for the selected DPC
and dates. Client BV and report totals cover all matching receipts, not just the
current page.

Live updates require applying the Supabase migrations, including
`20261108090000_enable_sales_report_realtime.sql`, and enabling Supabase Realtime
for the project. Database permissions and Realtime row-level security must allow the
signed-in user to receive sales header changes. If live updates fail, fetch the
report again to refresh it.

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```


### Format the files
```bash
yarn format
# or
npm run format
```


### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
