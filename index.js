// index.js
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fetch                        = require('node-fetch');
const cloudscraper                 = require('cloudscraper');
const manifest                     = require('./manifest.json');
const builder                      = new addonBuilder(manifest);
const stringSimilarity = require('string-similarity');
const cheerio = require('cheerio');

const SOURCES = { kisskh: 'https://kisskh.co' };

// …the rest of your handlers (catalog, meta, stream) unchanged…

// helper with retries and default headers
async function fetchWithHeaders(url, retries = 2) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept':     'application/json, text/plain, */*'
  };
  try {
    return await fetch(url, { headers, timeout: 10000 });
  } catch (err) {
    if (retries > 0) return fetchWithHeaders(url, retries - 1);
    throw err;
  }
}

// Cloudflare-aware fetch for KissKH
async function fetchJSON(url, retries = 2) {
  try {
    const response = await cloudscraper.get({
      uri: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://kisskh.co/'
      },
      gzip: true
    });
    return JSON.parse(response);
  } catch (err) {
    console.warn('cloudscraper failed, falling back to regular fetch:', err.message);
    if (retries > 0) return fetchJSON(url, retries - 1);
    throw err;
  }
}

const MDL_API_KEY = 'YOUR_MDL_API_KEY'; // <-- Insert your MyDramaList API key here

// Manual mapping for problematic/popular drama titles to IMDb IDs
const manualImdbMap = {
  'Hidden Love (2023)': 'tt28076458', // Use the correct OMDb IMDb ID
  'Forever Love (2023)': 'tt13598988', // Chinese drama IMDb ID
  'Good Boy (2025)': 'tt32361930', // TODO: Replace with correct IMDb ID
  'Moving (2023)': 'tt24640580', // Korean drama IMDb ID
  // Add more mappings as needed
};
// Reverse mapping from IMDb ID to KissKH title
const imdbToKissKH = {
  'tt28076458': 'Hidden Love (2023)', // Use the correct OMDb IMDb ID
  'tt13598988': 'Forever Love (2023)', // Chinese drama IMDb ID
  'tt32361930': 'Good Boy (2025)', // TODO: Replace with correct IMDb ID
  'tt24640580': 'Moving (2023)', // Korean drama IMDb ID
  // Add more mappings as needed
};

// Helper to robustly find IMDb ID from manual map, TMDb, OMDb, and MyDramaList
async function findImdbId(title, year) {
  // 0. Try manual mapping first
  if (manualImdbMap[title]) return manualImdbMap[title];

  // 1. Improved TMDb search with alternate titles
  try {
    let tmdbUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&first_air_date_year=${year}` : ''}`;
    let tmdbRes = await fetch(tmdbUrl);
    let tmdbData = await tmdbRes.json();
    if (tmdbData && tmdbData.results && tmdbData.results.length) {
      for (const show of tmdbData.results) {
        // Fetch external IDs for each result
        let extUrl = `https://api.themoviedb.org/3/tv/${show.id}/external_ids?api_key=${TMDB_API_KEY}`;
        let extRes = await fetch(extUrl);
        let extData = await extRes.json();
        // Check all possible title fields for a match
        const allTitles = [
          show.name,
          show.original_name,
          ...(show.origin_country || []),
          ...(show.also_known_as || [])
        ].map(t => t && t.toLowerCase().trim()).filter(Boolean);
        if (allTitles.includes(title.toLowerCase().trim()) && extData && extData.imdb_id && extData.imdb_id.startsWith('tt')) {
          return extData.imdb_id;
        }
      }
    }
  } catch (err) {
    console.error('Improved TMDb lookup failed:', err);
  }

  // 2. Fuzzy TMDb search (fallback)
  try {
    let tmdbUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    let tmdbRes = await fetch(tmdbUrl);
    let tmdbData = await tmdbRes.json();
    if (tmdbData && tmdbData.results && tmdbData.results.length) {
      // Use string similarity to pick the best match
      const titles = tmdbData.results.map(r => r.name);
      const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(title, titles);
      if (bestMatch.rating > 0.6) { // You can adjust the threshold
        const show = tmdbData.results[bestMatchIndex];
        // Now get external IDs
        let extUrl = `https://api.themoviedb.org/3/tv/${show.id}/external_ids?api_key=${TMDB_API_KEY}`;
        let extRes = await fetch(extUrl);
        let extData = await extRes.json();
        if (extData && extData.imdb_id && extData.imdb_id.startsWith('tt')) {
          return extData.imdb_id;
        }
      }
    }
  } catch (err) {
    console.error('TMDb fuzzy lookup failed:', err);
  }

  // 2. Fallback to OMDb (existing logic)
  // Try with year
  let url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}${year ? `&y=${year}` : ''}&type=series&apikey=${OMDB_API_KEY}`;
  let res = await fetch(url);
  let data = await res.json();
  if (data && data.imdbID && data.imdbID.startsWith('tt')) return data.imdbID;

  // Try without year
  url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&type=series&apikey=${OMDB_API_KEY}`;
  res = await fetch(url);
  data = await res.json();
  if (data && data.imdbID && data.imdbID.startsWith('tt')) return data.imdbID;

  // Try removing year in parentheses from title
  const titleNoYear = title.replace(/\(.*\)/, '').trim();
  if (titleNoYear !== title) {
    url = `http://www.omdbapi.com/?t=${encodeURIComponent(titleNoYear)}&type=series&apikey=${OMDB_API_KEY}`;
    res = await fetch(url);
    data = await res.json();
    if (data && data.imdbID && data.imdbID.startsWith('tt')) return data.imdbID;
  }

  // 3. Fallback to MyDramaList for alt_titles/original_title
  if (MDL_API_KEY && MDL_API_KEY !== 'YOUR_MDL_API_KEY') {
    try {
      // Search MDL
      const searchRes = await fetch('https://api.mydramalist.com/v1/search/titles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mdl-api-key': MDL_API_KEY
        },
        body: JSON.stringify({ q: title })
      });
      const searchData = await searchRes.json();
      if (searchData && searchData.data && searchData.data.length) {
        const mdlId = searchData.data[0].id;
        // Get title details
        const detailRes = await fetch(`https://api.mydramalist.com/v1/titles/${mdlId}`, {
          headers: {
            'Content-Type': 'application/json',
            'mdl-api-key': MDL_API_KEY
          }
        });
        const detailData = await detailRes.json();
        // Try alt_titles
        if (detailData && detailData.alt_titles && detailData.alt_titles.length) {
          for (const alt of detailData.alt_titles) {
            // Try TMDb/OMDb with alt_title
            const imdbId = await findImdbId(alt, year);
            if (imdbId) return imdbId;
          }
        }
        // Try original_title
        if (detailData && detailData.original_title) {
          const imdbId = await findImdbId(detailData.original_title, year);
          if (imdbId) return imdbId;
        }
      }
    } catch (err) {
      console.error('MDL lookup failed:', err);
    }
  }

  return undefined;
}

async function crossReferenceImdbId(allTitles, year) {
  for (const title of allTitles) {
    // Try manual mapping first
    if (manualImdbMap[title]) return manualImdbMap[title];
    // Try TMDb improved search
    const imdbId = await findImdbId(title, year);
    if (imdbId) return imdbId;
  }
  return undefined;
}

// TMDb genre ID to name mapping
const TMDB_GENRE_MAP = {
  10759: 'Action',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
  10749: 'Romance',
  36: 'Historical',
  53: 'Thriller',
  14: 'Fantasy',
  27: 'Horror',
  10402: 'Music',
  28: 'Action',
  12: 'Adventure',
  10770: 'TV Movie',
  878: 'Sci-Fi',
  10752: 'War',
  10768: 'War & Politics',
  10769: 'Foreign',
  10753: 'Crime',
  10755: 'Medical',
  10756: 'Supernatural',
  10757: 'Sports',
  10758: 'Business',
  10760: 'Political'
};

// 1) KissKH JSON API scraper
async function scrapeKissKH_API(categoryId, searchTerm, page = 1, pageSize = 10, genre) {
  try {
    const country = categoryId === 'kdrama' ? 2 : 1;
    const url = `${SOURCES.kisskh}/api/DramaList/List`
              + `?page=${page}&pageSize=${pageSize}`
              + `&type=1&sub=0&country=${country}&status=0&order=1`;
    console.log('🔍 KissKH JSON fetch:', url);
    let json;
    try {
      json = await fetchJSON(url);
    } catch (err) {
      console.warn('KissKH returned invalid JSON (likely blocked or HTML error), skipping...');
      return [];
    }
    const list = Array.isArray(json.data) ? json.data : [];

    console.log('All catalog titles and mapped IMDb IDs:');
    list.forEach(item => {
      console.log('[' + item.title + ']', '->', manualImdbMap[item.title]);
    });

    // For each item, look up IMDb ID via OMDb/TMDb and get genres from TMDb and OMDb if possible
    // In scrapeKissKH_API, always use manualImdbMap for id if available
    const metas = await Promise.all(list
      .filter(item =>
        !searchTerm ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map(async item => {
        // Aggregate all possible titles
        let allTitles = [item.title];
        // Optionally, add alternate names from other sources if available
        // e.g., allTitles.push(...item.alternateNames)
        let imdbId = await crossReferenceImdbId(allTitles, item.releaseDate ? item.releaseDate.slice(0, 4) : undefined);
        if (!imdbId) return null; // Only include items with IMDb ID
        console.log('Processing:', item.title, 'IMDb:', imdbId); // Debug log
        // Try to get genres from TMDb if we have an IMDb ID
        let genreNames = [];
        let omdbGenres = [];
        try {
          const tmdbFindUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
          const tmdbFindRes = await fetch(tmdbFindUrl);
          const tmdbFindData = await tmdbFindRes.json();
          if (tmdbFindData && tmdbFindData.tv_results && tmdbFindData.tv_results.length) {
            genreNames = (tmdbFindData.tv_results[0].genre_ids || [])
              .map(id => TMDB_GENRE_MAP[id])
              .filter(Boolean);
          }
          // Fetch genres from OMDb
          const omdbUrl = `http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`;
          const omdbRes = await fetch(omdbUrl);
          const omdbData = await omdbRes.json();
          if (omdbData && omdbData.Genre) {
            omdbGenres = omdbData.Genre.split(',').map(g => g.trim());
          }
        } catch (err) {
          console.error('TMDb/OMDb/genre lookup failed:', err);
          return null;
        }
        // Merge TMDb and OMDb genres
        const allGenres = Array.from(new Set([...genreNames, ...omdbGenres]));
        return {
          id: imdbId, // always use IMDb ID for Stremio
          kisskhId: item.id, // store the original KissKH numeric ID
          name: item.title,
          poster: item.thumbnail,
          type: 'series',
          genres: allGenres // merged TMDb + OMDb genres
        };
      })
    );
    // Remove nulls (items without IMDb ID)
    const filteredMetas = metas.filter(Boolean);
    // Filter by genre if provided (by name)
    console.log('Catalog metas:', filteredMetas.map(m => m.name)); // Debug log
    return genre ? filteredMetas.filter(meta => meta.genres && meta.genres.includes(genre)) : filteredMetas;
  } catch (err) {
    console.error('❌ scrapeKissKH_API error:', err);
    return [];
  }
}

// 2) Stub fallbacks
async function scrapeFromDramacool(category, search) { return []; }
async function scrapeFromAsiaflix(category, search, page = 1, pageSize = 10, genre) {
  try {
    const url = `https://asiaflix.net/drama-list?page=${page}`;
    const res = await fetchWithHeaders(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    const dramas = [];
    $('.film-poster').each((i, el) => {
      const name = $(el).attr('data-name')?.trim();
      const poster = $(el).find('img').attr('data-src');
      const link = $(el).attr('href');
      if (name && (!search || name.toLowerCase().includes(search.toLowerCase()))) {
        dramas.push({
          id: link, // Use the Asiaflix link as a unique ID for now
          name,
          poster,
          type: 'series'
        });
      }
    });
    return dramas.slice(0, pageSize);
  } catch (err) {
    console.error('❌ scrapeFromAsiaflix error:', err);
    return [];
  }
}
async function scrapeFromOneTouch(search)     { return []; }

async function scrapeFromDramacoolMeta(dramaUrl) {
  try {
    const res = await fetchWithHeaders(`https://dramacoolt.lv${dramaUrl}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const name = $('.info h1').text().trim();
    const poster = $('.info .img img').attr('src');
    const description = $('.info .desc').text().trim();
    // Parse episodes
    const episodes = [];
    $('.episode_list li').each((i, el) => {
      const epNum = parseInt($(el).find('.num').text().replace(/[^0-9]/g, ''));
      const epTitle = $(el).find('a').attr('title') || `Episode ${epNum}`;
      if (Number.isInteger(epNum)) {
        episodes.push({
          id: `dramacool:${dramaUrl}:1:${epNum}`,
          season: 1,
          number: epNum,
          title: epTitle,
          thumbnail: ''
        });
      }
    });
    return {
      id: dramaUrl,
      name,
      poster,
      description,
      type: 'series',
      episodes
    };
  } catch (err) {
    console.error('❌ scrapeFromDramacoolMeta error:', err);
    return null;
  }
}

async function scrapeFromAsiaflixMeta(dramaUrl) {
  try {
    const res = await fetchWithHeaders(`https://asiaflix.net${dramaUrl}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const name = $('.film-title').text().trim();
    const poster = $('.film-poster img').attr('src');
    const description = $('.description').text().trim();
    const episodes = [];
    $('.episodes-list a').each((i, el) => {
      const epNum = parseInt($(el).text().replace(/[^0-9]/g, ''));
      const epTitle = $(el).attr('title') || `Episode ${epNum}`;
      if (Number.isInteger(epNum)) {
        episodes.push({
          id: `asiaflix:${dramaUrl}:1:${epNum}`,
          season: 1,
          number: epNum,
          title: epTitle,
          thumbnail: ''
        });
      }
    });
    return {
      id: dramaUrl,
      name,
      poster,
      description,
      type: 'series',
      episodes
    };
  } catch (err) {
    console.error('❌ scrapeFromAsiaflixMeta error:', err);
    return null;
  }
}

const OMDB_API_KEY = 'e70e02e';
const TMDB_API_KEY = '2553973ce2cb1e0012700c51af701f43';

async function isCorrectShow(dramacoolTitle, expectedImdbId) {
  const tmdbFindUrl = `https://api.themoviedb.org/3/find/${expectedImdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
  const tmdbFindRes = await fetch(tmdbFindUrl);
  const tmdbFindData = await tmdbFindRes.json();
  let tmdbTitles = [];
  let tmdbYear = '';
  let tmdbCountry = '';
  if (tmdbFindData && tmdbFindData.tv_results && tmdbFindData.tv_results.length) {
    const show = tmdbFindData.tv_results[0];
    tmdbTitles = [
      show.name,
      show.original_name,
      ...(show.also_known_as || [])
    ].map(t => t && t.toLowerCase().replace(/[^a-z0-9]/gi, '').trim()).filter(Boolean);
    tmdbYear = (show.first_air_date || '').slice(0, 4);
    tmdbCountry = (show.origin_country || [])[0] || '';
  }
  const normalizedDramacoolTitle = dramacoolTitle.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
  const candidates = tmdbTitles
    .map(t => ({ t, score: stringSimilarity.compareTwoStrings(normalizedDramacoolTitle, t) }))
    .sort((a, b) => b.score - a.score);
  const bestMatch = candidates[0];
  const similarity = bestMatch ? bestMatch.score : 0;
  console.log('Dramacool title:', dramacoolTitle, '| TMDb titles:', tmdbTitles, '| Candidates:', candidates, '| Best similarity:', similarity, '| Year:', tmdbYear, '| Country:', tmdbCountry);
  // Optionally, check year/country if you can extract them from Dramacool
  return similarity > 0.8;
}

// ─── Catalog handler ─────────────────────────────────────────────────────
builder.defineCatalogHandler(async ({ id, search = '', extra = {} }) => {
  const skip  = Number(extra.skip)  || 0;
  const limit = Number(extra.limit) || 50; // Increased default limit to 50
  const page  = Math.floor(skip / limit) + 1;
  const genre = extra.genre; // <-- get genre filter

  let metas = await scrapeKissKH_API(id, search, page, limit, genre);
  if (!metas.length) metas = await scrapeFromDramacool(id, search, page, limit, genre);
  if (!metas.length) metas = await scrapeFromAsiaflix(id, search, page, limit, genre);
  if (!metas.length) metas = await scrapeFromOneTouch(search);

  console.log('Catalog metas:', metas.map(m => m.name)); // Debug log
  return { metas };
});

// ─── Meta handler ───────────────────────────────────────────────────────
builder.defineMetaHandler(async ({ id }) => {
  let dramaId = id;
  let showTitle = null;
  let imdbId;

  // If id is an IMDb ID, use mapping to get the KissKH title
  if (id.startsWith('tt')) {
    imdbId = id;
    showTitle = imdbToKissKH[id];
    console.log('Meta handler mapping:', imdbId, '->', showTitle); // Debug log
    if (!showTitle) return { meta: null };
    // Search KissKH for this title
    let searchResults = await scrapeKissKH_API('cdrama', showTitle, 1, 10);
    if (!searchResults.length) {
      searchResults = await scrapeKissKH_API('kdrama', showTitle, 1, 10);
    }
    console.log('Search results for', showTitle, ':', searchResults); // Debug log
    // Find the best match (exact or closest)
    const bestMatch = searchResults.find(item => item.id === imdbId) || searchResults[0];
    if (bestMatch) {
      dramaId = bestMatch.kisskhId;
      console.log('Using dramaId:', dramaId); // Debug log
    } else {
      // Fallback: try Dramacool meta scraping if KissKH fails
      let dramacoolResults = await scrapeFromDramacool('cdrama', showTitle, 1, 10);
      for (const dcMatch of dramacoolResults) {
        if (await isCorrectShow(dcMatch.name, imdbId)) {
          const meta = await scrapeFromDramacoolMeta(dcMatch.id);
          if (meta) {
            // Map to Stremio meta object
            return {
              meta: {
                id: imdbId,
                name: meta.name,
                poster: meta.poster,
                description: meta.description,
                type: 'series',
                imdb_id: imdbId,
                episodes: meta.episodes
              }
            };
          }
        }
      }
      // Fallback: try Asiaflix meta scraping if Dramacool fails
      let asiaflixResults = await scrapeFromAsiaflix('cdrama', showTitle, 1, 10);
      for (const afMatch of asiaflixResults) {
        if (await isCorrectShow(afMatch.name, imdbId)) {
          const meta = await scrapeFromAsiaflixMeta(afMatch.id);
          if (meta) {
            return {
              meta: {
                id: imdbId,
                name: meta.name,
                poster: meta.poster,
                description: meta.description,
                type: 'series',
                imdb_id: imdbId,
                episodes: meta.episodes
              }
            };
          }
        }
      }
      return { meta: null };
    }
  } else {
    dramaId = id.split('/').pop();
  }

  // Now fetch the meta/episodes as before using dramaId
  console.log('META →', id);
  if (!dramaId) return { meta: null };

  // Fetch show/episode data directly
  const detailUrl = `${SOURCES.kisskh}/api/DramaList/Drama/${dramaId}?isq=false`;
  let detailJson;
  try {
    detailJson = await fetchJSON(detailUrl);
    if (!detailJson || !detailJson.title) throw new Error('No detail data');
  } catch (err) {
    console.error('⚠️ Detail JSON fetch/parse failed:', err);
    return { meta: null };
  }

  // Try to look up IMDb ID using robust function if not already set
  if (!imdbId) {
    imdbId = await findImdbId(detailJson.title, detailJson.releaseDate ? detailJson.releaseDate.slice(0, 4) : undefined);
  }

  // Build meta + episodes as before, but include imdb_id if found
  let omdbSummary = '';
  try {
    if (imdbId) {
      const omdbUrl = `http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`;
      const omdbRes = await fetch(omdbUrl);
      const omdbData = await omdbRes.json();
      if (omdbData && omdbData.Plot && omdbData.Plot !== 'N/A') {
        omdbSummary = omdbData.Plot;
      }
    }
  } catch (err) {
    // fallback to KissKH summary
  }
  const meta = {
    id: imdbId, // always use IMDb ID for Stremio
    name:        detailJson.title || 'Unknown',
    poster:      detailJson.thumbnail || '',
    description: omdbSummary || detailJson.description || '',
    releaseDate: detailJson.releaseDate || '',
    type:        'series',
    country:     detailJson.country || '',
    status:      detailJson.status || '',
    imdb_id:     imdbId,
    genres: detailJson.genres || [],
    episodes: Array.isArray(detailJson.episodes)
      ? detailJson.episodes
          .filter(ep => Number.isInteger(ep.number)) // Only keep integer episodes
          .map(ep => ({
            id: imdbId ? `${imdbId}:1:${ep.number}` : undefined,
            season: 1,
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`,
            thumbnail: ep.thumbnail || ''
          }))
      : []
  };
  console.log('Meta object:', meta); // Debug log
  return { meta };
});

// ─── Stream handler ───────────────────────────────────────────────────────
builder.defineStreamHandler(async ({ id, extra }) => {
  // No streams from this addon; let Stremio show streams from other addons (e.g., Torrentio)
  return { streams: [] };
});

// ─── Start HTTP server ────────────────────────────────────────────────────
serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 3000
})
.then(() => console.log('Addon running at http://127.0.0.1:3000/manifest.json'));
