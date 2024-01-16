import DeckGL from "@deck.gl/react";
import { Map as MapGL } from "react-map-gl";
import maplibregl from "maplibre-gl";
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { useEffect, useRef, useState } from "react";
import { getBoundingBoxFromPolygon, getMapGraph, getNearestNode } from "../services/MapService";
import { INITIAL_COLORS, INITIAL_VIEW_STATE, MAP_STYLE } from "../config";
import useSmoothStateChange from "../hooks/useSmoothStateChange";

function Map() {
    const [startNode, setStartNode] = useState(null);
    const [endNode, setEndNode] = useState(null);
    const [selectionRadius, setSelectionRadius] = useState([]);
    const [tripsData, setTripsData] = useState([]);
    const [started, setStarted] = useState();
    const [time, setTime] = useState(0);
    const [animationEnded, setAnimationEnded] = useState(false);
    const [fadeRadiusReverse, setFadeRadiusReverse] = useState(false);
    const [placeEnd, setPlaceEnd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [colors, setColors] = useState(INITIAL_COLORS);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const ui = useRef();
    const fadeRadius = useRef();
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
                        pickable={true}get
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
        </>
    );
}

export default Map;