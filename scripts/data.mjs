// Generates public/data, public/flags and public/icons from npm packages (run before vite).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { presimplify, simplify, quantile } from 'topojson-simplify';

const require = createRequire(import.meta.url);
const pub = p => new URL('../public/' + p, import.meta.url);
for (const d of ['data', 'flags', 'icons']) fs.mkdirSync(pub(d), { recursive: true });

const CAP = { // Czech exonyms; others stay as in source
  Vienna:'Vídeň', Brussels:'Brusel', Prague:'Praha', Copenhagen:'Kodaň', Athens:'Atény', Rome:'Řím',
  Warsaw:'Varšava', Lisbon:'Lisabon', Bucharest:'Bukurešť', Moscow:'Moskva', Belgrade:'Bělehrad',
  Kyiv:'Kyjev', London:'Londýn', 'Washington D.C.':'Washington', Beijing:'Peking', Tokyo:'Tokio',
  Cairo:'Káhira', Algiers:'Alžír', Tehran:'Teherán', Baghdad:'Bagdád', Damascus:'Damašek',
  Jerusalem:'Jeruzalém', Riyadh:'Rijád', Muscat:'Maskat', 'Kuwait City':'Kuvajt',
  'Mexico City':'Ciudad de México', 'Guatemala City':'Guatemala', 'Panama City':'Panama',
  'New Delhi':'Nové Dillí', Hanoi:'Hanoj', 'Ulan Bator':'Ulánbátar', Pyongyang:'Pchjongjang',
  Seoul:'Soul', Yerevan:'Jerevan', Tashkent:'Taškent', Ashgabat:'Ašchabad', Dushanbe:'Dušanbe',
  Bishkek:'Biškek', Kathmandu:'Káthmándú', Dhaka:'Dháka', Reykjavik:'Reykjavík',
  'Addis Ababa':'Addis Abeba', Mogadishu:'Mogadišo', Khartoum:'Chartúm', "N'Djamena":'Ndžamena',
  Tripoli:'Tripolis', "Sana'a":"San'á", 'City of San Marino':'San Marino', 'Vatican City':'Vatikán',
  Luxembourg:'Lucemburk', Chișinău:'Kišiněv', Sofia:'Sofie', Nicosia:'Nikósie', Lobamba:'Mbabane',
  Kabul:'Kábul', Islamabad:'Islámábád', Doha:'Dauhá', 'Abu Dhabi':'Abú Zabí', Manama:'Manáma',
  Beirut:'Bejrút', Amman:'Ammán',
};
const SUB = {'Southern Asia':'jižní Asie','Middle Africa':'střední Afrika','Southeast Europe':'jihovýchodní Evropa',
  'Southern Europe':'jižní Evropa','Western Asia':'západní Asie','South America':'Jižní Amerika','Caribbean':'Karibik',
  'Australia and New Zealand':'Austrálie a Nový Zéland','Central Europe':'střední Evropa','Eastern Africa':'východní Afrika',
  'Western Europe':'západní Evropa','Western Africa':'západní Afrika','Eastern Europe':'východní Evropa',
  'Central America':'Střední Amerika','South-Eastern Asia':'jihovýchodní Asie','Southern Africa':'jižní Afrika',
  'North America':'Severní Amerika','Eastern Asia':'východní Asie','Northern Europe':'severní Evropa',
  'Northern Africa':'severní Afrika','Melanesia':'Melanésie','Micronesia':'Mikronésie','Central Asia':'střední Asie','Polynesia':'Polynésie'};
const cont = x => x.region === 'Americas' ? (x.subregion === 'South America' ? 'Jižní Amerika' : 'Severní Amerika')
  : { Europe:'Evropa', Asia:'Asie', Africa:'Afrika', Oceania:'Oceánie' }[x.region];
const min = s => s.replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();

const C = require('world-countries').filter(x => x.independent);
// Flags in their real proportions (public domain); flag-icons redraws every flag to 4:3.
const flagDir = new URL('../node_modules/svg-country-flags/svg/', import.meta.url);
const countries = C.map(x => {
  const f = x.cca2.toLowerCase();
  fs.writeFileSync(pub(`flags/${f}.svg`), min(fs.readFileSync(new URL(f + '.svg', flagDir), 'utf8')));
  return {
    id: x.ccn3, c: x.cca3, f, n: x.translations.ces.common, cap: CAP[x.capital[0]] || x.capital[0],
    k: cont(x), s: SUB[x.subregion] || x.subregion, a: Math.round(x.area), ll: x.landlocked, b: x.borders,
    cur: Object.entries(x.currencies || {}).map(([k, v]) => `${v.name} (${k})`).join(', '), p: x.latlng,
  };
}).sort((a, b) => a.n.localeCompare(b.n, 'cs'));
fs.writeFileSync(pub('data/countries.json'), JSON.stringify(countries));

const t = presimplify(require('world-atlas/countries-50m.json'));
const world = simplify(t, quantile(t, 0.15));
delete world.objects.land;
fs.writeFileSync(pub('data/world.json'), JSON.stringify(world));

const icon = fs.readFileSync(pub('icon.svg'));
for (const [name, size, pad] of [['192', 192, 0], ['512', 512, 0], ['maskable-512', 512, 0.12], ['apple-180', 180, 0]]) {
  const inner = Math.round(size * (1 - 2 * pad));
  await sharp(icon).resize(inner, inner).extend({ top: (size - inner) >> 1, bottom: (size - inner + 1) >> 1, left: (size - inner) >> 1, right: (size - inner + 1) >> 1, background: '#13212c' })
    .png().toFile(new URL(`../public/icons/${name}.png`, import.meta.url).pathname);
}

console.log(`${countries.length} countries`);
