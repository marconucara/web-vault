---
type: Note
---
# Welcome to your WebVault 👋

You deployed this in a few clicks. It's a **starter vault** — a tiny Markdown
knowledge base with WebVault already wired in. Right now the site is **public and
read-only**. Two quick steps finish the setup; both are optional, but the first is
what lets you edit from the browser.

## ✅ Finish your setup

- [ ] **Turn on editing.** Add a `GITHUB_TOKEN` **secret** to your Worker
  (Settings → Variables and Secrets) — a fine-grained GitHub token with
  *Contents: write* on this repository only. Then this note becomes editable and
  your changes commit straight back to the repo. *(Runtime secret — see the
  repo's `README.md`.)*
- [ ] **Make it private (recommended).** Put the site behind **Cloudflare Access**
  so only you can read it, while `/shared/<id>/` links stay public. Steps are in
  WebVault's `DEPLOY.md`.
- [ ] **(Optional) Speed up maps.** If you add *many* map pins, set
  `MAP_CACHE_KEY` + `SITE_URL` as **build** variables to cache Google Maps
  lookups between builds. Skip it until you need it.

## What a note can do

WebVault renders normal Markdown, so you get **bold**, *italics*, lists, tables,
and code. Notes also link to each other with wikilinks like
[[welcome]] — type `[[` in the editor to connect notes.

Any Google Maps link becomes an interactive **place card**, and a note's pins show
up together on a **map view**. Try these:

- [Colosseo](https://www.google.com/maps?q=Colosseo,+Roma)
- [Duomo di Milano](https://www.google.com/maps?q=Duomo+di+Milano)
- [Ponte di Rialto](https://www.google.com/maps?q=Ponte+di+Rialto,+Venezia)

Open this note on your site to see them resolved as cards on a map — that
resolution happens at build time, which is exactly what the optional maps cache
above speeds up.

## Make it yours

1. **Edit this note** (once the token is set) or delete it — it's just an example.
2. **Add your own notes**: drop `.md` files anywhere in this repository.
3. **Organise with views**: saved views live in `views/*.yml` — see **Start here**
   in the sidebar.
4. **Share a note**: publish it as an isolated public `/shared/<id>/` link while
   the rest of your vault stays private.

Full setup and deploy notes are in this repository's `README.md`.
