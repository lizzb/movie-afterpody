# Commentary Cinema PopNPods

Movie + Commentary Discovery App - "Movie Afterparty"

Product

A mobile-first movie discovery app optimized for the combined movie + commentary experience.

The central user need is:

Help me find the movie that will give me the best combined movie + commentary night.

The app combines:

movies

current streaming availability

movie filters/preferences

movie-commentary podcasts

podcast discovery

personal podcast preferences

episode ratings

listening completion

commentary scoring

watchlists/history

The app is initially single-user/personal but should use a multi-user-compatible architecture.

Core discovery modes

1. Tonight

Find movies available on the user's currently selected streaming services.

Filters:

genre

year

runtime

watched/unwatched

commentary availability

commentary score

podcast preference

Initial recommendation priority:

streaming availability

genre

runtime

preferred podcasts

commentary quality

year

movie preferences

These are initial weights, not hardcoded product limitations. Future versions should support configurable weighting.

2. Movie → Podcast

Movie detail page shows all known commentary episodes covering the movie.

Rank using:

user's podcast preference

user's previous episode ratings

completion behavior

commentary quality

number of episodes/podcasts covering the movie

external podcast ratings

podcast activity

similarity to user's preferences

3. Podcast → Movie

Podcast detail page shows movies that podcast has covered and that are currently available on the user's selected streaming services.

4. Podcast Discovery

Discover podcasts using:

episode count/backlog

recent activity

external rating

external rating count

number of movies covered

similarity to user preferences

Movie data

MVP is movies only.

Store enough structured metadata to support future TV expansion.

Minimum:

title

year/date

runtime

genres

synopsis

artwork/poster

external IDs

streaming availability

Streaming availability must be dynamic external data.

User manually selects which streaming services they currently have. Service selections must be easy to change.

MVP focuses on subscription services. Future support may include free/ad-supported, rental, and purchase availability.

Use a provider abstraction around streaming availability so the data source can change later.

Podcast data

Initial catalog should be prepopulated rather than manually entered by the user.

Initial target: approximately 100 relevant movie-commentary podcasts.

Store:

name

description

artwork

episode count

latest episode date

activity status

external platform identifiers/URLs

external rating

rating count

feed/source information

Episode data:

title

description

release date

duration

episode URLs

source/platform

movie associations

Podcast/movie matching

Manual episode cataloging is NOT acceptable as the primary workflow.

Use:

deterministic metadata/title matching

structured heuristics

AI only for ambiguous cases

AI usage must be minimized.

AI should enrich the catalog once and persist the result.

Do not call AI repeatedly for normal page loads, filtering, scoring, or recommendations.

The app should function if AI enrichment is unavailable.

One podcast episode may cover multiple movies.

Therefore:
Podcast Episode ↔ Movie = many-to-many

Podcast sources

Podcast episodes may exist in:

main RSS/feed

podcast website/archive

Spotify

Apple Podcasts

other podcast services

Patreon

The data model must support multiple sources for one canonical episode.

Podcast websites/back catalogs are desirable future sources.

Patreon ingestion is future scope, but the architecture must allow premium/private episode sources.

Podcast playback

Native playback is NOT an MVP dependency.

MVP:
Listen to episode ↗

opens the best available external destination.

The data model must support future embedded playback.

Do not make Spotify the canonical source of podcast data.

Use provider-neutral source records.

Podcast preference

Podcast preference is separate from episode ratings.

Support:

preferred

neutral/unselected

future: do not recommend

Preferred podcasts significantly influence recommendations.

Episode ratings

Use:
😞 Didn't like it
😐 Meh
😊 Loved it

Store ratings per episode.

Listening completion

MVP:

Not started

Started

Finished

Do not require manual percentage entry.

Future architecture may store:

playback position

duration

completion percentage

fully completed state

Completion behavior should influence recommendations.

Production quality

Store optional per-episode:
Production quality / audio quality

Example:

poor

okay

good

This is distinct from commentary quality.

Production quality is a secondary recommendation signal, not a dominant global ranking factor.

Do not force the user to rate it for every episode.

A smaller podcast may have mediocre audio but excellent commentary. Do not automatically bury it because of production quality.

Commentary Score

Every movie should have a Commentary Score representing the predicted quality of the movie + commentary experience for this user.

Signals:

number of commentary episodes

number of distinct podcasts

preferred podcasts covering the movie

podcasts the user frequently completes

user's episode ratings

podcast external rating

podcast rating count

podcast activity

similarity to previously enjoyed movies/podcasts

production quality when relevant

Use deterministic scoring for MVP.

Do not use an LLM to calculate Commentary Score at runtime.

Store/display an understandable explanation of why a movie scores well.

Personalization

Collect:

podcast preference

episode rating

episode completion

optional production quality

movies watched

watch date

watchlists

future movie ratings/reactions

MVP recommendation system should use explicit rules.

Do not build machine learning initially.

Design data structures so future recommendation models can use historical behavior.

Watchlists

Users can manually create watchlists.

Initial examples:

Date Night

Female-Led Thrillers

Bad Movies That Are Actually Good

Halloween

Rom-Coms

80s/90s/00s

Christmas Rom-Coms

Movies can belong to multiple watchlists.

Future: smart enhancement/generation of watchlists.

Watch history

MVP:

watched/unwatched

watch date

Future:

rewatches

detailed movie ratings/reactions

notes

commentary completion after movie

richer history

MVP exclusions

Do NOT make MVP dependent on:

native/embedded podcast playback

Patreon ingestion

podcast website archival scraping

TV

machine-learning recommendations

complex movie rating system

dynamic watchlists

social features

multi-user collaboration

manual cataloging of every podcast episode

manual listening percentages

Architecture principle

Separate canonical catalog data from user-specific data.

Use relational entities for:

movies

genres

streaming services

streaming availability

podcasts

podcast episodes

episode/movie associations

episode source/platform records

podcast external metrics

user podcast preferences

user episode ratings

user listening status

user production-quality ratings

watchlists

watchlist memberships

movie watch history

recommendation signals

Use provider abstractions for:

streaming data

podcast sources

Keep external provider IDs separate from internal IDs.

Design for future TV support and multi-user support without implementing those features now.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://movie-afterpody.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4ff118da-9d28-406a-8a0c-ae9c1a55e125).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
