# app.py (The Final, Corrected Version)
import sqlite3
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
DATABASE = 'wikipedia.db'

def get_db():
    conn = sqlite3.connect(DATABASE); conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/overview-graph')
def get_overview_graph():
    return send_from_directory('.', 'overview.json')

@app.route('/api/search')
def search_nodes():
    query = request.args.get('q', '').strip()
    if not query or len(query) < 3:
        return jsonify([])

    conn = get_db()

    # Improved query with ranked priority
    nodes = conn.execute("""
        SELECT id, label
        FROM nodes
        WHERE LOWER(label) LIKE LOWER(?)
        ORDER BY
            CASE
                WHEN LOWER(label) = LOWER(?) THEN 1       -- Exact match
                WHEN LOWER(label) LIKE LOWER(?) THEN 2    -- Prefix match
                ELSE 3                                     -- Substring match
            END,
            LENGTH(label) -- Prefer shorter titles
        LIMIT 10
    """, (f'%{query}%', query, f'{query}%')).fetchall()

    conn.close()
    return jsonify([
        {'value': node['id'], 'label': node['label']}
        for node in nodes
    ])

@app.route('/api/graph/<string:node_id>')
def get_graph_data(node_id):
    conn = get_db()
    neighbors = conn.execute('SELECT DISTINCT target AS id FROM edges WHERE source = ? UNION SELECT DISTINCT source AS id FROM edges WHERE target = ?', (node_id, node_id)).fetchall()
    node_ids = {row['id'] for row in neighbors}; node_ids.add(node_id)
    placeholders = ', '.join('?' for _ in node_ids)
    nodes_data = conn.execute(f'SELECT * FROM nodes WHERE id IN ({placeholders})', list(node_ids)).fetchall()
    edges_data = conn.execute(f'SELECT * FROM edges WHERE source IN ({placeholders}) AND target IN ({placeholders})', list(node_ids) * 2).fetchall()
    conn.close()
    elements = []
    for n in nodes_data:
        # THE FIX: Correctly access the data using dictionary-style keys
        elements.append({'data': {'id': n['id'], 'label': n['label'], 'size': n['size'], 'url': n['url']}})
    for e in edges_data:
        elements.append({'data': {'source': e['source'], 'target': e['target']}})
    return jsonify(elements)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
