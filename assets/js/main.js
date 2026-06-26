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
  const safeTitle=String(title||'Cinema Pick').replace(/[&<>]/g,letter=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[letter]));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5c0a0a"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><rect x="28" y="28" width="344" height="544" fill="none" stroke="#d4af37" stroke-width="6"/><circle cx="200" cy="150" r="54" fill="none" stroke="#d4af37" stroke-width="10"/><circle cx="200" cy="150" r="16" fill="#d4af37"/><text x="200" y="330" fill="#f5f5f5" font-family="Georgia,serif" font-size="38" text-anchor="middle" font-weight="700">${safeTitle}</text><text x="200" y="500" fill="#d4af37" font-family="Arial,sans-serif" font-size="18" text-anchor="middle" letter-spacing="4">CINEMA PICK</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
  if (!moodPanel) return;
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

const assistantForm=document.querySelector('[data-decision-form]');
const assistantResults=document.querySelector('[data-assistant-results]');
const assistantPanel=document.querySelector('[data-decision-results]');
const assistantReason=document.querySelector('[data-decision-reason]');
const assistantMemory=document.querySelector('[data-decision-memory]');
const assistantStorageKey='cinemaDecisionMemory';
const providerMap={netflix:'8',prime:'119',disney:'337'};
function normalizePlatform(value){
  const normalized=String(value||'')
    .toLowerCase()
    .replace(/amazon/g,'')
    .replace(/video/g,'')
    .replace(/\+/g,' plus ')
    .replace(/\s+/g,' ')
    .trim();
  if(!normalized||normalized==='any')return '';
  if(normalized.includes('prime'))return 'prime';
  if(normalized.includes('netflix'))return 'netflix';
  if(normalized.includes('disney'))return 'disney';
  if(normalized.includes('cinema')||normalized.includes('theater')||normalized.includes('theatre')||normalized.includes('big screen'))return 'cinema';
  if(normalized.includes('library')||normalized.includes('watchlist'))return 'library';
  return normalized;
}
const platformValues=movie=>{
  const value=movie.platforms??movie.platform??movie.provider??movie.watchProvider??movie.watch_provider;
  if(Array.isArray(value))return value;
  if(typeof value==='string')return value.split(/[,/|]+/).map(item=>item.trim()).filter(Boolean);
  return [];
};
const assistantFallback=[
  {title:'Arrival',year:'2016',runtime:116,rating:7.9,genreIds:[878,18],platforms:['Prime Video','Netflix','My own watchlist'],moods:['thoughtful','curious','inspired','moved'],age:'modern',overview:'A linguist works with the military to communicate with mysterious visitors, changing how she understands time and loss.',genre:'Sci-fi · Drama'},
  {title:'Interstellar',year:'2014',runtime:169,rating:8.7,genreIds:[878,18],platforms:['Amazon Prime Video','Cinema','My own watchlist'],moods:['inspired','thoughtful','moved'],age:'modern',overview:'A group of explorers travel through a wormhole to find humanity a future beyond Earth.',genre:'Sci-fi · Drama'},
  {title:'Her',year:'2013',runtime:126,rating:8.0,genreIds:[878,10749,18],platforms:['Netflix','Prime Video','My own watchlist'],moods:['lonely','romantic','curious','moved'],age:'modern',overview:'A lonely writer develops a relationship with an operating system that understands him deeply.',genre:'Sci-fi · Romance'},
  {title:'The Martian',year:'2015',runtime:144,rating:8.0,genreIds:[878,12],platforms:['Disney+','Amazon Prime Video','My own watchlist'],moods:['inspired','energized','happy'],age:'modern',overview:'An astronaut stranded on Mars uses science, humor, and persistence to survive.',genre:'Sci-fi · Adventure'},
  {title:'Blade Runner 2049',year:'2017',runtime:164,rating:8.0,genreIds:[878,18,53],platforms:['Netflix','Amazon Prime','My own watchlist'],moods:['thoughtful','curious','moved'],age:'new',overview:'A young blade runner uncovers a buried secret that could reshape society.',genre:'Sci-fi · Thriller'},
  {title:'Before Sunrise',year:'1995',runtime:101,rating:8.1,genreIds:[10749,18],platforms:['Prime Video','My own watchlist'],moods:['romantic','moved','relaxed'],age:'old',overview:'Two strangers meet on a train and spend one night walking and talking through Vienna.',genre:'Romance · Drama'},
  {title:'Whiplash',year:'2014',runtime:107,rating:8.4,genreIds:[18],platforms:['Netflix','Amazon Prime Video','My own watchlist'],moods:['energized','inspired','stressed'],age:'modern',overview:'A young drummer pushes himself under the pressure of a ruthless music teacher.',genre:'Drama'},
  {title:'Mad Max: Fury Road',year:'2015',runtime:121,rating:8.1,genreIds:[28,878],platforms:['Netflix','Prime','Cinema'],moods:['excited','energized'],age:'modern',overview:'A relentless desert chase turns survival into explosive visual cinema.',genre:'Action · Sci-fi'},
  {title:'My Neighbor Totoro',year:'1988',runtime:86,rating:8.1,genreIds:[16,10751],platforms:['netflix','library'],moods:['relaxed','happy','nostalgic'],age:'old',overview:'Two sisters discover gentle forest spirits while adapting to a new home.',genre:'Animation · Family'},
  {title:'Lost in Translation',year:'2003',runtime:102,rating:7.7,genreIds:[18,10749],platforms:['Amazon Prime','My own watchlist'],moods:['lonely','moved','relaxed'],age:'modern',overview:'Two strangers in Tokyo form a quiet connection during a moment of uncertainty.',genre:'Drama · Romance'},
  {title:'Spider-Man: Into the Spider-Verse',year:'2018',runtime:117,rating:8.4,genreIds:[16,28,12],platforms:['Netflix','Prime Video','My own watchlist'],moods:['happy','energized','inspired'],age:'new',overview:'Miles Morales discovers courage and identity across a visually explosive multiverse.',genre:'Animation · Action'},
  {title:'Cinema Paradiso',year:'1988',runtime:124,rating:8.5,genreIds:[18],platforms:['library'],moods:['nostalgic','moved','romantic'],age:'old',overview:'A filmmaker remembers the theater, mentor, and childhood that shaped his love of cinema.',genre:'Drama'}
].map(movie=>({...movie,release_date:`${movie.year}-01-01`,poster:posterFallback(movie.title),trailerQuery:`${movie.title} official trailer`}));

const defaultAssistantMemory=()=>({ratings:{},saved:[],watched:[]});
const getAssistantMemory=()=>{
  try{return JSON.parse(localStorage.getItem(assistantStorageKey)||'{"ratings":{},"saved":[],"watched":[]}');}
  catch{return defaultAssistantMemory();}
};
const setAssistantMemory=memory=>{
  try{localStorage.setItem(assistantStorageKey,JSON.stringify(memory));}catch{}
  updateAssistantMemory();
};
const updateAssistantMemory=()=>{
  if(!assistantMemory)return;
  const memory=getAssistantMemory();
  const ratings=Object.entries(memory.ratings||{}).filter(([,score])=>Number(score)>0).sort((a,b)=>b[1]-a[1]);
  const saved=(memory.saved||[]).length; const watched=(memory.watched||[]).length;
  if(!ratings.length&&!saved&&!watched){assistantMemory.textContent='Rate or save films and this assistant will start explaining recommendations based on your previous choices.';return;}
  const favorite=ratings[0]?.[0];
  assistantMemory.textContent=`Memory active: ${ratings.length} rated, ${saved} saved, ${watched} watched${favorite?`. You rated “${favorite}” highly, so similar choices get a small boost.`:'.'}`;
};
const assistantValues=form=>Object.fromEntries(new FormData(form).entries());
const movieMatchesPlatform=(movie,platform)=>{
  const selected=normalizePlatform(platform);
  if(!selected)return true;
  return platformValues(movie).some(value=>{
    const normalized=normalizePlatform(value);
    return normalized&&(
      normalized.includes(selected)||
      selected.includes(normalized)
    );
  });
};
const movieMatchesAge=(movie,age)=>{
  const year=Number(movie.year||(movie.release_date||'').slice(0,4)||0);
  if(age==='new')return year>=2018;
  if(age==='modern')return year>=2000&&year<2018;
  if(age==='old')return year>0&&year<2000;
  return true;
};
const movieMatchesTime=(movie,time)=>{
  const runtime=Number(movie.runtime||0);
  if(!runtime||time==='any')return true;
  if(time==='short')return runtime<=100;
  if(time==='medium')return runtime>95&&runtime<=140;
  if(time==='long')return runtime>140;
  return true;
};
const scoreAssistantMovie=(movie,answers,memory)=>{
  let score=Number(movie.rating||movie.vote_average||0);
  const genreIds=movie.genreIds||movie.genre_ids||[];
  if(answers.genre==='any'||genreIds.includes(Number(answers.genre)))score+=3;
  if(movieMatchesTime(movie,answers.time))score+=1.4;
  if(movieMatchesAge(movie,answers.age))score+=1.2;
  if(movieMatchesPlatform(movie,answers.platform))score+=2;
  if((movie.moods||[]).includes(answers.currentMood))score+=.8;
  if((movie.moods||[]).includes(answers.targetMood))score+=2.2;
  const ratingBoost=Number(memory.ratings?.[movie.title]||0);
  if(ratingBoost>=4)score+=1.8;
  if((memory.saved||[]).includes(movie.title))score+=.5;
  if((memory.watched||[]).includes(movie.title))score-=2;
  return score;
};
const assistantExplanation=(answers,movies)=>{
  const genreLabel=answers.genre==='any'?'a surprise genre':(genreNames[answers.genre]||'your selected genre');
  const titles=movies.map(movie=>movie.title).join(', ');
  const memory=getAssistantMemory();
  const topRated=Object.entries(memory.ratings||{}).filter(([,score])=>Number(score)>=4).map(([title])=>title)[0];
  return `You have ${answers.time==='any'?'flexible time':answers.time.replace('medium','100–140 minutes').replace('short','under 100 minutes').replace('long','more than 140 minutes')}, you want to feel ${answers.targetMood}, and you chose ${genreLabel}. ${topRated?`Because you rated “${topRated}” highly, similar films receive extra weight. `:''}Best choices: ${titles}.`;
};
const closestAssistantExplanation=(answers,movies)=>{
  const titles=movies.map(movie=>movie.title).join(', ');
  return `Closest matches for your mood: ${titles}. Some filters were relaxed so the wall always stays useful.`;
};
const fetchAssistantMovies=async answers=>{
  if(!token)throw new Error('TMDB token not configured');
  const params={include_adult:'false',sort_by:'vote_average.desc','vote_count.gte':'700',page:'1'};
  if(answers.genre!=='any')params.with_genres=answers.genre;
  if(answers.time==='short')params['with_runtime.lte']='100';
  if(answers.time==='medium'){params['with_runtime.gte']='95';params['with_runtime.lte']='140';}
  if(answers.time==='long')params['with_runtime.gte']='140';
  if(answers.age==='new')params['primary_release_date.gte']='2018-01-01';
  if(answers.age==='modern'){params['primary_release_date.gte']='2000-01-01';params['primary_release_date.lte']='2017-12-31';}
  if(answers.age==='old')params['primary_release_date.lte']='1999-12-31';
  const provider=providerMap[normalizePlatform(answers.platform)];
  if(provider){params.watch_region='DE';params.with_watch_providers=provider;}
  const data=await tmdb('/discover/movie',params);
  return data.results.map(movie=>{
    const normalized=normalizeMovie(movie);
    if(provider)normalized.platforms=[answers.platform];
    return normalized;
  });
};
const openMovieDetails=movie=>{
  const normalized=normalizeMovie(movie);
  const content=trailerDialog.querySelector('[data-trailer-content]');
  const message=trailerDialog.querySelector('[data-trailer-message]');
  content.replaceChildren();
  const detail=document.createElement('article');
  detail.className='movie-detail-card';
  const title=document.createElement('h3'); title.textContent=normalized.title;
  const meta=document.createElement('p'); meta.className='movie-detail-meta'; meta.textContent=`${normalized.year} · ${normalized.genre||'Film'} · ${normalized.rating==='0.0'?'Not rated':`★ ${normalized.rating}`}`;
  const overview=document.createElement('p'); overview.textContent=normalized.overview;
  const actions=document.createElement('div'); actions.className='assistant-actions detail-actions';
  const save=document.createElement('button'); save.type='button'; save.textContent='Save';
  const watched=document.createElement('button'); watched.type='button'; watched.textContent='Watched';
  const trailer=document.createElement('button'); trailer.type='button'; trailer.textContent='Trailer';
  const sync=()=>{const memory=getAssistantMemory();save.classList.toggle('is-active',(memory.saved||[]).includes(normalized.title));watched.classList.toggle('is-active',(memory.watched||[]).includes(normalized.title));};
  save.addEventListener('click',()=>{const next=getAssistantMemory();const set=new Set(next.saved||[]);set.has(normalized.title)?set.delete(normalized.title):set.add(normalized.title);next.saved=[...set];setAssistantMemory(next);sync();});
  watched.addEventListener('click',()=>{const next=getAssistantMemory();const set=new Set(next.watched||[]);set.has(normalized.title)?set.delete(normalized.title):set.add(normalized.title);next.watched=[...set];setAssistantMemory(next);sync();});
  trailer.addEventListener('click',()=>openTrailer(normalized));
  actions.append(save,watched,trailer); detail.append(title,meta,overview,actions); content.append(detail); message.textContent=''; sync(); trailerDialog.showModal();
};
const createAssistantCard=rawMovie=>{
  const movie=normalizeMovie(rawMovie);
  const poster=document.createElement('button'); poster.type='button'; poster.className='wall-poster'; poster.setAttribute('aria-label',`View details for ${movie.title}`);
  const image=document.createElement('img'); image.src=movie.poster; image.alt=`Poster for ${movie.title}`; image.loading='lazy'; image.addEventListener('error',()=>{image.src=posterFallback(movie.title)},{once:true});
  const overlay=document.createElement('span'); overlay.className='wall-poster-overlay'; overlay.innerHTML=`<strong>${movie.title}</strong><small>View Details</small>`;
  poster.append(image,overlay); poster.addEventListener('click',()=>openMovieDetails(movie));
  return poster;
};
let assistantRenderRequest=0;
const renderAssistantRecommendations=async ({scroll=false}={})=>{
  if(!assistantPanel||!assistantResults||!assistantReason)return;
  const requestId=++assistantRenderRequest;
  const answers=assistantValues(assistantForm); const memory=getAssistantMemory();
  const selectedPlatform=normalizePlatform(answers.platform);
  assistantPanel.hidden=false; assistantPanel.classList.add('is-visible');
  assistantReason.textContent='Calculating the strongest three choices…'; assistantResults.replaceChildren();
  try{
    let candidates;
    try{candidates=await fetchAssistantMovies(answers);}catch{candidates=assistantFallback;}
    if(requestId!==assistantRenderRequest)return;
    if(!candidates.length)candidates=assistantFallback;
    if(candidates.length<5){
      const seen=new Set(candidates.map(movie=>normalizeMovie(movie).title));
      candidates=[...candidates,...assistantFallback.filter(movie=>!seen.has(movie.title))];
    }
    console.log('Selected platform:', answers.platform, 'Normalized:', selectedPlatform);
    console.log('Movies with Prime:', candidates.filter(movie=>platformValues(movie).some(platform=>normalizePlatform(platform).includes('prime'))));
    const filtered=candidates.filter(movie=>{
      const normalized=normalizeMovie(movie);
      return (answers.genre==='any'||(normalized.genreIds||[]).includes(Number(answers.genre)))&&movieMatchesTime(movie,answers.time)&&movieMatchesAge(normalized,answers.age)&&movieMatchesPlatform(movie,answers.platform);
    });
    const exactTitles=new Set(filtered.map(movie=>normalizeMovie(movie).title));
    const exactRanked=filtered.map(movie=>({movie,score:scoreAssistantMovie(movie,answers,memory)})).sort((a,b)=>b.score-a.score).map(item=>item.movie);
    const closeRanked=candidates.filter(movie=>!exactTitles.has(normalizeMovie(movie).title)).map(movie=>({movie,score:scoreAssistantMovie(movie,answers,memory)})).sort((a,b)=>b.score-a.score).map(item=>item.movie);
    const pool=[...exactRanked,...closeRanked].slice(0,5);
    console.log('Filtered results:', pool);
    const exactEnough=exactRanked.length>=5;
    assistantResults.append(...pool.map(createAssistantCard));
    assistantReason.textContent=exactEnough?assistantExplanation(answers,pool.map(normalizeMovie)):closestAssistantExplanation(answers,pool.map(normalizeMovie));
  }catch(error){
    if(requestId!==assistantRenderRequest)return;
    const pool=assistantFallback.slice(0,5);
    assistantResults.append(...pool.map(createAssistantCard));
    assistantReason.textContent=closestAssistantExplanation(answers,pool.map(normalizeMovie));
  }
  if(scroll)assistantPanel.scrollIntoView({behavior:'smooth',block:'start'});
};
assistantForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  renderAssistantRecommendations({scroll:true});
});
assistantForm?.querySelectorAll('select,input').forEach(input=>input.addEventListener('change',()=>renderAssistantRecommendations()));
if(assistantForm)renderAssistantRecommendations();
document.querySelector('[data-clear-decision-memory]')?.addEventListener('click',()=>{try{localStorage.removeItem(assistantStorageKey);}catch{}updateAssistantMemory();});
updateAssistantMemory();

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
