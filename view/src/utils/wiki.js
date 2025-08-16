import axios from 'axios';

export const getWikiSummary = async (title) => {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data.extract || 'No summary available.';
  } catch (error) {
    console.warn(`Warning: Summary failed for '${title}': ${error}`);
    return 'No summary available.';
  }
};

export const getTouristPlace = async (lat, lon) => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=10&format=json&origin=*`;
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const places = response.data.query?.geosearch || [];
    if (!places.length) return null;

    const touristKeywords = ["park", "museum", "shrine", "monument", "fort", "tomb", "temple", "mosque", "holy", "ancient", "historic"];
    const placesWithScore = await Promise.all(
      places.map(async (place) => {
        const summary = await getWikiSummary(place.title);
        let score = summary.length;
        const titleLower = place.title.toLowerCase();
        if (touristKeywords.some(kw => titleLower.includes(kw))) {
          score += 1000; // Big boost for tourist-related terms
        }
        return [place, score];
      })
    );
    if (!placesWithScore.length) return null;

    const [bestPlace, bestScore] = placesWithScore.reduce((prev, curr) =>
      prev[1] > curr[1] ? prev : curr
    );
    return bestScore > 50 ? bestPlace : null; // Threshold to ensure quality
  } catch (error) {
    console.warn(`Warning: GeoSearch failed for (${lat}, ${lon}): ${error}`);
    return null;
  }
};