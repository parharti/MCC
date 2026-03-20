/**
 * Tamil Nadu - All 38 Districts
 * Social Media Tracking Portal - Election Commission
 */

const districts = [
  { id: 'ariyalur', name: 'Ariyalur', code: 'ary' },
  { id: 'chengalpattu', name: 'Chengalpattu', code: 'cgp' },
  { id: 'chennai', name: 'Chennai', code: 'chen' },
  { id: 'coimbatore', name: 'Coimbatore', code: 'cbe' },
  { id: 'cuddalore', name: 'Cuddalore', code: 'cdl' },
  { id: 'dharmapuri', name: 'Dharmapuri', code: 'dpi' },
  { id: 'dindigul', name: 'Dindigul', code: 'dgl' },
  { id: 'erode', name: 'Erode', code: 'erd' },
  { id: 'kallakurichi', name: 'Kallakurichi', code: 'klk' },
  { id: 'kanchipuram', name: 'Kanchipuram', code: 'knc' },
  { id: 'kanyakumari', name: 'Kanyakumari', code: 'kky' },
  { id: 'karur', name: 'Karur', code: 'krr' },
  { id: 'krishnagiri', name: 'Krishnagiri', code: 'kgi' },
  { id: 'madurai', name: 'Madurai', code: 'mdu' },
  { id: 'mayiladuthurai', name: 'Mayiladuthurai', code: 'myt' },
  { id: 'nagapattinam', name: 'Nagapattinam', code: 'ngp' },
  { id: 'namakkal', name: 'Namakkal', code: 'nmk' },
  { id: 'nilgiris', name: 'Nilgiris', code: 'nlg' },
  { id: 'perambalur', name: 'Perambalur', code: 'pmb' },
  { id: 'pudukkottai', name: 'Pudukkottai', code: 'pdk' },
  { id: 'ramanathapuram', name: 'Ramanathapuram', code: 'rmd' },
  { id: 'ranipet', name: 'Ranipet', code: 'rnp' },
  { id: 'salem', name: 'Salem', code: 'slm' },
  { id: 'sivagangai', name: 'Sivagangai', code: 'svg' },
  { id: 'tenkasi', name: 'Tenkasi', code: 'tks' },
  { id: 'thanjavur', name: 'Thanjavur', code: 'tnj' },
  { id: 'theni', name: 'Theni', code: 'thn' },
  { id: 'thoothukudi', name: 'Thoothukudi (Tuticorin)', code: 'ttk' },
  { id: 'tiruchirappalli', name: 'Tiruchirappalli', code: 'tchy' },
  { id: 'tirunelveli', name: 'Tirunelveli', code: 'tnvl' },
  { id: 'tirupathur', name: 'Tirupathur', code: 'tpr' },
  { id: 'tiruppur', name: 'Tiruppur', code: 'tpp' },
  { id: 'tiruvallur', name: 'Tiruvallur', code: 'tvl' },
  { id: 'tiruvannamalai', name: 'Tiruvannamalai', code: 'tvm' },
  { id: 'tiruvarur', name: 'Tiruvarur', code: 'tvr' },
  { id: 'vellore', name: 'Vellore', code: 'vlr' },
  { id: 'viluppuram', name: 'Viluppuram', code: 'vpm' },
  { id: 'virudhunagar', name: 'Virudhunagar', code: 'vng' }
];

// Password = district code + suffix from env
const districtPasswords = {};
const suffix = process.env.DISTRICT_PASSWORD_SUFFIX || '@2026';
districts.forEach(d => {
  districtPasswords[d.id] = `${d.code}${suffix}`;
});

// Assembly constituencies per district
const constituencies = {
  ariyalur: ['Ariyalur', 'Jayankondam', 'Sendurai'],
  chengalpattu: ['Chengalpattu', 'Thiruporur', 'Alandur', 'Tambaram', 'Pallavaram'],
  chennai: ['Harbour', 'Chepauk-Thiruvallikeni', 'Thousand Lights', 'Anna Nagar', 'Velachery', 'T. Nagar', 'Mylapore', 'Royapuram', 'Perambur', 'Kolathur'],
  coimbatore: ['Coimbatore North', 'Coimbatore South', 'Singanallur', 'Pollachi', 'Kavundampalayam', 'Sulur'],
  cuddalore: ['Cuddalore', 'Kurinjipadi', 'Bhuvanagiri', 'Chidambaram', 'Kattumannarkoil'],
  dharmapuri: ['Dharmapuri', 'Pennagaram', 'Pappireddipatti', 'Harur'],
  dindigul: ['Dindigul', 'Palani', 'Oddanchatram', 'Athoor', 'Nilakkottai'],
  erode: ['Erode East', 'Erode West', 'Modakkurichi', 'Bhavani', 'Perundurai', 'Gobichettipalayam'],
  kallakurichi: ['Kallakurichi', 'Sankarapuram', 'Ulundurpettai', 'Rishivandiyam'],
  kanchipuram: ['Kanchipuram', 'Uthiramerur', 'Sriperumbudur'],
  kanyakumari: ['Nagercoil', 'Colachal', 'Padmanabhapuram', 'Vilavancode', 'Killiyoor'],
  karur: ['Karur', 'Aravakurichi', 'Krishnarayapuram'],
  krishnagiri: ['Krishnagiri', 'Hosur', 'Veppanahalli', 'Bargur', 'Shoolagiri'],
  madurai: ['Madurai East', 'Madurai West', 'Madurai Central', 'Madurai North', 'Madurai South', 'Thiruparankundram', 'Melur'],
  mayiladuthurai: ['Mayiladuthurai', 'Sirkazhi', 'Poompuhar'],
  nagapattinam: ['Nagapattinam', 'Kilvelur', 'Vedaranyam'],
  namakkal: ['Namakkal', 'Rasipuram', 'Tiruchengode', 'Paramathi-Velur', 'Komarapalayam'],
  nilgiris: ['Udhagamandalam', 'Coonoor', 'Gudalur'],
  perambalur: ['Perambalur', 'Kunnam', 'Veppanthattai'],
  pudukkottai: ['Pudukkottai', 'Thirumayam', 'Alangudi', 'Aranthangi'],
  ramanathapuram: ['Ramanathapuram', 'Paramakudi', 'Tiruvadanai', 'Mudukulathur'],
  ranipet: ['Ranipet', 'Arcot', 'Sholingur', 'Walajapet'],
  salem: ['Salem North', 'Salem South', 'Salem West', 'Veerapandi', 'Attur', 'Yercaud', 'Gangavalli'],
  sivagangai: ['Sivagangai', 'Karaikudi', 'Manamadurai', 'Ilayangudi'],
  tenkasi: ['Tenkasi', 'Sankarankovil', 'Vasudevanallur', 'Kadayanallur'],
  thanjavur: ['Thanjavur', 'Kumbakonam', 'Papanasam', 'Thiruvidaimarudur', 'Orathanadu', 'Pattukkottai'],
  theni: ['Theni', 'Periyakulam', 'Bodinayakanur', 'Cumbum', 'Uthamapalayam'],
  thoothukudi: ['Thoothukudi', 'Tiruchendur', 'Srivaikuntam', 'Ottapidaram', 'Kovilpatti'],
  tiruchirappalli: ['Tiruchirappalli East', 'Tiruchirappalli West', 'Srirangam', 'Lalgudi', 'Manachanallur', 'Musiri'],
  tirunelveli: ['Tirunelveli', 'Palayamkottai', 'Ambasamudram', 'Radhapuram', 'Nanguneri', 'Alangulam'],
  tirupathur: ['Tirupathur', 'Vaniyambadi', 'Ambur', 'Jolarpet'],
  tiruppur: ['Tiruppur North', 'Tiruppur South', 'Avanashi', 'Palladam', 'Kangeyam', 'Dharapuram'],
  tiruvallur: ['Tiruvallur', 'Poonamallee', 'Avadi', 'Madhavaram', 'Ambattur', 'Gummidipoondi', 'Ponneri'],
  tiruvannamalai: ['Tiruvannamalai', 'Arani', 'Cheyyar', 'Vandavasi', 'Polur', 'Kalasapakkam'],
  tiruvarur: ['Tiruvarur', 'Nannilam', 'Needamangalam', 'Mannargudi'],
  vellore: ['Vellore', 'Anaikattu', 'Gudiyatham', 'K.V. Kuppam'],
  viluppuram: ['Viluppuram', 'Tindivanam', 'Gingee', 'Vanur', 'Vikravandi', 'Thirukoilur'],
  virudhunagar: ['Virudhunagar', 'Sivakasi', 'Aruppukkottai', 'Sattur', 'Rajapalayam']
};

module.exports = { districts, constituencies, districtPasswords };
