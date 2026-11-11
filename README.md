# Dyna App (dyna-shop)

A Quasar Project

## Session inactivity

Signed-in pages show an inactivity countdown during the last minute of the
10-minute timeout. Mouse, touch, keyboard,
scrolling and form interactions reset it, including activity in another tab for
the same account. The deadline persists across reloads and app interruptions;
returning after it expires signs the user out. Supabase authentication can also
end a session independently of the inactivity timer.

## Daily sales reports

The receipt range accepts numeric receipt suffixes; the selected DPC prefix is shown
automatically. Leave both fields empty to include all receipts for the selected DPC
and dates. Client BV badges load once per report, separately from the sales,
and include the client's purchases at all shops for the selected dates,
regardless of receipt range or page. The
period total BV covers the selected shop and dates regardless of receipt range
or page; total amount reflects the receipt range. Sales and client BV do not
update automatically; fetch the report again to refresh them or after changing the
selected DPC or dates.

Client BV across shops requires permission to
read the relevant sales headers and details at those shops.

## Stock movements and reports

Admin report table rows can be sorted using the column headings. Stock pivots
sum multiple rows for a product and report a loading error rather than showing
zero when a location cannot be read.

Apply the `20261111100000_safe_stock_movements.sql` migration after the earlier
stock movement migrations. It prevents conflicting transfers from checking
stock before acquiring the relevant locks. It cannot repair existing incorrect
balances, prevent all network failures, or verify database functions not defined
in this repository. A failed network response can have an unknown outcome;
check the transaction before submitting a different movement.

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
