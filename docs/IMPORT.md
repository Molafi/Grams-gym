# Moving members from the old gym program

`/admin/import` (admins only) brings members and their memberships over from the old desktop program. Members keep
their old numbers (`04852` → `GG-04852`); memberships become front-desk ("manual") memberships with the old start
and end dates. Running it again with a newer export updates members and adds new periods without duplicates.

## 1. Get the data out of the old program
Pick whichever works:
1. **Copy the table:** open the Subscriptions (or Members) list, show all members, click a row, press `Ctrl+A`,
   `Ctrl+C`, then paste into the box on `/admin/import`. The title row (Member #, Member, Mobile, From, To…) must be
   included.
2. **Export:** if the program has Export → Excel, save the file as **CSV UTF-8** (plain CSV breaks Arabic names) and
   choose it on `/admin/import`.
3. **The database itself:** if neither works (or you also want payments / check-in history), find the program's
   database: right-click its shortcut → *Open file location* and look for `.mdb`, `.accdb`, `.sdf`, `.db`, `.sqlite`,
   `.fdb` or `.mdf` files, or check `services.msc` for "SQL Server", "MySQL" or "Firebird". Send that information to
   the developer; an exporter can be written for it.

Columns are recognised by title in English or Arabic: member number, name, gender, mobile, program, from, to,
frozen, offer, notes. Dates are read as day/month/year unless the data shows otherwise.

## 2. After importing
- Imported members can't sign in until staff give them a password: Members → search the number → **Reset password**.
- Numbers already used by accounts created on this site are reported and skipped. Demo members are moved out of the
  way automatically. Import into the live database **before** creating other accounts there.

## 3. Automatic updates through the API (optional)
While both systems run side by side, a script on the gym PC can send a fresh export to the live site. Set
`IMPORT_API_TOKEN` (at least 24 random characters) in the site's environment, then:

```powershell
$body = @{ mode = "import"; text = (Get-Content export.csv -Raw -Encoding utf8) } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://YOUR-SITE/api/admin/import" `
  -Headers @{ Authorization = "Bearer YOUR-TOKEN" } -ContentType "application/json; charset=utf-8" -Body $body
```

`mode = "preview"` returns what would be imported without changing anything. Windows Task Scheduler can run this
daily. Keep the token secret: it can add and update members.
