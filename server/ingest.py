import sqlite3
import ijson
from tqdm import tqdm

JSON_FILE = 'elements.json'
DB_FILE = 'wikipedia.db'

# Connect to SQLite database
conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

print("Creating database tables...")
cursor.execute('CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, label TEXT, size REAL, url TEXT)')
cursor.execute('CREATE TABLE IF NOT EXISTS edges (source TEXT, target TEXT, PRIMARY KEY (source, target))')
conn.commit()

# Open JSON file and stream parse
print(f"Streaming data from {JSON_FILE}...")
nodes_to_insert = []
edges_to_insert = []

with open(JSON_FILE, 'r') as json_file:
    elements_stream = ijson.items(json_file, 'item')
    # Use tqdm to show progress; total(None) lets it adapt
    for el in tqdm(elements_stream, desc="Processing Elements", unit="elements"):
        data = el.get('data', {})
        if 'source' in data:  # It's an edge
            edges_to_insert.append((data['source'], data['target']))
        elif 'id' in data:  # It's a node
            # Ensure size is a float (convert Decimal if necessary)
            raw_size = data.get('size', 10)
            try:
                size_val = float(raw_size)
            except (TypeError, ValueError):
                size_val = 10.0
            nodes_to_insert.append((
                data['id'],
                data.get('label', ''),
                size_val,
                data.get('url', '')
            ))

# Bulk insert into database
print(f"Inserting {len(nodes_to_insert)} nodes...")
cursor.executemany(
    'INSERT OR IGNORE INTO nodes (id, label, size, url) VALUES (?, ?, ?, ?)',
    nodes_to_insert
)

print(f"Inserting {len(edges_to_insert)} edges...")
cursor.executemany(
    'INSERT OR IGNORE INTO edges (source, target) VALUES (?, ?)',
    edges_to_insert
)

# Create indexes
print("Creating indexes for faster queries...")
cursor.execute('CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes (label)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_edges_source ON edges (source)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_edges_target ON edges (target)')

conn.commit()
conn.close()

print(f"\nDatabase ingestion complete! Data is now in {DB_FILE}")
