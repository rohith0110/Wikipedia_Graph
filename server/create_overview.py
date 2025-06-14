# create_overview.py (Simplified for Frontend-Driven Layout)
import json
import sqlite3
import igraph as ig
from tqdm import tqdm

DB_FILE = 'wikipedia.db'
OVERVIEW_FILE = 'overview.json'
TOP_N_NODES = 750

print("Connecting to database...")
conn = sqlite3.connect(DB_FILE)
conn.row_factory = sqlite3.Row
all_nodes_data = conn.execute('SELECT * FROM nodes ORDER BY size DESC LIMIT ?', (TOP_N_NODES,)).fetchall()
top_node_ids = {row['id'] for row in all_nodes_data}
node_map = {row['id']: dict(row) for row in all_nodes_data}
placeholders = ', '.join('?' for _ in top_node_ids)
edges_data = conn.execute(f'SELECT * FROM edges WHERE source IN ({placeholders}) AND target IN ({placeholders})', list(top_node_ids) * 2).fetchall()
conn.close()

print("Building graph to detect communities...")
# We build a graph only to find the clusters. The layout is done on the frontend.
graph = ig.Graph.DictList(
    vertices=[{'name': id} for id in top_node_ids],
    edges=[{'source': e['source'], 'target': e['target']} for e in edges_data],
    directed=False
)

print("Detecting topic clusters (communities)...")
communities = graph.community_multilevel()
print(f"Found {len(communities)} distinct communities.")

print("Formatting final data for the frontend...")
final_elements = []

# Add nodes with their cluster_id
for node_id in tqdm(top_node_ids, desc="Formatting Nodes"):
    node_data = node_map[node_id]
    try:
        # Find the node in the igraph object to get its membership index
        vertex = graph.vs.find(name=node_id)
        cluster_id = communities.membership[vertex.index]
    except (ValueError, IndexError):
        # Assign a default cluster if node not found (should be rare)
        cluster_id = -1
        
    final_elements.append({
        'data': {
            'id': node_id,
            'label': node_data['label'],
            'size': node_data['size'],
            'url': node_data['url'],
            'cluster_id': cluster_id  # This is the key piece of info for the frontend
        }
    })

# Add edges
for edge in tqdm(edges_data, desc="Formatting Edges"):
    final_elements.append({'data': {'source': edge['source'], 'target': edge['target']}})

with open(OVERVIEW_FILE, 'w') as f:
    json.dump(final_elements, f)

print(f"Done. The overview file '{OVERVIEW_FILE}' is ready for the frontend to render.")
