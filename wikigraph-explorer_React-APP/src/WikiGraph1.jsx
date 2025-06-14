// src/WikiGraph.jsx (Improved Cluster Separation)
import React, { useEffect, useRef } from 'react';
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

// A high-contrast color palette for clusters
const CLUSTER_COLORS = [
    "#FF6633", "#FF33FF", "#00B3E6", "#E6B333", "#3366E6", "#FFB399",
    "#99FF99", "#B34D4D", "#80B300", "#E6B3B3", "#6680B3", "#66991A",
    "#FF99E6", "#CCFF1A", "#FF1A66", "#E6331A", "#33FFCC", "#66994D"
];

const WikiGraph = ({ elements, isLoading, topic, viewMode }) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);

    // Function to pre-position clusters in a circular arrangement
    const prePositionClusters = (graph) => {
        const clusters = {};
        
        // Group nodes by cluster
        graph.forEachNode(node => {
            const clusterId = graph.getNodeAttribute(node, 'cluster');
            if (!clusters[clusterId]) {
                clusters[clusterId] = [];
            }
            clusters[clusterId].push(node);
        });

        const clusterIds = Object.keys(clusters);
        const numClusters = clusterIds.length;
        const radius = Math.max(400, numClusters * 80); // Increased base radius for more separation

        clusterIds.forEach((clusterId, index) => {
            // Position cluster centers in a circle with more spacing
            const angle = (2 * Math.PI * index) / numClusters;
            const clusterCenterX = Math.cos(angle) * radius;
            const clusterCenterY = Math.sin(angle) * radius;
            
            const nodesInCluster = clusters[clusterId];
            const clusterRadius = Math.max(50, Math.sqrt(nodesInCluster.length) * 20); // Larger cluster radius

            // Position nodes within each cluster
            nodesInCluster.forEach((node, nodeIndex) => {
                const nodeAngle = (2 * Math.PI * nodeIndex) / nodesInCluster.length;
                const nodeRadius = Math.random() * clusterRadius;
                
                const x = clusterCenterX + Math.cos(nodeAngle) * nodeRadius;
                const y = clusterCenterY + Math.sin(nodeAngle) * nodeRadius;
                
                graph.setNodeAttribute(node, 'x', x);
                graph.setNodeAttribute(node, 'y', y);
            });
        });
    };

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.kill();
        }
        if (!elements || elements.length === 0 || !containerRef.current) {
            return;
        }

        const graph = new Graph();
        const mainNodeId = viewMode === 'detail' ? topic : null;

        elements.forEach(el => {
            if (el.data.id) {
                graph.addNode(el.data.id, {
                    ...el.data,
                    size: (((el.data.size || 10) / 150) * 45 + 5)/2,
                    cluster: el.data.cluster_id,
                    isMainNode: el.data.label === mainNodeId
                });
            } else if (el.data.source) {
                if (graph.hasNode(el.data.source) && graph.hasNode(el.data.target) && !graph.hasEdge(el.data.source, el.data.target)) {
                    graph.addEdge(el.data.source, el.data.target);
                }
            }
        });

        // Pre-position clusters to prevent overlap
        prePositionClusters(graph);

        if (graph.order > 1) {
            const iterations = viewMode === 'overview' ? 400 : 200;
            const settings = viewMode === 'overview'
                ? {
                    // Settings optimized for maximum cluster separation
                    linLogMode: false,
                    outboundAttractionDistribution: true,
                    adjustSizes: true,
                    edgeWeightInfluence: 0.05, // Reduced edge influence even more
                    scalingRatio: 80.0, // Much stronger repulsion
                    strongGravityMode: false,
                    gravity: 0.02, // Even weaker gravity
                    slowDown: 3.0, // Slower for precision
                    barnesHutOptimize: true,
                    barnesHutTheta: 0.8
                  }
                : {
                    linLogMode: false,
                    adjustSizes: true,
                    scalingRatio: 50.0,
                    gravity: 0.5,
                    strongGravityMode: false,
                    slowDown: 2.0
                  };
            
            // Run ForceAtlas2 with cluster-friendly settings
            forceAtlas2.assign(graph, { iterations, settings });
            
            // Optional: Second pass with even stronger settings for maximum separation
            if (viewMode === 'overview') {
                forceAtlas2.assign(graph, { 
                    iterations: 150, 
                    settings: {
                        ...settings,
                        scalingRatio: 120.0, // Maximum repulsion
                        gravity: 0.01, // Minimal gravity
                        slowDown: 8.0, // Very slow for maximum precision
                        edgeWeightInfluence: 0.02 // Minimal edge influence
                    }
                });
            }
        }

        const state = { hoveredNode: undefined };
        const renderer = new Sigma(graph, containerRef.current, {
            nodeReducer: (node, data) => {
                const res = { ...data };
                if (state.hoveredNode) {
                    if (node === state.hoveredNode || graph.areNeighbors(node, state.hoveredNode)) {
                        res.color = data.isMainNode ? "#FFD700" : CLUSTER_COLORS[data.cluster % CLUSTER_COLORS.length];
                        res.zIndex = 1;
                    } else {
                        res.color = "rgba(200, 200, 200, 0.2)"; // Mute non-neighbors significantly
                        res.label = "";
                        res.zIndex = 0;
                    }
                } else {
                    res.color = data.isMainNode ? "#FFD700" : CLUSTER_COLORS[data.cluster % CLUSTER_COLORS.length];
                }
                return res;
            },
            edgeReducer: (edge, data) => {
                const res = { ...data, type: "arrow", size: 0.001 };
                if (state.hoveredNode) {
                    const [source, target] = graph.extremities(edge);
                    // Hide edges not connected to the hovered node or its immediate neighbors
                    if (source !== state.hoveredNode && target !== state.hoveredNode) {
                        res.hidden = true;
                    } else {
                        res.color = "#888"; // Highlight connected edges
                        res.size = 0.01;
                    }
                } else {
                     res.color = "#3b3a37"; // Make edges very subtle by default
                }
                return res;
            },
            labelRenderedSizeThreshold: 12, // Show labels earlier
            zIndex: true,
        });

        renderer.on("enterNode", ({ node }) => { state.hoveredNode = node; renderer.refresh(); });
        renderer.on("leaveNode", () => { state.hoveredNode = undefined; renderer.refresh(); });
        renderer.on("clickNode", ({ node }) => {
            const url = graph.getNodeAttribute(node, "url");
            if (url) window.open(url, "_blank");
        });

        // Zoom out more to show separated clusters
        setTimeout(() => renderer.getCamera().animate({ ratio: 2.5 }, { duration: 600 }), 300);
        rendererRef.current = renderer;

    }, [elements, viewMode, topic]);

    if (isLoading) return <div className="loading-overlay"><p>Calculating Layout...</p></div>;
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default WikiGraph;