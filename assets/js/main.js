/* Cinema in the Digital Age — framework-free interactions.
   Add a TMDB Read Access Token in hugo.toml to enable live movie data.
   A static Hugo site exposes browser-side tokens. For a public production
   project, route TMDB requests through a serverless function instead. */

const header = document.querySelector('[data-header]');
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.primary-nav');
const token = document.querySelector('meta[name="tmdb-token"]')?.content.trim() || '';
const siteRoot = document.body?.dataset.siteRoot || '/';
const apiBase = 'https://api.themoviedb.org/3';
const imageBase = 'https://image.tmdb.org/t/p/w500';
let genreNames = { 12: 'Adventure', 16: 'Animation', 18: 'Drama', 27: 'Horror', 28: 'Action', 35: 'Comedy', 36: 'History', 53: 'Thriller', 80: 'Crime', 99: 'Documentary', 10749: 'Romance', 10751: 'Family', 878: 'Science Fiction' };

const closeNav = () => {
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Open navigation');
  document.body.classList.remove('nav-open');
};
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
  document.body.classList.toggle('nav-open', !open);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
window.addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 40), { passive: true });

const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
}), { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  document.querySelectorAll('.primary-nav a').forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
}), { rootMargin: '-25% 0px -65% 0px' });
document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));

const tmdb = async (path, params = {}) => {
  if (!token) throw new Error('TMDB token not configured');
  const url = new URL(`${apiBase}${path}`);
  Object.entries(params).forEach(([key, value]) => value !== '' && url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
  return response.json();
};

const posterFallback = title => {
  return new URL('images/movie-poster-fallback.svg', new URL(siteRoot, location.origin)).toString();
};

const normalizeMovie = movie => ({
  id: movie.id || null,
  title: movie.title,
  year: (movie.release_date || movie.year || 'TBA').slice(0, 4),
  releaseDate: movie.release_date || movie.releaseDate || '',
  rating: Number(movie.vote_average ?? movie.rating ?? 0).toFixed(1),
  overview: movie.overview || 'Details will be announced closer to release.',
  poster: movie.poster_path ? `${imageBase}${movie.poster_path}` : (movie.poster || posterFallback(movie.title)),
  genreIds: movie.genre_ids || movie.genreIds || [],
  genre: movie.genre || (movie.genre_ids || []).slice(0, 2).map(id => genreNames[id]).filter(Boolean).join(' · '),
  trailerQuery: movie.trailerQuery || `${movie.title} official trailer`
});

const createMovieCard = rawMovie => {
  const movie = normalizeMovie(rawMovie);
  const card = document.querySelector('#movie-card-template').content.firstElementChild.cloneNode(true);
  const image = card.querySelector('img');
  image.src = movie.poster; image.alt = `Poster for ${movie.title}`;
  image.addEventListener('error', () => { image.src = posterFallback(movie.title); }, { once: true });
  card.querySelector('.movie-rating').textContent = movie.rating === '0.0' ? 'Not rated' : `★ ${movie.rating}`;
  card.querySelector('.movie-year').textContent = movie.releaseDate || movie.year;
  card.querySelector('.movie-genre').textContent = movie.genre || 'Film';
  card.querySelector('h3').textContent = movie.title;
  card.querySelector('.movie-copy p').textContent = movie.overview;
  card.querySelector('.trailer-button').addEventListener('click', () => openTrailer(movie));
  card.dataset.genres = movie.genreIds.join(' ');
  card.dataset.title = movie.title.toLowerCase();
  return card;
};

const renderMovies = (container, movies, append = false) => {
  const cards = movies.map(createMovieCard);
  if (append) container.append(...cards); else container.replaceChildren(...cards);
  cards.forEach(card => { card.classList.add('is-visible'); });
};

const moodConfig = {
  happy: { label: 'Happy', genres: '35,16,12', reason: 'These films amplify joy through humor, friendship, and a sense of possibility.' },
  sad: { label: 'Sad', genres: '18,10749', reason: 'These emotionally honest stories create space for reflection, release, and empathy.' },
  lonely: { label: 'Lonely', genres: '18,10749', reason: 'These films explore connection, self-discovery, and meaningful relationships.' },
  romantic: { label: 'Romantic', genres: '10749,18', reason: 'These films find intimacy in chance encounters, difficult timing, and lasting devotion.' },
  motivated: { label: 'Motivated', genres: '18,36,12', reason: 'These stories follow persistence, craft, and people becoming larger than their circumstances.' },
  stressed: { label: 'Stressed', genres: '35,16,99', reason: 'These gentler films offer humor, wonder, and enough breathing room to reset.' },
  thoughtful: { label: 'Thoughtful', genres: '18,878,99', reason: 'These films reward curiosity and invite questions that continue after the credits.' },
  excited: { label: 'Excited', genres: '28,12,53', reason: 'These kinetic stories turn anticipation into movement, suspense, and spectacle.' },
  nostalgic: { label: 'Nostalgic', genres: '18,36,10749', reason: 'These films explore memory, time, home, and the distance between who we were and who we are.' }
};

const moodFallback = {
  happy: [['Paddington 2',2017,8.1,'A generous, joyful comedy about kindness becoming contagious.','Comedy'],['Sing Street',2016,7.9,'A teenager starts a band and discovers a larger version of his life.','Music · Comedy'],['Amélie',2001,7.9,'A whimsical celebration of small pleasures and human connection.','Romance · Comedy']],
  sad: [['Aftersun',2022,7.7,'A daughter revisits the fragile memories of a holiday with her father.','Drama'],['The Iron Claw',2023,7.5,'Brotherhood and grief collide inside a celebrated wrestling family.','Drama'],['Manchester by the Sea',2016,7.5,'A deeply human story about grief, responsibility, and survival.','Drama']],
  lonely: [['Her',2013,8.0,'A solitary writer develops an unexpected relationship with an operating system.','Drama · Romance'],['Lost in Translation',2003,7.7,'Two strangers find recognition and companionship far from home.','Drama'],['The Secret Life of Walter Mitty',2013,7.3,'A quiet dreamer steps beyond routine and into the world.','Adventure · Drama']],
  romantic: [['Before Sunrise',1995,8.1,'Two travelers meet by chance and spend one night walking through Vienna.','Romance · Drama'],['La La Land',2016,7.9,'Love and ambition share the stage in a modern musical.','Romance · Music'],['About Time',2013,7.8,'A time traveler learns that ordinary days are the heart of a life.','Romance · Comedy']],
  motivated: [['Rocky',1976,8.0,'An unknown boxer earns one chance to prove what persistence means.','Drama'],['Whiplash',2014,8.4,'A drummer pushes ambition toward its exhilarating and dangerous limits.','Drama · Music'],['The Pursuit of Happyness',2006,8.0,'A father refuses to let hardship define his family’s future.','Drama']],
  stressed: [['My Neighbor Totoro',1988,8.1,'Two sisters discover gentle forest spirits near their new home.','Animation'],['Chef',2014,7.3,'A chef rediscovers creativity, family, and pleasure through a food truck.','Comedy'],['The Biggest Little Farm',2018,8.0,'A restorative portrait of patience, ecology, and learning from the land.','Documentary']],
  thoughtful: [['Arrival',2016,7.9,'Language, time, and loss reshape humanity’s first encounter.','Science Fiction'],['The Truman Show',1998,8.2,'A man begins to question the perfectly constructed world around him.','Drama'],['After Yang',2021,6.7,'A family’s loss opens questions about memory and what makes a life.','Science Fiction · Drama']],
  excited: [['Mad Max: Fury Road',2015,8.1,'A breathtaking chase turns action filmmaking into pure visual momentum.','Action'],['Mission: Impossible – Fallout',2018,7.4,'Precision stunt work drives an escalating global mission.','Action · Thriller'],['Spider-Man: Into the Spider-Verse',2018,8.4,'A vivid leap across dimensions, identities, and animation styles.','Animation · Action']],
  nostalgic: [['Cinema Paradiso',1988,8.5,'A filmmaker remembers the theater and friendship that shaped his childhood.','Drama'],['The Fabelmans',2022,7.5,'A young filmmaker discovers how cameras transform family memory.','Drama'],['Midnight in Paris',2011,7.6,'A writer discovers the seduction—and illusion—of another era.','Comedy · Romance']]
};
Object.keys(moodFallback).forEach(key => { moodFallback[key] = moodFallback[key].map((m, i) => ({ id: null, title:m[0], year:String(m[1]), rating:m[2], overview:m[3], genre:m[4], genreIds:moodConfig[key].genres.split(',').map(Number), trailerQuery:`${m[0]} official trailer`, poster:posterFallback(m[0]+i) })); });

const moodPanel = document.querySelector('[data-recommendation-panel]');
document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', async () => {
  const key = button.dataset.mood; const config = moodConfig[key];
  document.querySelectorAll('[data-mood]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  moodPanel.hidden = false;
  moodPanel.querySelector('[data-mood-title]').textContent = `You selected ${config.label}.`;
  moodPanel.querySelector('[data-mood-reason]').textContent = config.reason;
  moodPanel.querySelector('input[name="mood"]').value = config.label;
  const status = moodPanel.querySelector('[data-mood-status]'); const results = moodPanel.querySelector('[data-mood-results]');
  status.textContent = token ? 'Searching the cinema archive…' : 'Showing curated selections. Add a TMDB token for live discovery.';
  moodPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const data = await tmdb('/discover/movie', { with_genres: config.genres, sort_by: 'vote_average.desc', 'vote_count.gte': '800', include_adult: 'false', page: String(Math.floor(Math.random() * 3) + 1) });
    renderMovies(results, data.results.slice(0, 6)); status.textContent = 'Live recommendations from TMDB.';
  } catch { renderMovies(results, moodFallback[key]); }
}));

const feedbackForm = document.querySelector('[data-feedback-form]');
feedbackForm?.querySelectorAll('[data-score]').forEach(button => button.addEventListener('click', async () => {
  const score = Number(button.dataset.score); feedbackForm.querySelector('input[name="score"]').value = String(score);
  feedbackForm.querySelectorAll('[data-score]').forEach(star => star.classList.toggle('is-active', Number(star.dataset.score) <= score));
  const entry = { mood: feedbackForm.elements.mood.value, score, recordedAt: new Date().toISOString() };
  const saved = JSON.parse(localStorage.getItem('cinemaMoodFeedback') || '[]'); saved.push(entry); localStorage.setItem('cinemaMoodFeedback', JSON.stringify(saved));
  feedbackForm.querySelector('[data-feedback-message]').textContent = 'Thank you — response saved.';
  if (!['localhost','127.0.0.1'].includes(location.hostname)) fetch('/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(new FormData(feedbackForm)).toString() }).catch(() => {});
}));

const fallbackUpcoming = [
  ['The Odyssey','2026-07-17',0,'A mythic voyage home across a world of gods, monsters, and human endurance.',[12,18]],
  ['Spider-Man: Brand New Day','2026-07-31',0,'A new chapter begins for the web-slinging hero in New York City.',[28,12]],
  ['Minions 3','2026-07-01',0,'The mischievous yellow crew returns for another animated adventure.',[16,35]],
  ['Avengers: Doomsday','2026-12-18',0,'Heroes across the universe assemble against a formidable new threat.',[28,878]],
  ['Dune: Part Three','2026-12-18',0,'The desert saga continues as power, prophecy, and consequence converge.',[878,12]],
  ['Spider-Man: Beyond the Spider-Verse','2027-06-04',0,'Miles Morales continues his journey across a limitless animated multiverse.',[16,28]],
  ['The Batman: Part II','2027-10-01',0,'Gotham’s detective returns to confront a new shadow over the city.',[80,18]],
  ['Frozen III','2027-11-24',0,'The sisters of Arendelle begin another journey beyond their kingdom.',[16,10751]]
].map(m => ({ title:m[0], release_date:m[1], rating:m[2], overview:m[3], genreIds:m[4], genre:m[4].map(id=>genreNames[id]).filter(Boolean).join(' · '), poster:posterFallback(m[0]) }));

const comingResults = document.querySelector('[data-coming-results]');
const comingStatus = document.querySelector('[data-coming-status]');
const genreFilter = document.querySelector('[data-genre-filter]');
const movieSearch = document.querySelector('[data-movie-search]');
const loadMoreButton = document.querySelector('[data-load-more]');
const apiNotice = document.querySelector('[data-api-notice]');
let comingMovies = [];
let comingPage = 0;
let comingTotalPages = 1;
let comingLoading = false;

const fillGenres = genres => { genres.forEach(genre => { const option=document.createElement('option'); option.value=genre.id; option.textContent=genre.name; genreFilter?.append(option); }); };
const preserveComingPosition = callback => {
  const toolbar = document.querySelector('.movie-toolbar');
  const before = toolbar?.getBoundingClientRect().top || 0;
  callback();
  requestAnimationFrame(() => { const after=toolbar?.getBoundingClientRect().top||0; window.scrollBy(0,after-before); });
};
const showComing = (movies, append=false) => {
  preserveComingPosition(() => renderMovies(comingResults,movies,append));
  const total=comingResults.children.length;
  comingStatus.textContent=`${total} ${total===1?'film':'films'} on the marquee${comingTotalPages>comingPage?' — more available':''}.`;
  if(loadMoreButton) loadMoreButton.hidden=!token||comingPage>=comingTotalPages;
};
const loadComingPage = async (reset=false) => {
  if(comingLoading)return;
  if(reset){comingPage=0;comingTotalPages=1;comingResults.replaceChildren();}
  if(comingPage>=comingTotalPages&&comingPage!==0)return;
  comingLoading=true;if(loadMoreButton)loadMoreButton.disabled=true;comingStatus.textContent='Loading future releases…';
  const nextPage=comingPage+1;const query=movieSearch.value.trim();const genre=genreFilter.value;const today=new Date().toISOString().slice(0,10);
  try{
    let data;
    if(query.length>2){data=await tmdb('/search/movie',{query,include_adult:'false',region:'DE',page:String(nextPage)});data.results=data.results.filter(movie=>!movie.release_date||movie.release_date>=today);}
    else{data=await tmdb('/discover/movie',{'primary_release_date.gte':today,region:'DE',with_release_type:'2|3',with_genres:genre,sort_by:'primary_release_date.asc',include_adult:'false',page:String(nextPage)});}
    comingPage=nextPage;comingTotalPages=Math.min(Number(data.total_pages)||1,500);const batch=data.results.map(normalizeMovie);comingMovies=reset?batch:[...comingMovies,...batch];showComing(batch,!reset&&comingPage>1);
  }catch{comingStatus.textContent='The live movie catalogue could not be reached. Please check the TMDB token.';}
  finally{comingLoading=false;if(loadMoreButton)loadMoreButton.disabled=false;}
};
const loadComing = async () => {
  if(token){
    try{const genres=await tmdb('/genre/movie/list');genreNames=Object.fromEntries(genres.genres.map(g=>[g.id,g.name]));fillGenres(genres.genres);await loadComingPage(true);return;}catch{}
  }
  apiNotice.hidden=false;comingMovies=fallbackUpcoming.map(normalizeMovie);fillGenres(Object.entries(genreNames).map(([id,name])=>({id,name})));comingPage=1;comingTotalPages=1;showComing(comingMovies);comingStatus.textContent=`${comingMovies.length} demonstration films. Connect TMDB for the complete live catalogue and official posters.`;
};
genreFilter?.addEventListener('change',()=>{if(token)loadComingPage(true);else{const genre=genreFilter.value;showComing(genre?comingMovies.filter(movie=>movie.genreIds.includes(Number(genre))):comingMovies);}});
loadMoreButton?.addEventListener('click',()=>loadComingPage(false));
let searchTimer;
movieSearch?.addEventListener('input', () => {
  clearTimeout(searchTimer); searchTimer=setTimeout(async () => {
    const query=movieSearch.value.trim();
    if(token){loadComingPage(true);return;}
    showComing(comingMovies.filter(movie=>movie.title.toLowerCase().includes(query.toLowerCase())));
  },350);
});
if (comingResults) loadComing();

const journalEntries=[...document.querySelectorAll('[data-journal-entry]')];
const journalSearch=document.querySelector('[data-journal-search]');
let journalCategory='all';
const filterJournal=()=>{ const query=(journalSearch?.value||'').trim().toLowerCase(); let visible=0; journalEntries.forEach(entry=>{ const matchCategory=journalCategory==='all'||entry.dataset.category.split(' ').includes(journalCategory); const matchSearch=!query||entry.dataset.search.includes(query); const show=matchCategory&&matchSearch; entry.hidden=!show; if(show)visible++; }); const empty=document.querySelector('[data-journal-empty]'); if(empty)empty.hidden=visible!==0; };
document.querySelectorAll('[data-journal-filter]').forEach(button=>button.addEventListener('click',()=>{journalCategory=button.dataset.journalFilter;document.querySelectorAll('[data-journal-filter]').forEach(item=>item.classList.toggle('is-active',item===button));filterJournal();}));
journalSearch?.addEventListener('input',filterJournal);

const trailerDialog=document.querySelector('[data-trailer-dialog]');
const openTrailer=async movie=>{
  const content=trailerDialog.querySelector('[data-trailer-content]'); const message=trailerDialog.querySelector('[data-trailer-message]'); content.replaceChildren(); message.textContent='Finding the trailer…'; trailerDialog.showModal();
  if(movie.id&&token){try{const data=await tmdb(`/movie/${movie.id}/videos`);const video=data.results.find(v=>v.site==='YouTube'&&v.type==='Trailer')||data.results.find(v=>v.site==='YouTube');if(video){const iframe=document.createElement('iframe');iframe.src=`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`;iframe.title=`${movie.title} trailer`;iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;content.append(iframe);message.textContent='';return;}}catch{}}
  const link=document.createElement('a');link.className='button';link.href=`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.trailerQuery)}`;link.target='_blank';link.rel='noopener';link.innerHTML='<span>Search trailer on YouTube</span><span aria-hidden="true">↗</span>';content.append(link);message.textContent='A direct trailer becomes available when TMDB is connected.';
};
const closeTrailer=()=>{trailerDialog.close();trailerDialog.querySelector('[data-trailer-content]').replaceChildren();};
document.querySelector('[data-trailer-close]')?.addEventListener('click',closeTrailer);
trailerDialog?.addEventListener('click',event=>{if(event.target===trailerDialog)closeTrailer();});

const communityForm=document.querySelector('[data-community-form]');
const memoryWall=document.querySelector('.memory-wall');
const addMemoryCard=memory=>{
  if(!memoryWall||!memory.movie)return;
  const score=Math.max(0,Math.min(5,parseInt(memory.rating,10)||0));
  const card=document.createElement('article');card.className='memory-card is-visible';
  const rating=document.createElement('span');rating.className='memory-rating';rating.textContent='★'.repeat(score)+'☆'.repeat(5-score);
  const title=document.createElement('h3');title.textContent=memory.movie;
  const experience=document.createElement('p');experience.textContent=`“${memory.experience||'A cinema memory worth keeping.'}”`;
  const details=document.createElement('dl');
  [['Before',memory['feeling-before']||'—'],['After',memory['feeling-after']||'—']].forEach(([label,value])=>{const wrap=document.createElement('div');const term=document.createElement('dt');const description=document.createElement('dd');term.textContent=label;description.textContent=value;wrap.append(term,description);details.append(wrap);});
  const byline=document.createElement('small');byline.textContent=`${memory.name||'Anonymous'} · ${memory.cinema||'Cinema memory'}`;
  card.append(rating,title,experience,details,byline);memoryWall.prepend(card);
};
JSON.parse(localStorage.getItem('cinemaCommunityMemories')||'[]').slice(-3).forEach(addMemoryCard);
communityForm?.addEventListener('submit',async event=>{
  event.preventDefault(); const message=communityForm.querySelector('[data-community-message]'); message.textContent='Saving your cinema memory…';
  const memory=Object.fromEntries(new FormData(communityForm).entries()); const saved=JSON.parse(localStorage.getItem('cinemaCommunityMemories')||'[]'); saved.push({...memory,recordedAt:new Date().toISOString()}); localStorage.setItem('cinemaCommunityMemories',JSON.stringify(saved));
  if(!['localhost','127.0.0.1'].includes(location.hostname)){try{await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(communityForm)).toString()});}catch{message.textContent='Saved on this device, but the online form could not be reached.';return;}}
  addMemoryCard(memory); communityForm.reset(); message.textContent='Your memory has been pinned. Thank you.';
});
