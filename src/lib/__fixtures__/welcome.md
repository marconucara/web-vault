---
type: Note
---
# Welcome to your WebVault 👋

You deployed this in a few clicks. It's a **starter vault** — a tiny Markdown
knowledge base with WebVault already wired in. Right now the site is **public and
read-only**. Two unlocks finish the setup: the first closes the site to everyone
but you, the second lets you edit from the browser.

## ✅ Finish your setup

- [ ] **🔒 Make it private (⚠️ important).** Until you do this, anyone with the
  URL can read your vault. Gate the site with **Cloudflare Access / Zero Trust**
  so only you can read it, while `/shared/<id>/` links stay public. Follow
  [WebVault's Access setup steps](https://github.com/marconucara/web-vault/blob/v0.5.2/DEPLOY.md#3-gate-the-site-with-cloudflare-access).
- [ ] **✏️ Turn on web editing.** Create a
  [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new)
  with *Contents: write* on this repository only, then add it to your Worker
  (Settings → Variables and Secrets) as a secret named `GITHUB_TOKEN`. Then this
  note becomes editable and your changes commit straight back to the repo.
- [ ] **🗺️ (Optional) Speed up maps.** Any Google Maps link in a note becomes a
  place card and a pin on a map — there are examples further down this note. If
  you add *many* pins, set `MAP_CACHE_KEY` + `SITE_URL` as **build** variables to
  cache those lookups between builds. Skip it until you need it.

## Get to know WebVault

Four things to try. Nothing here is required reading — poke at whatever looks
useful and come back later for the rest.

### ✍️ Try the editor

Your notes stay plain Markdown on disk, but you don't have to write it by hand.
The editor formats as you type: `**bold**`, `*italics*`, headings, tables, code,
quotes, and task lists all render live.

- [ ] Tick this box — it's a real Markdown task list
- [ ] Press `/` on an empty line to pick a block type
- [ ] Select some text to get the formatting toolbar

Everything you write is saved back as ordinary Markdown, so the vault stays
readable — and editable — outside WebVault too.

### 🔗 Link notes together

Typing two square brackets in the editor opens a picker of your notes, and
picking one drops in a link like [[welcome]]. Links are how a pile of notes turns
into something you can navigate: follow one, and the note it points at opens.

### 🗺️ Drop a place on the map

Paste any Google Maps link and it becomes an interactive **place card**. The link
text is yours to write — treat it as a note to yourself about the place, not just
its name:

1. [Colosseo — first thing to see once we land, can't wait for this one](https://www.google.com/maps?q=Colosseo,+Roma)
2. [Duomo di Milano — go early, the rooftop queue gets long by mid-morning](https://www.google.com/maps?q=Duomo+di+Milano)
3. [Ponte di Rialto — best at sunset, then dinner somewhere in San Polo](https://www.google.com/maps?q=Ponte+di+Rialto,+Venezia)

Put your places in a numbered list and each pin picks up its number, so a card
and its marker on the map are easy to match — which is what turns a day of an
itinerary into something you can actually read.

Every pin in a note also collects into a **map view** for that note, reachable
from the top bar (see below). Places are looked up when the site builds, not when
you open the note — which is what the optional maps cache above makes faster.

### 🧭 Explore the sidebar

The sidebar has three parts, top to bottom.

**Built-in views** come with WebVault and are always there:

- **All notes** — everything in the vault.
- **Inbox** — notes you haven't filed yet. A note leaves the Inbox once it has
  `_organized: true` in its frontmatter.
- **Shared** — the notes currently published as public links.

**Saved views** are yours. Each is a `views/*.yml` file describing what to show
and how to sort it — **Start here** is the one this template ships with. Add a
file, get a view.

**Types** group notes by what they *are*. A note declares one with `type:` in its
frontmatter, and every type in use becomes a sidebar entry. This template defines
two, in `_types/`: **Note** for anything general, and **Trip** for a destination
you're planning. A type document is just a note that sets its icon, colour, and
description — add a file to `_types/` to define your own.

Views and types are edited as files rather than through the interface for now.

### 🧰 The top bar

Three buttons sit above every open note, and they are worth knowing:

- **Edit source** swaps the visual editor for the raw Markdown — the exact
  characters on disk. Useful when you want precise control over the syntax, or
  just to see what the editor has been writing for you.
- **Map view** switches the note to the map of its pins, with the numbered
  markers described above. It only has something to show when the note contains
  Google Maps links.
- **Properties** opens a panel with the note's type, its frontmatter fields, and
  the notes it links to. It's read-only — edit the values in the frontmatter
  itself.

A small marker also appears next to the title when a note has changes that
haven't been committed back to your repository yet.

## Make it yours

1. **Edit this note** (once the token is set) or delete it — it's just an example.
2. **Add your own notes**: drop `.md` files anywhere in this repository.
3. **Organise with views**: saved views live in `views/*.yml` — see **Start here**
   in the sidebar.
4. **Share a note**: publish it as an isolated public `/shared/<id>/` link while
   the rest of your vault stays private.

Full setup and deploy notes are in this repository's `README.md`.
