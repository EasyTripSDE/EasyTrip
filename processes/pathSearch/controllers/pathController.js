'use strict';

const { pointToStr,pointArrayToObj,cleanWrtStruct,arrayToStr,reversePointArray, pointObjCompleteNames,parseBoolean } = require("../../../common/functions");
const { OSM_TOOLS_URL,INTERESTS,PROFILES } = require("../../../common/dataStructures");

const request = require('request-promise');
const geolib = require('geolib');

let MSG = {
    badRequest: "Bad Request", //Error code: 400
    serverError: "Server error", //Error code: 500
}

module.exports.stops = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    let params = getCommonQueryParams(req.query);
    params["poisDescriptions"] = req.query.poisDescriptions;

    let stops = await getStops(params.start,params.end,params.interests,params.strLimit,params.minDistanceStr,params.maxDetourStr,params.profile,params.poisDescriptions);

    if (stops != null) {
        res.status(200).json({
            //user: req.loggedUser,
            stops: stops
        });
    } else {
        res.status(400).json({
            error: MSG.badRequest
        });
    }
};

module.exports.routeGET = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    let params = getCommonQueryParams(req.query);

    let stops = await getStops(params.start,params.end,params.interests,params.strLimit,params.minDistanceStr,params.maxDetourStr,params.profile,"false");

    let route = await getRoute(stops,params.profile);

    if (route.paths != null) {
        res.status(200).json({
            //user: req.loggedUser,
            route: route
        });
    } else {
        res.status(400).json({
            error: MSG.badRequest
        });
    }
};

module.exports.routePOST = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    let profile = req.query.profile;
    let stops = req.body.stops;

    let route = await getRoute(stops,profile);

	if (route.paths != null) {
        res.status(200).json({
            //user: req.loggedUser,
            route: route
        });
    } else {
        res.status(400).json({
            error: MSG.badRequest
        });
    }
};

function getCommonQueryParams(query) {
    return {
        start: query.start,
        end: query.end,
        interests: Array.isArray(query.interest) ? query.interest : [query.interest],
        strLimit: query.limit,
        minDistanceStr: query.minDistance,
        maxDetourStr: query.maxDetour,
        profile: query.profile
    }
}

async function getStops(start,end,interests,strLimit = "3",minDistanceStr = "20000",maxDetourStr,profile = "car", poisDescriptionsStr = "true") {

    let stops = {
        start: {},
        end: {},
        intermediates: []
    };
    let poiDirections = [0,-1,1];
    let right = true;
    let i, j, limit, minDistance, maxDetour, poisDescriptions, path, subPathLen, interestsStr, pois, poiTollerance, maxMiddlePoint, currentMiddlePoint;
    //Request check
    if (start != undefined
            && end != undefined
            && !isNaN(limit = parseInt(strLimit)) && limit >= 0 && limit <= 8
            && PROFILES[profile] != undefined
            && (poisDescriptions = parseBoolean(poisDescriptionsStr)) != null) {
        if (limit > 0) {
            right = (interests = cleanWrtStruct(interests,INTERESTS)).length
            && !isNaN(minDistance = parseFloat(minDistanceStr)) && minDistance >= 0;
            if (right) {
                if (maxDetourStr != undefined) {
                    right = !isNaN(maxDetour = parseFloat(maxDetourStr)) && maxDetour >= 0 && maxDetour <= (minDistance/2);
                } else {
                    maxDetour = minDistance/2;
                }
            }
        }
        //Retrieve start and end coordinates and informations
        if (right) {
            try {
                stops.start = (await request(OSM_TOOLS_URL + "/v1/routing/geocode?limit=1&address=" + start)
                                .then(response => JSON.parse(response))).hits[0];
                stops.end = (await request(OSM_TOOLS_URL + "/v1/routing/geocode?limit=1&address=" + end)
                            .then(response => JSON.parse(response))).hits[0];
                right = stops.start != undefined && stops.end != undefined ? true : false;
            } catch (error) {
                //console.error(error);
                right = false;
            }
        }
    } else {
        right = false;
    }
    
    //Compute intermediary stops
    if (right) {
        if (limit) {
            try {
                //Retrieve route between start and end
                path = (await request(OSM_TOOLS_URL + "/v1/routing/route?point=" + pointToStr(stops.start) + "&point=" + pointToStr(stops.end) + "&profile=" + profile)
                                .then(response => JSON.parse(response))).paths[0];
                
                //Find at most limit intermediary points at least minDistance apart
                right = false;
                while (limit >= 0 && !right) {
                    stops.intermediates = [];
                    subPathLen = Math.round(path.points.coordinates.length/(limit+1));
                    for (i = subPathLen; i < subPathLen*(limit+1); i += subPathLen) {
                        stops.intermediates.push(reversePointArray(path.points.coordinates[i]));
                    }
                    if (limit > 0
                        && geolib.getDistance(pointArrayToObj(stops.intermediates[0]),
                            limit > 1 ? pointArrayToObj(stops.intermediates[1]) : pointObjCompleteNames(stops.end.point)) < minDistance) {
                        limit--;
                    } else {
                        right = true;
                    }
                }
    
                //For every point, search pois related with user interests and find the city with most of them
                interestsStr = arrayToStr(interests,"&interest=",true);
                poiTollerance = Math.round(subPathLen*0.2);
                for (i = 0; i < stops.intermediates.length; i++) {
                    //Find pois
                    j = 0;
                    do {
                        stops.intermediates[i] = !poiDirections[j] ? stops.intermediates[i] : reversePointArray(path.points.coordinates[subPathLen*(i+1)+poiDirections[j]*poiTollerance]);
                        try {
                            pois = (await request(OSM_TOOLS_URL + "/v1/locations/poi?point=" + pointToStr(stops.intermediates[i]) + interestsStr + "&squareSide=" + maxDetour)
                                .then(response => JSON.parse(response))
                                .catch(error => new Promise(resolve => resolve({elements: []})))
                                ).elements;
                        } catch (err) {
                            pois = [];
                        }
                        right = pois.length > 0;
                    } while (!right && ++j < poiDirections.length);
                    if (pois.length > 0) {
                        //Find city with max pois
                        pois.sort((a,b) => {
                            a = a.tags["addr:city"].toLowerCase();
                            b = b.tags["addr:city"].toLowerCase();
                            return a < b ? -1 : (a > b ? 1 : 0);
                        });
                        maxMiddlePoint = poisDescriptions ? {
                            details: "",
                            referPoint: null,
                            pois: [],
                        } : {
                            details: "",
                            referPoint: null,
                            nPois: 0
                        };
                        currentMiddlePoint = poisDescriptions ? {
                            details: pois[0].tags["addr:city"],
                            referPoint: [pois[0].lat,pois[0].lon], //Implementare conversione way,relations -> node
                            pois: []
                        } : {
                            details: pois[0].tags["addr:city"],
                            referPoint: [pois[0].lat,pois[0].lon], //Implementare conversione way,relations -> node
                            nPois: 0
                        };
                        for (const poi of pois) {
                            if (poi.tags["addr:city"] == currentMiddlePoint.details) {
                                if (poisDescriptions) {
                                    currentMiddlePoint.pois.push(poi);
                                } else {
                                    currentMiddlePoint.nPois++;
                                }
                            } else {
                                if (isBigger(currentMiddlePoint,maxMiddlePoint,poisDescriptions)) {
                                    maxMiddlePoint.details = currentMiddlePoint.details;
                                    maxMiddlePoint.referPoint = currentMiddlePoint.referPoint;
                                    if (poisDescriptions) {
                                        maxMiddlePoint.pois = currentMiddlePoint.pois;
                                    } else {
                                        maxMiddlePoint.nPois = currentMiddlePoint.nPois;
                                    }
                                }
                                currentMiddlePoint.details = poi.tags["addr:city"];
                                currentMiddlePoint.referPoint = [poi.lat,poi.lon]; //Implementare conversione way,relations -> node
                                if (poisDescriptions) {
                                    currentMiddlePoint.pois = [poi];
                                } else {
                                    currentMiddlePoint.nPois = 1;
                                }
                            }
                        }
                        if (currentMiddlePoint.details != maxMiddlePoint.details && isBigger(currentMiddlePoint,maxMiddlePoint,poisDescriptions)) {
                            maxMiddlePoint.details = currentMiddlePoint.details;
                            maxMiddlePoint.referPoint = currentMiddlePoint.referPoint;
                            if (poisDescriptions) {
                                maxMiddlePoint.pois = currentMiddlePoint.pois;
                            } else {
                                maxMiddlePoint.nPois = currentMiddlePoint.nPois;
                            }
                        }
                        stops.intermediates[i] = maxMiddlePoint;
                    } else {
                        stops.intermediates.splice(i--,1);
                    }
                }
                //Convert city name to a point
                for (i = 0; i < stops.intermediates.length; i++) {
                    stops.intermediates[i].details = (await request(OSM_TOOLS_URL + "/v1/routing/geocode?limit=5&onlyPlaces=true&address=" + stops.intermediates[i].details + "&closestTo=" + stops.intermediates[i].referPoint)
                    .then(response => JSON.parse(response))).hits[0];
                    delete stops.intermediates[i].referPoint;
                }
            } catch (error) {
                //console.log(error);
                stops = null;
            }
        }
    } else {
        stops = null;
    }

    return stops;
}

async function getRoute(stops,profile = "car") {

    let path = {
        distance: 0, //Total distance (meters)
        time: 0, //Total travel time (milliseconds)
        points_encoded: false, //false = points as array of points
        bbox: [180,90,-180,-90], //Extention of route ([minLon, minLat, maxLon, maxLat])
        points: { //Points of route
            type: "LineString", //Format of points
            coordinates: [] //Array of points ([{lon,lat}])
        },
        instructions: [], //Instructions for the route
        ascend: 0, //Total ascent
        descend: 0, //Total descent
        snapped_waypoints: { //Snapped input points: first and last point of the route
            type: "LineString", //Format of points
            coordinates: [] //Array of points ([{lon,lat}])
        }
    };
    let right = true;
    let points,tmpIntermediates,i,tmpPath,lastInterval = 0;
    
    //Check parameters
    try {
        if (stops != null &&
            PROFILES[profile] != undefined) {
            tmpIntermediates = stops.intermediates.map(point => point.details);
            points = [stops.start,...tmpIntermediates,stops.end];
        } else {
            right = false;
        }
    } catch (error) {
        //console.log(error);
        right = false;
    }

    //Compose the path
    if (right) {
        i = 0;
        while (path != null && i < points.length-1) {
            //Retrieve route between start and end
            try {
                tmpPath = (await request(OSM_TOOLS_URL + "/v1/routing/route?point=" + pointToStr(points[i]) + "&point=" + pointToStr(points[i+1]) + "&profile=" + profile)
                            .then(response => JSON.parse(response))).paths[0];
                path.distance += tmpPath.distance;
                path.time += tmpPath.time;
                path.bbox = tmpPath.bbox.map((coordinate,index) => {
                    if (index < 2) {
                        return coordinate < path.bbox[index] ? coordinate : path.bbox[index];
                    } else {
                        return coordinate > path.bbox[index] ? coordinate : path.bbox[index];
                    }
                });
                if (i != 0) {
                    tmpPath.points.coordinates.splice(0,1);
                }
                path.points.coordinates = path.points.coordinates.concat(tmpPath.points.coordinates); //Fare check punti uguali inizio-fine
                path.instructions = path.instructions.concat(prepareInstructions(tmpPath.instructions,lastInterval,i != points.length-2 ? i+1 : 0));
                lastInterval = path.instructions[path.instructions.length-1].interval[1];
                path.ascend += tmpPath.ascend;
                path.descend += tmpPath.descend;
                path.snapped_waypoints.coordinates.push(tmpPath.points.coordinates[tmpPath.points.coordinates.length-1]);
            } catch (error) {
                //console.log(error);
                path = null;
            }
            i++;
        }
        path.snapped_waypoints.coordinates.unshift(path.points.coordinates[0]);
    } else {
        path = null;
    }

    return {
        paths: path != null ? [path] : null
    };
}

function isBigger(currentMiddlePoint,maxMiddlePoint,poisDescriptions) {
    return (poisDescriptions && currentMiddlePoint.pois.length > maxMiddlePoint.pois.length)
    || (!poisDescriptions && currentMiddlePoint.nPois > maxMiddlePoint.nPois);
}

function prepareInstructions(instructions,startInterval = 0,waypoint = 0) {
    if (startInterval) {
        for (let i = 0; i < instructions.length; i++) {
            instructions[i].interval[0] += startInterval;
            instructions[i].interval[1] += startInterval;
        }
    }
    if (waypoint) {
        instructions[instructions.length-1].text = "Waypoint " + waypoint;
        instructions[instructions.length-1].sign = 5;
    }
    return instructions;
}