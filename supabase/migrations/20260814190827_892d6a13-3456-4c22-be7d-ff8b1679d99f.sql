INSERT INTO public.genres (slug, name) VALUES
('action','Action'),('adventure','Adventure'),('comedy','Comedy'),('crime','Crime'),('drama','Drama'),
('family','Family'),('fantasy','Fantasy'),('horror','Horror'),('musical','Musical'),('mystery','Mystery'),
('romance','Romance'),('scifi','Sci-Fi'),('thriller','Thriller'),('western','Western'),('documentary','Documentary');

INSERT INTO public.streaming_services (slug, name, short_name, accent, sort_order) VALUES
('netflix','Netflix','Netflix','berry',10),
('max','HBO Max','Max','purple',20),
('hulu','Hulu','Hulu','teal',30),
('prime-video','Prime Video','Prime','teal',40),
('disney-plus','Disney+','Disney+','purple',50),
('apple-tv-plus','Apple TV+','Apple TV+','navy',60),
('peacock','Peacock','Peacock','coral',70),
('paramount-plus','Paramount+','Paramount+','teal',80),
('criterion-channel','The Criterion Channel','Criterion','gold',90),
('shudder','Shudder','Shudder','berry',100),
('tubi','Tubi','Tubi','gold',110);

INSERT INTO public.movies (slug, title, release_year, release_date, runtime_minutes, accent, synopsis) VALUES
('the-thing','The Thing',1982,'1982-06-25',109,'teal','An Antarctic research crew is infiltrated by a shape-shifting organism that assumes the appearance of whoever it kills.'),
('heat','Heat',1995,'1995-12-15',170,'navy','A obsessive detective and a disciplined career thief circle each other across a sprawling, sun-bleached Los Angeles.'),
('clueless','Clueless',1995,'1995-07-19',97,'coral','A sunny Beverly Hills matchmaker reinvents her classmates and, eventually, herself.'),
('jurassic-park','Jurassic Park',1993,'1993-06-11',127,'gold','A billionaire''s dinosaur theme park goes catastrophically offline during its first preview weekend.'),
('the-fugitive','The Fugitive',1993,'1993-08-06',130,'navy','A surgeon framed for his wife''s murder runs from a relentless US Marshal while hunting the real killer.'),
('speed','Speed',1994,'1994-06-10',116,'coral','A bus rigged to explode below fifty miles an hour turns a Los Angeles commute into a rolling siege.'),
('point-break','Point Break',1991,'1991-07-12',122,'teal','An FBI rookie infiltrates a crew of surfers he suspects of robbing banks in ex-president masks.'),
('youve-got-mail','You''ve Got Mail',1998,'1998-12-18',119,'coral','Rival booksellers fall in love anonymously online while loathing each other in person.'),
('the-mummy','The Mummy',1999,'1999-05-07',124,'gold','A treasure-hunting adventurer and a librarian awaken a cursed high priest beneath the sand.'),
('hereditary','Hereditary',2018,'2018-06-08',127,'purple','A family unravels after the death of a secretive grandmother exposes something inherited and awful.'),
('knives-out','Knives Out',2019,'2019-11-27',130,'berry','A private detective picks apart a wealthy family after the patriarch dies on the night of his birthday.'),
('the-devil-wears-prada','The Devil Wears Prada',2006,'2006-06-30',109,'navy','An aspiring journalist survives a year as assistant to the most feared editor in fashion.'),
('face-off','Face/Off',1997,'1997-06-27',138,'berry','An FBI agent and a terrorist surgically swap faces, then swap lives, then swap gunfire.'),
('con-air','Con Air',1997,'1997-06-06',115,'gold','A paroled ranger is trapped aboard a prison transport plane hijacked by its passengers.'),
('jennifers-body','Jennifer''s Body',2009,'2009-09-18',102,'berry','A possessed cheerleader starts eating the boys of her small town while her best friend catches on.'),
('the-princess-bride','The Princess Bride',1987,'1987-09-25',98,'gold','A farm boy turned pirate crosses swords, cliffs and rodents to rescue his true love.'),
('mad-max-fury-road','Mad Max: Fury Road',2015,'2015-05-15',120,'coral','A drifter and a rogue war captain flee a warlord across the desert in one continuous chase.'),
('the-parent-trap','The Parent Trap',1998,'1998-07-29',128,'teal','Twins separated at birth meet at summer camp and scheme to reunite their parents.'),
('showgirls','Showgirls',1995,'1995-09-22',131,'purple','A drifter claws her way from a Vegas strip club to the main stage, wrecking everyone in reach.'),
('scream','Scream',1996,'1996-12-20',111,'berry','A masked killer stalks a town of teenagers who know exactly how horror movies work.'),
('oceans-eleven','Ocean''s Eleven',2001,'2001-12-07',116,'navy','A newly paroled thief assembles eleven specialists to rob three casinos in a single night.'),
('twister','Twister',1996,'1996-05-10',113,'teal','Divorcing storm chasers race a rival team to drop sensors into the heart of a tornado.'),
('moonstruck','Moonstruck',1987,'1987-12-16',102,'coral','A widowed Brooklyn bookkeeper falls for her fiance''s furious younger brother under a huge moon.'),
('the-fifth-element','The Fifth Element',1997,'1997-05-07',126,'purple','A cab driver in a vertical future city is handed the woman who can stop a cosmic evil.'),
('crimson-peak','Crimson Peak',2015,'2015-10-16',119,'berry','A young author marries into a decaying English house that bleeds red clay and keeps secrets.'),
('paddington-2','Paddington 2',2017,'2017-11-10',103,'coral','A polite bear is wrongly imprisoned and improves the prison considerably.');

INSERT INTO public.movie_genres (movie_id, genre_id)
SELECT m.id, g.id FROM (VALUES
('the-thing','horror'),('the-thing','scifi'),
('heat','crime'),('heat','thriller'),('heat','drama'),
('clueless','comedy'),('clueless','romance'),
('jurassic-park','adventure'),('jurassic-park','scifi'),
('the-fugitive','thriller'),('the-fugitive','action'),
('speed','action'),('speed','thriller'),
('point-break','action'),('point-break','crime'),
('youve-got-mail','romance'),('youve-got-mail','comedy'),
('the-mummy','adventure'),('the-mummy','action'),('the-mummy','fantasy'),
('hereditary','horror'),('hereditary','drama'),
('knives-out','mystery'),('knives-out','comedy'),('knives-out','crime'),
('the-devil-wears-prada','comedy'),('the-devil-wears-prada','drama'),
('face-off','action'),('face-off','thriller'),
('con-air','action'),('con-air','thriller'),
('jennifers-body','horror'),('jennifers-body','comedy'),
('the-princess-bride','adventure'),('the-princess-bride','romance'),('the-princess-bride','fantasy'),
('mad-max-fury-road','action'),('mad-max-fury-road','scifi'),
('the-parent-trap','family'),('the-parent-trap','comedy'),
('showgirls','drama'),
('scream','horror'),('scream','mystery'),
('oceans-eleven','crime'),('oceans-eleven','comedy'),
('twister','action'),('twister','adventure'),
('moonstruck','romance'),('moonstruck','comedy'),
('the-fifth-element','scifi'),('the-fifth-element','action'),
('crimson-peak','horror'),('crimson-peak','romance'),
('paddington-2','family'),('paddington-2','comedy')
) AS v(mslug, gslug)
JOIN public.movies m ON m.slug = v.mslug
JOIN public.genres g ON g.slug = v.gslug;

INSERT INTO public.movie_availability (movie_id, service_id, deep_link)
SELECT m.id, s.id, 'https://www.justwatch.com/us/search?q=' || replace(m.title, ' ', '%20')
FROM (VALUES
('the-thing','peacock'),('the-thing','shudder'),
('heat','netflix'),('heat','max'),
('clueless','paramount-plus'),('clueless','prime-video'),
('jurassic-park','peacock'),
('the-fugitive','max'),('the-fugitive','tubi'),
('speed','hulu'),
('point-break','max'),('point-break','tubi'),
('youve-got-mail','netflix'),
('the-mummy','peacock'),('the-mummy','prime-video'),
('hereditary','max'),('hereditary','shudder'),
('knives-out','netflix'),
('the-devil-wears-prada','hulu'),('the-devil-wears-prada','disney-plus'),
('face-off','paramount-plus'),('face-off','tubi'),
('con-air','disney-plus'),
('jennifers-body','hulu'),('jennifers-body','shudder'),
('the-princess-bride','disney-plus'),
('mad-max-fury-road','max'),('mad-max-fury-road','netflix'),
('the-parent-trap','disney-plus'),
('showgirls','criterion-channel'),('showgirls','tubi'),
('scream','paramount-plus'),('scream','max'),
('oceans-eleven','netflix'),('oceans-eleven','max'),
('twister','max'),
('moonstruck','criterion-channel'),('moonstruck','prime-video'),
('the-fifth-element','paramount-plus'),
('crimson-peak','netflix'),('crimson-peak','shudder'),
('paddington-2','netflix'),('paddington-2','max')
) AS v(mslug, sslug)
JOIN public.movies m ON m.slug = v.mslug
JOIN public.streaming_services s ON s.slug = v.sslug;

INSERT INTO public.podcasts (slug, name, description, accent, episode_count, latest_episode_at, activity_status, feed_url, website_url, external_ids) VALUES
('the-rewatchables','The Rewatchables','The Ringer crew argues about the movies they cannot stop rewatching, category by category.','coral',420,'2026-08-10','active','https://feeds.megaphone.fm/the-rewatchables','https://www.theringer.com','{"apple":"1268575154","spotify":"1lGpQ8pT2ldeUlEvUqdvhL"}'),
('blank-check','Blank Check with Griffin & David','Two hosts work through complete directors'' filmographies with obsessive, funny detail.','purple',560,'2026-08-12','active','https://feeds.simplecast.com/blank-check','https://blankcheckpod.com','{"apple":"911825147"}'),
('how-did-this-get-made','How Did This Get Made?','Comedians take apart gloriously broken movies in front of a live audience.','gold',330,'2026-08-05','active','https://feeds.earwolf.com/hdtgm','https://www.earwolf.com/show/how-did-this-get-made','{"apple":"423048846"}'),
('you-must-remember-this','You Must Remember This','Beautifully researched narrative history of Hollywood''s first century.','berry',240,'2026-07-28','active','https://feeds.megaphone.fm/ymrt','https://www.youmustrememberthispodcast.com','{"apple":"858124601"}'),
('unspooled','Unspooled','A critic and a comedian work through the canon and ask whether it deserves the pedestal.','teal',280,'2026-08-08','active','https://feeds.simplecast.com/unspooled','https://www.unspooledpod.com','{"apple":"1372164326"}'),
('the-flop-house','The Flop House','Three friends watch a bad movie and then talk about it warmly for an hour.','gold',400,'2026-08-01','active','https://feeds.maximumfun.org/flophouse','https://www.flophousepodcast.com','{"apple":"239103244"}'),
('we-hate-movies','We Hate Movies','Affectionate, riff-heavy demolition of the movies everyone rented twice.','coral',700,'2026-08-11','active','https://feeds.acast.com/we-hate-movies','https://www.wehatemovies.com','{"apple":"432912178"}'),
('the-big-picture','The Big Picture','Interviews and deep dives on new releases and the industry behind them.','navy','520','2026-08-13','active','https://feeds.megaphone.fm/the-big-picture','https://www.theringer.com','{"apple":"1320585539"}'),
('filmspotting','Filmspotting','Long-running Chicago film criticism with marathons, top fives and real disagreement.','teal',900,'2026-08-09','active','https://feeds.feedburner.com/filmspotting','https://www.filmspotting.net','{"apple":"79046113"}'),
('the-projection-booth','The Projection Booth','Exhaustive three-hour excavations of cult films, with cast and crew interviews.','purple',680,'2026-08-04','active','https://feeds.libsyn.com/projectionbooth','https://projectionboothpodcast.com','{"apple":"377407103"}'),
('faculty-of-horror','Faculty of Horror','Two academics apply theory to horror films without ever getting dry about it.','berry',120,'2026-07-30','active','https://feeds.libsyn.com/facultyofhorror','https://www.facultyofhorror.com','{"apple":"661683712"}'),
('the-evolution-of-horror','The Evolution of Horror','Themed seasons tracing how horror subgenres grew and mutated.','purple',260,'2026-08-06','active','https://feeds.acast.com/evolution-of-horror','https://www.evolutionofhorror.com','{"apple":"1216979982"}'),
('screen-drafts','Screen Drafts','Competitive ranked drafting of film canons, refereed and gloriously petty.','gold',210,'2026-08-07','active','https://feeds.simplecast.com/screendrafts','https://www.screendrafts.com','{"apple":"1443301483"}'),
('kill-by-kill','Kill by Kill','Slasher franchises taken apart one kill at a time.','berry',300,'2026-07-22','active','https://feeds.libsyn.com/killbykill','https://killbykill.libsyn.com','{"apple":"1236185741"}'),
('now-playing','Now Playing Podcast','Retrospective series covering entire franchises film by film.','teal',800,'2026-08-02','active','https://feeds.libsyn.com/nowplaying','https://www.nowplayingpodcast.com','{"apple":"304108684"}'),
('switchblade-sisters','Switchblade Sisters','Women filmmakers pick a genre movie and talk craft with real specificity.','coral',180,'2025-11-14','dormant','https://feeds.maximumfun.org/switchblade','https://maximumfun.org/podcasts/switchblade-sisters','{"apple":"1348731304"}'),
('maltin-on-movies','Maltin on Movies','A legendary critic and his daughter interview filmmakers and revisit favourites.','gold',350,'2026-08-03','active','https://feeds.simplecast.com/maltin','https://www.leonardmaltin.com','{"apple":"1015197028"}'),
('bad-dads-film-review','Bad Dads Film Review','Two dads review a film and rank it in an ever-growing top five.','navy',400,'2026-07-31','active','https://feeds.acast.com/bad-dads','https://www.baddadsfilm.com','{"apple":"1094096041"}'),
('the-empire-film-podcast','The Empire Film Podcast','The magazine''s weekly show, with sprawling and generous interviews.','coral',640,'2026-08-12','active','https://feeds.acast.com/empire','https://www.empireonline.com','{"apple":"278981407"}'),
('truth-and-movies','Truth & Movies','Little White Lies'' show: new releases, a curated rewatch, and a film club.','teal',300,'2026-08-08','active','https://feeds.acast.com/truth-and-movies','https://lwlies.com','{"apple":"1145088523"}'),
('seventy-mm','70mm','Three friends celebrate the movies they love with warmth and craft talk.','purple',220,'2026-08-05','active','https://feeds.simplecast.com/70mm','https://www.70mmpod.com','{"apple":"1480269751"}'),
('who-shot-ya','Who Shot Ya?','Critics argue about new releases and revisit what the canon got wrong.','berry',260,'2026-07-29','slow','https://feeds.simplecast.com/whoshotya','https://www.whoshotya.show','{"apple":"1470506397"}');

INSERT INTO public.podcast_external_metrics (podcast_id, platform, rating, rating_count, external_url)
SELECT p.id, 'apple', v.rating::numeric, v.cnt, 'https://podcasts.apple.com/podcast/id' || (p.external_ids->>'apple')
FROM (VALUES
('the-rewatchables',4.6,18400),('blank-check',4.8,12900),('how-did-this-get-made',4.6,26100),
('you-must-remember-this',4.8,9800),('unspooled',4.7,4300),('the-flop-house',4.7,6100),
('we-hate-movies',4.7,7400),('the-big-picture',4.5,11200),('filmspotting',4.7,5200),
('the-projection-booth',4.7,1400),('faculty-of-horror',4.9,2600),('the-evolution-of-horror',4.8,2100),
('screen-drafts',4.7,1900),('kill-by-kill',4.8,1100),('now-playing',4.5,8300),
('switchblade-sisters',4.8,1500),('maltin-on-movies',4.7,2800),('bad-dads-film-review',4.6,900),
('the-empire-film-podcast',4.7,5600),('truth-and-movies',4.6,1300),('seventy-mm',4.9,1700),
('who-shot-ya',4.5,800)
) AS v(pslug, rating, cnt)
JOIN public.podcasts p ON p.slug = v.pslug;

CREATE TEMP TABLE seed_eps (pslug text, mslug text, title text, rel date, dur int) ON COMMIT DROP;
INSERT INTO seed_eps VALUES
('the-rewatchables','heat','Heat: The Coffee Shop and Everything After','2026-03-04',7920),
('the-rewatchables','point-break','Point Break: Vaya Con Dios','2025-11-19',6840),
('the-rewatchables','face-off','Face/Off: Peak Cage, Peak Travolta','2026-01-14',7200),
('the-rewatchables','oceans-eleven','Ocean''s Eleven: The Coolest Movie Ever Made','2026-02-11',7500),
('the-rewatchables','the-fugitive','The Fugitive: I Didn''t Kill My Wife','2025-09-10',6900),
('the-rewatchables','speed','Speed: Pop Quiz, Hotshot','2026-04-22',6600),
('the-rewatchables','twister','Twister: Cow. Another Cow.','2026-05-13',6300),
('blank-check','jurassic-park','Jurassic Park with Emily VanDerWerff','2025-10-05',10800),
('blank-check','the-fifth-element','The Fifth Element','2026-02-22',11400),
('blank-check','crimson-peak','Crimson Peak','2025-12-07',10200),
('blank-check','showgirls','Showgirls','2026-06-14',12000),
('blank-check','mad-max-fury-road','Mad Max: Fury Road','2026-07-19',11700),
('blank-check','the-thing','The Thing','2026-01-25',10500),
('how-did-this-get-made','con-air','Con Air LIVE','2025-08-16',5400),
('how-did-this-get-made','face-off','Face/Off','2026-03-21',5700),
('how-did-this-get-made','showgirls','Showgirls','2025-10-18',6000),
('how-did-this-get-made','twister','Twister','2026-06-06',5100),
('you-must-remember-this','moonstruck','Moonstruck and the Last Great Studio Romance','2026-02-03',3300),
('you-must-remember-this','showgirls','Erotic 90s: Showgirls','2025-09-23',3600),
('unspooled','the-princess-bride','The Princess Bride','2026-04-09',4500),
('unspooled','jurassic-park','Jurassic Park','2025-11-06',4800),
('unspooled','scream','Scream','2026-05-28',4650),
('unspooled','moonstruck','Moonstruck','2026-07-02',4200),
('the-flop-house','con-air','Con Air','2026-01-09',4800),
('the-flop-house','showgirls','Showgirls','2025-12-19',5100),
('we-hate-movies','the-mummy','The Mummy','2026-03-12',4200),
('we-hate-movies','con-air','Con Air','2025-10-30',4350),
('we-hate-movies','point-break','Point Break','2026-06-25',4050),
('we-hate-movies','speed','Speed','2026-07-16',4200),
('the-big-picture','knives-out','Knives Out and the Modern Whodunnit','2026-01-30',4500),
('the-big-picture','mad-max-fury-road','Fury Road, Ten Years On','2026-05-15',4800),
('the-big-picture','hereditary','Hereditary and the New Horror','2025-10-24',4350),
('filmspotting','heat','Heat / Top 5 Los Angeles Movies','2026-02-27',4800),
('filmspotting','the-thing','The Thing / Top 5 Practical Effects','2025-10-10',5100),
('filmspotting','crimson-peak','Crimson Peak / Gothic Marathon','2026-04-17',4650),
('filmspotting','paddington-2','Paddington 2 / Top 5 Comfort Films','2026-06-19',4500),
('the-projection-booth','the-thing','The Thing (1982)','2025-09-02',12600),
('the-projection-booth','showgirls','Showgirls','2026-03-17',13200),
('the-projection-booth','the-fifth-element','The Fifth Element','2026-05-05',11400),
('the-projection-booth','point-break','Point Break','2026-07-07',10800),
('faculty-of-horror','hereditary','Hereditary: Grief as Inheritance','2025-11-13',5400),
('faculty-of-horror','jennifers-body','Jennifer''s Body: Hungry Girls','2026-02-19',5700),
('faculty-of-horror','crimson-peak','Crimson Peak: The Female Gothic','2026-06-11',5250),
('the-evolution-of-horror','scream','Slashers: Scream','2025-10-08',5400),
('the-evolution-of-horror','the-thing','Body Horror: The Thing','2026-01-21',5100),
('the-evolution-of-horror','jennifers-body','Possession: Jennifer''s Body','2026-04-29',4950),
('screen-drafts','jurassic-park','Spielberg Draft, Round One','2026-03-27',9000),
('screen-drafts','mad-max-fury-road','Action Movies of the 2010s','2026-05-22',9600),
('screen-drafts','scream','Slasher Draft','2025-10-16',8700),
('kill-by-kill','scream','Scream, Kill by Kill','2025-09-26',5400),
('kill-by-kill','jennifers-body','Jennifer''s Body','2026-02-06',5100),
('now-playing','the-mummy','The Mummy (1999) Retrospective','2025-11-21',6300),
('now-playing','scream','Scream Retrospective','2026-01-16',6600),
('now-playing','jurassic-park','Jurassic Park Retrospective','2026-04-03',6900),
('switchblade-sisters','jennifers-body','Jennifer''s Body with Karyn Kusama','2025-08-28',3900),
('switchblade-sisters','point-break','Point Break','2025-10-02',3600),
('maltin-on-movies','moonstruck','Moonstruck with Norman Jewison','2026-02-13',3600),
('maltin-on-movies','the-princess-bride','The Princess Bride','2025-12-12',3450),
('maltin-on-movies','clueless','Clueless with Amy Heckerling','2026-05-08',3750),
('bad-dads-film-review','the-parent-trap','The Parent Trap','2026-03-06',3900),
('bad-dads-film-review','paddington-2','Paddington 2','2025-12-05',4050),
('bad-dads-film-review','jurassic-park','Jurassic Park','2026-06-26',4200),
('the-empire-film-podcast','mad-max-fury-road','Fury Road Anniversary Special','2026-05-14',6600),
('the-empire-film-podcast','the-mummy','The Mummy Rewatch','2026-01-08',6300),
('the-empire-film-podcast','knives-out','Knives Out with Rian Johnson','2025-11-27',6900),
('truth-and-movies','crimson-peak','Film Club: Crimson Peak','2025-10-23',3600),
('truth-and-movies','the-devil-wears-prada','Film Club: The Devil Wears Prada','2026-04-16',3450),
('truth-and-movies','hereditary','Film Club: Hereditary','2026-02-26',3750),
('seventy-mm','the-princess-bride','Comfort Watch: The Princess Bride','2026-03-19',3300),
('seventy-mm','paddington-2','Comfort Watch: Paddington 2','2025-12-18',3150),
('seventy-mm','youve-got-mail','Comfort Watch: You''ve Got Mail','2026-07-09',3450),
('seventy-mm','clueless','Comfort Watch: Clueless','2026-06-04',3300),
('who-shot-ya','the-devil-wears-prada','The Devil Wears Prada, Twenty Years On','2026-01-22',4200),
('who-shot-ya','knives-out','Knives Out and the Whodunnit Revival','2025-11-05',4050),
('who-shot-ya','youve-got-mail','Nora Ephron and the Rom-Com Machine','2026-03-26',4350),
('the-rewatchables','the-mummy','The Mummy: Adventure Cinema''s Last Gasp','2026-06-17',7080),
('the-flop-house','the-fifth-element','The Fifth Element','2026-07-23',4950),
('unspooled','the-devil-wears-prada','The Devil Wears Prada','2026-07-30',4500);

INSERT INTO public.podcast_episodes (podcast_id, slug, title, description, released_at, duration_seconds)
SELECT p.id, e.pslug || '--' || e.mslug, e.title,
       'Full-length commentary discussion of ' || m.title || ' (' || m.release_year || ') from ' || p.name || '.',
       e.rel, e.dur
FROM seed_eps e
JOIN public.podcasts p ON p.slug = e.pslug
JOIN public.movies m ON m.slug = e.mslug;

INSERT INTO public.episode_movies (episode_id, movie_id, match_method, match_confidence)
SELECT ep.id, m.id, 'seed', 1.00
FROM seed_eps e
JOIN public.movies m ON m.slug = e.mslug
JOIN public.podcast_episodes ep ON ep.slug = e.pslug || '--' || e.mslug;

-- a few episodes cover more than one movie
INSERT INTO public.episode_movies (episode_id, movie_id, match_method, match_confidence, is_primary_subject)
SELECT ep.id, m.id, 'seed', 0.80, false
FROM (VALUES
('filmspotting--heat','the-fugitive'),
('screen-drafts--mad-max-fury-road','speed'),
('screen-drafts--slasher','scream'),
('the-rewatchables--point-break','speed'),
('who-shot-ya--youve-got-mail','moonstruck'),
('the-big-picture--knives-out','oceans-eleven')
) AS v(eslug, mslug)
JOIN public.podcast_episodes ep ON ep.slug = v.eslug
JOIN public.movies m ON m.slug = v.mslug;

INSERT INTO public.episode_sources (episode_id, platform, url, is_primary, embeddable)
SELECT ep.id, 'rss', COALESCE(p.website_url, 'https://example.com') || '/episodes/' || ep.slug, true, false
FROM public.podcast_episodes ep JOIN public.podcasts p ON p.id = ep.podcast_id;

INSERT INTO public.episode_sources (episode_id, platform, url, is_primary, embeddable)
SELECT ep.id, 'apple', 'https://podcasts.apple.com/podcast/id' || (p.external_ids->>'apple'), false, false
FROM public.podcast_episodes ep JOIN public.podcasts p ON p.id = ep.podcast_id
WHERE p.external_ids ? 'apple';

INSERT INTO public.episode_sources (episode_id, platform, url, is_primary, embeddable)
SELECT ep.id, 'spotify', 'https://open.spotify.com/show/' || (p.external_ids->>'spotify'), false, true
FROM public.podcast_episodes ep JOIN public.podcasts p ON p.id = ep.podcast_id
WHERE p.external_ids ? 'spotify';

UPDATE public.podcasts p SET episode_count = GREATEST(p.episode_count, sub.c)
FROM (SELECT podcast_id, count(*) c FROM public.podcast_episodes GROUP BY podcast_id) sub
WHERE sub.podcast_id = p.id;