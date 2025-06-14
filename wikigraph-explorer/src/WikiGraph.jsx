// src/WikiGraph.jsx (Pure Geometric Layout - No Simulation)
import React, { useEffect, useRef } from 'react';
import Graph from "graphology";
import Sigma from "sigma";

// A high-contrast color palette for clusters
const CLUSTER_COLORS = [
    "#FF6633", "#FF33FF", "#00B3E6", "#E6B333", "#3366E6", "#FFB399",
    "#99FF99", "#B34D4D", "#80B300", "#E6B3B3", "#6680B3", "#66991A",
    "#FF99E6", "#CCFF1A", "#FF1A66", "#E6331A", "#33FFCC", "#66994D"
];

const WikiGraph = ({ elements, isLoading, topic, viewMode }) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);

    // Create dense clusters with proper node separation (no overlapping)
    const createDenseClusters = (graph) => {
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
        
        // Calculate cluster center positions - well separated
        const baseRadius = viewMode === 'overview' ? 1200 : 900;
        const clusterRadius = Math.max(baseRadius, numClusters * 200);

        clusterIds.forEach((clusterId, clusterIndex) => {
            const nodesInCluster = clusters[clusterId];
            
            // Position cluster centers in a circle with maximum separation
            const clusterAngle = (2 * Math.PI * clusterIndex) / numClusters;
            const clusterCenterX = Math.cos(clusterAngle) * clusterRadius;
            const clusterCenterY = Math.sin(clusterAngle) * clusterRadius;
            
            // Calculate cluster area size based on number of nodes
            const clusterAreaRadius = Math.max(200, Math.sqrt(nodesInCluster.length) * 50);
            
            // Array to store positioned nodes for collision detection
            const positionedNodes = [];
            
            nodesInCluster.forEach((node, nodeIndex) => {
                const nodeSize = graph.getNodeAttribute(node, 'size') || 5;
                const minDistance = nodeSize * 6; // Minimum distance between node centers
                
                let x, y;
                let attempts = 0;
                let positionFound = false;
                
                if (nodeIndex === 0) {
                    // First node at center
                    x = clusterCenterX;
                    y = clusterCenterY;
                    positionFound = true;
                } else {
                    // Find position that doesn't overlap with existing nodes
                    while (attempts < 100 && !positionFound) {
                        // Generate random position within cluster area
                        const angle = Math.random() * 2 * Math.PI;
                        const distance = Math.random() * clusterAreaRadius;
                        
                        // Bias toward center for denser clustering
                        const biasedDistance = distance * (0.2 + 0.8 * Math.random());
                        
                        x = clusterCenterX + Math.cos(angle) * biasedDistance;
                        y = clusterCenterY + Math.sin(angle) * biasedDistance;
                        
                        // Check for collisions with already positioned nodes
                        positionFound = true;
                        for (const positioned of positionedNodes) {
                          const dx = x - positioned.x;
                          const dy = y - positioned.y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          const requiredDistance = (nodeSize + positioned.size) * 6; // Much larger separation
                          
                          if (distance < requiredDistance) {
                              positionFound = false;
                              break;
                          }
                        }
                        
                        attempts++;
                    }
                    
                    // If no collision-free position found, use spiral placement
                    if (!positionFound) {
                        const spiralAngle = nodeIndex * 0.5;
                        const spiralRadius = Math.sqrt(nodeIndex) * 60;
                        x = clusterCenterX + Math.cos(spiralAngle) * spiralRadius;
                        y = clusterCenterY + Math.sin(spiralAngle) * spiralRadius;
                    }
                }
                
                // Store position
                graph.setNodeAttribute(node, 'x', x);
                graph.setNodeAttribute(node, 'y', y);
                positionedNodes.push({ x, y, size: nodeSize });
            });
        });
    };

    const createDetailLayout = (graph, mainNodeId) => {
        // Find the main node using its label, which is passed in the `topic` prop
        const mainNode = graph.findNode(node => graph.getNodeAttribute(node, 'label') === mainNodeId);

        if (!mainNode) {
            // Fallback: If no specific node is found, just arrange them all in a circle
            const nodes = graph.nodes();
            const radius = Math.max(100, nodes.length * 20);
            nodes.forEach((node, i) => {
                const angle = (i * 2 * Math.PI) / nodes.length;
                graph.setNodeAttribute(node, 'x', radius * Math.cos(angle));
                graph.setNodeAttribute(node, 'y', radius * Math.sin(angle));
            });
            return;
        }

        // Place the main node at the center
        graph.setNodeAttribute(mainNode, 'x', 0);
        graph.setNodeAttribute(mainNode, 'y', 0);

        const neighbors = graph.neighbors(mainNode);
        const neighborCount = neighbors.length;
        
        // Create a natural scattered layout around the main node
        const positionedNodes = [{ x: 0, y: 0, size: graph.getNodeAttribute(mainNode, 'size') || 5 }];
        
        // Smaller base radius for tighter clustering
        const baseRadius = Math.max(200, Math.sqrt(neighborCount) * 35);
        const maxRadius = baseRadius * 4.5;
        
        neighbors.forEach((nodeId, i) => {
            const nodeSize = graph.getNodeAttribute(nodeId, 'size') || 5;
            let x, y;
            let attempts = 0;
            let positionFound = false;
            
            while (attempts < 300 && !positionFound) {
                // Completely random positioning within a circular area
                const angle = Math.random() * 2 * Math.PI;
                const distance = baseRadius + Math.random() * (maxRadius - baseRadius);
                
                // Add some bias towards closer positions for tighter clustering
                const biasedDistance = distance * (0.6 + 0.6 * Math.random());
                
                x = biasedDistance * Math.cos(angle);
                y = biasedDistance * Math.sin(angle);
                
                // Check for collisions with already positioned nodes
                positionFound = true;
                for (const positioned of positionedNodes) {
                    const dx = x - positioned.x;
                    const dy = y - positioned.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const requiredDistance = (nodeSize + positioned.size) * 20;
                    
                    if (distance < requiredDistance) {
                        positionFound = false;
                        break;
                    }
                }
                
                attempts++;
            }
            
            // If no collision-free position found, use spiral placement as fallback
            if (!positionFound) {
                const spiralAngle = i * 0.5;
                const spiralRadius = baseRadius + Math.sqrt(i) * 30;
                x = spiralRadius * Math.cos(spiralAngle);
                y = spiralRadius * Math.sin(spiralAngle);
            }
            
            graph.setNodeAttribute(nodeId, 'x', x);
            graph.setNodeAttribute(nodeId, 'y', y);
            positionedNodes.push({ x, y, size: nodeSize });
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
                const isMainNode = el.data.label === mainNodeId;
                let finalSize = (((el.data.size || 10) / 150) * 45 + 5) / 2;
                if (isMainNode && viewMode === 'detail') {
                    finalSize *= 3;
                }
                graph.addNode(el.data.id, {
                    ...el.data,
                    size: finalSize,
                    cluster: el.data.cluster_id,
                    isMainNode: el.data.label === mainNodeId
                });
            } else if (el.data.source) {
                if (graph.hasNode(el.data.source) && graph.hasNode(el.data.target) && 
                    !graph.hasEdge(el.data.source, el.data.target)) {
                    graph.addEdge(el.data.source, el.data.target);
                }
            }
        });

        // Choose layout method - now with proper node separation
        // Option 1: Collision detection clusters (recommended for clean separation)
        if (viewMode === 'overview') {
            // Use the sophisticated cluster algorithm for the "galaxy" view.
            createDenseClusters(graph);
        } else {
            // Use the simple, clean circular layout for the "detail" view.
            createDetailLayout(graph, mainNodeId);
        }
        
        // Option 2: Force-based separation within clusters (uncomment for more precise)
        // createForceBasedClusters(graph);
        
        // Option 3: Hexagonal packed clusters (uncomment for organized clustering)
        // createHexPackedClusters(graph);

        // NO SIMULATION - positions are final and precise
        const state = { hoveredNode: undefined };
        const renderer = new Sigma(graph, containerRef.current, {
            nodeReducer: (node, data) => {
                const res = { ...data };
                if (state.hoveredNode) {
                    if (node === state.hoveredNode || graph.areNeighbors(node, state.hoveredNode)) {
                        res.color = data.isMainNode ? "#FFD700" : CLUSTER_COLORS[data.cluster % CLUSTER_COLORS.length];
                        res.zIndex = 1;
                    } else {
                        res.color = "rgba(200, 200, 200, 0.2)";
                        res.label = "";
                        res.hidden = true;
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
                    if (source !== state.hoveredNode && target !== state.hoveredNode) {
                        res.hidden = true;
                    } else {
                        // Different colors for incoming vs outgoing edges
                        if (source === state.hoveredNode) {
                            // Outgoing edge (from hovered node)
                            res.color = "#2563eb"; // Blue for outgoing
                            res.size = 1.1;
                        } else if (target === state.hoveredNode) {
                            // Incoming edge (to hovered node)
                            res.color = "#dc2626"; // Red for incoming
                            res.size = 1.1;
                        }
                        res.size = 1.1;
                    }
                } else {
                    res.color = "#121211";
                }
                return res;
            },
            labelRenderedSizeThreshold: 12,
            zIndex: true,
            labelWeight: "bold",
            labelColor: {
                color: "#00ff6e" // Sets ALL labels to this color.
            }
        });

        renderer.on("enterNode", ({ node }) => { 
            state.hoveredNode = node; 
            renderer.refresh(); 
        });
        renderer.on("leaveNode", () => { 
            state.hoveredNode = undefined; 
            renderer.refresh(); 
        });
        renderer.on("clickNode", ({ node }) => {
            const url = graph.getNodeAttribute(node, "url");
            if (url) window.open(url, "_blank");
        });

        // Set initial zoom to show the complete layout
        setTimeout(() => {
            const camera = renderer.getCamera();
            camera.animate({ ratio: 1.2 }, { duration: 600 });
        }, 300);

        rendererRef.current = renderer;

    }, [elements, viewMode, topic]);

    if (isLoading) return <div className="loading-overlay"><p>Calculating Layout...</p></div>;
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default WikiGraph;