import DeckGL from "@deck.gl/react";
import { Map as MapGL } from "react-map-gl";
import maplibregl from "maplibre-gl";
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "deck.gl";
import { TripsLayer } from "@deck.gl/geo-layers";
import { createGeoJSONCircle } from "../helpers";
import { useEffect, useRef, useState } from "react";
import { getBoundingBoxFromPolygon, getMapGraph, getNearestNode } from "../services/MapService";
import PathfindingState from "../models/PathfindingState";
import Interface from "./Interface";
import { INITIAL_COLORS, INITIAL_VIEW_STATE, MAP_STYLE } from "../config";
import useSmoothStateChange from "../hooks/useSmoothStateChange";

function Map() {
    const [startNode, setStartNode] = useState(null);
    const [endNode, setEndNode] = useState(null);
    const [selectionRadius, setSelectionRadius] = useState([]);
    const [tripsData, setTripsData] = useState([]);
    const [started, setStarted] = useState();
    const [animationEnded, setAnimationEnded] = useState(false);
    const [playbackOn, setPlaybackOn] = useState(false);
    const [playbackDirection, setPlaybackDirection] = useState(1);
    const [fadeRadiusReverse, setFadeRadiusReverse] = useState(false);
    const [placeEnd, setPlaceEnd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({ algorithm: "astar", radius: 4, speed: 5 });
    const [colors, setColors] = useState(INITIAL_COLORS);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const ui = useRef();
    const fadeRadius = useRef();
    const requestRef = useRef();
    const previousTimeRef = useRef();
    const timer = useRef(0);
    const waypoints = useRef([]);
    const state = useRef(new PathfindingState());
    const traceNode = useRef(null);
    const traceNode2 = useRef(null);
    const selectionRadiusOpacity = useSmoothStateChange(0, 0, 1, 400, fadeRadius.current, fadeRadiusReverse);

    async function mapClick(e, info, radius = null) {
        if(started && !animationEnded) return;

        setFadeRadiusReverse(false);
        fadeRadius.current = true;
        clearPath();

        // Place end node
        if(info.rightButton || placeEnd) {
            if(e.layer?.id !== "selection-radius") {
                ui.current.showSnack("Please select a point inside the radius.", "info");
                return;
            }

            if(loading) {
                ui.current.showSnack("Please wait for all data to load.", "info");
                return;
            }

            const loadingHandle = setTimeout(() => {
                setLoading(true);
            }, 300);
            
            const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
            if(!node) {
                ui.current.showSnack("No path was found in the vicinity, please try another location.");
                clearTimeout(loadingHandle);
                setLoading(false);
                return;
            }

            const realEndNode = state.current.getNode(node.id);
            setEndNode(node);
            
            clearTimeout(loadingHandle);
            setLoading(false);

            if(!realEndNode) {
                ui.current.showSnack("An error occurred. Please try again.");
                return;
            }
            state.current.endNode = realEndNode;
            
            return;
        }

        const loadingHandle = setTimeout(() => {
            setLoading(true);
        }, 300);

        // Fectch nearest node
        const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
        if(!node) {
            ui.current.showSnack("No path was found in the vicinity, please try another location.");
            clearTimeout(loadingHandle);
            setLoading(false);
            return;
        }

        setStartNode(node);
        setEndNode(null);
        const circle = createGeoJSONCircle([node.lon, node.lat], radius ?? settings.radius);
        setSelectionRadius([{ contour: circle}]);
        
        // Fetch nodes inside the radius
        getMapGraph(getBoundingBoxFromPolygon(circle), node.id).then(graph => {
            state.current.graph = graph;
            clearPath();
            clearTimeout(loadingHandle);
            setLoading(false);
        });
    }

    // Start new pathfinding animation
    function startPathfinding() {
        setFadeRadiusReverse(true);
        setTimeout(() => {
            clearPath();
            state.current.start(settings.algorithm);
            setStarted(true);
        }, 400);
    }

    

    function clearPath() {
        setStarted(false);
        setTripsData([]);
        setTime(0);
        state.current.reset();
        waypoints.current = [];
        timer.current = 0;
        previousTimeRef.current = null;
        traceNode.current = null;
        traceNode2.current = null;
        setAnimationEnded(false);
    }

    

    

    // Add new node to the waypoitns property and increment timer
    function updateWaypoints(node, refererNode, color = "path", timeMultiplier = 1) {
        if(!node || !refererNode) return;
        const distance = Math.hypot(node.longitude - refererNode.longitude, node.latitude - refererNode.latitude);
        const timeAdd = distance * 50000 * timeMultiplier;

        waypoints.current = [...waypoints.current,
            { 
                path: [[refererNode.longitude, refererNode.latitude], [node.longitude, node.latitude]],
                timestamps: [timer.current, timer.current + timeAdd],
                color,// timestamp: timer.current + timeAdd
            }
        ];

        timer.current += timeAdd;
        setTripsData(() => waypoints.current);
    }

    function changeLocation(location) {
        setViewState({ ...viewState, longitude: location.longitude, latitude: location.latitude, zoom: 13,transitionDuration: 1, transitionInterpolator: new FlyToInterpolator()});
    }

    function changeSettings(newSettings) {
        setSettings(newSettings);
        const items = { settings: newSettings, colors };
        localStorage.setItem("path_settings", JSON.stringify(items));
    }

    function changeColors(newColors) {
        setColors(newColors);
        const items = { settings, colors: newColors };
        localStorage.setItem("path_settings", JSON.stringify(items));
    }

    function changeAlgorithm(algorithm) {
        clearPath();
        changeSettings({ ...settings, algorithm });
    }

    function changeRadius(radius) {
        changeSettings({...settings, radius});
        if(startNode) {
            mapClick({coordinate: [startNode.lon, startNode.lat]}, {}, radius);
        }
    }

    

    return (
        <>
            <div onContextMenu={(e) => { e.preventDefault(); }}>
                <DeckGL
                    initialViewState={viewState}
                    controller={{ doubleClickZoom: false, keyboard: false }}
                    onClick={mapClick}
                >
                    <PolygonLayer 
                        id={"selection-radius"}
                        data={selectionRadius}
                        pickable={true}
                        stroked={true}
                        getPolygon={d => d.contour}
                        getFillColor={[80, 210, 0, 10]}
                        getLineColor={[9, 142, 46, 175]}
                        getLineWidth={3}
                        opacity={selectionRadiusOpacity}
                    />

                    <TripsLayer
                        id={"pathfinding-layer"}
                        data={tripsData}
                        opacity={1}
                        widthMinPixels={3}
                        widthMaxPixels={5}
                        fadeTrail={false}
                        currentTime={time}
                        getColor={d => colors[d.color]}
                        updateTriggers={{
                            getColor: [colors.path, colors.route]
                        }}
                    />

                    <ScatterplotLayer 
                        id="start-end-points"
                        data={[
                            ...(startNode ? [{ coordinates: [startNode.lon, startNode.lat], color: colors.startNodeFill, lineColor: colors.startNodeBorder }] : []),
                            ...(endNode ? [{ coordinates: [endNode.lon, endNode.lat], color: colors.endNodeFill, lineColor: colors.endNodeBorder }] : []),
                        ]}
                        pickable={true}
                        opacity={1}
                        stroked={true}
                        filled={true}
                        radiusScale={1}
                        radiusMinPixels={7}
                        radiusMaxPixels={20}
                        lineWidthMinPixels={1}
                        lineWidthMaxPixels={3}
                        getPosition={d => d.coordinates}
                        getFillColor={d => d.color}
                        getLineColor={d => d.lineColor}
                    />

                    <MapGL 
                        reuseMaps mapLib={maplibregl} 
                        mapStyle={MAP_STYLE} 
                        doubleClickZoom={false}
                    />
                </DeckGL>

            </div>
            
            <div className="attrib-container"><summary className="maplibregl-ctrl-attrib-button" title="Toggle attribution" aria-label="Toggle attribution"></summary><div className="maplibregl-ctrl-attrib-inner">© <a href="https://carto.com/about-carto/" target="_blank" rel="noopener">CARTO</a>, © <a href="http://www.openstreetmap.org/about/" target="_blank">OpenStreetMap</a> contributors</div></div>

        </>
    );
}

export default Map;