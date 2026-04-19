import fs from 'fs';
import path from 'path';

const DB_PATH = './surf-news.json';
const LATEST_PATH = './surf-news-latest.json';

const emptyDB = {
  site: {
    name: "SurfMorocco",
    description: "The Morocco surf blog — spots, seasons, beginner tips.",
    canonicalOrigin: "https://marocsurf.com",
    topics: ["Spots", "Beginners", "Seasons", "Gear", "Culture", "Techniques"],
    defaultOgImage: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&h=630&fit=crop&q=80"
  },
  articles: []
};

const str = JSON.stringify(emptyDB, null, 2);

fs.writeFileSync(DB_PATH, str, 'utf-8');
fs.writeFileSync(LATEST_PATH, str, 'utf-8');

console.log('✅ Bases de donnees JSON reinitialisees (0 articles) !');
