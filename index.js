// index.js
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fetch                        = require('node-fetch');
const cloudscraper                 = require('cloudscraper');
const tunnel                       = require('tunnel');
const axios                        = require('axios');
const { ProxyAgent }               = require('proxy-agent');
const manifest                     = require('./manifest.json');
const builder                      = new addonBuilder(manifest);
const stringSimilarity = require('string-similarity');
const cheerio = require('cheerio');

const SOURCES = { kisskh: 'https://kisskh.co' };

// Enhanced proxy list with v2rayN support
const PROXY_LIST = [
  // Free proxies (fallback)
  'http://103.149.162.194:80',
  'http://103.149.162.195:80',
  'http://103.149.162.196:80',
  'http://103.149.162.197:80',
  'http://103.149.162.198:80',
  
  // v2rayN proxy examples (replace with your actual proxy)
  // 'http://127.0.0.1:10809',  // HTTP proxy
  // 'socks5://127.0.0.1:10808', // SOCKS5 proxy
  // 'http://127.0.0.1:7890',   // HTTP proxy (alternative port)
  // 'socks5://127.0.0.1:7891'  // SOCKS5 proxy (alternative port)
];

// v2rayN proxy configuration
const V2RAYN_CONFIG = {
  enabled: false, // Set to true if you have v2rayN running
  httpProxy: 'http://127.0.0.1:10809',
  socks5Proxy: 'socks5://127.0.0.1:10808',
  timeout: 10000
};

// Create proxy agents for different protocols
function createProxyAgent(proxyUrl) {
  try {
    if (proxyUrl.startsWith('socks5://')) {
      return new ProxyAgent(proxyUrl);
    } else if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
      return new ProxyAgent(proxyUrl);
    }
  } catch (err) {
    console.warn('Failed to create proxy agent:', err.message);
  }
  return null;
}

// Get available proxies including v2rayN
function getAvailableProxies() {
  const proxies = [...PROXY_LIST];
  
  // Add v2rayN proxies if enabled
  if (V2RAYN_CONFIG.enabled) {
    proxies.push(V2RAYN_CONFIG.httpProxy, V2RAYN_CONFIG.socks5Proxy);
  }
  
  return proxies.filter(Boolean);
}

// Session management for maintaining cookies
let sessionCookies = null;
let lastSessionTime = 0;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Initialize session with KissKH
async function initializeSession() {
  try {
    console.log('🔐 Initializing session with KissKH...');
    const response = await cloudscraper.get({
      uri: 'https://kisskh.co/',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      gzip: true,
      followRedirect: true,
      followAllRedirects: true,
      timeout: 15000
    });
    
    // Extract cookies from response
    if (response && response.headers && response.headers['set-cookie']) {
      sessionCookies = response.headers['set-cookie'];
      lastSessionTime = Date.now();
      console.log('✅ Session initialized successfully');
      return true;
    }
  } catch (err) {
    console.warn('❌ Session initialization failed:', err.message);
  }
  return false;
}

// Check if session is still valid
function isSessionValid() {
  return sessionCookies && (Date.now() - lastSessionTime) < SESSION_TIMEOUT;
}

// Enhanced alternative data sources
async function fetchAlternativeData() {
  console.log('📡 Fetching alternative data sources...');
  
  // Try to scrape from alternative sites first
  try {
    const alternativeData = await scrapeAlternativeSites();
    if (alternativeData && alternativeData.length > 0) {
      console.log(`✅ Found ${alternativeData.length} items from alternative sites`);
      return {
        data: alternativeData,
        total: alternativeData.length,
        message: "Using alternative scraping sources"
      };
    }
  } catch (err) {
    console.warn('Alternative sites failed:', err.message);
  }
  
  // Enhanced mock data for popular Asian dramas
  const mockDramas = [
    {
      id: 1,
      name: "Goblin (Guardian: The Lonely and Great God)",
      nameEn: "Goblin",
      year: 2016,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/FF6B6B/FFFFFF?text=Goblin",
      rating: 8.8,
      episodes: 16
    },
    {
      id: 2,
      name: "Descendants of the Sun",
      nameEn: "Descendants of the Sun",
      year: 2016,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/4ECDC4/FFFFFF?text=Descendants+of+the+Sun",
      rating: 8.2,
      episodes: 16
    },
    {
      id: 3,
      name: "The Untamed",
      nameEn: "The Untamed",
      year: 2019,
      country: "China",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/45B7D1/FFFFFF?text=The+Untamed",
      rating: 8.9,
      episodes: 50
    },
    {
      id: 4,
      name: "Itaewon Class",
      nameEn: "Itaewon Class",
      year: 2020,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/96CEB4/FFFFFF?text=Itaewon+Class",
      rating: 8.2,
      episodes: 16
    },
    {
      id: 5,
      name: "The King: Eternal Monarch",
      nameEn: "The King: Eternal Monarch",
      year: 2020,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/FFEAA7/000000?text=The+King",
      rating: 8.1,
      episodes: 16
    },
    {
      id: 6,
      name: "Love Alarm",
      nameEn: "Love Alarm",
      year: 2019,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/DDA0DD/FFFFFF?text=Love+Alarm",
      rating: 7.8,
      episodes: 8
    },
    {
      id: 7,
      name: "The Heirs",
      nameEn: "The Heirs",
      year: 2013,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/98D8C8/FFFFFF?text=The+Heirs",
      rating: 8.0,
      episodes: 20
    },
    {
      id: 8,
      name: "Boys Over Flowers",
      nameEn: "Boys Over Flowers",
      year: 2009,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/F7DC6F/000000?text=Boys+Over+Flowers",
      rating: 7.8,
      episodes: 25
    },
    {
      id: 9,
      name: "My Love from the Star",
      nameEn: "My Love from the Star",
      year: 2013,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/BB8FCE/FFFFFF?text=My+Love+from+the+Star",
      rating: 8.3,
      episodes: 21
    },
    {
      id: 10,
      name: "Crash Landing on You",
      nameEn: "Crash Landing on You",
      year: 2019,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/85C1E9/FFFFFF?text=Crash+Landing+on+You",
      rating: 8.7,
      episodes: 16
    },
    {
      id: 11,
      name: "Hidden Love",
      nameEn: "Hidden Love",
      year: 2023,
      country: "China",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Hidden+Love",
      rating: 8.5,
      episodes: 25
    },
    {
      id: 12,
      name: "Moving",
      nameEn: "Moving",
      year: 2023,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/3498DB/FFFFFF?text=Moving",
      rating: 8.9,
      episodes: 20
    },
    {
      id: 13,
      name: "Forever Love",
      nameEn: "Forever Love",
      year: 2023,
      country: "China",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=Forever+Love",
      rating: 8.3,
      episodes: 30
    },
    {
      id: 14,
      name: "Good Boy",
      nameEn: "Good Boy",
      year: 2025,
      country: "Korea",
      type: "Drama",
      status: "Ongoing",
      poster: "https://via.placeholder.com/300x450/2ECC71/FFFFFF?text=Good+Boy",
      rating: 8.1,
      episodes: 8
    },
    {
      id: 15,
      name: "Squid Game",
      nameEn: "Squid Game",
      year: 2021,
      country: "Korea",
      type: "Drama",
      status: "Completed",
      poster: "https://via.placeholder.com/300x450/F39C12/FFFFFF?text=Squid+Game",
      rating: 8.0,
      episodes: 9
    }
  ];
  
  return {
    data: mockDramas,
    total: mockDramas.length,
    message: "Using enhanced mock data (KissKH blocked)"
  };
}

// Try to scrape from alternative Asian drama sites
async function scrapeAlternativeSites() {
  const sites = [
    { name: 'DramaCool', url: 'https://www1.dramacool.one' },
    { name: 'AsianWiki', url: 'https://asianwiki.com' },
    { name: 'MyDramaList', url: 'https://mydramalist.com' }
  ];
  
  for (const site of sites) {
    try {
      console.log(`🔍 Trying ${site.name}...`);
      const data = await scrapeFromSite(site);
      if (data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn(`${site.name} failed:`, err.message);
    }
  }
  
  return [];
}

// Generic site scraper
async function scrapeFromSite(site) {
  try {
    const response = await fetch(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    });
    
    if (response.ok) {
      const html = await response.text();
      return parseSiteData(html, site.name);
    }
  } catch (err) {
    throw new Error(`Failed to scrape ${site.name}: ${err.message}`);
  }
  
  return [];
}

// Parse site data (basic implementation)
function parseSiteData(html, siteName) {
  // This is a basic implementation - you can enhance this based on each site's structure
  const $ = cheerio.load(html);
  const dramas = [];
  
  // Basic parsing logic - adjust based on actual site structure
  $('a[href*="drama"], a[href*="show"], .drama-item, .show-item').each((i, el) => {
    const title = $(el).text().trim();
    if (title && title.length > 3) {
      dramas.push({
        id: i + 1,
        name: title,
        nameEn: title,
        year: 2023,
        country: "Korea",
        type: "Drama",
        status: "Completed",
        poster: `https://via.placeholder.com/300x450/random/FFFFFF?text=${encodeURIComponent(title)}`,
        rating: 7.5 + Math.random() * 1.5,
        episodes: 16
      });
    }
  });
  
  return dramas.slice(0, 20); // Limit to 20 items
}

// Rate limiting to avoid triggering Cloudflare
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

async function rateLimitedRequest(fn) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏳ Rate limiting: waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  return await fn();
}

// Enhanced fetch function with better Cloudflare bypass
async function fetchJSON(url, retries = 2) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  // Initialize session if needed
  if (!isSessionValid()) {
    await initializeSession();
  }

  // Try multiple strategies
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt + 1}: Trying KissKH with enhanced cloudscraper...`);
      
      const userAgent = userAgents[attempt % userAgents.length];
      
      // Try with proxy on second attempt
      let cloudscraperOptions = {
        uri: url,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://kisskh.co/',
          'Origin': 'https://kisskh.co',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive',
          'DNT': '1'
        },
        gzip: true,
        followRedirect: true,
        followAllRedirects: true,
        timeout: 20000,
        cloudflareTimeout: 10000,
        cloudflareMaxTimeout: 30000,
        challengesToSolve: 3
      };

      // Add session cookies if available
      if (sessionCookies) {
        cloudscraperOptions.headers['Cookie'] = sessionCookies.join('; ');
      }

      // Add proxy on second attempt
      if (attempt === 1) {
        const availableProxies = getAvailableProxies();
        const proxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
        console.log(`🌐 Using proxy: ${proxy}`);
        
        // Create proxy agent for advanced protocols
        const proxyAgent = createProxyAgent(proxy);
        if (proxyAgent) {
          cloudscraperOptions.agent = proxyAgent;
        } else {
          cloudscraperOptions.proxy = proxy;
        }
      }
      
      // Use rate limiting for requests
      const response = await rateLimitedRequest(async () => {
        return await cloudscraper.get(cloudscraperOptions);
      });
      
      const data = JSON.parse(response);
      if (data && data.data && data.data.length > 0) {
        console.log(`✅ Successfully fetched ${data.data.length} items from KissKH`);
        return data;
      }
    } catch (err) {
      console.warn(`❌ KissKH attempt ${attempt + 1} failed:`, err.message);
      
      // Reset session on failure
      if (attempt === 2) {
        sessionCookies = null;
        lastSessionTime = 0;
      }
      
      // Wait before retry
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      }
    }
  }
  
  // If all KissKH attempts fail, use alternative data
  console.log('🚫 All KissKH attempts failed, using alternative data sources...');
  return await fetchAlternativeData();
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

// Test v2rayN proxy connectivity
async function testV2rayNProxy() {
  console.log('🔍 Testing v2rayN proxy connectivity...');
  
  const testUrls = [
    'http://httpbin.org/ip',
    'https://api.ipify.org?format=json',
    'https://httpbin.org/headers'
  ];
  
  for (const proxyUrl of [V2RAYN_CONFIG.httpProxy, V2RAYN_CONFIG.socks5Proxy]) {
    try {
      console.log(`Testing ${proxyUrl}...`);
      const agent = createProxyAgent(proxyUrl);
      
      if (!agent) {
        console.warn(`❌ Failed to create agent for ${proxyUrl}`);
        continue;
      }
      
      const response = await fetch('https://httpbin.org/ip', {
        agent,
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${proxyUrl} working - IP: ${data.origin}`);
        return true;
      }
    } catch (err) {
      console.warn(`❌ ${proxyUrl} failed:`, err.message);
    }
  }
  
  console.log('❌ No v2rayN proxies working');
  return false;
}

// Instructions for v2rayN setup
function printV2rayNInstructions() {
  console.log(`
🔧 v2rayN Setup Instructions:
1. Download v2rayN from: https://github.com/2dust/v2rayN/releases
2. Install and configure your proxy server
3. Enable HTTP proxy on port 10809
4. Enable SOCKS5 proxy on port 10808
5. Set V2RAYN_CONFIG.enabled = true in this file
6. Restart the addon

Alternative ports:
- HTTP: 7890, 10809, 10807
- SOCKS5: 7891, 10808, 10806

To enable v2rayN support, edit the V2RAYN_CONFIG object in index.js:
const V2RAYN_CONFIG = {
  enabled: true, // Change this to true
  httpProxy: 'http://127.0.0.1:10809',
  socks5Proxy: 'socks5://127.0.0.1:10808',
  timeout: 10000
};
`);
}

// ─── Catalog handler ─────────────────────────────────────────────────────
builder.defineCatalogHandler(async ({ id, search = '', extra = {} }) => {
  const skip  = Number(extra.skip)  || 0;
  const limit = Number(extra.limit) || 50; // Increased default limit to 50
  const page  = Math.floor(skip / limit) + 1;
  const genre = extra.genre; // <-- get genre filter

  try {
    const url = `https://kisskh.co/api/DramaList/List?page=${page}&pageSize=${limit}&type=1&sub=0&country=1&status=0&order=1`;
    console.log('🔍 KissKH JSON fetch:', url);
    
    const response = await fetchJSON(url);
    
    // Debug: Log the actual response structure
    console.log('🔍 Response structure:', JSON.stringify(response, null, 2).substring(0, 500));
    
    if (response.data && response.data.length > 0) {
      const metas = response.data
        .filter(drama => !search || (drama.name && drama.name.toLowerCase().includes(search.toLowerCase())))
        .map(drama => {
          // Debug: Log the first drama object to see its structure
          if (response.data.indexOf(drama) === 0) {
            console.log('🔍 First drama object:', JSON.stringify(drama, null, 2));
          }
          
          return {
            id: `kisskh_${drama.id || drama.kisskhId || 'unknown'}`,
            name: drama.nameEn || drama.name || drama.title || 'Unknown Drama',
            type: 'series',
            poster: drama.poster || drama.thumbnail || 'https://via.placeholder.com/300x450/random/FFFFFF?text=Drama',
            posterShape: 'poster',
            background: drama.poster || drama.thumbnail || 'https://via.placeholder.com/300x450/random/FFFFFF?text=Drama',
            logo: drama.poster || drama.thumbnail || 'https://via.placeholder.com/300x450/random/FFFFFF?text=Drama',
            description: `${drama.name || drama.title || 'Unknown'} (${drama.year || drama.releaseDate || 'N/A'}) - ${drama.country || 'Unknown'} ${drama.type || 'Drama'}`,
            releaseInfo: `${drama.year || drama.releaseDate || 'N/A'} • ${drama.country || 'Unknown'} • ${drama.episodes || 'Unknown'} episodes`,
            runtime: `${(drama.episodes || 16) * 60} min`,
            genre: [drama.type || 'Drama', drama.country || 'Unknown'],
            director: drama.country || 'Unknown',
            cast: [drama.country || 'Unknown'],
            rating: drama.rating || 7.5,
            year: drama.year || drama.releaseDate || 2023,
            status: drama.status || 'Completed',
            episodes: drama.episodes || 16
          };
        });
      
      console.log(`Catalog metas: ${metas.length} items`);
      return { metas };
    } else {
      console.log('No data available, returning empty catalog');
      return { metas: [] };
    }
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return { metas: [] };
  }
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
async function startServer() {
  // Test v2rayN proxy if enabled
  if (V2RAYN_CONFIG.enabled) {
    console.log('🔧 v2rayN proxy support enabled');
    await testV2rayNProxy();
  } else {
    console.log('💡 To enable v2rayN proxy support, set V2RAYN_CONFIG.enabled = true');
    printV2rayNInstructions();
  }
  
  serveHTTP(builder.getInterface(), {
    port: process.env.PORT || 3000
  })
  .then(() => console.log('Addon running at http://127.0.0.1:3000/manifest.json'));
}

startServer();
