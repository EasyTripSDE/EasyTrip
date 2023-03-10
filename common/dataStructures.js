const SERVER_BASE_URL = "http://localhost"

const AUTH_PORT = process.env.AUTH_PORT || 12345;
const OSM_PORT = process.env.OSM_PORT || 12346;
const POINT_PORT = process.env.POINT_PORT || 12347;
const PATH_PORT = process.env.PATH_PORT || 12348;
const FACADE_PORT = process.env.FACADE_PORT || 12349;

const OSM_TOOLS_URL = SERVER_BASE_URL + ":" + OSM_PORT;
const POINT_SEARCH_URL = SERVER_BASE_URL + ":" + POINT_PORT;
const PATH_SEARCH_URL = SERVER_BASE_URL + ":" + PATH_PORT;

const AMENITIES = {
    sustenance: ["bar","biergarten","cafe","fast_food","food_court","ice_cream","pub","restaurant"],
    education: ["college","driving_school","kindergarten","language_school","library","toy_library","training","music_school","school","university"],
    entertainment: ["arts_centre","casino","cinema","community_centre","conference_centre","events_venue","fountain","planetarium","public_bookcase","social_centre","studio","theatre"]
}

const TOURISM = {
    tourism: ["aquarium","artwork","attraction","gallery","gallery","information","museum","picnic_site","theme_park","viewpoint","zoo"],
    accomodation: ["alpine_hut","apartment","camp_pitch","camp_site","caravan_site","chalet","guest_house","hostel","hotel","motel","wilderness_hut"]
}

const INTERESTS = new Set([...Object.keys(AMENITIES), ...Object.keys(TOURISM)]);

const PLACES = ["city","town","village","hamlet"];

const PROFILES = {
    car: "Car",
    foot: "Foot",
    bike: "Bike",
}

module.exports = { SERVER_BASE_URL,AUTH_PORT,OSM_PORT,POINT_PORT,PATH_PORT,FACADE_PORT,OSM_TOOLS_URL,POINT_SEARCH_URL,PATH_SEARCH_URL,AMENITIES,TOURISM,INTERESTS,PLACES,PROFILES }